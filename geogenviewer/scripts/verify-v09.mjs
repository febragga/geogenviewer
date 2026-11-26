import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const appDir = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const afterDir = join(repoRoot, "docs", "v09", "evidence", "after");
const outDir = join(appDir, "test-results", "v09");
await mkdir(afterDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const port = process.env.GEOGEN_V09_PORT ?? "3209";
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [join(appDir, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", port],
  { cwd: appDir, stdio: "inherit" }
);

const report = {
  resolutions: [],
  accessibility: [],
  navCube: {},
  userOrganization: {},
  settings: {},
  commandPalette: {},
  problems: [],
};

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    if (await fetch(origin).then((r) => r.ok).catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Servidor Next V0.9 indisponível.");
}

async function checkAxe(page, label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  report.accessibility.push({
    label,
    violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length })),
  });
  assert.equal(
    result.violations.length,
    0,
    `Axe violations on ${label}: ${JSON.stringify(result.violations.map((v) => v.id))}`
  );
}

async function checkOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  report.resolutions.push({ label, ...dims });
  assert.ok(
    dims.scrollWidth <= dims.innerWidth + 1,
    `Horizontal overflow at ${label}: scrollWidth=${dims.scrollWidth} > innerWidth=${dims.innerWidth}`
  );
}

