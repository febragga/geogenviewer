import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Vector3 } from "three";
import { componentIdentity, componentLabel } from "../src/lib/geogen/domain/component-identity.ts";
import { collectModelSummary, summarizeModel } from "../src/lib/geogen/revisions/model-summary.ts";
import { captureRevision } from "../src/lib/geogen/revisions/revision.ts";
import { defaultFabrication } from "../src/lib/geogen/revisions/fabrication.ts";
import { matchesComponent, normalizeSearch } from "../src/lib/geogen/domain/visibility.ts";
import {
  buildTreeRows,
} from "../src/features/viewer/tree/build-rows.ts";
import {
  useViewerStore,
} from "../src/features/viewer/state/viewer-store.ts";
import {
  computeVisibilityState,
} from "../src/lib/geogen/domain/model.ts";
import {
  importGlbBasicPackage,
  importGlbWithManifestPackage,
  sha256Hex,
} from "../src/lib/geogen/importers/package.ts";
import {
  ManifestValidationError,
  parseAndValidateManifest,
} from "../src/lib/geogen/validation/manifest.ts";

const basicGlbBytes = readFileSync(new URL("../public/demos/estrutura.glb", import.meta.url));
const contractGlbBytes = readFileSync(new URL("../../exporter-contract/model.example.glb", import.meta.url));
const contractManifestBytes = readFileSync(new URL("../../exporter-contract/manifest.example.json", import.meta.url));

const toArrayBuffer = (buf) =>
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

/**
 * Builds a minimal valid GLB 2.0 in memory from a glTF JSON document + single tiny triangle BIN buffer.
 */
function buildSyntheticGlb(gltfPatch) {
  // Single triangle: 3 vec3 positions (36 bytes) + 3 uint16 indices (6 bytes + 2 pad = 8 bytes) = 44 bytes
  const bin = Buffer.alloc(44);
  // Triangle vertices in meters
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
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [0.1, 0.1, 0],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: "SCALAR",
      },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1 }],
      },
    ],
    materials: [{ name: "Default", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1] } }],
    ...gltfPatch,
  };

  const jsonRaw = Buffer.from(JSON.stringify(doc), "utf8");
  const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);

  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0x00)]);

  const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonChunk.length, 0);
  jsonHdr.writeUInt32LE(0x4e4f534a, 4);

  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(binChunk.length, 0);
  binHdr.writeUInt32LE(0x004e4942, 4);

  return toArrayBuffer(Buffer.concat([header, jsonHdr, jsonChunk, binHdr, binChunk]));
}

test("Sprint A: PartIDs duplicados são rótulos e nomes GLB preservam a origem", async () => {
  const glb = buildSyntheticGlb({
    nodes: [
      { name: "CAD bruto A", mesh: 0, extras: { geogenElementId: "id-a", "geogen.v02.partId": " V-03 " } },
      { name: "CAD bruto B", mesh: 0, extras: { geogenElementId: "id-b", "geogen.v02.partId": "V-03" } },
      { mesh: 0, extras: { geogenElementId: "id-c", "geogen.v02.partId": " " } },
      { mesh: 0, extras: { geogenElementId: "id-d", "geogen.v02.partId": 93, objectName: "Viga especial" } },
    ],
    scenes: [{ nodes: [0, 1, 2, 3] }],
    scene: 0,
  });
  const pkg = await importGlbBasicPackage(glb, "sintetico.glb");
  try {
    const graph = pkg.sceneGraph;
    const rows = buildTreeRows(graph, "hierarchy", "V-03", []);
    assert.deepEqual(rows.map(({ id, label }) => [id, label]), [["id-a", "V-03"], ["id-b", "V-03"]]);
    assert.equal(componentLabel(graph.components["id-c"]), "id-c");
    assert.equal(componentLabel(graph.components["id-d"]), "Viga especial");
    assert.deepEqual(componentIdentity(graph.components["id-a"]).glbNames, ["CAD bruto A"]);
    for (const query of ["CAD bruto A", "id-a", "v-03"]) assert.ok(matchesComponent(graph, "id-a", normalizeSearch(query)));
  } finally { pkg.dispose(); }
});

