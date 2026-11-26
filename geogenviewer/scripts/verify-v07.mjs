import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { makeBenchmarkFixture } from "./revision-benchmark-fixture.mjs";

const app = fileURLToPath(new URL("../", import.meta.url));
const out = join(app, "test-results", "v07");
const fixtures = join(app, "public", "demos", "revision-lab");
await mkdir(out, { recursive: true });
const origin = "http://127.0.0.1:" + (process.env.GEOGEN_V07_PORT ?? "3207");
const server = spawn(process.execPath, [join(app, "node_modules/next/dist/bin/next"), "start",
  "--hostname", "127.0.0.1", "--port", new URL(origin).port], { cwd: app, stdio: "inherit" });
const results = { a11y: {}, dimensions: [], graphics: {}, issues: [], exports: [], graphicsScale: [] };
let browser;

const compare = (page) => page.getByRole("complementary", { name: "Comparar", exact: true });
const quantities = (page) => page.getByRole("complementary", { name: "Quantitativos", exact: true });
const workspace = (page, value) => page.getByLabel("Workspace", { exact: true }).selectOption(value);
const canvas = (page) => page.locator(".gg-viewport canvas");

async function ready() {
  for (let attempt = 0; attempt < 48; attempt++) {
    if (await fetch(origin).then((response) => response.ok).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Servidor local indisponível.");
}

async function instrument(context) {
  await context.addInitScript(() => {
    const contexts = new Set();
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (name, ...args) {
      const value = original.call(this, name, ...args);
      if (name === "webgl2" && value) contexts.add(value);
      return value;
    };
    document.addEventListener("geogen-camera-frame", (event) => {
      document.documentElement.dataset.v07Contexts = String(contexts.size);
      document.documentElement.dataset.v07Pose = JSON.stringify(event.detail.pose);
      document.documentElement.dataset.v07Frame = String(performance.now());
    });
  });
}

async function axe(page, name) {
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  results.a11y[name] = report.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

async function reveal(panel, summary) {
  const marker = panel.locator("summary").filter({ hasText: new RegExp("^" + summary + "$") });
  await marker.waitFor();
  if (!await marker.evaluate((element) => element.parentElement.open)) await marker.click();
}

async function lab(page) {
  await page.goto(origin + "/viewer", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Laboratório de revisões", exact: true }).click();
  await compare(page).getByRole("heading", { name: "Diferenças", exact: true }).waitFor();
  await canvas(page).waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.v07Contexts === "1");
}

async function download(button, target) {
  const pending = button.page().waitForEvent("download");
  await button.click();
  const file = await pending;
  assert.equal(await file.failure(), null);
  await file.saveAs(join(out, target));
  const data = await readFile(join(out, target));
  assert.ok(data.length > 64);
  results.exports.push({ file: target, bytes: data.length });
  return data;
}

async function coloredPixels(page, image) {
  return page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) -
        Math.min(data[i], data[i + 1], data[i + 2]) > 25) count++;
      return count;
    } finally { bitmap.close(); }
  }, Array.from(image));
}

async function videoStats(page) {
  const button = page.getByRole("button", { name: "Exibição", exact: true });
  await button.click();
  await page.getByLabel("Diagnóstico", { exact: true }).check();
  const popover = page.locator(".gg-v05-popover").filter({ hasText: "Draw calls" });
  await popover.waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".gg-v05-stats dd")).slice(1, 2).some((cell) => Number(cell.textContent) > 0));
  const items = await popover.locator("dt,dd").allTextContents();
  await button.click();
  return Object.fromEntries(items.flatMap((label, index) => index % 2 ? [] : [[label, items[index + 1]]]));
}