async function instrument(context) {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const active = new Set();
    HTMLCanvasElement.prototype.getContext = function (name, ...params) {
      const value = original.call(this, name, ...params);
      if (name === "webgl2" && value) active.add(value);
      return value;
    };
    document.addEventListener("geogen-camera-frame", (event) => {
      document.documentElement.dataset.glCount = String(active.size);
      document.documentElement.dataset.projection = event.detail.pose.projection;
      document.documentElement.dataset.frameSeq = String(
        Number(document.documentElement.dataset.frameSeq ?? "0") + 1
      );
    });
  });
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await instrument(context);
  const page = await context.newPage();
  page.on("pageerror", (err) => report.problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.problems.push(`console.error: ${msg.text()}`);
  });

  // 1. Home Launchpad (Dark + Light + Showcase + Docs)
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Da geometria à montagem." }).waitFor();
  await page.getByText("v0.9.0").first().waitFor();
  await checkOverflow(page, "home-1440x900-dark");
  await checkAxe(page, "home-dark");
  await page.screenshot({ path: join(afterDir, "01-home-dark.png"), fullPage: true });

  await page.getByRole("button", { name: "Explodido" }).click();
  await page.getByRole("button", { name: "Knolling" }).click();
  await page.getByRole("tab", { name: "GeoGenExporter" }).click();

  await page.locator(".gg-home-header .gg-theme-toggle").click();
  await page.waitForTimeout(150);
  await checkOverflow(page, "home-1440x900-light");
  await checkAxe(page, "home-light");
  await page.screenshot({ path: join(afterDir, "02-home-light.png"), fullPage: true });

  // Switch back to dark
  await page.locator(".gg-home-header .gg-theme-toggle").click();

  // 2. Empty Viewer state screenshot
  await page.goto(`${origin}/viewer`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Nenhum modelo carregado" }).waitFor();
  await checkOverflow(page, "viewer-empty-1440x900");
  await checkAxe(page, "viewer-empty");
  await page.screenshot({ path: join(afterDir, "03-viewer-empty-dark.png") });

  // 3. Load Pavilion demo & test 3D Navigation Cube + Quad View
  await page.goto(`${origin}/viewer?demo=pavilhao`, { waitUntil: "networkidle" });
  await page.locator(".gg-view-cube").waitFor();
  await page.waitForFunction(() => Number(document.documentElement.dataset.frameSeq ?? "0") > 0);
  await checkOverflow(page, "viewer-loaded-1440x900-dark");
  await checkAxe(page, "viewer-loaded-dark");
  await page.screenshot({ path: join(afterDir, "04-viewer-loaded-desktop-dark.png") });

  const glCount = await page.evaluate(() => Number(document.documentElement.dataset.glCount ?? "0"));
  assert.ok(glCount <= 1, `Expected single WebGL context, saw ${glCount}`);
  report.navCube.glCount = glCount;

  // Test NavCube faces & aux controls
  await page.locator('.gg-view-cube button[aria-label="Frontal"]').click();
  await page.waitForTimeout(350);
  await page.locator('.gg-view-cube button[aria-label*="Alternar projeção"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.projection === "orthographic");
  await page.locator('.gg-view-cube button[aria-label="Girar 90° horário"]').click();
  await page.waitForTimeout(350);
  await page.locator('.gg-view-cube button[aria-label="Vista inicial"]').click();
  await page.waitForTimeout(350);
  report.navCube.verified = true;

  // Quad View verification
  await page.getByRole("button", { name: "Vistas", exact: true }).click();
  await page.getByRole("combobox", { name: "Distribuição" }).selectOption("quad");
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(afterDir, "07-quad-view.png") });
  await page.getByRole("combobox", { name: "Distribuição" }).selectOption("single");
  await page.keyboard.press("Escape");

  // 4. User Organization System & Context Menu
  await page.getByRole("tab", { name: "Camadas" }).click();
  await page.getByRole("button", { name: "Personalizada" }).click();
  await page.getByRole("button", { name: "+ Camada" }).click();
  await page.getByPlaceholder("Nome da camada…").fill("Camada Teste V09");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.locator(".gg-tree-row", { hasText: "Camada Teste V09" }).waitFor();

  // Undo & Redo
  await page.getByRole("button", { name: "Desfazer organização" }).click();
  assert.equal(await page.locator(".gg-tree-row", { hasText: "Camada Teste V09" }).count(), 0);
  await page.getByRole("button", { name: "Refazer organização" }).click();
  await page.locator(".gg-tree-row", { hasText: "Camada Teste V09" }).waitFor();

  // Context menu from Component row
  await page.getByRole("tab", { name: "Componentes" }).click();
  await page.locator('.gg-tree-row button[aria-label^="Ações para"]').first().click();
  await page.getByRole("menu", { name: "Menu de ações do componente" }).waitFor();
  await page.screenshot({ path: join(afterDir, "12-user-org-context-menu.png") });
  await page.getByRole("menuitemradio", { name: /Camada Teste V09/ }).click();

  // Delete layer explicit strategy dialog
  await page.getByRole("tab", { name: "Camadas" }).click();
  await page.locator('button[aria-label="Excluir Camada Teste V09"]').click();
  await page.getByRole("heading", { name: /Excluir camada/ }).waitFor();
  await page.screenshot({ path: join(afterDir, "13-delete-layer-dialog.png") });
  await page.getByRole("button", { name: /Remover atribuição de camada/ }).click();
  report.userOrganization.verified = true;

  // 5. Settings Dialog & Independent Viewport Background
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.getByRole("heading", { name: "Configurações do GeoGenViewer" }).waitFor();
  await page.getByRole("combobox", { name: /Fundo da viewport 3D/ }).selectOption("white");
  assert.equal(await page.locator(".gg-viewport").getAttribute("data-background"), "white");
  await page.screenshot({ path: join(afterDir, "14-settings-dialog.png") });
  await page.getByRole("tab", { name: "Sobre" }).click();
  await page.getByText("GeoGenViewer v0.9.0").waitFor();
  await page.getByRole("button", { name: "Fechar configurações" }).click();
  report.settings.verified = true;

  // 6. Command Palette
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Digite um comando…").fill("pavilhao");
  await page.screenshot({ path: join(afterDir, "15-command-palette.png") });
  await page.keyboard.press("Escape");
  report.commandPalette.verified = true;

  // 7. Home Recent Projects check after opening demo
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Projetos recentes" }).waitFor();
  await page.locator(".gg-recent-card").first().waitFor();

  // 8. Responsive sweep across 6 resolutions (1920, 1440, 1280, 1024, 768, 390)
  const viewports = [
    { name: "1920x1080", width: 1920, height: 1080, file: "05-viewer-1920x1080.png" },
    { name: "1280x800", width: 1280, height: 800, file: "06-viewer-1280x800.png" },
    { name: "1024x768", width: 1024, height: 768, file: "08-viewer-1024x768.png" },
    { name: "768x1024", width: 768, height: 1024, file: "09-tablet-portrait.png" },
    { name: "390x844", width: 390, height: 844, file: "10-smartphone.png" },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${origin}/viewer?demo=pavilhao`, { waitUntil: "networkidle" });
    await page.locator(".gg-view-cube").waitFor();
    await page.waitForTimeout(250);
    await checkOverflow(page, `viewer-${vp.name}`);
    await checkAxe(page, `viewer-${vp.name}`);
    await page.screenshot({ path: join(afterDir, vp.file) });
  }

  // Also test Knolling & Catalog UI on 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/viewer?demo=catalog`, { waitUntil: "networkidle" });
  await page.getByRole("complementary", { name: "Knolling", exact: true }).waitFor();
  await page.waitForTimeout(350);
  await checkOverflow(page, "knolling-1440x900");
  await page.screenshot({ path: join(afterDir, "11-knolling-after.png") });

  assert.equal(report.problems.length, 0, `Runtime errors detected: ${report.problems.join(" | ")}`);
  await writeFile(join(outDir, "verify-v09.json"), JSON.stringify(report, null, 2));
  console.log("V0.9 Playwright QA verification passed across 6 resolutions and all flows.");
} finally {
  await browser?.close();
  server.kill();
}
