import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const app = fileURLToPath(new URL("../", import.meta.url));
const output = join(app, "test-results", "v0912");
await mkdir(output, { recursive: true });
const port = process.env.GEOGEN_V0912_PORT ?? "3292";
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port],
  { cwd: app, stdio: "inherit" });
const report = { errors: [], remote: [], layouts: [], styles: [], png: {} };
const button = (root, name) => root.getByRole("button", { name, exact: true });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const canvas = (page) => page.locator(".gg-viewport canvas:not(.gg-v08-overlay)");
const choice = (root, name) => root.getByRole("combobox", { name, exact: true });
const treeLabel = (page, name) => page.locator(".gg-tree-label").filter({ hasText: new RegExp("^" + name + "$") });
const workspace = (page, value) => choice(page, "Workspace").selectOption(value);
const fixture = join(app, "public", "demos", "catalog-lab", "rev-01");
const input = (page) => page.locator('input[aria-label="Abrir GLB / Manifesto"]');
const selectedRow = (page) => page.locator('.gg-tree-row[aria-selected="true"]');
let browser;

async function loadContract(page) {
  await input(page).setInputFiles([join(fixture, "model.glb"), join(fixture, "manifest.json")]);
  await treeLabel(page, "V-01").waitFor();
}

function collectErrors(page) {
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + "/")) report.remote.push(request.url());
  });
}

async function draw(page, mode) {
  const menu = dialog(page, "Apresentação");
  await button(page, "Exibição").click();
  await choice(menu, "Exibição").selectOption(mode);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  report.styles.push(mode);
}

async function downloadPng(page, transparent) {
  await button(page, "Exibição").click();
  const menu = dialog(page, "Apresentação");
  await choice(menu, "Largura do PNG").selectOption("1280");
  await menu.getByRole("checkbox", { name: "Fundo transparente", exact: true }).setChecked(transparent);
  const [download] = await Promise.all([page.waitForEvent("download"), button(menu, "Exportar PNG").click()]);
  const bytes = await readFile(await download.path());
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 1280);
  await page.keyboard.press("Escape");
  return bytes.length;
}

