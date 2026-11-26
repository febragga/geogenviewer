
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BoxGeometry, Color, Group, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { importGlbBasicPackage, importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { validateGlb } from "../src/lib/geogen/importers/glb.ts";
import { checkOrganizationCompatibility, parseAndValidateOrganization } from "../src/lib/geogen/organization/document.ts";
import { createEmptyOrganization } from "../src/lib/geogen/organization/model.ts";
import { InstancedBatchManager } from "../src/features/viewer/scene/instancing.ts";
import { useOrganizationStore } from "../src/features/viewer/state/organization-store.ts";
import { preferenceKey, readLocalList, validFilters, validNamedView } from "../src/features/viewer/state/local-preferences.ts";
import { hiddenByGroups } from "../src/lib/geogen/domain/visibility.ts";
import { createUserGroup, moveUserGroup } from "../src/lib/geogen/organization/operations.ts";
import { captureRevision } from "../src/lib/geogen/revisions/revision.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";
import { AssemblyPose } from "../src/lib/geogen/assembly/pose.ts";
import { defaultExplodeParams, ExplodedViewController } from "../src/lib/geogen/explode/controller.ts";
import { catalogEntries, occurrenceItems } from "../src/lib/geogen/documentation/catalog.ts";
import { defaultLayout, layoutKnolling } from "../src/lib/geogen/documentation/knolling.ts";
import { KnollingPose } from "../src/lib/geogen/documentation/knolling-pose.ts";

function glbJson(json) {
  const payload = Buffer.from(json.padEnd(Math.ceil(Buffer.byteLength(json) / 4) * 4));
  const file = Buffer.alloc(20 + payload.length);
  file.write("glTF", 0);
  file.writeUInt32LE(2, 4);
  file.writeUInt32LE(file.length, 8);
  file.writeUInt32LE(payload.length, 12);
  file.write("JSON", 16);
  payload.copy(file, 20);
  return Uint8Array.from(file).buffer;
}

test("V0.9.1 GLB preflight rejects non-finite transforms, invalid scene references and unsafe metadata", () => {
  const wrap = (fields) => glbJson('{"asset":{"version":"2.0"},' + fields + '}');
  assert.doesNotThrow(() => validateGlb(wrap('"nodes":[{"translation":[0,1,2]}],"scenes":[{"nodes":[0]}]')));
  for (const fields of [
    '"nodes":[{"translation":[1e999,1,2]}]',
    '"nodes":[{"scale":[1,2]}]',
    '"nodes":[{"matrix":[1,0,0]}]',
    '"nodes":[null]',
    '"nodes":[{}],"scenes":[{"nodes":[1]}]',
    '"nodes":[{"children":[1]},{}],"scenes":[{"nodes":[0,1]}]',
    '"nodes":[{"extras":{"__proto__":{"unexpected":true}}}]',
  ]) {
    assert.throws(() => validateGlb(wrap(fields)), /GLB/);
  }
  assert.throws(() => validateGlb(wrap('"images":[{"uri":"https://example.invalid/a.png"}]')), /buffers e imagens/);
});

test("V0.9.1 CAD aliases cannot claim the same mesh twice under distinct occurrence IDs", async () => {
  const glb = await readFile(new URL("../public/demos/contrato-exemplo.glb", import.meta.url));
  const manifest = JSON.parse(await readFile(new URL("../public/demos/contrato-exemplo.manifest.json", import.meta.url), "utf8"));
  const element = manifest.elements[0];
  manifest.geometry.nodeMatchStrategy = "nameExact";
  manifest.elements = [element, { ...element, id: "another-occurrence" }];
  const packageBytes = Uint8Array.from(glb).buffer;
  const decoded = await importGlbBasicPackage(packageBytes, "fixture.glb");
  const glbNodeName = decoded.objectByComponentId.get(element.id).name;
  decoded.dispose();
  manifest.elements[0] = { ...element, glbNodeName };
  manifest.elements[1].glbNodeName = glbNodeName;
  delete manifest.assembly;
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  await assert.rejects(importGlbWithManifestPackage(Uint8Array.from(glb).buffer, json.buffer, "fixture.glb"),
    (error) => error.code === "DUPLICATE_NODE_OWNER");
});

test("V0.9.1 organization scopes hash, project and revision before binding members", () => {
  const binding = { key: "runtime", projectId: "project", revisionId: "r02", modelSha256: "a".repeat(64) };
  const graph = { projectTitle: "Projeto", componentOrder: ["p1"], layers: {}, groups: {} };
  assert.equal(checkOrganizationCompatibility(createEmptyOrganization(binding), graph, binding).status, "match");
  const priorRevision = createEmptyOrganization({ ...binding, revisionId: "r01" });
  assert.equal(checkOrganizationCompatibility(priorRevision, graph, binding).status, "mismatch");
  const legacyTitle = createEmptyOrganization({ ...binding, projectId: graph.projectTitle });
  assert.equal(checkOrganizationCompatibility(legacyTitle, graph, binding).sanitized.projectId, "project");
  assert.equal(checkOrganizationCompatibility(createEmptyOrganization(), graph, binding).status, "mismatch");
});

test("V0.9.1 batching leaves transparent, mirrored and hidden-ancestor meshes on their original render path", () => {
  const geometry = new BoxGeometry();
  const opaque = new MeshStandardMaterial();
  const transparent = new MeshStandardMaterial({ transparent: true, opacity: 0.5 });
  const source = new Group();
  const host = new Group().add(source);
  const hidden = new Group();
  hidden.visible = false;
  source.add(hidden);
  const mixed = [new Mesh(geometry, transparent), new Mesh(geometry, opaque), new Mesh(geometry, opaque)];
  mixed[1].scale.x = -1;
  hidden.add(mixed[2]);
  source.add(mixed[0], mixed[1]);
  const manager = new InstancedBatchManager(source, host, (mesh) => mesh?.uuid ?? null, 1);
  try { assert.equal(manager.batches.length, 0); }
  finally { manager.dispose(); geometry.dispose(); opaque.dispose(); transparent.dispose(); }
});

test("V0.9.1 an instance remains pickable after it moves beyond the previous batch bounds", () => {
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const mesh = new Mesh(geometry, material);
  const source = new Group().add(mesh);
  const host = new Group().add(source);
  const manager = new InstancedBatchManager(source, host, (object) => object === mesh ? "piece" : null, 1);
  const batch = manager.batches[0].instancedMesh;
  const raycaster = new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1));
  const color = new Color("white");
  try {
    manager.applyDisplayAndVisibility({ mode: "material", opacity: 1, shadows: false, selected: new Set(),
      hovered: null, hidden: new Set(), isolated: null, ghosts: new Set(), colorForComponent: () => null,
      clayColor: color, selectionColor: color, hoverColor: color });
    host.updateMatrixWorld(true);
    assert.equal(manager.resolveHitComponentId(raycaster.intersectObject(batch)[0]), "piece");
    mesh.position.x = 60;
    manager.syncTransforms();
    raycaster.ray.origin.x = 60;
    const hit = raycaster.intersectObject(batch)[0];
    assert.ok(hit);
    assert.equal(manager.resolveHitComponentId(hit), "piece");
  } finally { manager.dispose(); geometry.dispose(); material.dispose(); }
});

