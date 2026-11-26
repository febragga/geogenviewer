import { mkdir, readFile, writeFile } from "node:fs/promises";
import { importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { alignmentFor, captureRevision, defaultAlignment } from "../src/lib/geogen/revisions/revision.ts";
import { diffRevisions } from "../src/lib/geogen/revisions/diff.ts";
import { matchRevisions } from "../src/lib/geogen/revisions/matching.ts";
import { collectQuantities, summarizeQuantities } from "../src/lib/geogen/revisions/quantities.ts";
import { analyzeFabrication, defaultFabrication, summarizeFabrication } from "../src/lib/geogen/revisions/fabrication.ts";
import { differencesCsv, quantitiesCsv } from "../src/lib/geogen/revisions/reports.ts";

const fixtures = new URL("../public/demos/revision-lab/", import.meta.url);
const out = new URL("../../docs/v07/examples/", import.meta.url);
await mkdir(out, { recursive: true });

async function load(name) {
  const bytes = (file) => readFile(new URL(name + "/" + file, fixtures)).then((data) => Uint8Array.from(data).buffer);
  const [glb, manifest] = await Promise.all([bytes("model.glb"), bytes("manifest.json")]);
  return captureRevision(await importGlbWithManifestPackage(glb, manifest, "model.glb"));
}

const [base, comparison] = await Promise.all([load("proto-01"), load("proto-02")]);
try {
  const toleranceM = 0.0001;
  const generatedAt = "2026-11-26T12:00:00.000Z";
  const schemaVersion = "1.0.0";
  const alignment = defaultAlignment;
  const differences = diffRevisions(base, comparison, matchRevisions(base, comparison),
    alignmentFor(base, comparison, alignment).matrix, toleranceM);
  const rows = collectQuantities(comparison);
  const settings = defaultFabrication;
  const components = analyzeFabrication(comparison, rows, settings);
  const json = (name, data) => writeFile(new URL(name, out), JSON.stringify(data, null, 2) + "\n");
  await Promise.all([
    writeFile(new URL("diferencas.csv", out), differencesCsv(base, comparison, differences, toleranceM, generatedAt)),
    writeFile(new URL("quantitativos.csv", out), quantitiesCsv(comparison, rows, components, "Modelo completo", generatedAt)),
    json("comparison.json", { schemaVersion, generatedAt, base: base.identity, comparison: comparison.identity,
      associated: false, toleranceM, alignment, manual: [], filter: null, differences }),
    json("fabrication-analysis.json", { schemaVersion, generatedAt, revision: comparison.identity, settings,
      scope: "all", grouping: "category", scopeValue: "", property: "", report: {
        scope: "all", includedIds: rows.map((row) => row.occurrence.id), excludedIds: [], components,
        summary: summarizeQuantities(rows), fabrication: summarizeFabrication(components),
        units: { mass: "kg", time: "s", volume: "m³", area: "m²" },
      } }),
  ]);
} finally { base.scene.dispose(); comparison.scene.dispose(); }