test("Sprint A: manifesto atual e legado mantêm identidade e precedência de nomes", async () => {
  const manifest = JSON.parse(contractManifestBytes);
  const [first, second, third] = manifest.elements;
  first.userText = { ...first.userText, "geogen.v02.partId": " V-03 ", "GeoGen:ObjectName": "Cubo CAD nominal",
    "GeoGen:Fabrication:VolumeM3": "0.0002" };
  first.fabrication = { ...first.fabrication, material: null };
  second.properties = { ...second.properties, "GeoGen:PartId": "V-03" };
  third.name = " ";
  third.userText = { ...third.userText, "GeoGen:ObjectName": "Nome Rhino do terceiro" };
  const data = toArrayBuffer(Buffer.from(JSON.stringify(manifest)));
  const pkg = await importGlbWithManifestPackage(toArrayBuffer(contractGlbBytes), data, manifest.geometry.file);
  try {
    const graph = pkg.sceneGraph;
    assert.equal(componentLabel(graph.components[first.id]), "V-03");
    assert.equal(componentLabel(graph.components[second.id]), "V-03");
    assert.equal(componentLabel(graph.components[third.id]), "Nome Rhino do terceiro");
    assert.deepEqual(componentIdentity(graph.components[first.id]).cadNames, ["Cubo CAD nominal"]);
    const { rows, fabrication } = collectModelSummary(captureRevision(pkg), new Set([first.id]), defaultFabrication);
    const summary = summarizeModel(rows, fabrication);
    assert.equal(summary.area["area-cad"].subtotal, first.areaM2.value);
    assert.equal(summary.volume["volume-cad"].subtotal, first.volumeM3.value);
    assert.equal(summary.fabricationVolume.subtotal, 0.0002);
    assert.equal(summary.length.subtotal, first.dimensions.lengthM);
    assert.ok(summary.mass.solid.subtotal > 0);
    for (const query of [first.name, first.sourceObjectId, "Cubo CAD nominal"]) {
      assert.ok(matchesComponent(graph, first.id, normalizeSearch(query)));
    }
  } finally { pkg.dispose(); }
});

test("V0.2: modo GLB básico preserva IDs estáveis, cubo 100mm, seleção e visibilidade", async () => {
  const pkg = await importGlbBasicPackage(toArrayBuffer(basicGlbBytes), "estrutura.glb");
  assert.equal(pkg.sceneGraph.mode, "glb-basic");
  assert.equal(pkg.sceneGraph.componentOrder.length, 8);

  const c100 = pkg.sceneGraph.components.c100;
  assert.ok(c100, "componente c100 deve existir");
  for (const dim of c100.meshBoundsMeters) {
    assert.ok(Math.abs(dim - 0.1) < 1e-6, `cubo 100mm esperado ~0.1m, veio ${dim}`);
  }

  const cubeObj = pkg.objectByComponentId.get("c100");
  assert.ok(cubeObj);
  assert.equal(pkg.resolveComponentId(cubeObj), "c100");

  // Exercise Zustand viewer-store selection & visibility rules
  const secondId = pkg.sceneGraph.componentOrder.find((id) => id !== "c100");
  assert.ok(secondId);

  useViewerStore.getState().setSceneGraph(pkg.sceneGraph);
  useViewerStore.getState().select("c100");
  assert.deepEqual(useViewerStore.getState().selectedIds, ["c100"]);

  useViewerStore.getState().select(secondId, "toggle");
  assert.deepEqual(useViewerStore.getState().selectedIds, ["c100", secondId]);

  useViewerStore.getState().hideIds(["c100"]);
  const partialVis = computeVisibilityState(
    ["c100", secondId],
    new Set(useViewerStore.getState().hiddenIds),
    null
  );
  assert.equal(partialVis, "partial");

  useViewerStore.getState().isolateIds(["c100"]);
  assert.deepEqual(useViewerStore.getState().isolatedIds, ["c100"]);
  assert.equal(
    computeVisibilityState(["c100"], new Set(useViewerStore.getState().hiddenIds), new Set(["c100"])),
    "visible"
  );

  useViewerStore.getState().showAll();
  assert.equal(useViewerStore.getState().hiddenIds.length, 0);
  assert.equal(useViewerStore.getState().isolatedIds, null);
  useViewerStore.getState().setSceneGraph(null);
  pkg.dispose();
});

