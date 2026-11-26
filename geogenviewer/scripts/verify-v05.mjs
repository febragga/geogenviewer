import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const app = fileURLToPath(new URL("../", import.meta.url));
const output = join(app, "test-results", "v05");
await mkdir(output, { recursive: true });
const origin = `http://127.0.0.1:${process.env.GEOGEN_V05_PORT ?? 3205}`;
const demo = origin + "/viewer?demo=pavilhao";
const server = spawn(process.execPath, [
  join(app, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", new URL(origin).port,
], { cwd: app, stdio: "inherit" });
const issues = [];
const accessibility = {};
const sizes = [];
const measurements = {};
let browser;

function watch(page) {
  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") issues.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith(origin) && !/^(data|blob):/.test(request.url())) issues.push(request.url()); });
  page.on("requestfailed", (request) => issues.push(request.url() + " " + request.failure()?.errorText));
}

async function open(page) {
  await page.goto(demo, { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Vistas", exact: true }).waitFor();
}

async function capture(page, name) {
  await page.screenshot({ path: join(output, name + ".png") });
}

async function audit(page, name) {
  const result = await new AxeBuilder({ page }).analyze();
  accessibility[name] = result.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }));
}

async function metrics(page, size) {
  const result = await page.evaluate(() => {
    const canvases = document.querySelectorAll(".gg-viewport canvas");
    const canvas = canvases[0];
    const gl = canvas?.getContext("webgl2");
    const rect = canvas?.getBoundingClientRect();
    const elements = document.querySelectorAll(".gg-topbar__actions button, .gg-v05-tools button, .gg-view-cube");
    const clipped = Array.from(elements, (element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width && (rect.x < -1 || rect.right > innerWidth + 1 || rect.top < 0 || rect.bottom > innerHeight + 1))
      .map(({ element }) => element.getAttribute("aria-label") || element.textContent);
    const toolbar = document.querySelector(".gg-toolbar");
    const toolbarOverflow = toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 0;
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      canvas: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
      count: canvases.length, contextLost: !gl || gl.isContextLost(), clipped, toolbarOverflow,
      overflow: document.documentElement.scrollWidth - innerWidth,
      gpu: debug && gl ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    };
  });
  sizes.push({ size, ...result });
  assert.equal(result.count, 1, size + " must render one canvas");
  assert.equal(result.contextLost, false, size + " context");
  assert.deepEqual(result.clipped, [], size + " visible controls must fit");
  assert.ok(result.canvas[0] > 200 && result.canvas[1] > 200);
  assert.ok(result.overflow <= 0, size + " page overflow");
  assert.ok(result.toolbarOverflow <= 1, size + " toolbar overflow " + result.toolbarOverflow);
}

async function touchNavigation(context, page) {
  const session = await context.newCDPSession(page);
  const pointer = page.locator(".gg-viewport canvas");
  const box = await pointer.boundingBox();
  const x = Math.round(box.x + box.width * 0.5);
  const y = Math.round(box.y + box.height * 0.5);
  await page.evaluate(() => {
    document.addEventListener("geogen-camera-frame", (event) => {
      document.body.dataset.cameraCheck = JSON.stringify(event.detail.pose);
    });
  });
  const pose = async () => JSON.parse(await page.locator("body").getAttribute("data-camera-check"));
  const send = (type, touchPoints) => session.send("Input.dispatchTouchEvent", { type, touchPoints });
  const point = (id, dx, dy) => ({ id, x: x + dx, y: y + dy });
  await page.getByRole("button", { name: "Redefinir câmera", exact: true }).tap();
  await page.waitForFunction(() => document.body.dataset.cameraCheck);
  const initial = await pose();
  await page.touchscreen.tap(x, Math.round(box.y + box.height * 0.47));
  await page.locator(".gg-tool-btn[aria-label=Ocultar]:enabled").waitFor({ state: "attached" });
  await send("touchStart", [point(0, 0, 0)]);
  await send("touchMove", [point(0, 45, 23)]);
  await send("touchEnd", []);
  await page.waitForFunction((position) => JSON.parse(document.body.dataset.cameraCheck).position.some((value, index) => Math.abs(value - position[index]) > 1e-5), initial.position);
  const orbited = await pose();
  await send("touchStart", [point(0, -30, 0), point(1, 30, 0)]);
  await send("touchMove", [point(0, -64, 28), point(1, 70, 28)]);
  await send("touchEnd", []);
  await page.waitForFunction((previous) => {
    const current = JSON.parse(document.body.dataset.cameraCheck);
    return current.height < previous.height && current.target.some((value, index) => Math.abs(value - previous.target[index]) > 1e-5);
  }, orbited);
  await session.detach();
}

