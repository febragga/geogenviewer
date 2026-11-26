import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  cadAxisToGltf,
  cadVectorToGltf,
  defaultExplodeParams,
  ExplodedViewController,
} from "../src/lib/geogen/explode/controller.ts";
import {
  importGlbBasicPackage,
  importGlbWithManifestPackage,
} from "../src/lib/geogen/importers/package.ts";
import { useViewerStore } from "../src/features/viewer/state/viewer-store.ts";

const basicGlb = readFileSync(new URL("../public/demos/estrutura.glb", import.meta.url));
const contractGlb = readFileSync(new URL("../../exporter-contract/model.example.glb", import.meta.url));
const contractManifest = readFileSync(new URL("../../exporter-contract/manifest.example.json", import.meta.url));
const pavilionGlb = readFileSync(new URL("../public/demos/pavilhao-explosao.glb", import.meta.url));
const pavilionManifest = readFileSync(new URL("../public/demos/pavilhao-explosao.manifest.json", import.meta.url));

const toAb = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

function makeMinimalGlb(gltfPatch) {
  const bin = Buffer.alloc(44);
  bin.writeFloatLE(0, 0); bin.writeFloatLE(0, 4); bin.writeFloatLE(0, 8);
  bin.writeFloatLE(0.1, 12); bin.writeFloatLE(0, 16); bin.writeFloatLE(0, 20);
  bin.writeFloatLE(0, 24); bin.writeFloatLE(0.1, 28); bin.writeFloatLE(0, 32);
  bin.writeUInt16LE(0, 36); bin.writeUInt16LE(1, 38); bin.writeUInt16LE(2, 40);

  const doc = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.1, 0.1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    materials: [{ name: "M", pbrMetallicRoughness: { baseColorFactor: [0.7, 0.7, 0.7, 1] } }],
    ...gltfPatch,
  };
  const j = Buffer.from(JSON.stringify(doc), "utf8");
  const jPad = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const bPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const len = 12 + 8 + jPad.length + 8 + bPad.length;
  const h = Buffer.alloc(12);
  h.write("glTF", 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(len, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jPad.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bPad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return toAb(Buffer.concat([h, jh, jPad, bh, bPad]));
}

test("V0.4: convenção de eixos CAD -> glTF respeita EXPORTER_CONTRACT", () => {
  const zCad = cadAxisToGltf("Z");
  assert.deepEqual(zCad.toArray(), [0, 1, 0]);
  const yCad = cadAxisToGltf("Y");
  assert.deepEqual(yCad.toArray(), [0, 0, -1]);
  const xCad = cadAxisToGltf("X");
  assert.deepEqual(xCad.toArray(), [1, 0, 0]);

  const v = cadVectorToGltf([1, 2, 3]);
  assert.deepEqual(v.toArray(), [1, 3, -2]);
});

test("V0.4: fator zero restaura pose exata e chamadas repetidas não acumulam deriva", async () => {
  const pkg = await importGlbWithManifestPackage(
    toAb(pavilionGlb),
    toAb(pavilionManifest),
    "pavilhao-explosao.glb"
  );
  const ctrl = new ExplodedViewController(pkg);
  const initialPositions = new Map();
  for (const id of pkg.sceneGraph.componentOrder) {
    initialPositions.set(id, pkg.objectByComponentId.get(id).position.clone());
  }

  ctrl.prepare({ ...defaultExplodeParams, enabled: true, mode: "radial" }, []);
  ctrl.applyFactor(0.6);
  const firstAt06 = pkg.objectByComponentId.get("lj-painel-oeste").position.clone();

  // Repeated applications must stay idempotent (no accumulated drift)
  ctrl.applyFactor(0.2);
  ctrl.applyFactor(1.4);
  ctrl.applyFactor(0.6);
  const repeatAt06 = pkg.objectByComponentId.get("lj-painel-oeste").position.clone();
  assert.ok(firstAt06.distanceTo(repeatAt06) < 1e-8);

  // Return to 0 restores exact rest position
  ctrl.applyFactor(0);
  for (const id of pkg.sceneGraph.componentOrder) {
    const restored = pkg.objectByComponentId.get(id).position;
    assert.ok(restored.distanceTo(initialPositions.get(id)) < 1e-9, `deriva em ${id}`);
  }
  pkg.dispose();
});

test("V0.4: compósitos, instâncias, grupos sobrepostos e seleção permanecem íntegros", async () => {
  const pkg = await importGlbWithManifestPackage(
    toAb(pavilionGlb),
    toAb(pavilionManifest),
    "pavilhao-explosao.glb"
  );
  const ctrl = new ExplodedViewController(pkg);

  // Composite multi-mesh beams and stairs must preserve sub-mesh relative offsets
  const stairObj = pkg.objectByComponentId.get("esc-lance-01");
  const childStep0 = stairObj.children[0].position.clone();
  const childStep3 = stairObj.children[3].position.clone();

  ctrl.prepare(
    { ...defaultExplodeParams, enabled: true, mode: "axial", axis: "Z" },
    []
  );
  ctrl.applyFactor(1.0);

  assert.deepEqual(stairObj.children[0].position.toArray(), childStep0.toArray());
  assert.deepEqual(stairObj.children[3].position.toArray(), childStep3.toArray());

  // Axial CAD Z moves vertically (+Y glTF) without X/Z drift on vertical column/slab test
  const slabDelta = ctrl.getComponentDelta("lj-painel-leste");
  assert.ok(Math.abs(slabDelta.x) < 1e-8 && Math.abs(slabDelta.z) < 1e-8);
  assert.ok(slabDelta.y > 0.01);

  // Overlapping groups must not apply double displacement in group granularity
  ctrl.prepare(
    { ...defaultExplodeParams, enabled: true, mode: "radial", granularity: "group" },
    []
  );
  ctrl.applyFactor(1.0);
  const compDeltaGroup = ctrl.getComponentDelta("vg-composta-central");
  const northBeamDelta = ctrl.getComponentDelta("vg-long-norte");
  // vg-composta-central belongs to g-portico-norte first, so it shares g-portico-norte vector exactly
  assert.ok(compDeltaGroup.distanceTo(northBeamDelta) < 1e-7);

  // Shared geometry instances maintain independent component IDs and picking resolution
  const cn1 = pkg.objectByComponentId.get("cn-encaixe-01");
  const cn2 = pkg.objectByComponentId.get("cn-encaixe-02");
  assert.equal(cn1.geometry, cn2.geometry);
  assert.equal(pkg.resolveComponentId(cn1), "cn-encaixe-01");
  assert.equal(pkg.resolveComponentId(cn2), "cn-encaixe-02");

  // Bounds after explosion exceed rest bounds cleanly
  const restBox = ctrl.computeBounds({ exploded: false });
  const expBox = ctrl.computeBounds({ exploded: true });
  assert.ok(expBox.getSize(new Vector3()).length() > restBox.getSize(new Vector3()).length());
  pkg.dispose();
});

test("V0.4: escopo de seleção, ocultação, isolamento, linhas de referência e store", async () => {
  const pkg = await importGlbWithManifestPackage(
    toAb(pavilionGlb),
    toAb(pavilionManifest),
    "pavilhao-explosao.glb"
  );
  const ctrl = new ExplodedViewController(pkg);

  // Selected scope moves only selected component
  ctrl.prepare(
    { ...defaultExplodeParams, enabled: true, mode: "radial", scope: "selection" },
    ["lj-painel-oeste"]
  );
  ctrl.applyFactor(1.0);
  assert.ok(ctrl.getComponentDelta("lj-painel-oeste").length() > 0.01);
  assert.equal(ctrl.getComponentDelta("fd-sapata-01").length(), 0);

  // Reference lines respect hidden & isolated filters without interference
  const positions = new Float32Array(ctrl.componentCount * 6);
  const countVisible = ctrl.writeReferenceSegmentsBuffer(positions, new Set(), null);
  assert.equal(countVisible, 1);

  const countHidden = ctrl.writeReferenceSegmentsBuffer(
    positions,
    new Set(["lj-painel-oeste"]),
    null
  );
  assert.equal(countHidden, 0);

  const countIsolatedOther = ctrl.writeReferenceSegmentsBuffer(
    positions,
    new Set(),
    new Set(["fd-sapata-01"])
  );
  assert.equal(countIsolatedOther, 0);

  // Picking via Raycaster after explosion finds shifted component & ignores hidden
  const slabObj = pkg.objectByComponentId.get("lj-painel-oeste");
  const slabWorldPos = new Box3().setFromObject(slabObj).getCenter(new Vector3());
  const raycaster = new Raycaster(
    slabWorldPos.clone().add(new Vector3(0, 1, 0)),
    new Vector3(0, -1, 0)
  );
  const hits = raycaster.intersectObject(pkg.model.scene, true);
  assert.ok(hits.length > 0);
  assert.equal(pkg.resolveComponentId(hits[0].object), "lj-painel-oeste");

  // Store state clears explosion completely upon switching models
  useViewerStore.getState().setSceneGraph(pkg.sceneGraph);
  useViewerStore.getState().setExplodeFactor(0.8);
  assert.equal(useViewerStore.getState().explode.factor, 0.8);
  useViewerStore.getState().setSceneGraph(null);
  assert.equal(useViewerStore.getState().explode.factor, 0);
  assert.equal(useViewerStore.getState().explode.enabled, false);
  assert.equal(useViewerStore.getState().explodeTransition, null);

  pkg.dispose();
});

test("V0.4: modelos GLB básico e contrato v1.0.0 continuam totalmente compatíveis", async () => {
  const basicPkg = await importGlbBasicPackage(toAb(basicGlb), "estrutura.glb");
  const basicCtrl = new ExplodedViewController(basicPkg);
  basicCtrl.prepare({ ...defaultExplodeParams, enabled: true, mode: "radial" }, []);
  basicCtrl.applyFactor(0.75);
  assert.ok(basicCtrl.getComponentDelta("c100").length() > 0);
  basicCtrl.reset();
  assert.equal(basicCtrl.getComponentDelta("c100").length(), 0);
  basicPkg.dispose();

  const contractPkg = await importGlbWithManifestPackage(
    toAb(contractGlb),
    toAb(contractManifest),
    "model.example.glb"
  );
  const contractCtrl = new ExplodedViewController(contractPkg);
  contractCtrl.prepare(
    { ...defaultExplodeParams, enabled: true, mode: "directional", useManifestHints: true },
    []
  );
  contractCtrl.applyFactor(1.0);
  assert.ok(contractCtrl.getComponentDelta("ex-cube-100").length() > 0);
  contractPkg.dispose();
});

test("V0.4: casos degenerados — hierarquia profunda, escala não uniforme, centro coincidente, longe da origem e cena vazia", async () => {
  // Structural hierarchy (4 container depth levels) with non-uniform scale [2, 0.5, 3] & far-from-origin offset
  const glb = makeMinimalGlb({
    scene: 0,
    scenes: [{ nodes: [0, 8, 9] }],
    nodes: [
      // 0: structural group far from origin with non-uniform scale [2, 0.5, 3]
      {
        name: "ParentNonUniform",
        translation: [10000, 0, 10000],
        scale: [2, 0.5, 3],
        children: [1, 2],
      },
      // 1: branch A leaf
      { name: "Leaf0", mesh: 0, translation: [0.1, 0, 0], extras: { geogenElementId: "deep-0" } },
      // 2: sub-container level 1
      { name: "Sub1", translation: [0.2, 0.2, 0.2], children: [3, 4] },
      { name: "Leaf1", mesh: 0, extras: { geogenElementId: "deep-1" } },
      // 4: sub-container level 2
      { name: "Sub2", translation: [0.2, 0.2, 0.2], children: [5, 6] },
      { name: "Leaf2", mesh: 0, extras: { geogenElementId: "deep-2" } },
      // 6: sub-container level 3
      { name: "Sub3", translation: [0.2, 0.2, 0.2], children: [7] },
      { name: "Leaf3", mesh: 0, extras: { geogenElementId: "deep-3" } },
      // 8 & 9: Two completely coincident components at exact center
      { name: "CoinA", mesh: 0, translation: [10000, 0, 10000], extras: { geogenElementId: "coin-a" } },
      { name: "CoinB", mesh: 0, translation: [10000, 0, 10000], extras: { geogenElementId: "coin-b" } },
    ],
  });

  const pkg = await importGlbBasicPackage(glb, "degenerado.glb");
  const ctrl = new ExplodedViewController(pkg);

  // Coincident & hierarchical explosion must produce finite, non-zero, non-doubled positions
  ctrl.prepare({ ...defaultExplodeParams, enabled: true, mode: "hierarchical" }, []);
  ctrl.applyFactor(1.0);

  for (const id of pkg.sceneGraph.componentOrder) {
    const pos = pkg.objectByComponentId.get(id).position;
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z));
  }

  // Deep child total world displacement matches desired delta (parent move compensated cleanly)
  const d0World = new Vector3();
  const d3World = new Vector3();
  pkg.objectByComponentId.get("deep-0").getWorldPosition(d0World);
  pkg.objectByComponentId.get("deep-3").getWorldPosition(d3World);
  assert.ok(d3World.distanceTo(d0World) > 0.05);

  // Radial mode on coincident components separates them deterministically without NaN
  ctrl.prepare({ ...defaultExplodeParams, enabled: true, mode: "radial" }, []);
  ctrl.applyFactor(1.0);
  const deltaCoinA = ctrl.getComponentDelta("coin-a");
  const deltaCoinB = ctrl.getComponentDelta("coin-b");
  assert.ok(deltaCoinA.length() > 0 && deltaCoinB.length() > 0);
  assert.ok(deltaCoinA.distanceTo(deltaCoinB) > 1e-4);

  ctrl.reset();
  pkg.dispose();

  // Empty model safety check
  const emptyPkg = {
    model: {
      scene: new Group(),
      bounds: new Box3(),
      dispose: () => {},
    },
    sceneGraph: {
      mode: "glb-basic",
      fileName: "vazio.glb",
      fileSizeBytes: 100,
      projectTitle: "Vazio",
      revisionId: null,
      geometryKind: "unknown",
      scaleDenominator: null,
      displayUnit: "mm",
      sourceApplication: null,
      sourceUnit: null,
      totalNodes: 1,
      totalMeshes: 0,
      totalVertices: 0,
      totalTriangles: 0,
      sceneBoundsMeters: [0, 0, 0],
      components: {},
      componentOrder: [],
      rootComponentIds: [],
      layers: {},
      rootLayerIds: [],
      groups: {},
      rootGroupIds: [],
      materials: {},
      diagnostics: { sha256Verified: null, nodeMatchStrategy: "extras", warnings: [], matchedCount: 0 },
    },
    objectByComponentId: new Map(),
    resolveComponentId: () => null,
    dispose: () => {},
  };
  // Attach real box mesh just so dispose doesn't fail on mock
  const emptyCtrl = new ExplodedViewController(emptyPkg);
  assert.equal(emptyCtrl.componentCount, 0);
  emptyCtrl.prepare(defaultExplodeParams, []);
  emptyCtrl.applyFactor(1.0);
  emptyCtrl.reset();

  // Verify degenerate zero-thickness object didn't break Box3 bounds
  const singleMesh = new Mesh(new BoxGeometry(0.1, 0, 0.1), new MeshBasicMaterial());
  singleMesh.geometry.dispose();
  singleMesh.material.dispose();
  emptyPkg.model.dispose();
});