test("V0.2: compósito multi-malha, instâncias compartilhadas, IDs ausentes e duplicados", async () => {
  const glb = buildSyntheticGlb({
    scene: 0,
    scenes: [{ nodes: [0, 3, 4, 5, 6] }],
    nodes: [
      // 0: composite root owning child meshes 1 & 2
      { name: "QuadrosComposto", extras: { geogenElementId: "comp_1" }, children: [1, 2] },
      // 1: sub-mesh with accidental extras inside composite root
      { name: "SubA", mesh: 0, extras: { geogenElementId: "nested_ignored" } },
      // 2: sub-mesh
      { name: "SubB", mesh: 0, translation: [0.2, 0, 0] },
      // 3 & 4: two instances sharing mesh 0
      { name: "InstA", mesh: 0, extras: { geogenElementId: "inst_a" } },
      { name: "InstB", mesh: 0, extras: { geogenElementId: "inst_b" }, translation: [0.4, 0, 0] },
      // 5: missing extras ID -> deterministic key
      { name: "SemExtras", mesh: 0 },
      // 6: duplicate extras ID
      { name: "Duplicado", mesh: 0, extras: { geogenElementId: "inst_a" } },
    ],
  });

  const pkg = await importGlbBasicPackage(glb, "composto.glb");
  const comp1 = pkg.sceneGraph.components.comp_1;
  assert.ok(comp1);
  assert.equal(comp1.isComposite, true);
  assert.equal(comp1.meshCount, 2);

  // Clicking child mesh of composite root must resolve to comp_1
  const compObj = pkg.objectByComponentId.get("comp_1");
  assert.ok(compObj);
  const subMeshes = [];
  compObj.traverse((o) => {
    if (o.isMesh) subMeshes.push(o);
  });
  assert.equal(subMeshes.length, 2);
  assert.equal(pkg.resolveComponentId(subMeshes[0]), "comp_1");
  assert.equal(pkg.resolveComponentId(subMeshes[1]), "comp_1");

  // Shared geometry instances flagged cleanly with distinct IDs
  assert.equal(pkg.sceneGraph.components.inst_a.isInstance, true);
  assert.equal(pkg.sceneGraph.components.inst_b.isInstance, true);

  // Duplicate extras ID disambiguated cleanly with warning in basic mode
  assert.ok(pkg.sceneGraph.components["inst_a#2"]);
  assert.ok(pkg.sceneGraph.diagnostics.warnings.length >= 2);
  pkg.dispose();
});

test("V0.3: importa pacote exemplo oficial GLB + JSON com SHA-256 e metadados CAD", async () => {
  const pkg = await importGlbWithManifestPackage(
    toArrayBuffer(contractGlbBytes),
    toArrayBuffer(contractManifestBytes),
    "model.example.glb"
  );

  assert.equal(pkg.sceneGraph.mode, "manifest-full");
  assert.equal(pkg.sceneGraph.diagnostics.sha256Verified, true);
  assert.equal(pkg.sceneGraph.diagnostics.nodeMatchStrategy, "extras");
  assert.ok(pkg.sceneGraph.componentOrder.length >= 4);

  // Check layer tree, group tree, and search rows
  const compRows = buildTreeRows(pkg.sceneGraph, "hierarchy", "", pkg.sceneGraph.rootComponentIds);
  assert.ok(compRows.length >= 4);

  const layerRows = buildTreeRows(pkg.sceneGraph, "layers", "", Object.keys(pkg.sceneGraph.layers));
  assert.ok(layerRows.some((r) => r.kind === "layer"));

  const groupRows = buildTreeRows(pkg.sceneGraph, "groups", "", Object.keys(pkg.sceneGraph.groups));
  assert.ok(groupRows.some((r) => r.kind === "group"));

  const filtered = buildTreeRows(pkg.sceneGraph, "hierarchy", "100", []);
  assert.ok(filtered.some((r) => r.label.includes("100") || r.id.includes("100")));

  // Check open surface in synthetic manifest sets isClosed === false and volumeM3 === null
  const openSurfaceManifest = structuredClone(
    JSON.parse(contractManifestBytes.toString("utf8"))
  );
  openSurfaceManifest.elements[0].isClosed = false;
  openSurfaceManifest.elements[0].volumeM3 = null;
  const openPkg = await importGlbWithManifestPackage(
    toArrayBuffer(contractGlbBytes),
    new TextEncoder().encode(JSON.stringify(openSurfaceManifest)).buffer,
    "model.example.glb"
  );
  const openEl = openPkg.sceneGraph.components["ex-cube-100"];
  assert.equal(openEl.cad?.isClosed, false);
  assert.equal(openEl.cad?.volumeM3, null);
  openPkg.dispose();

  // Check composite CAD element & block instances in official example
  const composite = pkg.sceneGraph.components["ex-composite-01"];
  assert.ok(composite, "contrato exemplo deve conter ex-composite-01");
  assert.equal(composite.isComposite, true);

  assert.equal(pkg.sceneGraph.components["ex-conn-inst-01"].isInstance, true);
  assert.equal(pkg.sceneGraph.components["ex-conn-inst-02"].isInstance, true);

  // Confirm 100mm calibration cube size inside loaded bounds
  const calCube = pkg.sceneGraph.components["ex-cube-100"];
  assert.ok(calCube);
  for (const s of calCube.meshBoundsMeters) {
    assert.ok(Math.abs(s - 0.1) < 1e-5, `ex-cube-100 esperado ~0.1m, obteve ${s}`);
  }

  // Up axis check (example sits above y=0)
  const worldBox = pkg.model.bounds.getSize(new Vector3());
  assert.ok(worldBox.y > 0.1);
  pkg.dispose();
});

