import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { makeBenchmarkFixture } from "./revision-benchmark-fixture.mjs";

const app = fileURLToPath(new URL("../", import.meta.url));
const hardware = process.env.GEOGEN_V091_HARDWARE === "1";
const out = join(app, "test-results", hardware ? "v091-hardware" : "v08");
await mkdir(out, { recursive: true });
const port = process.env.GEOGEN_V08_PORT ?? "3208";
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", port],
  { cwd: app, stdio: "inherit" });
const results = { dimensions: [], accessibility: {}, downloads: [], benchmark: [], problems: [] };
const kit = (page) => page.getByRole("complementary", { name: "Knolling", exact: true });
const catalog = (page) => page.getByRole("complementary", { name: "Catálogo", exact: true });
const workspace = (page, value) => page.getByRole("combobox", { name: "Workspace", exact: true }).selectOption(value);
const view = (page) => page.locator(".gg-viewport canvas:not(.gg-v08-overlay)");
const button = (root, name) => root.getByRole("button", { name, exact: true });
const itemButton = (root, name) => root.getByRole("button", { name: new RegExp("^" + name + "(?:\\s|$)") });
const choice = (root, name) => root.getByRole("combobox", { name, exact: true });
const record = (page) => page.on("pageerror", (reason) => results.problems.push(reason.message));
let browser;

async function ready() {
  for (let i = 0; i < 48; i++) {
    if (await fetch(origin).then((response) => response.ok).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Servidor Next indisponível.");
}

async function instrument(context) {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const encode = HTMLCanvasElement.prototype.toBlob;
    let thumbnailEncodes = 0;
    HTMLCanvasElement.prototype.toBlob = function (...params) {
      if (this.width === 160 && this.height === 160) document.documentElement.dataset.thumbEncodes = String(++thumbnailEncodes);
      return encode.call(this, ...params);
    };
    const active = new Set();
    HTMLCanvasElement.prototype.getContext = function (name, ...params) {
      const value = original.call(this, name, ...params);
      if (name === "webgl2" && value) active.add(value);
      return value;
    };
    document.addEventListener("geogen-camera-frame", (event) => {
      document.documentElement.dataset.glCount = String(active.size);
      document.documentElement.dataset.projection = event.detail.pose.projection;
      document.documentElement.dataset.viewerFrame = String(performance.now());
    });
  });
}

async function open(page) {
  await page.goto(origin + "/viewer", { waitUntil: "networkidle" });
  await button(page, "Laboratório de catálogo").click();
  await kit(page).getByRole("heading", { name: "Knolling", exact: true }).waitFor();
  await view(page).waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.projection === "orthographic");
}

async function expand(root, label) {
  const header = root.locator("summary").filter({ hasText: new RegExp("^" + label + "$") });
  if (!(await header.evaluate((node) => node.parentElement.open))) await header.click();
}

async function audit(page, name) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  results.accessibility[name] = violations.map(({ id, nodes }) => ({ id, targets: nodes.flatMap((node) => node.target) }));
}

async function pngOrData(target, fileName) {
  const start = performance.now();
  const [file] = await Promise.all([target.page().waitForEvent("download"), target.click()]);
  assert.equal(await file.failure(), null);
  await file.saveAs(join(out, fileName));
  const buffer = await readFile(join(out, fileName));
  assert.ok(buffer.length > 32);
  if (fileName.endsWith(".png")) assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  results.downloads.push({ file: fileName, bytes: buffer.length, durationMs: Math.round(performance.now() - start) });
  return buffer;
}
async function stats(page) {
  const toggle = button(page, "Exibição");
  await toggle.click();
  await page.getByLabel("Diagnóstico", { exact: true }).check();
  await page.waitForFunction(() => Number(document.querySelectorAll(".gg-v05-stats dd")[1]?.textContent) > 0);
  const fields = await page.locator(".gg-v05-stats dt,.gg-v05-stats dd").allTextContents();
  await toggle.click();
  return Object.fromEntries(fields.flatMap((label, i) => i % 2 ? [] : [[label, fields[i + 1]]]));
}

