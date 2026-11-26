import { mkdir, writeFile } from "node:fs/promises";
import { importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { alignmentFor, captureRevision, defaultAlignment } from "../src/lib/geogen/revisions/revision.ts";
import { diffRevisions } from "../src/lib/geogen/revisions/diff.ts";
import { matchRevisions } from "../src/lib/geogen/revisions/matching.ts";
import { collectQuantities, groupQuantities, summarizeQuantities } from "../src/lib/geogen/revisions/quantities.ts";
import { analyzeFabrication, defaultFabrication, summarizeFabrication } from "../src/lib/geogen/revisions/fabrication.ts";
import { makeBenchmarkFixture } from "./revision-benchmark-fixture.mjs";

const buffer = (bytes) => Uint8Array.from(bytes).buffer;
const rounded = (value) => Number(value.toFixed(3));
const out = new URL("../test-results/v07/", import.meta.url);
await mkdir(out, { recursive: true });
const measurements = [];

async function load(count, variant) {
  const fixture = makeBenchmarkFixture(count, variant);
  return captureRevision(await importGlbWithManifestPackage(buffer(fixture.glb), buffer(fixture.manifest), "model.glb"));
}

async function measure(count) {
  const timings = {};
  globalThis.gc?.();
  const before = process.memoryUsage();
  let mark = performance.now();
  const [a, b] = await Promise.all([load(count, false), load(count, true)]);
  const track = (name) => { timings[name] = rounded(performance.now() - mark); mark = performance.now(); };
  track("loadBothMs");
  const pairs = matchRevisions(a, b);
  track("matchingMs");
  const results = diffRevisions(a, b, pairs, alignmentFor(a, b, defaultAlignment).matrix, 0.0001);
  track("geometryAndDiffMs");
  const rows = [a, b].map((revision) => {
    const data = collectQuantities(revision);
    summarizeQuantities(data);
    summarizeFabrication(analyzeFabrication(revision, data, defaultFabrication));
    return data;
  });
  track("quantitiesAndFabricationMs");
  const modified = new Set(results.filter((row) => row.status === "modified").map((row) => row.baseId));
  const filtered = rows[0].filter((row) => modified.has(row.occurrence.id));
  track("filterMs");
  const model = groupQuantities(filtered, "category");
  const tableRows = [...model.groups.values()].flatMap((entries) => {
    const summary = summarizeQuantities(entries);
    return [summary, ...entries.map((entry) => [entry.occurrence.id, entry.occurrence.record.name])];
  });
  track("tableDataMs");
  const active = process.memoryUsage();
  const resources = new Set([a, b].flatMap((revision) =>
    revision.renderables.map((entry) => entry.mesh.geometry)));
  let disposed = 0;
  for (const geometry of resources) geometry.addEventListener("dispose", () => disposed++);
  a.scene.dispose();
  b.scene.dispose();
  track("disposeMs");
  return { count, ...timings, changed: modified.size, tableEntries: tableRows.length,
    usedGeometries: resources.size, disposedGeometries: disposed,
    processHeapDeltaMiB: rounded((active.heapUsed - before.heapUsed) / 2 ** 20) };
}

await measure(25);
for (const count of [100, 1000, 10000]) measurements.push(await measure(count));
const report = { environment: { node: process.version, platform: process.platform, arch: process.arch }, measurements };
await writeFile(new URL("cpu.json", out), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
