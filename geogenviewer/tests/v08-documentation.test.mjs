import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Matrix4, OrthographicCamera, Plane, Vector3 } from "three";
import { importGlbBasicPackage, importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { captureRevision, alignmentFor, defaultAlignment } from "../src/lib/geogen/revisions/revision.ts";
import { diffRevisions } from "../src/lib/geogen/revisions/diff.ts";
import { matchRevisions } from "../src/lib/geogen/revisions/matching.ts";
import { collectModelSummary, groupModelSummary, summarizeModel } from "../src/lib/geogen/revisions/model-summary.ts";
import { defaultFabrication } from "../src/lib/geogen/revisions/fabrication.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";
import { parseInspection, inspectionIdentity } from "../src/lib/geogen/inspection/document.ts";
import { meshReferences } from "../src/lib/geogen/inspection/measurements.ts";
import { catalogEntries, catalogTypes, compareCatalog, defaultTypes, occurrenceItems, projectSearch, scopeCatalog } from "../src/lib/geogen/documentation/catalog.ts";
import { defaultLayout, layoutKnolling, planeBasis } from "../src/lib/geogen/documentation/knolling.ts";
import { KnollingPose } from "../src/lib/geogen/documentation/knolling-pose.ts";
import { annotationModel, annotationPoint, calloutText, makeCallout, projectCallouts } from "../src/lib/geogen/documentation/callouts.ts";
import { createDocumentation, defaultDocumentation, parseDocumentation } from "../src/lib/geogen/documentation/document.ts";
import { assemblyMoment, catalogCsv, partsList, sheetPage } from "../src/lib/geogen/documentation/sheets.ts";

const lab = new URL("../public/demos/catalog-lab/", import.meta.url);
const read = (file) => readFile(new URL(file, lab));
const bytes = (file) => read(file).then((data) => Uint8Array.from(data).buffer);
const expected = JSON.parse(await read("expected.json"));
async function load(key) {
  return captureRevision(await importGlbWithManifestPackage(
    await bytes(key + "/model.glb"), await bytes(key + "/manifest.json"), "model.glb"));
}
const a = await load("rev-01"), b = await load("rev-02");
const timeline = compileAssembly(a.scene.manifest.assembly.steps);
const diffs = diffRevisions(a, b, matchRevisions(a, b), alignmentFor(a, b, defaultAlignment).matrix, 0.0001);
const rows = catalogEntries(a, timeline, new Map(diffs.flatMap((diff) => diff.baseId ? [[diff.baseId, diff.status]] : [])));
const byId = new Map(rows.map((row) => [row.occurrence.id, row]));
const items = occurrenceItems(rows);
const baseSettings = { ...defaultLayout(0.5), ...expected.positionCheck, spacingM: expected.positionCheck.gapMeters };
const epsilon = 1e-9;
const approx = (a, b) => assert.ok(Math.abs(a - b) < epsilon, a + " != " + b);
test.after(() => { a.scene.dispose(); b.scene.dispose(); });

function disjoint(places, gap) {
  for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) {
    const a = places[i], b = places[j];
    assert.ok(a.x + a.w + gap <= b.x + epsilon || b.x + b.w + gap <= a.x + epsilon ||
      a.y + a.h + gap <= b.y + epsilon || b.y + b.h + gap <= a.y + epsilon,
    a.item.representative.occurrence.id + " overlaps " + b.item.representative.occurrence.id);
  }
}

test("V0.8: os cinco layouts são determinísticos, preservam dimensões e respeitam folgas nos três planos", () => {
  for (const plane of expected.positionCheck.planes) for (const mode of ["grid", "grouped", "shelf", "types", "assembly"]) {
    const settings = { ...baseSettings, plane, mode };
    const first = layoutKnolling(items, settings), second = layoutKnolling([...items].reverse(), settings);
    const extract = ({ placements }) => placements.map((item) => [item.item.key, item.x, item.y, item.w, item.h]);
    assert.deepEqual(extract(first), extract(second), plane + "/" + mode);
    assert.equal(first.placements.length, expected.components);
    disjoint(first.placements, settings.spacingM);
    if (mode === "grouped") assert.ok(first.groups.length >= 4);
    if (mode === "assembly") assert.equal(first.groups.at(-1).label, "Sem etapa autorada");
  }
});