async function profileFrameIntervals(page) {
  return page.evaluate(async () => {
    const stamps = [];
    const capture = () => stamps.push(performance.now());
    document.addEventListener("geogen-camera-frame", capture);
    const canvas = document.querySelector(".gg-viewport canvas:not(.gg-v08-overlay)");
    const bounds = canvas.getBoundingClientRect();
    const windowCount = 20;
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await pause(250);
      const idleFrames250ms = stamps.length;
      stamps.length = 0;
      for (let i = 0; i < windowCount; i++) {
        canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: i % 2 ? 24 : -24,
          clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2, cancelable: true }));
        await pause(35);
      }
      const intervals = stamps.slice(1).map((stamp, index) => stamp - stamps[index]).sort((a, b) => a - b);
      const percentile = (p) => intervals.length ? Number(intervals[Math.ceil(intervals.length * p) - 1].toFixed(2)) : null;
      return { idleFrames250ms, samples: intervals.length, p50: percentile(0.5), p95: percentile(0.95) };
    } finally { document.removeEventListener("geogen-camera-frame", capture); }
  });
}

try {
  await ready();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    args: hardware ? [] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: "light" });
  await instrument(context);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  record(page);
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + "/")) results.problems.push("Requisição externa " + request.url());
  });
  await open(page);
  const renderer = await view(page).evaluate((canvas) => {
    const gl = canvas.getContext("webgl2");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
  });
  results.environment = { browser: browser.version(), mode: hardware ? "default" : "swiftshader", renderer };
  const k = kit(page);
  await page.screenshot({ path: join(out, "knolling-completo.png") });
  results.lab = await stats(page);
  await choice(k, "Modo de disposição").selectOption("grouped");
  await k.getByRole("checkbox", { name: "Mostrar callouts", exact: true }).first().check();
  await page.locator(".gg-v08-overlay").waitFor();
  await page.screenshot({ path: join(out, "knolling-categoria.png") });
  await audit(page, "knolling");
  await choice(k, "Modo de disposição").selectOption("types");
  await page.screenshot({ path: join(out, "knolling-tipos.png") });
  await choice(k, "Modo de disposição").selectOption("shelf");
  await button(k, "Reproduzir transição").click();
  await button(k, "Reproduzir transição").waitFor();
  await button(k, "Voltar à pose montada").click();
  await button(k, "Gerar disposição").click();

  await choice(k, "Escopo de componentes").selectOption("category");
  await choice(k, "Valor do filtro").selectOption("beam");
  await itemButton(k, "Viga principal A").click();
  await expand(k, "Posição e orientação da peça");
  await button(k, "Fixar nesta posição").click();
  await expand(k, "Callouts e lista de peças");
  await button(k, "Adicionar callout").click();
  await choice(k, "Tipo do callout").selectOption("custom");
  await k.getByRole("textbox", { name: "Texto do callout", exact: true }).fill("V-01 · referência da viga");
  await page.screenshot({ path: join(out, "callouts.png") });
  await expand(k, "Exportar e restaurar");
  const captureControls = k.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Exportar e restaurar$/ }) }).last();
  await captureControls.getByRole("checkbox", { name: "Mostrar callouts", exact: true }).uncheck();
  const plain = await pngOrData(button(k, "Exportar PNG do knolling"), "knolling.png");
  const labels = await pngOrData(button(k, "Exportar PNG com callouts"), "knolling-callouts.png");
  assert.ok(!plain.equals(labels));
  const knollingJson = await pngOrData(button(k, "Exportar knolling JSON"), "knolling.json");
  assert.equal(JSON.parse(knollingJson).settings.callouts.length, 1);
  await k.locator('input[aria-label="Importar documentação V0.8"]').setInputFiles(join(out, "knolling.json"));
  await k.getByText("Documento V0.8 restaurado.", { exact: true }).waitFor();

  await workspace(page, "catalog");
  const c = catalog(page);
  const search = c.getByRole("searchbox", { name: "Pesquisar peças", exact: true });
  await search.fill("Viga principal A");
  await itemButton(c, "Viga principal A").click();
  await c.locator(".gg-v08-thumb img").first().waitFor();
  assert.equal(await page.locator("html").getAttribute("data-gl-count"), "1");
  await page.screenshot({ path: join(out, "catalogo-cards.png") });
  await choice(c, "Vista do catálogo").selectOption("table");
  await c.getByRole("table", { name: "Catálogo", exact: true }).waitFor();
  await page.screenshot({ path: join(out, "catalogo-tabela.png") });
  await audit(page, "catalog-table");
  const beforeThumb = await page.locator("html").getAttribute("data-thumb-encodes");
  await choice(c, "Vista do catálogo").selectOption("cards");
  await c.locator(".gg-v08-thumb img").first().waitFor();
  assert.equal(await page.locator("html").getAttribute("data-thumb-encodes"), beforeThumb);
  await choice(c, "Aparência da miniatura").selectOption("technical");
  await c.locator(".gg-v08-thumb img").first().waitFor();
  const afterThumb = await page.locator("html").getAttribute("data-thumb-encodes");
  assert.equal(Number(afterThumb), Number(beforeThumb) + 1);
  results.thumbnailCache = { before: Number(beforeThumb), sameStyle: Number(beforeThumb), technical: Number(afterThumb) };

  await button(c, "Abrir ficha técnica").click();
  await button(c, "Gerar ficha").click();
  const article = c.locator(".gg-v08-page");
  await article.getByRole("heading", { name: "Viga principal A", exact: true }).waitFor();
  await article.locator("img").first().waitFor();
  await article.scrollIntoViewIfNeeded();
  await audit(page, "component-sheet");
  await page.screenshot({ path: join(out, "ficha-individual.png") });
  const individual = await pngOrData(button(c, "Exportar PNG da ficha"), "ficha-peca.png");
  assert.deepEqual([individual.readUInt32BE(16), individual.readUInt32BE(20)], [1634, 1155]);

  await choice(c, "Modelo da ficha").selectOption("comparison");
  await choice(c, "Formato da página").selectOption("A3");
  await choice(c, "Orientação da página").selectOption("portrait");
  await button(c, "Gerar ficha").click();
  await article.getByText("Ocorrência correspondente", { exact: true }).waitFor();
  await article.locator("img").first().waitFor();
  await article.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(out, "comparacao-pecas.png") });
  const comparison = await pngOrData(button(c, "Exportar PNG da ficha"), "ficha-comparativa.png");
  assert.deepEqual([comparison.readUInt32BE(16), comparison.readUInt32BE(20)], [1485, 2100]);
  await choice(c, "Modelo da ficha").selectOption("assembly");
  await choice(c, "Formato da página").selectOption("A4");
  await choice(c, "Orientação da página").selectOption("landscape");
  await choice(c, "Etapa de montagem").selectOption("1");
  await choice(c, "Instante da etapa").selectOption("during");
  await c.getByRole("checkbox", { name: "Manual de montagem", exact: true }).check();
  await button(c, "Gerar ficha").click();
  await article.getByRole("heading", { name: "Instalar pilares", exact: true }).waitFor();
  await article.locator("img").first().waitFor();
  assert.equal(await article.locator(".gg-v08-manual section").count(), 4);
  await article.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(out, "ficha-montagem.png") });
  const manualPdf = await page.pdf({ path: join(out, "manual-imprimivel.pdf"), format: "A4", landscape: true, printBackground: true });
  assert.equal(manualPdf.subarray(0, 4).toString(), "%PDF");
  results.downloads.push({ file: "manual-imprimivel.pdf", bytes: manualPdf.length });
  await pngOrData(button(c, "Exportar PNG da ficha"), "manual-montagem.png");
  await expand(c, "Exportar e restaurar");
  await pngOrData(button(c, "Exportar PNG da peça"), "peca.png");
  await pngOrData(button(c, "Exportar CSV do catálogo"), "catalogo.csv");
  await pngOrData(button(c, "Exportar catálogo JSON"), "catalog.json");
  const exported = await pngOrData(button(c, "Exportar documentação JSON"), "documentation.json");
  assert.equal(JSON.parse(exported).report.manual.length, 4);

  await choice(c, "Revisão do catálogo").selectOption("peer");
  await choice(c, "Revisão do catálogo").waitFor();
  await c.locator('input[aria-label="Importar documentação V0.8"]').setInputFiles(join(out, "documentation.json"));
  await c.getByRole("alert").filter({ hasText: "outro GLB" }).waitFor();
  await workspace(page, "explore");
  assert.equal(await view(page).count(), 1);
  await context.close();

  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]) {
    const browserContext = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 1024, colorScheme: "dark" });
    await instrument(browserContext);
    const tab = await browserContext.newPage();
    record(tab);
    await open(tab);
    const state = await tab.evaluate(() => ({
      width: document.querySelector(".gg-viewport canvas")?.clientWidth, height: document.querySelector(".gg-viewport canvas")?.clientHeight,
      overflow: document.documentElement.scrollWidth - innerWidth, contexts: Number(document.documentElement.dataset.glCount),
    }));
    assert.equal(state.overflow, 0);
    assert.equal(state.contexts, 1);
    assert.ok(state.height >= 200);
    results.dimensions.push({ viewport: [width, height], ...state });
    await tab.screenshot({ path: join(out, "knolling-" + width + "x" + height + ".png") });
    if (width === 1024 || width === 768 || width === 390) {
      await workspace(tab, "catalog");
      await choice(catalog(tab), "Vista do catálogo").selectOption("table");
      await catalog(tab).getByRole("table", { name: "Catálogo", exact: true }).scrollIntoViewIfNeeded();
      await tab.screenshot({ path: join(out, "catalogo-" + width + "x" + height + ".png") });
      assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await audit(tab, "catalog-" + width);
    }
    await browserContext.close();
  }

  if (process.env.GEOGEN_V08_GPU === "1") for (const count of [100, 1000, 10000]) {
    const browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await instrument(browserContext);
    const tab = await browserContext.newPage();
    tab.setDefaultTimeout(90000);
    record(tab);
    await tab.goto(origin + "/viewer", { waitUntil: "networkidle" });
    const fixture = makeBenchmarkFixture(count, false);
    const input = [
      { name: "model.glb", mimeType: "model/gltf-binary", buffer: fixture.glb },
      { name: "manifest.json", mimeType: "application/json", buffer: fixture.manifest },
    ];
    const t0 = performance.now();
    await tab.locator('input[aria-label="Abrir GLB / Manifesto"]').setInputFiles(input);
    await workspace(tab, "knolling");
    await kit(tab).getByRole("heading", { name: "Knolling", exact: true }).waitFor();
    await tab.waitForFunction(() => document.documentElement.dataset.projection === "orthographic");
    const loadAndLayoutMs = Math.round(performance.now() - t0);
    const figures = await stats(tab);
    const activeFramesMs = process.env.GEOGEN_V091_PROFILE === "1" ? await profileFrameIntervals(tab) : undefined;
    await kit(tab).getByRole("checkbox", { name: "Mostrar callouts", exact: true }).first().check();
    const overlay = await stats(tab);
    const startThumb = performance.now();
    await workspace(tab, "catalog");
    await catalog(tab).locator(".gg-v08-thumb img").first().waitFor();
    const firstThumbnailMs = Math.round(performance.now() - startThumb);
    const beginFilter = performance.now();
    await catalog(tab).getByRole("searchbox", { name: "Pesquisar peças", exact: true }).fill("bench-" + (count - 1));
    await itemButton(catalog(tab), "Peça " + (count - 1)).click();
    const filterMs = Math.round(performance.now() - beginFilter);
    await button(catalog(tab), "Abrir ficha técnica").click();
    const sheetStart = performance.now();
    await button(catalog(tab), "Gerar ficha").click();
    await catalog(tab).locator(".gg-v08-page img").first().waitFor();
    const sheetMs = Math.round(performance.now() - sheetStart);
    const captureStart = performance.now();
    await pngOrData(button(catalog(tab), "Exportar PNG da ficha"), "bench-" + count + ".png");
    const captureMs = Math.round(performance.now() - captureStart);
    const contexts = Number(await tab.locator("html").getAttribute("data-gl-count"));
    assert.equal(contexts, 1);
    results.benchmark.push({ count, loadAndLayoutMs, firstThumbnailMs, filterMs, sheetMs, captureMs, contexts, figures, overlay, activeFramesMs });
    if (count === 10_000 && process.env.GEOGEN_V091_PROFILE === "1") {
      await workspace(tab, "explore");
      await button(tab, "Vistas").click();
      await choice(tab, "Distribuição").selectOption("quad");
      await tab.waitForFunction(() => document.querySelectorAll(".gg-view-region").length === 4);
      await tab.keyboard.press("Escape");
      const quad = await stats(tab);
      await tab.screenshot({ path: join(out, "stress-quad.png") });
      const replaced = await view(tab).elementHandle();
      await tab.locator('input[aria-label="Abrir GLB / Manifesto"]').setInputFiles(join(app, "public/demos/estrutura.glb"));
      await tab.waitForFunction((canvas) => !canvas.isConnected, replaced);
      await view(tab).waitFor();
      const small = await stats(tab);
      assert.equal(await view(tab).count(), 1);
      results.stress = { quad, small, priorCanvasDetached: true, currentCanvasCount: 1 };
    }
    await browserContext.close();
  }
} catch (error) {
  results.problems.push(error.stack ?? String(error));
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await writeFile(join(out, "browser.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}
assert.deepEqual(results.problems, []);
assert.ok(Object.values(results.accessibility).every((issues) => !issues.length), "Falha na auditoria axe.");