try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await fetch(origin).then(({ ok }) => ok).catch(() => false);
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Servidor Next indisponível");
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce",
    colorScheme: "light", acceptDownloads: true });
  await context.addInitScript(() => {
    document.addEventListener("geogen-camera-frame", ({ detail }) => {
      document.documentElement.dataset.auditPose = JSON.stringify(detail.pose);
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  collectErrors(page);
  await page.goto(origin + "/viewer?demo=basic");
  await canvas(page).waitFor();
  const summaryButton = button(page, "Resumo");
  await summaryButton.focus();
  await page.keyboard.press("Enter");
  const summary = dialog(page, "Resumo");
  await summary.getByText("Comprimento autorado", { exact: true }).waitFor();
  assert.match(await summary.innerText(), /Indisponível/);
  await choice(summary, "Escopo").selectOption("selected");
  await summary.getByText("Nenhum componente neste escopo.").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Resumo");

  await loadContract(page);
  assert.equal(await treeLabel(page, "P-01").count(), 4);
  const row = page.locator(".gg-tree-row").filter({ has: treeLabel(page, "V-01") });
  await row.locator(".gg-tree-select-btn").click();
  await selectedRow(page).filter({ has: treeLabel(page, "V-01") }).waitFor();
  await summaryButton.click();
  for (const field of ["layer", "material", "type", "assembly", "category"]) {
    await choice(summary, "Agrupar por").selectOption(field);
    assert.ok(await choice(summary, "Grupo").locator("option").count() > 1);
  }
  await choice(summary, "Escopo").selectOption("selected");
  const componentCount = summary.locator("dt").filter({ hasText: /^Componentes$/ }).locator("xpath=following-sibling::dd[1]");
  assert.equal(await componentCount.innerText(), "1");
  await choice(summary, "Escopo").selectOption("visible");
  assert.equal(await componentCount.innerText(), "15");
  await page.screenshot({ path: join(output, "resumo-desktop.png") });
  await page.keyboard.press("Escape");

  const before = await page.locator("html").getAttribute("data-audit-pose");
  const webgl = await canvas(page).elementHandle();
  for (const mode of ["material", "mono", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial", "dither", "blueprint", "clayStudio"]) {
    await draw(page, mode);
    await selectedRow(page).filter({ has: treeLabel(page, "V-01") }).waitFor();
    assert.equal(await webgl.evaluate((node) => node.isConnected), true);
    assert.equal(await page.locator("html").getAttribute("data-audit-pose"), before);
    assert.equal(await page.locator(".gg-app").getAttribute("data-graphics-theme"), mode === "blueprint" ? "blueprint" : null);
  }
  const display = dialog(page, "Apresentação");
  await button(page, "Exibição").click();
  await display.getByRole("checkbox", { name: "Plano de chão", exact: true }).check();
  await display.getByRole("checkbox", { name: "Sombras", exact: true }).check();
  const exposure = display.getByRole("slider", { name: /^Exposição/ });
  await exposure.press("ArrowRight");
  assert.equal(await exposure.inputValue(), "1.05");
  await page.keyboard.press("Escape");
  report.png.clay = await downloadPng(page, false);
  await button(page, "Exibição").click();
  await display.getByRole("checkbox", { name: "Plano de chão", exact: true }).uncheck();
  await display.getByRole("checkbox", { name: "Sombras", exact: true }).uncheck();
  await page.keyboard.press("Escape");
  await draw(page, "dither");
  report.png.dither = await downloadPng(page, true);

  await workspace(page, "knolling");
  const knolling = page.getByRole("complementary", { name: "Knolling", exact: true });
  await choice(knolling, "Modo de disposição").selectOption("assembly");
  await knolling.locator("summary").filter({ hasText: /^Configurar disposição$/ }).click();
  await choice(knolling, "Orientação das peças").selectOption("largestFace");
  await button(knolling, "Gerar disposição").click();
  await choice(knolling, "Orientação das peças").selectOption("principalAxis");
  await button(knolling, "Voltar à pose montada").click();
  await button(knolling, "Gerar disposição").click();
  await knolling.locator("summary").filter({ hasText: /^Renomear etapas ou categorias$/ }).click();
  const stage = knolling.getByRole("textbox", { name: /^Etapa 01/ });
  await stage.fill("Montagem de ensaio");
  await stage.press("Enter");
  await knolling.getByRole("textbox", { name: "Etapa 01 — Montagem de ensaio" }).waitFor();
  await page.screenshot({ path: join(output, "knolling.png") });

  await button(page, "Exibição").click();
  await choice(dialog(page, "Apresentação"), "Qualidade gráfica").selectOption("performance");
  await page.keyboard.press("Escape");
  await page.reload();
  await loadContract(page);
  await button(page, "Exibição").click();
  assert.equal(await choice(dialog(page, "Apresentação"), "Exibição").inputValue(), "dither");
  assert.equal(await choice(dialog(page, "Apresentação"), "Qualidade gráfica").inputValue(), "performance");
  await choice(display, "Exibição").selectOption("clayStudio");
  assert.equal(await exposure.inputValue(), "1.05");
  await page.keyboard.press("Escape");
  await workspace(page, "knolling");
  await choice(knolling, "Modo de disposição").selectOption("assembly");
  await knolling.locator("summary").filter({ hasText: /^Renomear etapas ou categorias$/ }).click();
  await knolling.getByRole("textbox", { name: "Etapa 01 — Montagem de ensaio" }).waitFor();

  await page.evaluate(() => localStorage.setItem("geogen:v09:settings", JSON.stringify({ displayMode: "clay", theme: "dark" })));
  await page.goto(origin + "/viewer?demo=basic");
  await button(page, "Exibição").click();
  assert.equal(await choice(dialog(page, "Apresentação"), "Exibição").inputValue(), "mono");
  await page.keyboard.press("Escape");

  for (const [width, height, colorScheme] of [[375, 800, "dark"], [900, 700, "light"], [1440, 900, "light"]]) {
    const device = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: "reduce", hasTouch: width < 1000 });
    const tab = await device.newPage();
    collectErrors(tab);
    await tab.goto(origin + "/viewer?demo=basic");
    await button(tab, "Resumo").click();
    const popup = dialog(tab, "Resumo");
    await popup.waitFor();
    const bounds = await popup.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    const { violations } = await new AxeBuilder({ page: tab }).include(".gg-v05-popover")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    report.layouts.push({ width, height, colorScheme, violations: violations.map(({ id }) => id) });
    assert.equal(violations.length, 0);
    await tab.screenshot({ path: join(output, "resumo-" + width + ".png") });
    await device.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.remote, []);
} finally {
  await browser?.close();
  server.kill();
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