test("V0.9.1 organization migrates proven legacy data, preserves in-memory edits on quota failure and clears redo on edit", () => {
  const binding = { key: "runt", projectId: "project", revisionId: "rev-a", modelSha256: "c".repeat(64) };
  const graph = { mode: "manifest-full", projectTitle: "Projeto", componentOrder: ["p1", "p2"], layers: {}, groups: {} };
  const legacy = { ...createEmptyOrganization(binding), projectId: graph.projectTitle, activeSource: "user" };
  const pairs = new Map([["geogen:v09:org:" + binding.modelSha256, JSON.stringify(legacy)]]);
  let quota = false;
  globalThis.window = { localStorage: {
    getItem: (key) => pairs.get(key) ?? null,
    setItem: (key, value) => { if (quota) throw new Error("quota"); pairs.set(key, value); },
  } };
  try {
    const store = useOrganizationStore.getState;
    store().initializeForRevision(graph, binding);
    assert.equal(store().doc.projectId, "project");
    quota = true;
    assert.equal(store().createLayer({ name: "Pilares", memberIds: ["p1", "p2"] }), true);
    assert.ok(store().persistenceNotice);
    const [layer] = store().doc.userLayers;
    assert.equal(store().doc.componentLayerAssignments.p2, layer.id);
    assert.equal(store().past.length, 1);
    store().undo();
    assert.equal(store().doc.componentLayerAssignments.p2, undefined);
    store().redo();
    assert.equal(store().doc.componentLayerAssignments.p1, layer.id);
    const prior = store().doc;
    const report = store().importJson(JSON.stringify({ ...prior, revisionId: "other" }), graph);
    assert.equal(report.status, "mismatch");
    assert.equal(store().doc, prior);
    store().undo();
    quota = false;
    store().createLayer({ name: "Outra camada" });
    assert.equal(store().future.length, 0);
    assert.notEqual(store().doc.userLayers[0].id, layer.id);
    store().initializeForRevision(graph, binding);
    assert.equal(store().doc.userLayers[0].name, "Outra camada");
    assert.equal(store().past.length, 0);
    store().initializeForRevision(graph, { ...binding, revisionId: "rev-b" });
    assert.equal(store().doc.userLayers.length, 0);
  } finally {
    useOrganizationStore.getState().initializeForRevision(null, null);
    delete globalThis.window;
  }
});

