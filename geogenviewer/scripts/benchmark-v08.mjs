import { mkdir, writeFile } from "node:fs/promises";
import { importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { captureRevision } from "../src/lib/geogen/revisions/revision.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";
import { catalogEntries, catalogTypes, defaultTypes, occurrenceItems, projectSearch } from "../src/lib/geogen/documentation/catalog.ts";
import { defaultLayout, layoutKnolling } from "../src/lib/geogen/documentation/knolling.ts";
import { KnollingPose } from "../src/lib/geogen/documentation/knolling-pose.ts";
import { annotationModel } from "../src/lib/geogen/documentation/callouts.ts";
import { defaultDocumentation } from "../src/lib/geogen/documentation/document.ts";
import { sheetPage } from "../src/lib/geogen/documentation/sheets.ts";
import { makeBenchmarkFixture } from "./revision-benchmark-fixture.mjs";

const arrayBuffer = (value) => Uint8Array.from(value).buffer;
const round = (value) => Number(value.toFixed(3));
const results = new URL("../test-results/v08/", import.meta.url);
await mkdir(results, { recursive: true });

async function benchmark(count) {
  globalThis.gc?.();
  const before = process.memoryUsage().heapUsed;
  const input = makeBenchmarkFixture(count, false);
  let time = performance.now();
  const times = {};
  const mark = (key) => { times[key] = round(performance.now() - time); time = performance.now(); };
  const revision = captureRevision(await importGlbWithManifestPackage(arrayBuffer(input.glb), arrayBuffer(input.manifest), "model.glb"));
  mark("importMs");
  const rows = catalogEntries(revision, compileAssembly([]), new Map());
  const items = occurrenceItems(rows);
  mark("catalogMs");
  const groups = catalogTypes(rows, defaultTypes);
  mark("groupingMs");
  const config = defaultLayout(Math.max(...revision.scene.sceneGraph.sceneBoundsMeters));
  const layout = layoutKnolling(items, { ...config, columns: Math.ceil(Math.sqrt(count)) });
  mark("layoutMs");
  layoutKnolling(items, { ...config, mode: "shelf", orientation: "quarter" });
  mark("updateMs");
  const pose = new KnollingPose(revision);
  for (const amount of [0.2, 0.4, 0.6, 0.8, 1, 0]) pose.apply(layout, amount);
  mark("sixPoseUpdatesMs");
  const found = rows.filter((row) => projectSearch(row, "bench-" + (count - 1)));
  mark("filterMs");
  const settings = defaultDocumentation(revision);
  sheetPage(revision, { ...settings.sheet, template: "knolling" }, items, [], [], null);
  mark("sheetDataMs");
  const annotations = annotationModel(new Map(rows.map((row) => [row.occurrence.id, row])), [], rows, new Set());
  mark("annotationModelMs");
  const target = process.memoryUsage().heapUsed;
  const resources = new Set(revision.renderables.map((item) => item.mesh.geometry));
  let disposed = 0;
  for (const geometry of resources) geometry.addEventListener("dispose", () => disposed++);
  revision.scene.dispose();
  mark("disposeMs");
  return { count, ...times, types: groups.length, matches: found.length, labels: annotations.length,
    placed: layout.placements.length, usedGeometries: resources.size, disposedGeometries: disposed,
    heapDeltaMiB: round((target - before) / 2 ** 20) };
}
await benchmark(25);
const measurements = [];
for (const count of [100, 1000, 10000]) measurements.push(await benchmark(count));
const report = { environment: { node: process.version, platform: process.platform, arch: process.arch }, measurements };
await writeFile(new URL("cpu.json", results), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
