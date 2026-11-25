import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const outDir = path.join(appDir, "test-results", "ui-audit");
mkdirSync(outDir, { recursive: true });

const port = Number(process.env.GEOGEN_UI_PORT ?? 3199);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    path.join(appDir, "node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: appDir,
    stdio: ["ignore", "pipe", "pipe"],
  }
);

async function waitForReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      // Wait for Next.js production server startup
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Next.js server did not become ready in time");
}

function summarizeAxe(res) {
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
}

async function main() {
  await waitForReady();
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) =>
      failedRequests.push(`${req.url()} (${req.failure()?.errorText})`)
    );
    page.on("request", (req) => {
      if (
        !req.url().startsWith(baseUrl) &&
        !req.url().startsWith("data:") &&
        !req.url().startsWith("blob:")
      ) {
        externalRequests.push(req.url());
      }
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outDir, "01-home-dark.png") });
    const axeHome = await new AxeBuilder({ page }).analyze();

    await page.locator(".gg-theme-toggle").click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, "02-home-light.png") });
    await page.locator(".gg-theme-toggle").click();

    await page.goto(`${baseUrl}/viewer`, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(outDir, "03-viewer-empty-desktop.png"),
    });

    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(appDir, "public/demos/estrutura.glb"));
    await page.locator("canvas").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(outDir, "04-viewer-loaded-desktop-dark.png"),
    });
    const axeViewerDark = await new AxeBuilder({ page }).analyze();

    const desktopMetrics = await page.evaluate(() => {
      const toolbar = document
        .querySelector(".gg-toolbar")
        ?.getBoundingClientRect();
      const axes = document.querySelector(".gg-axes")?.getBoundingClientRect();
      const canvas = document.querySelector("canvas")?.getBoundingClientRect();
      const toolbarAxesOverlap =
        toolbar && axes
          ? !(
              toolbar.right < axes.left ||
              toolbar.left > axes.right ||
              toolbar.bottom < axes.top ||
              toolbar.top > axes.bottom
            )
          : false;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        canvas,
        toolbarAxesOverlap,
      };
    });

    await page.keyboard.press("Control+k");
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(outDir, "05-command-palette.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    await page.locator(".gg-theme-toggle").click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(outDir, "06-viewer-loaded-desktop-light.png"),
    });
    const axeViewerLight = await new AxeBuilder({ page }).analyze();
    await page.locator(".gg-theme-toggle").click();
    await page.waitForTimeout(150);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "07-tablet-landscape.png") });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, "08-tablet-portrait.png") });
    await page.getByRole("button", { name: /estrutura/i }).click();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(outDir, "09-tablet-portrait-drawer.png"),
    });
    await page.locator(".gg-tablet-scrim").click();
    await page.waitForTimeout(200);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const mobileMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    await page.screenshot({ path: path.join(outDir, "10-smartphone.png") });
    await page.getByRole("button", { name: /propriedades/i }).click();
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(outDir, "11-smartphone-sheet.png"),
    });

    const summary = {
      outDir,
      desktopMetrics,
      mobileMetrics,
      consoleErrors,
      pageErrors,
      failedRequests,
      externalRequests,
      axeViolations: {
        home: summarizeAxe(axeHome),
        viewerDark: summarizeAxe(axeViewerDark),
        viewerLight: summarizeAxe(axeViewerLight),
      },
    };
    console.log(JSON.stringify(summary, null, 2));

    const hasFailures =
      consoleErrors.length > 0 ||
      pageErrors.length > 0 ||
      failedRequests.length > 0 ||
      externalRequests.length > 0 ||
      desktopMetrics.scrollWidth > desktopMetrics.innerWidth ||
      mobileMetrics.scrollWidth > mobileMetrics.innerWidth ||
      desktopMetrics.toolbarAxesOverlap ||
      summary.axeViolations.home.length > 0 ||
      summary.axeViolations.viewerDark.length > 0 ||
      summary.axeViolations.viewerLight.length > 0;

    if (hasFailures) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  server.kill();
  process.exit(1);
});
