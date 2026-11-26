import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Matrix4 } from "three";
import { importGlbBasicPackage, importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { alignmentFor, captureRevision, defaultAlignment, needsProjectAssociation, reverseAlignment } from "../src/lib/geogen/revisions/revision.ts";
import { matchRevisions, validateManual } from "../src/lib/geogen/revisions/matching.ts";
import { diffRevisions } from "../src/lib/geogen/revisions/diff.ts";
import { compareShape, meshMetrics } from "../src/lib/geogen/revisions/geometry.ts";
import { analyzeFabrication, defaultFabrication, summarizeFabrication } from "../src/lib/geogen/revisions/fabrication.ts";
import { collectQuantities, groupQuantities, numeric, summarizeQuantities } from "../src/lib/geogen/revisions/quantities.ts";
import { parseComparison, parseFabrication } from "../src/lib/geogen/revisions/documents.ts";
import { readInspection, pairInspections } from "../src/lib/geogen/revisions/inspection.ts";
import { csv, differencesCsv, numericDelta, quantitiesCsv } from "../src/lib/geogen/revisions/reports.ts";

const fixture = new URL("../public/demos/revision-lab/", import.meta.url);
const read = (file, encoding) => readFile(new URL(file, fixture), encoding);
const expected = JSON.parse(await read("expected-differences.json", "utf8"));
const expectedQuantities = JSON.parse(await read("expected-quantities.json", "utf8"));
const toArrayBuffer = (value) => Uint8Array.from(value).buffer;
const glbA = toArrayBuffer(await read("proto-01/model.glb"));
const glbB = toArrayBuffer(await read("proto-02/model.glb"));
const load = async (file, bytes) => captureRevision(await importGlbWithManifestPackage(
  bytes, toArrayBuffer(await read(file + "/manifest.json")), "model.glb"));
const base = await load("proto-01", glbA);
const next = await load("proto-02", glbB);
const space = alignmentFor(base, next, defaultAlignment);
const compare = (manual = []) => diffRevisions(base, next, matchRevisions(base, next, manual), space.matrix, expected.toleranceM);
const byBase = (rows, id) => rows.find((row) => row.baseId === id);
const byNext = (rows, id) => rows.find((row) => row.comparisonId === id);
const close = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, a + " != " + b);
test.after(() => { base.scene.dispose(); next.scene.dispose(); });

test("V0.7: IDs persistentes, ocorrências independentes e caminho de instância", () => {
  const rows = compare();
  assert.notEqual(base.occurrences.get("same").key, next.occurrences.get("same").key);
  for (const id of expected.stable) assert.equal(byBase(rows, id).status, "unchanged", id);
  assert.equal(byBase(rows, "block-a").comparisonId, "block-a");
  assert.equal(byBase(rows, "old-id").comparisonId, "new-id");
  assert.equal(byBase(rows, "old-id").method, "persistent");
  assert.equal(base.occurrences.get("block-a").parts[0].geometry, base.occurrences.get("block-b").parts[0].geometry);
});

test("V0.7: Part IDs repetidos exigem resolução e decisão manual pode substituir ou rejeitar", () => {
  const rows = compare();
  for (const id of expected.ambiguous) assert.equal((byBase(rows, id) ?? byNext(rows, id)).status, "unresolved");
  assert.equal(byBase(rows, "repeat-a1").candidateCount, 2);
  const manual = [{ baseId: "repeat-a1", comparisonId: "repeat-b2", replacement: true },
    { baseId: "repeat-a2", comparisonId: null }];
  const resolved = compare(manual);
  assert.equal(byBase(resolved, "repeat-a1").method, "manual");
  assert.ok(byBase(resolved, "repeat-a1").changes.includes("replacement"));
  assert.equal(byBase(resolved, "repeat-a2").status, "removed");
  assert.throws(() => validateManual(base, next, [...manual, manual[0]]), /repetida/);
  assert.throws(() => validateManual(base, next, [{ baseId: "missing", comparisonId: "repeat-b1" }]), /indisponível/);
});

test("V0.7: GUID de topo compartilhado permanece sugestão mesmo depois de correspondências estáveis", () => {
  const derive = (revision, id) => {
    const first = revision.occurrences.get("block-a"), second = revision.occurrences.get("block-b");
    const strip = (item, key) => ({ ...item, id: key, record: { ...item.record, instancePath: null } });
    return { ...revision, occurrences: new Map([["block-a", strip(first, "block-a")], [id, strip(second, id)]]) };
  };
  const rows = matchRevisions(derive(base, "unlinked-a"), derive(next, "unlinked-b"));
  assert.equal(byBase(rows, "block-a").method, "persistent");
  assert.equal(byBase(rows, "unlinked-a").confirmed, false);
});

