import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const app = fileURLToPath(new URL("../", import.meta.url));
const output = join(app, "test-results", "sprint-b");
await mkdir(output, { recursive: true });
const port = process.env.GEOGEN_SPRINT_B_PORT ?? "3295";
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
  cwd: app,
  stdio: "inherit",
});

const button = (root, name) => root.getByRole("button", { name, exact: true });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const choice = (root, name) => root.getByRole("combobox", { name, exact: true });
const canvas = (page) => page.locator(".gg-viewport canvas:not(.gg-v08-overlay)");
const treeLabel = (page, name) => page.locator(".gg-tree-label").filter({ hasText: new RegExp("^" + name + "$") });
const fixture = join(app, "public", "demos", "catalog-lab", "rev-01");

const report = {
  browser: "",
  errors: [],
  consoleErrors: [],
  remote: [],
  modes: {},
  png: {},
  axe: [],
  layout: [],
  disposalCheck: null,
};

let browser;

async function waitForFrames(page, frames = 4) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, frames);
}

async function selectMode(page, mode) {
  await button(page, "Exibição").click();
  const menu = dialog(page, "Apresentação");
  await choice(menu, "Exibição").selectOption(mode);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await waitForFrames(page, 6);
}

async function readStatsAndSample(page) {
  await button(page, "Exibição").click();
  const menu = dialog(page, "Apresentação");
  const diagCheckbox = menu.getByRole("checkbox", { name: "Diagnóstico", exact: true });
  if (!(await diagCheckbox.isChecked())) await diagCheckbox.check();
  await waitForFrames(page, 4);
  const stats = await menu.locator(".gg-v05-stats").innerText();
  const parsed = {};
  const lines = stats.trim().split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i += 2) {
    parsed[lines[i]] = lines[i + 1];
  }
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  return parsed;
}

async function measureOrbitFrameTime(page) {
  const box = await canvas(page).boundingBox();
  assert.ok(box);
  const cx = box.x + box.width * 0.55;
  const cy = box.y + box.height * 0.5;
  await page.evaluate(() => {
    window.__ggOrbitTimes = [];
    window.__ggOrbitLast = performance.now();
    window.__ggOrbitListener = () => {
      const now = performance.now();
      window.__ggOrbitTimes.push(now - window.__ggOrbitLast);
      window.__ggOrbitLast = now;
    };
    document.querySelector(".gg-viewport canvas:not(.gg-v08-overlay)")?.addEventListener("geogen-camera-frame", window.__ggOrbitListener);
  });
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(cx + i * 10, cy + i * 4);
    await waitForFrames(page, 2);
  }
  await page.mouse.up();
  await waitForFrames(page, 2);
  return page.evaluate(() => {
    const times = window.__ggOrbitTimes ?? [];
    document.querySelector(".gg-viewport canvas:not(.gg-v08-overlay)")?.removeEventListener("geogen-camera-frame", window.__ggOrbitListener);
    delete window.__ggOrbitTimes;
    delete window.__ggOrbitLast;
    delete window.__ggOrbitListener;
    return {
      frames: times.length,
      avgMs: times.length ? Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)) : 0,
    };
  });
}

async function downloadPng(page, fileName, transparent) {
  await button(page, "Exibição").click();
  const menu = dialog(page, "Apresentação");
  await choice(menu, "Largura do PNG").selectOption("1920");
  await menu.getByRole("checkbox", { name: "Fundo transparente", exact: true }).setChecked(transparent);
  const [download] = await Promise.all([page.waitForEvent("download"), button(menu, "Exportar PNG").click()]);
  const tempPath = await download.path();
  const bytes = await readFile(tempPath);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 1920);
  await writeFile(join(output, fileName), bytes);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  return bytes.length;
}

