
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import packageJson from "../package.json" with { type: "json" };

const dir = fileURLToPath(new URL("../", import.meta.url));
const out = join(dir, "test-results", "v091");
const captures = join(out, "captures");
await mkdir(captures, { recursive: true });
const port = process.env.GEOGEN_V091_PORT ?? "3291";
const origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port],
  { cwd: dir, stdio: "inherit" });
const report = { layerAndGroup: {}, recovery: {}, assets: {}, accessibility: [], problems: [], external: [] };
let browser;

const button = (page, name) => page.getByRole("button", { name, exact: typeof name === "string" });
const row = (page, name) => page.locator(".gg-tree-row").filter({ has: page.locator(".gg-tree-label", { hasText: name }) });
const modelInput = (page) => page.locator('input[aria-label="Abrir GLB / Manifesto"]');
const organizationInput = (page) => page.locator('.gg-org-bar input[type=file]');
const screenshot = (page, name) => page.screenshot({ path: join(captures, name) });
async function axe(page, name) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations = result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) }));
  report.accessibility.push({ name, violations });
  assert.deepEqual(violations, [], name);
}
async function captureDownload(page, trigger) {
  const received = page.waitForEvent("download");
  await trigger.click();
  const path = await (await received).path();
  return readFile(path);
}