test("V0.9.1 showing one group never releases an overlapping restriction and group trees propagate masks", () => {
  const graph = { groups: { imported: { elementIds: ["shared"], childGroupIds: [] } } };
  const organization = { groups: {
    parent: { componentIds: ["first"], childIds: ["child"] },
    child: { componentIds: ["shared", "other"], childIds: [] },
    parallel: { componentIds: ["shared"], childIds: [] },
  } };
  assert.deepEqual([...hiddenByGroups(graph, ["user:parent", "user:parallel", "cad:imported"], organization)].sort(),
    ["first", "other", "shared"]);
  assert.deepEqual([...hiddenByGroups(graph, ["user:parallel"], organization)], ["shared"]);
  assert.equal(hiddenByGroups(graph, ["cad:imported"], organization).has("shared"), true);
});

test("V0.9.1 refusing an over-deep move preserves the whole group subtree", () => {
  let doc = createEmptyOrganization();
  function makeChain(prefix, count) {
    let root, prior;
    for (let i = 0; i < count; i++) {
      doc = createUserGroup(doc, { name: prefix + i, parentId: prior });
      prior = doc.userGroups.at(-1).id;
      root ??= prior;
    }
    return { root, leaf: prior };
  }
  const first = makeChain("A", 9);
  const second = makeChain("B", 8);
  assert.equal(moveUserGroup(doc, second.root, first.leaf), doc);
  assert.doesNotThrow(() => parseAndValidateOrganization(JSON.stringify(doc)));
});

test("V0.9.1 named views and filter presets separate same-size GLBs and ignore corrupt entries", () => {
  assert.notEqual(preferenceKey("views", undefined, "a.glb", 100, "a".repeat(64)),
    preferenceKey("views", undefined, "a.glb", 100, "b".repeat(64)));
  assert.equal(preferenceKey("filters", undefined, "a.glb", 100, null), null);
  assert.equal(validFilters({ userGroup: ["g1"] }), true);
  assert.equal(validFilters({ userGroup: 12 }), false);
  assert.equal(readLocalList("views", { getItem: () => '[{"id":"one","name":"inválida","pose":{}}]' }, validNamedView).length, 0);
});

test("V0.9.1 100 cycles of explode, assembly and knolling restore world matrices within 1e-8 m", async () => {
  const glb = await readFile(new URL("../public/demos/catalog-lab/rev-01/model.glb", import.meta.url));
  const manifest = await readFile(new URL("../public/demos/catalog-lab/rev-01/manifest.json", import.meta.url));
  const pkg = await importGlbWithManifestPackage(Uint8Array.from(glb).buffer, Uint8Array.from(manifest).buffer, "catalog.glb");
  try {
    const revision = captureRevision(pkg);
    const timeline = compileAssembly(pkg.manifest.assembly?.steps ?? []);
    const items = occurrenceItems(catalogEntries(revision, timeline, new Map()));
    const layout = layoutKnolling(items, defaultLayout(0.5));
    assert.ok(timeline.schedule.length);
    assert.ok(layout.placements.length);
    const knoll = new KnollingPose(revision);
    const assembly = new AssemblyPose(pkg.model.scene, pkg.objectByComponentId);
    const explode = new ExplodedViewController(pkg);
    explode.prepare({ ...defaultExplodeParams, enabled: true, mode: "radial" }, []);
    for (let index = 0; index < 100; index++) {
      explode.applyFactor((index + 1) / 100);
      explode.reset();
      assembly.apply(timeline, timeline.total * (index + 0.5) / 100, null, true);
      assembly.reset();
      knoll.apply(layout, (index + 1) / 100);
      knoll.reset();
    }
    pkg.model.scene.updateWorldMatrix(true, true);
    for (const [id, object] of pkg.objectByComponentId) {
      const rest = revision.occurrences.get(id).rest.elements;
      object.matrixWorld.elements.forEach((value, column) => assert.ok(Math.abs(value - rest[column]) < 1e-8, id));
    }
  } finally { pkg.dispose(); }
});

test("V0.9.1 the comparison batch keeps authored non-auto-updated matrices", () => {
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeTranslation(8, 4, 2);
  const root = new Group().add(mesh);
  root.position.x = 30;
  const batch = new InstancedBatchManager(root, root, () => "source", 1, true);
  const color = new Color("white");
  try {
    batch.applyDisplayAndVisibility({ mode: "material", opacity: 1, shadows: false, selected: new Set(),
      hovered: null, hidden: new Set(), isolated: null, ghosts: new Set(), colorForComponent: () => null,
      clayColor: color, selectionColor: color, hoverColor: color });
    const matrix = new Matrix4();
    batch.batches[0].instancedMesh.getMatrixAt(0, matrix);
    assert.deepEqual(matrix.elements, mesh.matrix.elements);
    assert.equal(matrix.elements[12], 8);
  } finally { batch.dispose(); geometry.dispose(); material.dispose(); }
});