try {
  await ready();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const main = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await instrument(main);
  const page = await main.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => results.issues.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + "/")) results.issues.push("Requisição externa " + request.url());
  });
  await lab(page);
  const comparePanel = compare(page);
  await axe(page, "compare-light");
  await page.screenshot({ path: join(out, "comparar-lado-a-lado.png") });
  results.graphics.labSide = await videoStats(page);

  await comparePanel.getByLabel("Exibição", { exact: true }).selectOption("overlay");
  await reveal(comparePanel, "Cores das diferenças");
  await comparePanel.getByLabel("Opacidade · Revisão comparada", { exact: true }).fill("0.45");
  await comparePanel.getByRole("button", { name: /Travessa redimensionada/ }).click();
  await comparePanel.getByRole("heading", { name: "Propriedades comparadas", exact: true }).waitFor();
  await axe(page, "compare-overlay");
  results.graphics.labOverlay = await videoStats(page);
  await page.screenshot({ path: join(out, "comparar-sobreposicao.png") });

  await comparePanel.getByLabel("Exibição", { exact: true }).selectOption("differences");
  await comparePanel.getByLabel("Mostrar inalterados em transparência").check();
  await comparePanel.getByRole("combobox", { name: "Estado da diferença", exact: true }).selectOption("unresolved");
  await comparePanel.getByRole("button", { name: /Peça repetida 1/ }).first().click();
  await reveal(comparePanel, "Correspondência manual");
  await comparePanel.getByRole("button", { name: "Confirmar sugestão", exact: true }).first().click();
  await comparePanel.getByRole("combobox", { name: "Estado da diferença", exact: true }).selectOption("all");

  await reveal(comparePanel, "Registros de inspeção");
  await comparePanel.locator('input[aria-label="Carregar inspeção · Revisão base"]').setInputFiles(join(fixtures, "proto-01", "inspection.json"));
  await comparePanel.locator('input[aria-label="Carregar inspeção · Revisão comparada"]').setInputFiles(join(fixtures, "proto-02", "inspection.json"));
  await comparePanel.getByRole("button", { name: "Confirmar equivalência da medição", exact: true }).click();
  await comparePanel.getByText(/Referência indisponível/).waitFor();
  await comparePanel.getByText(/Peça removida da revisão comparada/).waitFor();

  await comparePanel.getByLabel("Exibição", { exact: true }).selectOption("side");
  await reveal(comparePanel, "Exportar e restaurar");
  const exported = await download(comparePanel.getByRole("button", { name: "Exportar comparação JSON", exact: true }), "comparison.json");
  assert.equal(JSON.parse(exported).manual.length, 1);
  await download(comparePanel.getByRole("button", { name: "Exportar diferenças CSV", exact: true }), "diferencas.csv");
  await comparePanel.getByRole("button", { name: "Enquadrar comparação", exact: true }).click();
  const png = await download(comparePanel.getByRole("button", { name: "Exportar comparação PNG", exact: true }), "comparacao.png");
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  await comparePanel.locator('input[aria-label="Importar comparação JSON"]').setInputFiles(join(out, "comparison.json"));
  assert.equal(await comparePanel.getByRole("alert").count(), 0);

  await workspace(page, "inspect");
  await page.getByRole("button", { name: "Inspeção espacial", exact: true }).click();
  await page.getByRole("button", { name: "Plano X", exact: true }).click();
  await page.getByRole("checkbox", { name: "Ativar corte X", exact: true }).check();
  await workspace(page, "compare");
  await reveal(comparePanel, "Exportar e restaurar");
  await comparePanel.getByRole("button", { name: "Enquadrar comparação", exact: true }).click();
  const clipped = await download(comparePanel.getByRole("button", { name: "Exportar comparação PNG", exact: true }), "comparacao-com-corte.png");
  const before = await coloredPixels(page, png);
  const after = await coloredPixels(page, clipped);
  assert.ok(before > 0 && after > 0 && after < before * 0.8, JSON.stringify({ before, after }));
  results.clipping = { coloredPixels: before, clippedPixels: after };
  await workspace(page, "inspect");
  const inspection = page.getByRole("button", { name: "Inspeção espacial", exact: true });
  if (await inspection.getAttribute("aria-expanded") !== "true") await inspection.click();
  await page.getByRole("button", { name: "Plano X", exact: true }).click();
  await page.getByRole("checkbox", { name: "Ativar corte X", exact: true }).uncheck();

  await workspace(page, "quantities");
  const q = quantities(page);
  await q.getByRole("heading", { name: "Quantitativos", exact: true }).waitFor();
  await q.getByLabel("Pesquisar componentes", { exact: true }).fill("Viga rotacionada");
  await q.getByRole("checkbox", { name: /Componente Viga rotacionada/ }).check();
  await q.getByLabel("Pesquisar componentes", { exact: true }).clear();
  await q.getByLabel("Escopo", { exact: true }).selectOption("selected");
  await q.getByRole("button", { name: "Viga rotacionada", exact: true }).waitFor();
  await q.getByLabel("Escopo", { exact: true }).selectOption("all");
  await q.getByLabel("Revisão", { exact: true }).selectOption("comparison");
  await q.getByLabel("Layout de quantitativos", { exact: true }).selectOption("analytics");
  await q.getByLabel("Indicador do gráfico", { exact: true }).selectOption("revision");
  await q.getByRole("list", { name: "Indicadores entre revisões", exact: true }).waitFor();
  await page.screenshot({ path: join(out, "quantitativos-analise.png") });
  await axe(page, "quantities-analytics");
  await reveal(q, "Exportar e restaurar");
  const fab = await download(q.getByRole("button", { name: "Exportar fabricação JSON", exact: true }), "fabrication-analysis.json");
  assert.equal(JSON.parse(fab).revision.revisionId, "proto-02");
  await download(q.getByRole("button", { name: "Exportar quantitativos CSV", exact: true }), "quantitativos.csv");
  await q.locator('input[aria-label="Importar fabricação JSON"]').setInputFiles(join(out, "fabrication-analysis.json"));
  await q.getByLabel("Layout de quantitativos", { exact: true }).selectOption("tableFocus");
  await q.getByRole("table", { name: "Tabela de quantitativos" }).waitFor();
  await axe(page, "quantities-table");

  await workspace(page, "explore");
  await canvas(page).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-v07-contexts"), "1");
  await workspace(page, "compare");
  await reveal(compare(page), "Revisões carregadas");
  await compare(page).getByRole("button", { name: "Inverter revisões", exact: true }).click();
  await compare(page).getByRole("heading", { name: "Diferenças", exact: true }).waitFor();
  await reveal(compare(page), "Revisões carregadas");
  await compare(page).getByRole("button", { name: "Remover · Revisão comparada", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".gg-v07-view-labels"));
  await canvas(page).waitFor();
  await main.close();

  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 1024, colorScheme: "dark" });
    await instrument(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => results.issues.push(error.message));
    await lab(page);
    if (width < 768) {
      await compare(page).getByLabel("Alternar revisão", { exact: true }).selectOption("comparison");
      await page.locator(".gg-v07-view-labels").getByText("Revisão comparada").waitFor();
    }
    const layout = await page.evaluate(() => {
      const { width, height } = document.querySelector(".gg-viewport canvas").getBoundingClientRect();
      return { canvas: [Math.floor(width), Math.floor(height)], canvasCount: document.querySelectorAll(".gg-viewport canvas").length,
        contexts: Number(document.documentElement.dataset.v07Contexts), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(layout.overflow, 0);
    assert.equal(layout.canvasCount, 1);
    assert.equal(layout.contexts, 1);
    assert.ok(layout.canvas[1] > 220);
    results.dimensions.push({ size: [width, height], ...layout });
    await page.screenshot({ path: join(out, "comparar-" + width + "x" + height + ".png") });
    if (width === 390 || width === 768) {
      await axe(page, "compare-dark-" + width);
      await workspace(page, "quantities");
      await quantities(page).getByRole("table", { name: "Tabela de quantitativos" }).waitFor();
      const quantitiesOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.equal(quantitiesOverflow, 0);
      results.dimensions.at(-1).quantitiesOverflow = quantitiesOverflow;
      await quantities(page).getByRole("table", { name: "Tabela de quantitativos" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(out, "quantitativos-" + width + "x" + height + ".png") });
      await axe(page, "quantities-dark-" + width);
    }
    await context.close();
  }

  if (process.env.GEOGEN_V07_GPU === "1") {
    for (const count of [100, 1000, 10000]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await instrument(context);
      const page = await context.newPage();
      page.setDefaultTimeout(90000);
      page.on("pageerror", (error) => results.issues.push(error.message));
      await page.goto(origin + "/viewer", { waitUntil: "networkidle" });
      const a = makeBenchmarkFixture(count, false), b = makeBenchmarkFixture(count, true);
      const files = (fixture) => [
        { name: "model.glb", mimeType: "model/gltf-binary", buffer: fixture.glb },
        { name: "manifest.json", mimeType: "application/json", buffer: fixture.manifest },
      ];
      const start = performance.now();
      await page.locator('input[type="file"][aria-label="Abrir GLB / Manifesto"]').setInputFiles(files(a));
      await workspace(page, "compare");
      await compare(page).locator('input[aria-label="Carregar revisão · Revisão comparada"]').setInputFiles(files(b));
      await compare(page).getByRole("heading", { name: "Diferenças", exact: true }).waitFor();
      const wallMs = Math.round(performance.now() - start);
      const before = await videoStats(page);
      await reveal(compare(page), "Revisões carregadas");
      await compare(page).getByRole("button", { name: "Remover · Revisão comparada", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".gg-v07-view-labels"));
      const after = await videoStats(page);
      const contexts = Number(await page.locator("html").getAttribute("data-v07-contexts"));
      await workspace(page, "quantities");
      const q = quantities(page);
      const table = q.getByRole("table", { name: "Tabela de quantitativos" });
      await table.waitFor();
      const tableStart = performance.now();
      await q.getByLabel("Pesquisar componentes", { exact: true }).fill("bench-" + (count - 1));
      await table.getByRole("button", { name: "Peça " + (count - 1), exact: true }).waitFor();
      assert.equal(await table.getAttribute("aria-rowcount"), "3");
      const tableFilterWallMs = Math.round(performance.now() - tableStart);
      results.graphicsScale.push({ count, wallMs, contexts, before, after, tableFilterWallMs });
      await context.close();
    }
  }
} catch (error) {
  results.issues.push(error.stack ?? String(error));
  throw error;
} finally {
  await browser?.close();
  server.kill();
  await writeFile(join(out, "browser.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));
}
assert.deepEqual(results.issues, []);
assert.ok(Object.values(results.a11y).every((violations) => violations.length === 0), "Foram encontradas violações axe.");