test("V0.8: rotações, escalas não uniformes, compósitos e peças pequenas definem caixas conservadoras", () => {
  assert.equal(byId.get(expected.composite).occurrence.parts.length, 5);
  for (const orientation of ["preserve", "world", "quarter", "longest", "manual", "largestFace", "principalAxis"]) {
    const layout = layoutKnolling(items, { ...baseSettings, orientation, overrides: { "pilar-4": { rotation: 35, fixed: null } } });
    for (const item of layout.placements) {
      const occurrence = item.item.representative.occurrence;
      approx(item.world.determinant(), occurrence.rest.determinant());
      assert.ok(item.w > 0 && item.h > 0);
    }
    disjoint(layout.placements, baseSettings.spacingM);
  }
  assert.deepEqual(planeBasis("XY")[2].toArray(), [0, 1, 0]);
});

test("V0.8: posição fixada persiste, parâmetros são validados e posições incompatíveis geram erro", () => {
  const overrides = { base: { rotation: 0, fixed: [-0.2, -0.1] } };
  const layout = layoutKnolling(items, { ...baseSettings, columns: 4, overrides });
  const placed = layout.placements.find((entry) => entry.item.representative.occurrence.id === "base");
  assert.deepEqual([placed.x, placed.y], [-0.2, -0.1]);
  assert.ok(placed.fixed);
  disjoint(layout.placements, baseSettings.spacingM);
  assert.throws(() => layoutKnolling(items, { ...baseSettings, overrides: {
    ...overrides, laje: { rotation: 0, fixed: [-0.2, -0.1] },
  } }), /sobrepõem/);
  assert.throws(() => layoutKnolling(items, { ...baseSettings, columns: 0 }), /inválidos/);
});

test("V0.8: retorno de matriz, compósitos e instâncias sem deriva após ciclos", () => {
  const cached = new Map([...a.scene.objectByComponentId].map(([id, node]) => [id, node.matrixWorld.toArray()]));
  const pose = new KnollingPose(a);
  for (const orientation of ["longest", "largestFace", "principalAxis"]) for (let i = 0; i < 12; i++) {
    const layout = layoutKnolling(items, { ...baseSettings, orientation });
    pose.apply(layout, 0.37);
    pose.apply(layout, 1);
    for (const item of layout.placements) {
      const node = a.scene.objectByComponentId.get(item.item.representative.occurrence.id);
      node.matrixWorld.toArray().forEach((value, index) => approx(value, item.world.elements[index]));
    }
    pose.apply(layout, 0);
    for (const [id, node] of a.scene.objectByComponentId) assert.deepEqual(node.matrixWorld.toArray(), cached.get(id));
  }
});

test("Sprint A: etapas autoradas mantêm ordem, títulos repetidos continuam distintos e categorias não viram dependências", () => {
  const draft = timeline.schedule.map(({ step }, index) => index === 0 ? { ...step, title: "Etapa 1" } : step);
  const effective = compileAssembly(draft);
  const renamed = { ["step:" + draft[1].id]: "Pré-montagem" };
  const entries = catalogEntries(a, effective, new Map(), undefined, undefined, undefined, renamed, true);
  const result = layoutKnolling(occurrenceItems(entries), { ...baseSettings, mode: "assembly" });
  assert.match(result.groups[0].label, /^Etapa 01 — /);
  assert.equal(result.groups[1].label, "Etapa 02 — Pré-montagem");
  const baseline = scopeCatalog(entries, "assembly", "2 · " + draft[1].title, {});
  assert.deepEqual(baseline.map((row) => row.occurrence.id), draft[1].elementIds);
  const noSteps = catalogEntries(a, compileAssembly([]), new Map(), undefined, undefined, undefined, {}, true);
  assert.equal(noSteps.find((row) => row.category === "column").stepLabel, "Pilares");
  assert.ok(noSteps.every((row) => row.step === null));
  assert.equal(compileAssembly(draft).total, timeline.total);
});