try {
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    ready = await fetch(origin).then(({ ok }) => ok).catch(() => false);
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Servidor Next indisponível");
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const cx = await browser.newContext({ viewport: { width: 1440, height: 900 },
    locale: "pt-BR", colorScheme: "light", reducedMotion: "reduce", acceptDownloads: true });
  const page = await cx.newPage();
  page.setDefaultTimeout(18_000);
  page.on("pageerror", (error) => report.problems.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && /^https?:/.test(request.url())) report.external.push(request.url());
  });

  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByText("v" + packageJson.version, { exact: true }).first().waitFor();
  const icons = await page.locator('link[rel="icon"],link[rel="apple-touch-icon"],link[rel="manifest"]')
    .evaluateAll((links) => links.map((link) => new URL(link.href).pathname));
  assert.deepEqual([...new Set(icons)].sort(), ["/apple-icon.png", "/favicon.ico", "/icon.svg", "/manifest.webmanifest"]);
  assert.equal(icons.length, 4);
  for (const path of [...icons, "/icons/icon-192.png", "/icons/icon-512.png", "/brand/geogenviewer-og.png"]) {
    const response = await page.request.get(origin + path);
    assert.ok(response.ok(), path);
    report.assets[path] = response.headers()["content-type"];
  }
  const ico = await (await page.request.get(origin + "/favicon.ico")).body();
  assert.equal(ico.readUInt16LE(2), 1);
  assert.deepEqual(Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16]), [16, 32, 48]);
  assert.match(await (await page.request.get(origin + "/icon.svg")).text(), /#3B82F6/i);
  const manifest = await (await page.request.get(origin + "/manifest.webmanifest")).json();
  assert.equal(manifest.theme_color.toUpperCase(), "#3B82F6");

  // GLB-only, organization and reversible visibility without modifying CAD data.
  await page.goto(origin + "/viewer?demo=basic", { waitUntil: "networkidle" });
  await row(page, /Pilar[ _]01/).first().waitFor();
  for (const index of [1, 2, 3, 4]) {
    await row(page, new RegExp("Pilar[ _]0" + index)).first().locator(".gg-tree-select-btn")
      .click({ modifiers: index === 1 ? [] : ["Control"] });
  }
  await page.getByRole("tab", { name: "Grupos" }).click();
  await button(page, "+ Grupo").click();
  await page.getByPlaceholder("Nome do grupo…").fill("Pilares de ensaio");
  await button(page, "Salvar").click();
  await row(page, "Pilares de ensaio").first().waitFor();
  await screenshot(page, "grupo-glb.png");
  await page.getByRole("tab", { name: "Camadas" }).click();
  await button(page, "+ Camada").click();
  await page.getByPlaceholder("Nome da camada…").fill("Nível de ensaio");
  await button(page, "Salvar").click();
  await row(page, "Nível de ensaio").first().waitFor();
  const exported = await captureDownload(page, button(page, "Exportar organization.json"));
  const doc = JSON.parse(exported);
  assert.ok(/^[0-9a-f]{64}$/.test(doc.modelSha256));
  assert.equal(doc.projectId, null);
  assert.equal(doc.userGroups.find(({ name }) => name === "Pilares de ensaio").memberIds.length, 4);
  assert.equal(Object.keys(doc.componentLayerAssignments).length, 4);
  await screenshot(page, "camada-glb.png");
  await axe(page, "camada-glb");
  await button(page, "Desfazer organização").click();
  assert.equal(await row(page, "Nível de ensaio").count(), 0);
  await organizationInput(page).setInputFiles({ name: "organization.json", mimeType: "application/json", buffer: exported });
  await row(page, "Nível de ensaio").first().waitFor();

  const wrong = { ...doc, modelSha256: "0".repeat(64), userLayers: doc.userLayers.map((layer) => ({...layer, name: "Modelo errado"})) };
  await organizationInput(page).setInputFiles({ name: "organization.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(wrong)) });
  await page.getByText("O arquivo de organização não pôde ser vinculado ao modelo carregado.").first().waitFor();
  assert.equal(await row(page, "Modelo errado").count(), 0);
  await page.getByRole("tab", { name: "Grupos" }).click();
  await row(page, "Pilares de ensaio").first().locator('button[aria-label^="Ações para"]').click();
  await page.getByRole("menuitem", { name: /Isolar/ }).click();
  await page.getByRole("combobox", { name: "Workspace", exact: true }).selectOption("knolling");
  await page.getByRole("complementary", { name: "Knolling", exact: true }).waitFor();
  await screenshot(page, "knolling-glb.png");
  await page.getByRole("combobox", { name: "Workspace", exact: true }).selectOption("catalog");
  await page.getByRole("complementary", { name: "Catálogo", exact: true }).waitFor();
  await screenshot(page, "catalogo-glb.png");
  report.layerAndGroup = { pillars: 4, occurrencesAssigned: 4, validRestore: true, wrongHashRejected: true, isolateKnollingCatalog: true };

  // Failing and cancelled imports keep the last committed viewport usable.
  await page.goto(origin + "/viewer?demo=basic", { waitUntil: "networkidle" });
  await row(page, /Pilar[ _]01/).first().waitFor();
  const original = await page.locator(".gg-viewport canvas:not(.gg-v08-overlay)").elementHandle();
  await modelInput(page).setInputFiles({ name: "invalido.glb", mimeType: "model/gltf-binary", buffer: Buffer.alloc(12) });
  await page.locator(".gg-error-banner[role=alert]").waitFor();
  assert.equal(await original.evaluate((canvas) => canvas.isConnected), true);
  await screenshot(page, "erro-importacao.png");
  await axe(page, "erro-importacao");
  const fixture = await readFile(join(dir, "public/demos/estrutura.glb"));
  await modelInput(page).setInputFiles([
    { name: "estrutura.glb", mimeType: "model/gltf-binary", buffer: fixture },
    { name: "manifest.json", mimeType: "application/json", buffer: Buffer.from("{") },
  ]);
  await page.locator(".gg-error-banner--choice").waitFor();
  assert.equal(await original.evaluate((canvas) => canvas.isConnected), true);
  await page.locator(".gg-error-banner--choice button[aria-label]").click();
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  await page.route("**/demos/pavilhao-explosao.glb", async (route) => {
    await delayed;
    await route.abort().catch(() => {});
  });
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Digite um comando…").fill("pavilhao");
  await page.getByText("Demo Pavilhão", { exact: true }).last().click();
  await button(page, "Cancelar carregamento").click();
  release();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await original.evaluate((canvas) => canvas.isConnected), true);

  const canLose = await original.evaluate((canvas) => {
    const ext = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    ext.loseContext();
    return true;
  });
  assert.equal(canLose, true);
  const retry = button(page, "Tentar recriar a vista");
  await retry.waitFor();
  await screenshot(page, "contexto-perdido.png");
  await retry.click();
  await page.locator(".gg-viewport canvas:not(.gg-v08-overlay)").waitFor();
  await page.locator(".gg-view-cube").waitFor();
  assert.equal(await original.evaluate((canvas) => canvas.isConnected), false);
  await row(page, /Pilar[ _]01/).first().waitFor();
  report.recovery = { badGlbPreserved: true, badManifestPreserved: true, asyncCancelPreserved: true, artificialContextLossRecovered: true };

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("Armazenamento local desativado para teste.", "SecurityError"); },
    });
  });
  const blockedPage = await blocked.newPage();
  blockedPage.on("pageerror", (error) => report.problems.push(error.message));
  await blockedPage.goto(origin + "/viewer?demo=basic", { waitUntil: "networkidle" });
  await row(blockedPage, /Pilar[ _]01/).first().waitFor();
  await blockedPage.getByRole("tab", { name: "Camadas" }).click();
  await button(blockedPage, "+ Camada").click();
  await blockedPage.getByPlaceholder("Nome da camada…").fill("Camada em memória");
  await button(blockedPage, "Salvar").click();
  await row(blockedPage, "Camada em memória").first().waitFor();
  await blockedPage.getByText("O armazenamento local está indisponível.", { exact: false }).first().waitFor();
  report.recovery.storageBlocked = true;
  await blocked.close();
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.external, []);
  console.log("V0.9.1 production smoke, organization, import recovery and accessibility passed.");
} catch (error) {
  report.problems.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(join(out, "browser.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close();
  server.kill();
}