test("V0.7: GLB-only aceita associação explícita e nunca toma nome de nó como identidade", async () => {
  const packages = await Promise.all([importGlbBasicPackage(glbA, "iguais.glb"), importGlbBasicPackage(glbB, "iguais.glb")]);
  try {
    const [a, b] = packages.map(captureRevision);
    assert.ok(needsProjectAssociation(a, b));
    assert.throws(() => matchRevisions(a, b), /explicitamente/);
    assert.ok(matchRevisions(a, b, [], true).every((row) => row.method !== "persistent"));
    const foreign = { ...next, identity: { ...next.identity, projectId: "outro" } };
    assert.throws(() => matchRevisions(base, foreign), /explicitamente/);
    assert.equal(byBase(matchRevisions(base, foreign, [], true), "same").comparisonId, null);
  } finally { packages.forEach((entry) => entry.dispose()); }
});

test("V0.7: adições, remoções e mudanças geométricas, semânticas e de pose são independentes", () => {
  const rows = compare();
  for (const [id, changes] of Object.entries(expected.modified)) {
    assert.equal(byBase(rows, id).status, "modified", id);
    assert.deepEqual([...byBase(rows, id).changes].sort(), changes.sort(), id);
  }
  assert.equal(byBase(rows, expected.removed).status, "removed");
  assert.equal(byNext(rows, expected.added).status, "added");
  assert.equal(byBase(rows, "moved").shape, "identical");
  assert.equal(byBase(rows, "rotated").shape, "identical");
  assert.equal(byBase(rows, "scaled").shape, "identical");
  const object = base.scene.objectByComponentId.get("same");
  const restore = object.position.clone();
  object.position.x += 2;
  try { assert.equal(byBase(compare(), "same").status, "unchanged"); }
  finally { object.position.copy(restore); object.updateMatrixWorld(true); }
});

test("V0.7: retesselação planar, tolerância e ausência de forma", () => {
  const rows = compare();
  assert.equal(byBase(rows, "tess").shape, "mesh-different");
  assert.equal(byBase(rows, "tess").status, "unchanged");
  const a = base.occurrences.get("size"), b = next.occurrences.get("size");
  assert.equal(compareShape(a, b, 0.0001), "above-tolerance");
  assert.equal(compareShape(a, b, 0.02), "mesh-different");
  assert.equal(compareShape({ ...a, parts: [] }, b, 0.02), "inconclusive");
});

test("V0.7: origens em mm e m, deslocamento manual, rotação e escala física", () => {
  assert.equal(space.sourceAvailable, true);
  assert.deepEqual(space.matrix.elements.slice(12, 15), expected.sourceOffsetM);
  const manual = alignmentFor(base, next, { source: false, translationM: [1, 2, 3], rotationDeg: [0, 90, 0] });
  close(manual.matrix.elements[2], -1);
  assert.deepEqual(manual.matrix.elements.slice(12, 15), [1, 2, 3]);
  const other = { ...next, identity: { ...next.identity, scaleDenominator: 100 } };
  assert.equal(alignmentFor(base, other, defaultAlignment).differentScale, true);
  assert.deepEqual(alignmentFor(base, other, defaultAlignment).matrix.elements, new Matrix4().elements);
});

test("V0.7: inverter revisões conserva o alinhamento como transformação inversa", () => {
  const config = { source: true, translationM: [0.01, -0.025, 0.05], rotationDeg: [4, 19, -27] };
  const a = alignmentFor(base, next, config).matrix;
  const b = alignmentFor(next, base, reverseAlignment(next, base, config)).matrix;
  const identity = new Matrix4().elements;
  a.multiply(b).elements.forEach((value, index) => close(value, identity[index]));
});

test("V0.7: quantitativos distinguem ocorrências, geometrias compartilhadas, compósitos e grupos", () => {
  const rows = collectQuantities(base);
  const quantities = summarizeQuantities(rows);
  for (const key of ["components", "occurrences", "blocks", "types"]) assert.equal(quantities[key], expectedQuantities[key]);
  assert.ok(quantities.uniqueGeometries < quantities.occurrences);
  assert.equal(rows.find((row) => row.occurrence.id === "compound").occurrence.parts.length, 2);
  const grouped = groupQuantities(rows, "group");
  assert.equal(grouped.overlapping, true);
  assert.equal(summarizeQuantities([...grouped.groups.values()].flat()).components, rows.length);
  assert.equal(collectQuantities(base, new Set(["open"])).length, 1);
  const open = rows.find((row) => row.occurrence.id === "open");
  assert.equal(open.volume, null);
  assert.equal(meshMetrics(open.occurrence).volumeM3, null);
  assert.equal(quantities.volumeCoverage.excluded, 1);
  close(quantities.volume["volume-cad"].subtotal, expectedQuantities.knownCadVolumeM3);
});

