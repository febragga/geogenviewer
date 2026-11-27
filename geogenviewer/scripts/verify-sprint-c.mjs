import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { makeBenchmarkFixture } from "./revision-benchmark-fixture.mjs";

const app = fileURLToPath(new URL("../", import.meta.url));
const baseline = process.env.GEOGEN_SPRINT_C_BASELINE === "1";
const software = process.env.GEOGEN_SPRINT_C_HARDWARE !== "1";
const output = join(app, "test-results", baseline ? "sprint-c-baseline" : software ? "sprint-c" : "sprint-c-hardware");
await mkdir(output, { recursive: true });
const port = process.env.GEOGEN_SPRINT_C_PORT ?? "3296";
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port],
  { cwd: app, stdio: "inherit" });
const modes = ["shaded", "material", "technical", "mono", "blueprint", "dither", "clayStudio"];
const report = { environment: {}, profiles: [], exports: {}, theme: {}, resources: [], errors: [], warnings: [], external: [] };
const button = (root, name) => root.getByRole("button", { name, exact: true });
const choice = (root, name) => root.getByRole("combobox", { name, exact: true });
const canvas = (page) => page.locator(".gg-viewport canvas:not(.gg-v08-overlay)");
const menu = (page) => page.getByRole("dialog", { name: "Apresentação", exact: true });
let browser;

async function open(page) {
  await button(page, "Exibição").click();
  await menu(page).waitFor();
  return menu(page);
}
async function close(page) {
  await page.keyboard.press("Escape");
  await menu(page).waitFor({ state: "hidden" });
}
async function settings(page, mode, quality) {
  const popup = await open(page);
  await choice(popup, "Exibição").selectOption(mode);
  if (quality) await choice(popup, "Qualidade gráfica").selectOption(quality);
  await close(page);
}
async function settle(page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}
async function reset(page) {
  await button(page, "Redefinir câmera").click();
  await settle(page);
}

async function orbit(page) {
  const box = await canvas(page).boundingBox();
  assert.ok(box);
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  await page.evaluate(() => {
    window.ggIntervals = [];
    let last = null;
    window.ggWatchFrame = () => {
      const now = performance.now();
      if (last !== null) window.ggIntervals.push(now - last);
      last = now;
    };
    document.addEventListener("geogen-camera-frame", window.ggWatchFrame);
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x + i * 5, y + i * 2);
    await settle(page);
  }
  await page.mouse.up();
  const values = await page.evaluate(() => {
    document.removeEventListener("geogen-camera-frame", window.ggWatchFrame);
    return window.ggIntervals.sort((a, b) => a - b);
  });
  const mean = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  const quantile = (q) => values.length ? Number(values[Math.ceil(q * values.length) - 1].toFixed(1)) : null;
  return { samples: values.length, p50Ms: quantile(0.5), p95Ms: quantile(0.95),
    fpsFromIntervals: mean ? Number((1000 / mean).toFixed(1)) : null };
}

function installInstrumentation() {
  const state = { live: {}, created: {}, linked: 0, frames: 0 };
  const prototype = WebGL2RenderingContext.prototype;
  for (const kind of ["Texture", "Framebuffer", "Renderbuffer", "Buffer", "Program"]) {
    const objects = new WeakSet();
    state.live[kind] = state.created[kind] = 0;
    const create = prototype["create" + kind], remove = prototype["delete" + kind];
    prototype["create" + kind] = function (...args) {
      const value = create.apply(this, args);
      if (value) { objects.add(value); state.live[kind]++; state.created[kind]++; }
      return value;
    };
    prototype["delete" + kind] = function (value) {
      if (value && objects.delete(value)) state.live[kind]--;
      return remove.call(this, value);
    };
  }
  const link = prototype.linkProgram;
  prototype.linkProgram = function (...args) { state.linked++; return link.apply(this, args); };
  document.addEventListener("geogen-camera-frame", () => { state.frames++; });
  window.ggCaptureDiagnostics = () => structuredClone(state);
}

async function sample(page, model, mode, quality) {
  await settings(page, mode, quality);
  await reset(page);
  const popup = await open(page);
  await popup.getByRole("checkbox", { name: "Diagnóstico", exact: true }).check();
  await popup.locator(".gg-v05-stats dd").nth(1).filter({ hasText: /[1-9]/ }).waitFor();
  const labels = await popup.locator(".gg-v05-stats dt").allTextContents();
  const values = await popup.locator(".gg-v05-stats dd").allTextContents();
  await close(page);
  const frame = await orbit(page);
  const beforeIdle = await page.evaluate(() => window.ggCaptureDiagnostics());
  await new Promise((done) => setTimeout(done, 280));
  const afterIdle = await page.evaluate(() => window.ggCaptureDiagnostics());
  report.profiles.push({ model, mode, quality, frame, idleFrames280ms: afterIdle.frames - beforeIdle.frames,
    stats: Object.fromEntries(labels.map((key, i) => [key, values[i]])), liveWebGl: afterIdle.live });
}