try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await fetch(origin).then(({ ok }) => ok).catch(() => false);
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Servidor Next indisponível");

  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  report.browser = browser.version();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    colorScheme: "light",
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    document.addEventListener("geogen-camera-frame", ({ detail }) => {
      document.documentElement.dataset.auditPose = JSON.stringify(detail.pose);
    });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });
  page.on("request", (req) => {
    if (/^https?:/.test(req.url()) && !req.url().startsWith(origin + "/")) report.remote.push(req.url());
  });

  await page.goto(origin + "/viewer?demo=pavilhao", { waitUntil: "networkidle" });
  await canvas(page).waitFor();
  await waitForFrames(page, 6);

  // Select one component so Blueprint cyan selection & Mono highlight are clearly visible
  const firstRow = page.locator(".gg-tree-select-btn").first();
  await firstRow.click();
  await waitForFrames(page, 3);
  const referencePose = await page.locator("html").getAttribute("data-audit-pose");

  // 1. Mono 2.0
  await selectMode(page, "mono");
  assert.equal(await page.locator("html").getAttribute("data-audit-pose"), referencePose);
  await page.screenshot({ path: join(output, "01-mono-desktop.png") });
  report.modes.mono = {
    stats: await readStatsAndSample(page),
    orbit: await measureOrbitFrameTime(page),
  };
  await button(page, "Redefinir câmera").click();
  await waitForFrames(page, 4);
  report.png.mono = await downloadPng(page, "01-mono-1920.png", false);

  // Check Exibição popover with Mono open
  await button(page, "Exibição").click();
  await dialog(page, "Apresentação").getByText("Mono 2.0").waitFor();
  await page.screenshot({ path: join(output, "01b-exibicao-mono.png") });
  await page.keyboard.press("Escape");

  // 2. Blueprint + Blueprint UI Theme + Axe check
  await selectMode(page, "blueprint");
  assert.equal(await page.locator(".gg-app").getAttribute("data-graphics-theme"), "blueprint");
  await page.screenshot({ path: join(output, "02-blueprint-desktop.png") });
  const bpAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  report.axe.push({ view: "blueprint", violations: bpAxe.violations.map((v) => ({ id: v.id, count: v.nodes.length })) });
  report.modes.blueprint = {
    stats: await readStatsAndSample(page),
    orbit: await measureOrbitFrameTime(page),
  };
  await button(page, "Redefinir câmera").click();
  await waitForFrames(page, 4);
  report.png.blueprint = await downloadPng(page, "02-blueprint-1920.png", false);

  // Test unsyncing Blueprint UI theme and re-syncing
  await button(page, "Exibição").click();
  const bpDialog = dialog(page, "Apresentação");
  const syncToggle = bpDialog.getByRole("checkbox", { name: "Aplicar tema Blueprint na interface", exact: true });
  await syncToggle.uncheck();
  assert.equal(await page.locator(".gg-app").getAttribute("data-graphics-theme"), null);
  await syncToggle.check();
  assert.equal(await page.locator(".gg-app").getAttribute("data-graphics-theme"), "blueprint");
  await page.keyboard.press("Escape");

  // 3. Dither
  await selectMode(page, "dither");
  assert.equal(await page.locator(".gg-app").getAttribute("data-graphics-theme"), null);
  await page.screenshot({ path: join(output, "03-dither-desktop.png") });
  report.modes.dither = {
    stats: await readStatsAndSample(page),
    orbit: await measureOrbitFrameTime(page),
  };
  await button(page, "Redefinir câmera").click();
  await waitForFrames(page, 4);
  report.png.ditherOpaque = await downloadPng(page, "03-dither-1920.png", false);
  report.png.ditherTransparent = await downloadPng(page, "03-dither-transparent-1920.png", true);

  // 4. Clay Studio (High quality + Shadows + Ground)
  await button(page, "Exibição").click();
  const clayMenu = dialog(page, "Apresentação");
  await choice(clayMenu, "Exibição").selectOption("clayStudio");
  await choice(clayMenu, "Qualidade gráfica").selectOption("high");
  await clayMenu.getByRole("checkbox", { name: "Plano de chão", exact: true }).check();
  await clayMenu.getByRole("checkbox", { name: "Sombras", exact: true }).check();
  await page.keyboard.press("Escape");
  await clayMenu.waitFor({ state: "hidden" });
  await waitForFrames(page, 8);
  await page.screenshot({ path: join(output, "04-clay-desktop.png") });
  report.modes.clayStudio = {
    stats: await readStatsAndSample(page),
    orbit: await measureOrbitFrameTime(page),
  };
  await button(page, "Redefinir câmera").click();
  await waitForFrames(page, 4);
  report.png.clayStudio = await downloadPng(page, "04-clay-1920.png", false);

  // Verify Performance quality fallback in Clay does not throw and keeps geometries bounded
  await button(page, "Exibição").click();
  await choice(dialog(page, "Apresentação"), "Qualidade gráfica").selectOption("performance");
  await dialog(page, "Apresentação").getByRole("checkbox", { name: "Plano de chão", exact: true }).uncheck();
  await dialog(page, "Apresentação").getByRole("checkbox", { name: "Sombras", exact: true }).uncheck();
  await page.keyboard.press("Escape");
  await waitForFrames(page, 4);
  report.modes.clayPerformanceStats = await readStatsAndSample(page);

  // 5. Quick Model Summary & Knolling Visual Check with contract fixture
  await page.locator('input[aria-label="Abrir GLB / Manifesto"]').setInputFiles([join(fixture, "model.glb"), join(fixture, "manifest.json")]);
  await treeLabel(page, "V-01").waitFor();
  await selectMode(page, "clayStudio");
  await button(page, "Resumo").click();
  await dialog(page, "Resumo").getByText("Identificação", { exact: true }).waitFor();
  await page.screenshot({ path: join(output, "05-summary-desktop.png") });
  const sumAxe = await new AxeBuilder({ page }).include(".gg-v05-popover").withTags(["wcag2a", "wcag2aa"]).analyze();
  report.axe.push({ view: "summary", violations: sumAxe.violations.map((v) => ({ id: v.id, count: v.nodes.length })) });
  await page.keyboard.press("Escape");

  await choice(page, "Workspace").selectOption("knolling");
  const knollPanel = page.getByRole("complementary", { name: "Knolling", exact: true });
  await choice(knollPanel, "Modo de disposição").selectOption("assembly");
  await button(knollPanel, "Gerar disposição").click();
  await waitForFrames(page, 8);
  await page.screenshot({ path: join(output, "06-knolling-clay.png") });

  await selectMode(page, "blueprint");
  await waitForFrames(page, 6);
  await page.screenshot({ path: join(output, "07-knolling-blueprint.png") });

  // Return to shaded and verify disposal / stats remain stable
  await selectMode(page, "shaded");
  report.disposalCheck = await readStatsAndSample(page);

  for (const [w, h] of [[1024, 768], [390, 844]]) {
    const dev = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", hasTouch: true });
    const tab = await dev.newPage();
    tab.on("pageerror", (e) => report.errors.push(e.message));
    await tab.goto(origin + "/viewer?demo=pavilhao", { waitUntil: "networkidle" });
    await canvas(tab).waitFor();
    await selectMode(tab, "blueprint");
    await button(tab, "Exibição").click();
    const box = await dialog(tab, "Apresentação").boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= w + 1 && box.y + box.height <= h + 1, `Exibição overflow em ${w}x${h}`);
    report.layout.push({ viewport: `${w}x${h}`, fits: true });
    await tab.screenshot({ path: join(output, `08-blueprint-${w}.png`) });
    await dev.close();
  }

  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.remote, []);
  for (const entry of report.axe) {
    assert.equal(entry.violations.length, 0, `Axe violations in ${entry.view}: ${JSON.stringify(entry.violations)}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
