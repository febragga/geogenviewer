import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { OrthographicCamera, Vector3 } from "three";

const app = fileURLToPath(new URL("../", import.meta.url));
const out = join(app, "test-results", "v06");
const demos = join(app, "public", "demos");
await mkdir(out, { recursive: true });
const origin = "http://127.0.0.1:" + (process.env.GEOGEN_V06_PORT ?? "3206");
const server = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", new URL(origin).port],
  { cwd: app, stdio: "inherit" });
const problems = [];
const a11y = {};
const dimensions = [];
const graphics = {};
const captureTimes = [];
const fixture = JSON.parse(await readFile(join(demos, "inspection-lab.manifest.json"), "utf8"));
let browser;

async function inspect(page, name) {
  const button = page.getByRole("button", { name: "Inspeção espacial", exact: true });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  const panel = page.locator(".gg-v05-popover").filter({ hasText: "Inspeção espacial" });
  if (name) await panel.getByRole("button", { name, exact: true }).click();
  return panel;
}

async function open(page, demo = "inspecao") {
  await page.goto(origin + "/viewer?demo=" + demo, { waitUntil: "networkidle" });
  await page.locator(".gg-viewport canvas").waitFor();
  await page.getByRole("button", { name: "Inspeção espacial", exact: true }).waitFor();
}

async function close(page) {
  const trigger = page.locator(".gg-v05-tools button[aria-expanded=true]").first();
  if (await trigger.count()) await trigger.click();
}

async function prepare(context) {
  await context.addInitScript(() => {
    document.addEventListener("geogen-camera-frame", (event) => {
      const data = document.documentElement.dataset;
      data.cameraPose = JSON.stringify(event.detail.pose);
      if (data.captureGpu !== "true") return;
      const gl = event.target.getContext("webgl2");
      if (!gl) return;
      const w = Math.floor(gl.drawingBufferWidth / 2);
      const h = Math.floor(gl.drawingBufferHeight / 2);
      const buffer = new Uint8Array(w * h * 4);
      const hashes = [[0,h],[w,h],[0,0],[w,0]].map(([x,y]) => {
        gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
        let hash = 2166136261;
        for (const byte of buffer) hash = Math.imul(hash ^ byte, 16777619);
        return hash >>> 0;
      });
      data.gpuHashes = JSON.stringify(hashes);
      data.captureGpu = "false";
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8500);
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text()); });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(request.url() + " " + request.failure()?.errorText);
  });
  page.on("request", (request) => { if (!request.url().startsWith(origin) && !/^(data|blob):/.test(request.url())) problems.push(request.url()); });
  return page;
}

async function screenshot(page, name) {
  await page.screenshot({ path: join(out, name + ".png") });
}

async function audit(page, name) {
  const result = await new AxeBuilder({ page }).analyze();
  a11y[name] = result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((item) => item.target) }));
}

async function layout(page, kind) {
  await close(page);
  const button = page.getByRole("button", { name: "Vistas", exact: true });
  await button.click();
  await page.getByRole("combobox", { name: /Distribuição/ }).selectOption(kind);
  await button.click();
}

async function top(page) {
  await close(page);
  const button = page.getByRole("button", { name: "Vistas", exact: true });
  await button.click();
  await page.getByRole("combobox", { name: /Orientação/ }).selectOption("top");
  await button.click();
  await page.waitForFunction(() => {
    const pose = JSON.parse(document.documentElement.dataset.cameraPose ?? "null");
    return pose?.projection === "orthographic" && pose.up[2] < -0.9;
  });
}