test("Sprint A: resumo mantém cobertura, proveniência, ocorrências e agrupamento por etapa", () => {
  const ids = new Set(["base", "pilar-1", "pilar-2", "viga-principal-a"]);
  const { rows, fabrication } = collectModelSummary(a, ids, defaultFabrication);
  const totals = summarizeModel(rows, fabrication);
  assert.equal(totals.components, 4);
  assert.equal(totals.occurrences, 4);
  assert.ok(totals.types > 0);
  assert.ok(totals.area["area-triangles"].subtotal > 0);
  assert.ok(totals.length.subtotal > 0 && totals.length.excluded > 0);
  assert.equal(totals.mass.slicer.included, 1);
  const groups = groupModelSummary(a, rows, fabrication, timeline, "assembly");
  assert.ok(groups.some(({ label }) => label?.startsWith("Etapa")));
  assert.equal(groups.reduce((sum, group) => sum + group.rows.length, 0), rows.length);
  for (const grouping of ["category", "layer", "material", "type"]) {
    assert.equal(groupModelSummary(a, rows, fabrication, timeline, grouping).flatMap(({ rows }) => rows).length, 4);
  }
  const unknown = summarizeModel([], []);
  assert.equal(unknown.length.subtotal, null);
  assert.equal(unknown.mass.solid.subtotal, null);
});

test("V0.8: tipos autorados preservam quantidade, repetição, variantes e autorização manual", () => {
  assert.equal(items.length, expected.components);
  assert.equal(items.filter((item) => item.representative.category === "column").length, expected.columns);
  assert.equal(byId.get(expected.missingType).type, null);
  assert.equal(rows.filter((row) => row.part === "P-01").length, 4);
  const separated = catalogTypes(rows, defaultTypes).filter((item) => item.label === "PILAR");
  assert.deepEqual(separated.map((item) => item.quantity).sort(), expected.pilarVariants);
  assert.ok(separated.every((item) => item.inconsistent));
  const grouped = catalogTypes(rows, { ...defaultTypes, confirmed: ["PILAR"], overrides: { apoio: "APOIO" } });
  assert.equal(grouped.find((item) => item.label === "PILAR").quantity, expected.typePilar);
  assert.equal(grouped.find((item) => item.label === "APOIO").representative.occurrence.id, "apoio");
});

test("V0.8: busca, escopos, revisão, valores ausentes e proveniência", () => {
  const ctx = { selected: new Set(["base"]), visible: new Set(["laje"]), filtered: new Set(["base", "laje"]) };
  assert.deepEqual(scopeCatalog(rows, "group", "Revisão", ctx).map((row) => row.occurrence.id), expected.groupOverlap);
  assert.equal(scopeCatalog(rows, "selected", "", ctx).length, 1);
  assert.equal(scopeCatalog(rows, "filtered", "", ctx).length, 2);
  assert.equal(scopeCatalog(rows, "visible", "", ctx)[0].occurrence.id, "laje");
  assert.equal(scopeCatalog(rows, "modified", "", ctx)[0].occurrence.id, expected.modified);
  assert.ok(projectSearch(byId.get("viga-secundaria"), "secundaria"));
  assert.equal([...rows].sort((a, b) => compareCatalog(a, b, "length"))[0].occurrence.id, "viga-secundaria");
  assert.equal(byId.get("base").occurrence.record.cad.dimensions, null);
  assert.equal(byId.get("laje").fabrication.density, null);
  assert.equal(byId.get("viga-principal-a").fabrication.mass.slicer.source, "cad");
  assert.equal(diffs.find((diff) => diff.baseId === expected.removed).status, "removed");
  assert.equal(diffs.find((diff) => diff.comparisonId === expected.added).status, "added");
});