async function png(page, key, width, transparent) {
  const popup = await open(page);
  await choice(popup, "Largura do PNG").selectOption(String(width));
  await popup.getByRole("checkbox", { name: "Fundo transparente", exact: true }).setChecked(transparent);
  const [download] = await Promise.all([page.waitForEvent("download"), button(popup, "Exportar PNG").click()]);
  const bytes = await readFile(await download.path());
  await close(page);
  assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  const pixels = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + base64)).blob());
    const { width, height } = bitmap;
    const image = new OffscreenCanvas(width, height);
    const ctx = image.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, width, height);
    const background = data.slice(0, 4);
    const frequency = new Map();
    let clear = 0, partial = 0, changed = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) clear++;
      else if (data[i + 3] < 255) partial++;
      if (data[i + 3] !== background[3] || Math.abs(data[i] - background[0]) + Math.abs(data[i + 1] - background[1])
          + Math.abs(data[i + 2] - background[2]) > 12) changed++;
      if (data[i + 3] === 255 && i % 12 === 0) {
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        frequency.set(key, (frequency.get(key) ?? 0) + 1);
      }
    }
    const colors = [...frequency].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key]) => key.toString(16).padStart(6, "0"));
    return { width, height, clear, partial, changed, colors };
  }, bytes.toString("base64"));
  assert.ok(pixels.width <= width && pixels.changed > 1000, key + " precisa conter a geometria");
  if (transparent) assert.ok(pixels.clear > pixels.width && pixels.clear < pixels.width * pixels.height, key + " precisa conter transparência");
  else assert.equal(pixels.clear + pixels.partial, 0);
  await writeFile(join(output, key + ".png"), bytes);
  report.exports[key] = { ...pixels, bytes: bytes.length };
  return bytes;
}