async function point(page, coords, touch = false) {
  const rect = await page.locator(".gg-viewport canvas").boundingBox();
  const pose = JSON.parse(await page.locator("html").getAttribute("data-camera-pose"));
  const vertical = pose.height / 2;
  const horizontal = vertical * rect.width / rect.height;
  const camera = new OrthographicCamera(-horizontal,horizontal,vertical,-vertical,0.00001,500);
  camera.position.fromArray(pose.position);
  camera.up.fromArray(pose.up);
  camera.lookAt(new Vector3(...pose.target));
  camera.updateMatrixWorld();
  const world = new Vector3(...coords).project(camera);
  const x = rect.x + (1 + world.x) * rect.width / 2;
  const y = rect.y + (1 - world.y) * rect.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function stats(page) {
  await close(page);
  const btn = page.getByRole("button", { name: "Exibição", exact: true });
  await btn.click();
  await page.getByLabel("Diagnóstico", { exact: true }).check();
  await page.waitForTimeout(500);
  const text = await page.locator(".gg-v05-stats").innerText();
  await btn.click();
  const data = text.trim().split(/\r?\n/);
  return Object.fromEntries(Array.from({ length: data.length / 2 }, (_, index) => [data[index * 2], data[index * 2 + 1]]));
}

async function metric(page, size) {
  const data = await page.evaluate(() => {
    const canvases = document.querySelectorAll(".gg-viewport canvas");
    const canvas = canvases[0];
    const rect = canvas.getBoundingClientRect();
    const popover = document.querySelector(".gg-v05-popover");
    const popup = popover?.getBoundingClientRect();
    const toolbar = document.querySelector(".gg-toolbar");
    return {
      canvas: [Math.round(rect.width), Math.round(rect.height)], count: canvases.length,
      contextLost: canvas.getContext("webgl2")?.isContextLost() ?? true,
      overflow: document.documentElement.scrollWidth - innerWidth,
      toolbarOverflow: toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 0,
      popupFits: !popup || (popup.left >= -1 && popup.top >= -1 && popup.right <= innerWidth + 1 && popup.bottom <= innerHeight + 1),
    };
  });
  dimensions.push({ size, ...data });
  assert.equal(data.count, 1);
  assert.equal(data.contextLost, false);
  assert.ok(data.canvas[0] > 220 && data.canvas[1] > 200);
  const [width, height] = size.match(/\d+/g).map(Number);
  assert.ok(data.canvas[0] <= width + 1 && data.canvas[1] <= height + 1, JSON.stringify(data));
  assert.ok(data.overflow <= 0 && data.toolbarOverflow <= 1 && data.popupFits, JSON.stringify(data));
}

async function download(page, button, name) {
  const start = performance.now();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button, exact: true }).click()]);
  await file.saveAs(join(out, name));
  return performance.now() - start;
}

async function pixels(page) {
  await page.waitForFunction(() => document.documentElement.dataset.captureGpu === "false");
  return JSON.parse(await page.locator("html").getAttribute("data-gpu-hashes"));
}

async function pixelCheck(page, name) {
  const buffer = await readFile(join(out, name));
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, corner: [...ctx.getImageData(0,0,1,1).data] };
  }, Array.from(buffer));
}