async function displayStats(page) {
  await page.getByRole("button", { name: "Exibição", exact: true }).click();
  await page.getByLabel("Diagnóstico", { exact: true }).check();
  const data = await page.locator(".gg-v05-stats").innerText();
  await page.getByRole("button", { name: "Exibição", exact: true }).click();
  return data.trim().split(/\r?\n/);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt++) {
    try { ready = (await fetch(origin)).ok; } catch { /* Startup */ }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "production server did not start");
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  watch(page);
  await open(page);
  await capture(page, "1440-explore");
  await metrics(page, "1440 × 900");
  measurements.single = await displayStats(page);

  const toggleViews = () => page.getByRole("button", { name: "Vistas", exact: true }).click();
  await toggleViews();
  await page.getByLabel("Distribuição").selectOption("horizontal");
  assert.equal(await page.locator(".gg-view-region").count(), 2);
  await page.getByLabel("Distribuição").selectOption("vertical");
  assert.equal(await page.locator(".gg-view-region").count(), 2);
  await page.getByLabel("Distribuição").selectOption("quad");
  await page.getByLabel("Sincronizar alvo").check();
  await page.getByLabel("Sincronizar zoom ortográfico").check();
  await toggleViews();
  assert.equal(await page.locator(".gg-view-region").count(), 4);
  await capture(page, "1440-quad");
  await audit(page, "quad");
  measurements.quad = await displayStats(page);

  const component = page.locator(".gg-tree-select-btn", { hasText: "Viga Composta Central" });
  await component.click();
  await page.getByRole("button", { name: "Vista 2", exact: true }).click();
  assert.equal(await component.locator("xpath=..").getAttribute("aria-selected"), "true");
  await toggleViews();
  await page.getByLabel("Seleção compartilhada").uncheck();
  await page.getByLabel("Visibilidade compartilhada").uncheck();
  await toggleViews();
  await page.keyboard.press("h");
  await page.getByRole("button", { name: "Vista 3", exact: true }).click();
  assert.equal(await component.locator("xpath=..").getAttribute("aria-selected"), "true");
  assert.equal(await component.locator("xpath=..").evaluate((node) => node.classList.contains("gg-tree-row--hidden")), false);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vista 2", exact: true }).click();
  assert.equal(await component.locator("xpath=..").getAttribute("aria-selected"), "true");
  assert.equal(await component.locator("xpath=..").evaluate((node) => node.classList.contains("gg-tree-row--hidden")), true);

  await toggleViews();
  await page.getByLabel("Visibilidade compartilhada").check();
  await page.getByRole("button", { name: "Maximizar vista", exact: true }).click();
  assert.equal(await page.locator(".gg-view-region").count(), 1);
  await page.locator(".gg-v05-popover").getByRole("combobox", { name: /Projeção/ }).selectOption("perspective");
  await page.locator(".gg-v05-popover").getByRole("combobox", { name: /Projeção/ }).selectOption("orthographic");
  await page.locator(".gg-v05-popover").getByRole("combobox", { name: /Orientação/ }).selectOption("top");
  await page.getByLabel("Nome", { exact: true }).fill("Planta auditada");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("button", { name: "Restaurar layout", exact: true }).click();
  assert.equal(await page.locator(".gg-view-region").count(), 4);

  await open(page);
  await toggleViews();
  await page.getByRole("combobox", { name: /Vistas salvas/ }).selectOption({ label: "Planta auditada" });
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  assert.equal(await page.locator(".gg-projection-indicator").textContent(), "Ortográfica");
  await toggleViews();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.locator(".gg-v05-popover").getByRole("combobox", { name: /Filtros/ }).selectOption("layer");
  await page.getByLabel("Estrutura::Pilares", { exact: true }).check();
  await page.getByLabel("Nome", { exact: true }).fill("Pilares");
  await page.getByRole("button", { name: "Salvar combinação", exact: true }).click();
  await capture(page, "1440-filters");
  await audit(page, "filters");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.keyboard.press("a");
  await page.keyboard.press("r");

  await page.getByRole("button", { name: "Exibição", exact: true }).click();
  await page.locator(".gg-v05-popover").getByRole("combobox", { name: /Exibição/ }).selectOption("technical");
  await page.getByLabel("Grade", { exact: true }).check();
  await page.getByLabel("Fundo transparente").check();
  await page.getByLabel("Largura do PNG").selectOption("1280");
  const [image] = await Promise.all([
    page.waitForEvent("download"), page.getByRole("button", { name: "Exportar PNG", exact: true }).click(),
  ]);
  await image.saveAs(join(output, "viewport-export.png"));
  const png = await readFile(join(output, "viewport-export.png"));
  assert.equal(png.readUInt32BE(16), 1280);
  assert.equal(png[25], 6);
  const alpha = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  }, Array.from(png));
  assert.equal(alpha, 0);
  await page.getByRole("button", { name: "Exibição", exact: true }).click();
  await capture(page, "1440-technical");

  const workspace = page.getByRole("combobox", { name: /Workspace/ });
  await workspace.selectOption("assembly");
  const timeline = page.getByRole("slider", { name: "Tempo da montagem" });
  const progress = page.getByLabel("Progresso temporal");
  await timeline.fill("2.3");
  await capture(page, "1440-assembly");
  await audit(page, "assembly");
  assert.match(await progress.innerText(), /2,3/);
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  const paused = await progress.innerText();
  assert.notEqual(paused, "2,3 / 5,8 s");
  await page.waitForTimeout(190);
  assert.equal(await progress.innerText(), paused);
  await page.getByRole("combobox", { name: /Velocidade/ }).selectOption("4");
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await page.getByText("Concluída", { exact: true }).waitFor();
  assert.match(await progress.innerText(), /5,8 \/ 5,8/);
  await page.getByRole("button", { name: "Parar", exact: true }).click();
  assert.match(await progress.innerText(), /^0,0/);
  await page.getByRole("button", { name: "Próxima etapa", exact: true }).click();
  assert.match(await progress.innerText(), /^0,6/);

  await page.getByRole("button", { name: "Editar sequência", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Editor de montagem" });
  await page.getByRole("button", { name: "Criar etapa", exact: true }).click();
  await editor.getByRole("button", { name: "Aplicar", exact: true }).click();
  await editor.getByRole("alert").waitFor();
  await editor.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("combobox", { name: /^Etapa/ }).selectOption("0");
  await page.getByLabel("Título da etapa").fill("Fundação revisada");
  await capture(page, "1440-editor");
  await audit(page, "editor");
  const [manifestExport] = await Promise.all([
    page.waitForEvent("download"), editor.getByRole("button", { name: "Baixar manifesto JSON" }).click(),
  ]);
  const edited = JSON.parse(await readFile(await manifestExport.path(), "utf8"));
  const source = JSON.parse(await readFile(join(app, "public/demos/pavilhao-explosao.manifest.json"), "utf8"));
  assert.deepEqual(edited.geometry, source.geometry);
  assert.equal(edited.assembly.steps[0].title, "Fundação revisada");
  await editor.getByRole("button", { name: "Mostrar só esta etapa" }).click();
  await page.getByRole("button", { name: "Sair da prévia" }).waitFor();
  await workspace.selectOption("explode");
  await page.locator(".gg-explode-popover").waitFor();
  await page.getByRole("button", { name: "Média", exact: true }).click();
  await workspace.selectOption("assembly");
  assert.equal(await page.locator(".gg-explode-popover").count(), 0);
  await page.locator(".gg-assembly").waitFor();
  await workspace.selectOption("explore");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.keyboard.press("v");
  await capture(page, "1920-quad");
  await metrics(page, "1920 × 1080");
  await page.keyboard.press("j");
  await capture(page, "1920-clean");
  await metrics(page, "1920 × 1080 · modo limpo");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await capture(page, "1280-quad");
  await metrics(page, "1280 × 800");
  await context.close();

  const touch = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, colorScheme: "light" });
  const tablet = await touch.newPage();
  tablet.setDefaultTimeout(9000);
  watch(tablet);
  await open(tablet);
  await tablet.getByRole("combobox", { name: /Workspace/ }).selectOption("assembly");
  await tablet.getByRole("slider", { name: "Tempo da montagem" }).fill("3.9");
  await capture(tablet, "1024-assembly-touch");
  await metrics(tablet, "1024 × 768 · touch");
  await tablet.setViewportSize({ width: 768, height: 1024 });
  await tablet.getByRole("button", { name: "Vistas", exact: true }).tap();
  await tablet.getByLabel("Distribuição").selectOption("quad");
  await tablet.getByRole("button", { name: "Vistas", exact: true }).tap();
  await capture(tablet, "768-quad-touch");
  await metrics(tablet, "768 × 1024 · touch");
  await tablet.setViewportSize({ width: 390, height: 844 });
  await tablet.getByRole("combobox", { name: /Workspace/ }).selectOption("explore");
  await tablet.getByRole("button", { name: "Vistas", exact: true }).tap();
  await tablet.getByLabel("Distribuição").selectOption("single");
  await tablet.getByRole("button", { name: "Vistas", exact: true }).tap();
  await capture(tablet, "390-explore-touch");
  await metrics(tablet, "390 × 844 · touch");
  await touchNavigation(touch, tablet);
  await touch.close();

  assert.deepEqual(issues, []);
  assert.deepEqual(Object.values(accessibility).flat(), []);
} finally {
  await writeFile(join(output, "results.json"), JSON.stringify({ sizes, measurements, issues, accessibility }, null, 2) + "\n");
  console.log(JSON.stringify({ sizes, measurements, issues, accessibility }, null, 2));
  await browser?.close();
  server.kill();
}