test("V0.3: rejeita estritamente violações semânticas, versão, ciclo, SHA-256 e HTML", async () => {
  const validManifest = JSON.parse(contractManifestBytes.toString("utf8"));

  // 1. SHA-256 mismatch
  const badSha = structuredClone(validManifest);
  badSha.geometry.sha256 = "0".repeat(64);
  await assert.rejects(
    () =>
      importGlbWithManifestPackage(
        toArrayBuffer(contractGlbBytes),
        new TextEncoder().encode(JSON.stringify(badSha)).buffer,
        "model.example.glb"
      ),
    (err) => err instanceof ManifestValidationError && err.code === "SHA256_MISMATCH"
  );

  const encodeJson = (obj) => new TextEncoder().encode(JSON.stringify(obj)).buffer;

  // 2. Unsupported major & minor version
  const badMajor = structuredClone(validManifest);
  badMajor.schemaVersion = "2.0.0";
  assert.throws(
    () => parseAndValidateManifest(encodeJson(badMajor)),
    ManifestValidationError
  );

  const badMinor = structuredClone(validManifest);
  badMinor.schemaVersion = "1.9.0";
  assert.throws(
    () => parseAndValidateManifest(encodeJson(badMinor)),
    (err) => err instanceof ManifestValidationError && err.code === "UNSUPPORTED_MINOR_VERSION"
  );

  // 3. Cycle in elements hierarchy
  const cycleManifest = structuredClone(validManifest);
  cycleManifest.elements[0].parentId = cycleManifest.elements[1].id;
  cycleManifest.elements[1].parentId = cycleManifest.elements[0].id;
  assert.throws(
    () => parseAndValidateManifest(encodeJson(cycleManifest)),
    ManifestValidationError
  );

  // 4. Dangling layer reference
  const danglingLayer = structuredClone(validManifest);
  danglingLayer.elements[0].layerId = "layer_inexistente";
  assert.throws(
    () => parseAndValidateManifest(encodeJson(danglingLayer)),
    ManifestValidationError
  );

  // 5. HTML / script injection attempt
  const xssManifest = structuredClone(validManifest);
  xssManifest.elements[0].name = "<script>alert(1)</script>";
  assert.throws(
    () => parseAndValidateManifest(encodeJson(xssManifest)),
    ManifestValidationError
  );

  // 6. Open surface claiming solid volume
  const openVolManifest = structuredClone(validManifest);
  openVolManifest.elements[0].isClosed = false;
  openVolManifest.elements[0].volumeM3 = { value: 0.05, source: "cad" };
  assert.throws(
    () => parseAndValidateManifest(encodeJson(openVolManifest)),
    ManifestValidationError
  );

  // 7. Duplicate element ID
  const dupId = structuredClone(validManifest);
  dupId.elements.push(structuredClone(dupId.elements[0]));
  assert.throws(
    () => parseAndValidateManifest(encodeJson(dupId)),
    ManifestValidationError
  );
});

test("V0.3: estratégia alternativa nameExact vincula nós ou rejeita ausência sem fallback silencioso", async () => {
  const glb = buildSyntheticGlb({
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "PilarP01", mesh: 0 }],
  });
  const sha = await sha256Hex(glb);

  const manifestOk = {
    schemaVersion: "1.0.0",
    project: {
      id: "proj_name_exact",
      title: "Teste nameExact",
      revisionId: "rev_1",
      geometryKind: "physicalModel",
      scaleDenominator: 20,
      displayUnit: "mm",
    },
    source: {
      application: "Rhino 8",
      sourceUnit: "mm",
      sourceUpAxis: "Z",
      sourceOrigin: [0, 0, 0],
      metersPerSourceUnit: 0.001,
    },
    geometry: {
      file: "teste.glb",
      format: "glb",
      coordinateSystem: "RH_Y_UP",
      unit: "m",
      nodeMatchStrategy: "nameExact",
      sha256: sha,
    },
    layers: [{ id: "layer_0", name: "Estrutura", parentId: null }],
    groups: [],
    materials: [],
    elements: [
      {
        id: "el_p01",
        name: "Pilar P01",
        glbNodeName: "PilarP01",
        category: "column",
        layerId: "layer_0",
        groupIds: [],
        materialId: null,
      },
    ],
  };

  const pkg = await importGlbWithManifestPackage(
    glb,
    new TextEncoder().encode(JSON.stringify(manifestOk)).buffer,
    "teste.glb"
  );
  assert.equal(pkg.sceneGraph.diagnostics.nodeMatchStrategy, "nameExact");
  assert.ok(pkg.sceneGraph.components.el_p01);
  pkg.dispose();

  // Missing matching node must throw cleanly
  const manifestMissing = structuredClone(manifestOk);
  manifestMissing.elements[0].glbNodeName = "Inexistente";
  await assert.rejects(
    () =>
      importGlbWithManifestPackage(
        glb,
        new TextEncoder().encode(JSON.stringify(manifestMissing)).buffer,
        "teste.glb"
      ),
    (err) => err instanceof ManifestValidationError && err.code === "MISSING_GLB_NODE"
  );
});