test("V0.7: massas, moedas, cenários, nulos e proveniência de fabricação", () => {
  const rows = collectQuantities(next);
  const data = analyzeFabrication(next, rows, defaultFabrication);
  const find = (id) => data.find((entry) => entry.id === id);
  close(find("same").mass.solid.value, 0.00024 * 1100);
  assert.equal(find("same").mass.measured.value, 0);
  assert.equal(find("same").mass.measured.source, "cad");
  assert.equal(find("size").mass.slicer.value, 0.12);
  assert.equal(find("open").density, null);
  assert.equal(find("layer").rate, null);
  assert.equal(find("material").time.machine.value, 360);
  assert.ok(summarizeFabrication(data).costs["BRL solid"]);
  assert.ok(summarizeFabrication(data).costs["EUR solid"]);
  for (const invalid of [null, "", true, "-1", Infinity, {}, "missing"]) assert.equal(numeric(invalid), null);
  const settings = { ...defaultFabrication,
    materials: [{ code: "sim", name: "Simulado", densityKgM3: 1000, costPerKg: 20, currency: "USD", source: "Ensaio", notes: "" }],
    scenarios: [{ name: "alternativo", materialCode: "sim", replaces: "sample-a" }], activeScenario: "alternativo",
    authored: { same: { measured: { value: 0.09, source: "Balança" } } },
  };
  const simulation = analyzeFabrication(next, rows, settings).find((entry) => entry.id === "same");
  assert.equal(simulation.mass.solid.source, "scenario");
  close(simulation.mass.solid.value, 0.24);
  assert.equal(simulation.mass.measured.detail, "Balança");
  assert.deepEqual(simulation.costs.map((cost) => [cost.currency, cost.method]), [["USD", "solid"]]);
  assert.equal(find("same").material, "sample-a");
});

test("V0.7: inspeções exatas, referência removida, retenção de registro inválido e revisão manual", async () => {
  const a = readInspection(await read("proto-01/inspection.json", "utf8"), base);
  const b = readInspection(await read("proto-02/inspection.json", "utf8"), next);
  assert.equal(a.length, 2);
  assert.equal(b[1].invalid, true);
  const pairs = pairInspections(a, b, compare(), new Set());
  assert.equal(pairs[0].valid, true);
  assert.equal(pairs[0].delta, null);
  assert.equal(pairs[1].removed, true);
  const accepted = pairInspections(a, b, compare(), new Set([pairs[0].key]));
  close(accepted[0].delta.absolute, 0.03);
  await assert.rejects(async () => readInspection(await read("proto-02/inspection.json", "utf8"), base), /outro modelo/);
});

test("V0.7: schemas, ordem de referência, dados malformados, CSV e delta com zero", () => {
  const date = "2026-11-26T12:00:00.000Z";
  const rows = compare();
  const comparison = { schemaVersion: "1.0.0", generatedAt: date, base: base.identity, comparison: next.identity,
    associated: false, toleranceM: 0.0001, alignment: defaultAlignment, manual: [], filter: "modified", differences: rows };
  assert.equal(parseComparison(JSON.stringify(comparison), base, next).filter, "modified");
  assert.throws(() => parseComparison(JSON.stringify(comparison), next, base), /hashes/);
  assert.throws(() => parseComparison(JSON.stringify({ ...comparison, toleranceM: -1 }), base, next), /inválido/);
  const fabrication = { schemaVersion: "1.0.0", generatedAt: date, revision: base.identity, settings: defaultFabrication,
    scope: "all", grouping: "material", property: "", scopeValue: "" };
  assert.equal(parseFabrication(JSON.stringify(fabrication), base).grouping, "material");
  assert.throws(() => parseFabrication("{", base), /JSON inválido/);
  assert.throws(() => parseFabrication(JSON.stringify(fabrication), next), /outra revisão/);
  assert.throws(() => parseFabrication(JSON.stringify({ ...fabrication, settings: { ...defaultFabrication, authored: {
    nonexistent: { measured: { value: 1, source: "fixture" } },
  } } }), base), /inválidos/);
  const quantity = collectQuantities(base);
  assert.match(quantitiesCsv(base, quantity, analyzeFabrication(base, quantity, defaultFabrication), "all", date), /"sha256".*"scope"/);
  assert.match(differencesCsv(base, next, rows, 0.0001, date), /"removed","","removed"/);
  assert.equal(csv([["=1+1", 'texto "entre aspas"', -4, null]]), '\uFEFF"\'=1+1","texto ""entre aspas""","-4",""\r\n');
  assert.deepEqual(numericDelta(0, 4), { absolute: 4, percent: null });
});