try {
  let ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    try { ready = (await fetch(origin)).ok; } catch { /* Boot */ }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready);
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"] });
  const context = await browser.newContext({ viewport: { width:1440, height:900 }, colorScheme:"dark" });
  const page = await prepare(context);
  await open(page);
  graphics.labSingle = await stats(page);
  await page.evaluate(({ projectId, revisionId }) => {
    const pose = JSON.parse(document.documentElement.dataset.cameraPose);
    const legacy = {
      id: "legacy-v05", name: "Vista salva na V0.5", pose,
      display: { mode:"shaded", background:"theme", grid:false, axes:true, ground:false, edges:false, shadows:false, light:1, opacity:1, quality:"balanced" },
      visibility: { filters:{}, hiddenIds:[], isolatedIds:null },
    };
    localStorage.setItem("geogen:v05:views:" + JSON.stringify([projectId, revisionId]), JSON.stringify([legacy]));
  }, { projectId: fixture.project.id, revisionId: fixture.project.revisionId });
  const legacyButton = page.getByRole("button", { name: "Vistas", exact: true });
  await legacyButton.click();
  await page.getByRole("combobox", { name: /Vistas salvas/ }).selectOption({ label: "Vista salva na V0.5" });
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await legacyButton.click();
  let panel = await inspect(page, "Cortes");
  await panel.getByLabel("Ativar corte Z").check();
  await panel.getByLabel("Posição CAD numérica Z").fill("50");
  await panel.getByLabel("Posição CAD numérica Z").press("Enter");
  await panel.getByRole("combobox", { name: /Representação da seção/ }).selectOption("filled");
  await panel.getByText(/ficaram abertas/).waitFor();
  await screenshot(page, "1440-section-controls");
  await audit(page, "section");
  await metric(page, "1440 × 900");
  await close(page);
  await screenshot(page, "1440-filled-section");
  const gizmo = page.getByRole("button", { name: "Mover corte Z", exact: true });
  const handle = await gizmo.boundingBox();
  assert.ok(handle);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 22, { steps:4 });
  await page.mouse.up();
  panel = await inspect(page, "Cortes");
  assert.ok(Math.abs(Number(await panel.getByLabel("Posição CAD numérica Z").inputValue()) - 50) > 0.01);
  await panel.getByLabel("Posição CAD numérica Z").fill("50");
  await panel.getByLabel("Posição CAD numérica Z").press("Enter");
  await close(page);
  graphics.labFilled = await stats(page);

  await layout(page, "quad");
  panel = await inspect(page, "Cortes");
  await panel.getByLabel("Compartilhar cortes entre vistas").uncheck();
  await close(page);
  await page.evaluate(() => { document.documentElement.dataset.captureGpu = "true"; });
  await page.getByRole("button", { name:"Vista 2", exact:true }).click();
  const allCut = await pixels(page);
  panel = await inspect(page, "Cortes");
  await panel.getByLabel("Ativar corte Z").evaluate((input) => {
    document.documentElement.dataset.captureGpu = "true";
    if (input.checked) input.click();
  });
  const oneUncut = await pixels(page);
  assert.notEqual(oneUncut[1], allCut[1], "The second region must reflect its own clip configuration");
  for (const index of [0,2,3]) assert.equal(oneUncut[index], allCut[index], "Other regions retain their clipping");
  await close(page);
  await page.getByRole("button", { name:"Vista 1", exact:true }).click();
  panel = await inspect(page, "Cortes");
  assert.equal(await panel.getByLabel("Ativar corte Z").isChecked(), true);
  await close(page);
  await screenshot(page, "1440-quad-independent");
  graphics.labQuad = await stats(page);

  await layout(page, "single");
  panel = await inspect(page, "Cortes");
  await panel.getByRole("button", { name:"Restaurar todos os cortes", exact:true }).click();
  await close(page);
  await top(page);
  await inspect(page, "Medir");
  await close(page);
  await point(page, [-0.369,0.1,0.131]);
  await page.locator(".gg-inspection-hint").getByText("Confirme o segundo ponto.").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".gg-inspection-hint").getByText("Toque ou clique no primeiro ponto.").waitFor();
  await point(page, [-0.369,0.1,0.131]);
  await point(page, [-0.271,0.1,0.131]);
  await page.locator(".gg-inspection-overlay").getByText(/100 mm · original/).waitFor();
  await screenshot(page, "1440-measurement");
  panel = await inspect(page, "Medir");
  await panel.locator(".gg-inspection-record summary").first().click();
  await panel.getByText(/Proveniência · Malha/).waitFor();
  await audit(page, "measurement");
  await close(page);

  panel = await inspect(page, "Cortes");
  await panel.getByLabel("Ativar corte Z").check();
  await panel.getByLabel("Posição CAD numérica Z").fill("51");
  await panel.getByLabel("Posição CAD numérica Z").press("Enter");
  await panel.getByRole("combobox", { name: /Representação da seção/ }).selectOption("technical");
  await close(page);
  const views = page.getByRole("button", { name:"Vistas", exact:true });
  await views.click();
  await page.getByLabel("Nome", { exact: true }).fill("Planta técnica de inspeção");
  await page.getByRole("button", { name:"Salvar", exact:true }).click();
  await views.click();

  panel = await inspect(page, "Captura");
  await panel.getByRole("combobox", { name:/Largura da captura/ }).selectOption("1280");
  await panel.getByLabel("Incluir identificadores").check();
  await audit(page, "capture");
  captureTimes.push(await download(page, "Baixar PNG técnico", "technical-white.png"));
  let image = await pixelCheck(page, "technical-white.png");
  assert.equal(image.width, 1280);
  assert.deepEqual(image.corner, [255,255,255,255]);
  await panel.getByLabel("Incluir medições").uncheck();
  await download(page, "Baixar PNG técnico", "technical-without-measurements.png");
  assert.notDeepEqual(await readFile(join(out, "technical-white.png")), await readFile(join(out, "technical-without-measurements.png")));
  await panel.getByLabel("Incluir medições").check();
  await panel.getByRole("combobox", { name:/Fundo da captura/ }).selectOption("transparent");
  captureTimes.push(await download(page, "Baixar PNG técnico", "technical-transparent.png"));
  image = await pixelCheck(page, "technical-transparent.png");
  assert.equal(image.corner[3], 0);
  await download(page, "Baixar metadados da última captura", "technical-snapshot.json");
  const snapshot = JSON.parse(await readFile(join(out, "technical-snapshot.json"), "utf8"));
  assert.equal(snapshot.snapshot.viewName, "Planta técnica de inspeção");
  assert.equal(snapshot.capture.background, "transparent");
  await download(page, "Baixar JSON de inspeção", "inspection-export.json");
  const exported = JSON.parse(await readFile(join(out, "inspection-export.json"), "utf8"));
  assert.equal(exported.model.sha256, fixture.geometry.sha256);
  assert.equal(exported.sections.views[0].planes[2].enabled, true);
  assert.equal(exported.measurements[0].valueM.toFixed(5), "0.10000");
  assert.equal(exported.snapshot.projection, "orthographic");
  assert.equal(exported.measurements[0].provenance, "mesh");
  const input = panel.locator('input[type=file]');
  await input.setInputFiles({ name:"invalid.json", mimeType:"application/json", buffer:Buffer.from("{") });
  await panel.getByRole("alert").waitFor();
  const another = { ...exported, model:{ ...exported.model, revisionId:"lab-r2" } };
  await input.setInputFiles({ name:"wrong-revision.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(another)) });
  await panel.getByText(/outro modelo ou revisão/).waitFor();
  await input.setInputFiles(join(demos,"inspection-lab.inspection.json"));
  await panel.getByText("Inspeção importada.", { exact:true }).waitFor();
  await close(page);
  await views.click();
  await page.getByRole("combobox", { name:/Vistas salvas/ }).selectOption({ label:"Planta técnica de inspeção" });
  await page.getByRole("button", { name:"Aplicar", exact:true }).click();
  await views.click();
  panel = await inspect(page, "Cortes");
  assert.equal(await panel.getByLabel("Ativar corte Z").isChecked(), true);
  await close(page);

  await page.getByRole("combobox", { name:/Workspace/ }).selectOption("explode");
  await page.getByRole("button", { name:"Média", exact:true }).click();
  await screenshot(page, "1440-exploded-cut");
  await page.getByRole("combobox", { name:/Workspace/ }).selectOption("assembly");
  await page.getByRole("slider", { name:"Tempo da montagem" }).fill("1.5");
  await screenshot(page, "1440-assembly-cut");
  await page.getByRole("combobox", { name:/Workspace/ }).selectOption("inspect");
  for (const [width,height] of [[1920,1080],[1280,800]]) {
    await page.setViewportSize({ width,height });
    await page.waitForFunction(({ width, height }) => {
      const rect = document.querySelector(".gg-viewport canvas")?.getBoundingClientRect();
      return rect && rect.width <= width && rect.width >= width - 570 && rect.height > height - 65 && rect.height <= height;
    }, { width, height });
    await metric(page, width + " × " + height);
    await screenshot(page, width + "-inspection");
  }
  await open(page, "pavilhao");
  graphics.pavilionSingle = await stats(page);
  await layout(page, "quad");
  graphics.pavilionQuad = await stats(page);
  assert.equal(graphics.pavilionSingle["Draw calls"], "24");
  assert.equal(graphics.pavilionQuad["Draw calls"], "96");
  panel = await inspect(page, "Cortes");
  assert.equal(await panel.getByLabel("Ativar corte Z").isChecked(), false);
  await context.close();

  const portable = await browser.newContext({ viewport:{width:1024,height:768}, isMobile:true, hasTouch:true, colorScheme:"light" });
  const tablet = await prepare(portable);
  await open(tablet);
  for (const [width,height] of [[1024,768],[768,1024],[390,844]]) {
    await tablet.setViewportSize({ width,height });
    await inspect(tablet, "Cortes");
    await metric(tablet, width + " × " + height + " touch");
    await screenshot(tablet, width + "-touch-section");
    await close(tablet);
  }
  await top(tablet);
  await inspect(tablet, "Medir");
  await close(tablet);
  await point(tablet, [-0.369,0.1,0.131], true);
  await point(tablet, [-0.271,0.1,0.131], true);
  await tablet.locator(".gg-inspection-overlay").getByText(/100 mm · original/).waitFor();
  await screenshot(tablet, "390-touch-measurement");
  await portable.close();
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.values(a11y).flat(), []);
} finally {
  const report = { dimensions, graphics, captureTimesMs: captureTimes.map(Math.round), accessibility: a11y, problems };
  await writeFile(join(out, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await browser?.close();
  server.kill();
}