try {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Servidor encerrou");
    if (await fetch(origin).then((response) => response.ok).catch(() => false)) break;
    if (i === 59) throw new Error("Servidor Next indisponível");
    await new Promise((done) => setTimeout(done, 250));
  }
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    args: software ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: "light",
    reducedMotion: "reduce", acceptDownloads: true });
  await context.addInitScript(installInstrumentation);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
    if (message.type() === "warning" && /shader|framebuffer|webgl/i.test(message.text())) report.warnings.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + "/")) report.external.push(request.url());
  });
  await page.goto(origin + "/viewer?demo=pavilhao");
  await canvas(page).waitFor();
  report.environment = { browser: browser.version(), software, ...await canvas(page).evaluate((node) => {
    const gl = node.getContext("webgl2");
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return { devicePixelRatio, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null };
  }) };

  for (const mode of modes) await sample(page, "18", mode, "balanced");
  await sample(page, "18", "clayStudio", "high");
  await sample(page, "18", "clayStudio", "performance");

  await settings(page, "mono", "balanced");
  await reset(page);
  await png(page, "mono-1280", 1280, true);
  if (!baseline) assert.ok(report.exports["mono-1280"].colors.includes("151515"));
  await page.screenshot({ path: join(output, "mono-viewport.png") });
  const mono = await open(page);
  await mono.getByRole("checkbox", { name: /Inverter/ }).check();
  await close(page);
  const inverted = await png(page, "mono-invertido-1920", 1920, false);
  const restored = await open(page);
  await restored.getByRole("checkbox", { name: /Inverter/ }).uncheck();
  await close(page);
  const afterInvert = await png(page, "mono-normal-1920", 1920, false);
  assert.ok(!inverted.equals(afterInvert));

  const appRoot = page.locator(".gg-app");
  const previousTheme = await appRoot.evaluate((node) => getComputedStyle(node).getPropertyValue("--gg-bg-panel").trim());
  await settings(page, "blueprint", "balanced");
  await reset(page);
  const blueprint = await open(page);
  assert.equal(await appRoot.getAttribute("data-graphics-theme"), "blueprint");
  const blueprintTheme = await appRoot.evaluate((node) => getComputedStyle(node).getPropertyValue("--gg-bg-panel").trim());
  const theme = blueprint.getByRole("checkbox", { name: "Aplicar tema Blueprint na interface", exact: true });
  await theme.uncheck();
  assert.equal(await appRoot.getAttribute("data-graphics-theme"), null);
  await theme.check();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const nativeColorScheme = await blueprint.evaluate((node) => getComputedStyle(node).colorScheme);
  report.theme = { previousTheme, blueprintTheme, nativeColorScheme, axe: axe.violations.map(({ id }) => id) };
  if (!baseline) assert.equal(nativeColorScheme, "dark");
  assert.deepEqual(report.theme.axe, []);
  await close(page);
  await png(page, "blueprint-1920", 1920, false);
  await page.screenshot({ path: join(output, "blueprint-viewport.png") });

  await settings(page, "dither", "performance");
  assert.equal(await appRoot.evaluate((node) => getComputedStyle(node).getPropertyValue("--gg-bg-panel").trim()), previousTheme);
  await reset(page);
  const firstDither = await png(page, "dither-4-1280", 1280, true);
  const secondDither = await png(page, "dither-4-repetido-1280", 1280, true);
  assert.ok(firstDither.equals(secondDither), "Dither deve ser idêntico para a mesma pose");
  const dither = await open(page);
  await button(dither, "Bayer 8×8").click();
  await close(page);
  const thirdDither = await png(page, "dither-8-1280", 1280, true);
  assert.ok(!firstDither.equals(thirdDither));
  await png(page, "dither-3840", 3840, false);
  await page.screenshot({ path: join(output, "dither-viewport.png") });

  await settings(page, "clayStudio", "balanced");
  const clay = await open(page);
  await clay.getByRole("checkbox", { name: "Plano de chão", exact: true }).check();
  await clay.getByRole("checkbox", { name: "Sombras", exact: true }).check();
  await close(page);
  await reset(page);
  await png(page, "clay-perspectiva-1920", 1920, false);
  await page.screenshot({ path: join(output, "clay-viewport.png") });
  await button(page, "Vistas").click();
  const views = page.getByRole("dialog", { name: "Vistas", exact: true });
  await choice(views, "Projeção").selectOption("orthographic");
  await page.keyboard.press("Escape");
  await views.waitFor({ state: "hidden" });
  await settle(page);
  await png(page, "clay-ortografica-1280", 1280, true);
  await settings(page, "clayStudio", "performance");
  const clayLow = await open(page);
  const exposure = clayLow.getByRole("slider", { name: /^Exposição/ });
  await exposure.press("Home");
  await close(page);
  const dark = await png(page, "clay-performance-exposicao-baixa", 1280, true);
  const clayHigh = await open(page);
  await clayHigh.getByRole("slider", { name: /^Exposição/ }).press("End");
  await close(page);
  const bright = await png(page, "clay-performance-exposicao-alta", 1280, true);
  report.exports.clayExposureAffectsCapture = !dark.equals(bright);
  if (!baseline) assert.equal(report.exports.clayExposureAffectsCapture, true);

  const clayReset = await open(page);
  await clayReset.getByRole("checkbox", { name: "Plano de chão", exact: true }).uncheck();
  await clayReset.getByRole("checkbox", { name: "Sombras", exact: true }).uncheck();
  await close(page);
  await settings(page, "shaded", "balanced");
  await settle(page);
  report.resources.push(await page.evaluate(() => window.ggCaptureDiagnostics()));
  for (let i = 0; i < 3; i++) {
    for (const mode of ["mono", "blueprint", "dither", "clayStudio", "shaded"]) await settings(page, mode, "balanced");
    await settle(page);
    report.resources.push(await page.evaluate(() => window.ggCaptureDiagnostics()));
  }
  if (!baseline) {
    for (const kind of ["Framebuffer", "Renderbuffer", "Texture", "Program"]) {
      assert.equal(report.resources.at(-1).live[kind], report.resources.at(-2).live[kind], kind + " cresce durante trocas de modo");
    }
  }

  const fixture = makeBenchmarkFixture(1000, false);
  await page.locator('input[aria-label="Abrir GLB / Manifesto"]').setInputFiles([
    { name: "model.glb", mimeType: "model/gltf-binary", buffer: fixture.glb },
    { name: "manifest.json", mimeType: "application/json", buffer: fixture.manifest },
  ]);
  await page.locator(".gg-tree-row").filter({ hasText: "bench-0" }).first().waitFor();
  await canvas(page).waitFor();
  for (const mode of ["shaded", "mono", "blueprint", "dither", "clayStudio"]) await sample(page, "1000", mode, "performance");

  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
} finally {
  await browser?.close();
  server.kill();
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ environment: report.environment, profiles: report.profiles.length, exports: Object.keys(report.exports),
    resources: report.resources.map(({ live }) => live), errors: report.errors, warnings: report.warnings.length, external: report.external }));
}