test("V0.8: callout local acompanha a pose, visibilidade e clipping, e evita caixas sobrepostas", () => {
  const label = makeCallout(byId.get("base"), "L01", "number");
  assert.equal(calloutText(byId.get("base"), label, 0), "01");
  const center = annotationPoint(a, label);
  const pose = new KnollingPose(a);
  const layout = layoutKnolling(items, baseSettings);
  pose.apply(layout, 1);
  try {
    assert.ok(center.distanceTo(annotationPoint(a, label)) > 0.02);
    const camera = new OrthographicCamera(-4, 4, 4, -4, 0.01, 20);
    camera.position.set(0, 4, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const authors = [label, { ...label, id: "L02" }, { ...label, id: "L03", visible: false }];
    const model = annotationModel(byId, authors, [], new Set(["base"]));
    assert.equal(model.length, 2);
    const world = (id) => a.scene.objectByComponentId.get(id)?.matrixWorld;
    const draw = (planes, mask = world) => projectCallouts(model, camera, 500, 400, mask, planes, () => 60);
    assert.equal(draw([]).length, 2);
    disjoint(draw([]).map((box) => ({ ...box, item: items[0] })), 0);
    assert.equal(draw([new Plane(new Vector3(-1, 0, 0), -20)]).length, 0);
    assert.equal(draw([], () => undefined).length, 0);
  } finally { pose.reset(); }
});

test("V0.8: montagem autorada, ficha técnica, medidas, longos textos e CSV sanitizado", async () => {
  const before = assemblyMoment(timeline, 1, "before", 0.5), during = assemblyMoment(timeline, 1, "during", 0.5);
  const after = assemblyMoment(timeline, 1, "after", 0.5);
  assert.equal(timeline.schedule.length, expected.assemblySteps);
  assert.deepEqual(before.previously, ["base"]);
  assert.deepEqual(before.installed, []);
  assert.equal(during.installed.length, 4);
  approx(during.offsets.get("pilar-1")[1], 0.09);
  assert.equal(after.offsets.size, 0);
  assert.equal(assemblyMoment(compileAssembly([]), 0, "before", 0), null);
  const settings = defaultDocumentation(a);
  const inspection = meshReferences(a.scene.model.scene, a.scene.objectByComponentId);
  const records = parseInspection((await read("rev-01/inspection.json")).toString(), inspectionIdentity(a.scene), new Set(a.occurrences.keys()), inspection.valid);
  const beam = items.find((item) => item.representative.occurrence.id === "viga-principal-a");
  const page = sheetPage(a, { ...settings.sheet, notes: "observação ".repeat(200), page: "A3" }, [beam], records.measurements, [], null);
  assert.equal(page.partIds.length, 1);
  assert.ok(page.groups.some((group) => group.lines.some((line) => line.value === "480 mm" && line.provenance === "mesh · rest")));
  assert.ok(page.groups.some((group) => group.title === "Fabricação"));
  assert.deepEqual(partsList([beam], []).map((part) => part.members), [["viga-principal-a"]]);
  const unsafe = { ...beam, representative: { ...beam.representative, part: "=CMD()" } };
  assert.match(catalogCsv(a, [unsafe], []), /"'=CMD\(\)"/);
});

test("V0.8: documento validado por hash e referência, com GLB-only", async () => {
  const settings = defaultDocumentation(a);
  settings.callouts = [makeCallout(byId.get("base"), "base-c")];
  const document = createDocumentation(a, settings, "knolling", { count: rows.length }, "2026-11-26T12:00:00.000Z");
  const text = JSON.stringify(document);
  assert.equal(parseDocumentation(text, a).settings.callouts[0].elementId, "base");
  assert.throws(() => parseDocumentation(text, b), /outro GLB/);
  assert.throws(() => parseDocumentation("[", a), /inválido/);
  assert.throws(() => parseDocumentation(JSON.stringify({ ...document, schemaVersion: "0" }), a), /inválido/);
  settings.callouts[0].elementId = "missing";
  assert.throws(() => parseDocumentation(JSON.stringify(document), a), /referências/);
  const basic = captureRevision(await importGlbBasicPackage(await bytes("rev-01/model.glb"), "model.glb"));
  try {
    const basicRows = catalogEntries(basic, compileAssembly([]), new Map());
    assert.ok(basicRows.length >= expected.components);
    assert.ok(layoutKnolling(occurrenceItems(basicRows), defaultLayout(0.5)).placements.length >= expected.components);
    assert.equal(parseDocumentation(JSON.stringify(createDocumentation(basic, defaultDocumentation(basic), "catalog")), basic).identity.projectId, null);
  } finally { basic.scene.dispose(); }
});

test("V0.8: matrices de orientação independem da pose temporária", () => {
  const matrix = new Matrix4().makeRotationY(0.35);
  const scale = matrix.determinant();
  assert.ok(scale > 0);
  const initial = layoutKnolling(items, baseSettings);
  const pose = new KnollingPose(a);
  pose.apply(initial, 0.5);
  try {
    assert.deepEqual(layoutKnolling(items, baseSettings).placements.map((p) => p.world.elements),
      initial.placements.map((p) => p.world.elements));
  } finally { pose.reset(); }
});
