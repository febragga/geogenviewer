import assert from "node:assert/strict";
import test from "node:test";
import packageJson from "../package.json" with { type: "json" };
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import {
  GEOGEN_BRAND_BLUE,
  GEOGEN_CONTRACT_VERSION,
  GEOGEN_VERSION,
  GEOGEN_VERSION_LABEL,
} from "../src/lib/geogen/version.ts";
import {
  buildNavCubeStations,
  defaultNavCubeOrientation,
  projectNavCube,
} from "../src/lib/geogen/domain/nav-cube.ts";
import {
  createEmptyOrganization,
} from "../src/lib/geogen/organization/model.ts";
import {
  addOccurrencesToUserGroup,
  assignOccurrencesToUserLayer,
  copyImportedStructureToUser,
  createUserGroup,
  createUserLayer,
  deleteUserLayer,
  moveUserLayer,
  removeOccurrencesFromUserGroup,
  resolveOrganizationView,
  toggleUserLayerVisibility,
} from "../src/lib/geogen/organization/operations.ts";
import {
  checkOrganizationCompatibility,
  OrganizationValidationError,
  parseAndValidateOrganization,
  serializeOrganization,
} from "../src/lib/geogen/organization/document.ts";
import { catalogFor, hiddenByFilters } from "../src/lib/geogen/domain/visibility.ts";
import {
  collectQuantities,
  groupQuantities,
  summarizeQuantities,
} from "../src/lib/geogen/revisions/quantities.ts";
import { captureRevision } from "../src/lib/geogen/revisions/revision.ts";
import {
  catalogEntries,
  projectSearch,
  scopeCatalog,
} from "../src/lib/geogen/documentation/catalog.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";
import { InstancedBatchManager } from "../src/features/viewer/scene/instancing.ts";
import { makeCallout, projectCallouts } from "../src/lib/geogen/documentation/callouts.ts";
import { OrthographicCamera } from "three";

function createSyntheticScenePackage(count = 12) {
  const root = new Group();
  const geometry = new BoxGeometry(1, 0.2, 0.4);
  const material = new MeshStandardMaterial({ color: "#cccccc" });
  const objectByComponentId = new Map();
  const meshToId = new WeakMap();
  const components = {};
  const componentOrder = [];

  for (let i = 0; i < count; i += 1) {
    const id = `comp-${i + 1}`;
    const mesh = new Mesh(geometry, material);
    mesh.name = `Barra ${i + 1}`;
    mesh.position.set(i * 1.2, 0, 0);
    root.add(mesh);
    objectByComponentId.set(id, mesh);
    meshToId.set(mesh, id);
    componentOrder.push(id);
    components[id] = {
      id,
      name: `Barra ${i + 1}`,
      category: i % 2 === 0 ? "Viga" : "Montante",
      sourceObjectId: id,
      layerId: "cad-layer-a",
      groupIds: ["cad-group-1"],
      materialId: "mat-alu",
      materialNames: ["Alumínio"],
      parentId: null,
      childIds: [],
      blockDefinitionId: null,
      instancePath: null,
      isComposite: false,
      isInstance: false,
      meshCount: 1,
      vertexCount: 24,
      triangleCount: 12,
      meshBoundsMeters: [1, 0.2, 0.4],
      meshMinMaxMeters: { min: [i * 1.2 - 0.5, -0.1, -0.2], max: [i * 1.2 + 0.5, 0.1, 0.2] },
      cad: null,
    };
  }

  const sceneGraph = {
    mode: "manifest-full",
    fileName: "synthetic-test.glb",
    fileSizeBytes: 2048,
    projectTitle: "Projeto Teste V0.9",
    revisionId: "rev-test-01",
    geometryKind: "synthetic",
    scaleDenominator: 10,
    displayUnit: "mm",
    sourceApplication: "synthetic",
    sourceUnit: "m",
    totalNodes: count,
    totalMeshes: count,
    totalVertices: count * 24,
    totalTriangles: count * 12,
    sceneBoundsMeters: [count * 1.2, 0.2, 0.4],
    components,
    componentOrder,
    rootComponentIds: [...componentOrder],
    layers: {
      "cad-layer-a": {
        id: "cad-layer-a",
        name: "Estrutura CAD",
        fullPath: "Estrutura CAD",
        parentId: null,
        colorHex: "#4477AA",
        defaultVisible: true,
        childLayerIds: [],
        elementIds: [...componentOrder],
      },
    },
    rootLayerIds: ["cad-layer-a"],
    groups: {
      "cad-group-1": {
        id: "cad-group-1",
        name: "Pórtico Base CAD",
        parentId: null,
        childGroupIds: [],
        elementIds: [...componentOrder],
      },
    },
    rootGroupIds: ["cad-group-1"],
    materials: {
      "mat-alu": {
        id: "mat-alu",
        name: "Alumínio",
        colorHex: "#CCCCCC",
        densityKgM3: 2700,
      },
    },
    diagnostics: {
      sha256Verified: true,
      nodeMatchStrategy: "name",
      warnings: [],
      matchedCount: count,
    },
  };

  return {
    binarySha256: "a".repeat(64),
    model: {
      scene: root,
      bounds: { min: new Vector3(-1, -1, -1), max: new Vector3(count * 1.2, 1, 1) },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    },
    sceneGraph,
    objectByComponentId,
    resolveComponentId(object) {
      return object ? meshToId.get(object) ?? null : null;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

test("V0.9 branding constants and version metadata stay centralized", () => {
  assert.equal(GEOGEN_VERSION, packageJson.version);
  assert.equal(GEOGEN_VERSION_LABEL, "v" + packageJson.version);
  assert.equal(GEOGEN_CONTRACT_VERSION, "1.0.0");
  assert.equal(GEOGEN_BRAND_BLUE, "#3B82F6");
});

test("V0.9 3D Navigation Cube generates 26 watertight faces and projects accurately", () => {
  const stations = buildNavCubeStations({
    left: "Esquerda",
    right: "Direita",
    bottom: "Inferior",
    top: "Superior",
    back: "Posterior",
    front: "Frontal",
  });
  assert.equal(stations.length, 26);
  assert.equal(stations.filter((s) => s.kind === 1).length, 6);
  assert.equal(stations.filter((s) => s.kind === 2).length, 12);
  assert.equal(stations.filter((s) => s.kind === 3).length, 8);

  const frontProjected = projectNavCube(stations, new Quaternion(), 100, 30);
  const frontal = frontProjected.find((f) => f.station.id === "0,0,1");
  const posterior = frontProjected.find((f) => f.station.id === "0,0,-1");
  assert.equal(frontal?.visible, true);
  assert.ok(frontal?.textMatrix?.startsWith("matrix("));
  assert.equal(posterior?.visible, false);

  const isoProjected = projectNavCube(stations, defaultNavCubeOrientation(), 100, 30);
  assert.ok(isoProjected.some((f) => f.station.kind === 3 && f.visible));
});

test("V0.9 User Organization preserves origin isolation, single layer rule, overlap groups and cycle protection", () => {
  const pkg = createSyntheticScenePackage(6);
  let doc = createEmptyOrganization({
    projectId: pkg.sceneGraph.projectTitle,
    revisionId: pkg.sceneGraph.revisionId,
    modelSha256: pkg.binarySha256,
  });

  // Create parent & child layers
  doc = createUserLayer(doc, { name: "Cobertura", color: "#3B82F6" });
  const rootLayerId = doc.userLayers[0].id;
  doc = createUserLayer(doc, { name: "Terças", parentId: rootLayerId });
  const childLayerId = doc.userLayers[1].id;

  // Cycle protection: cannot move parent under child
  const cycleAttempt = moveUserLayer(doc, rootLayerId, childLayerId);
  assert.equal(cycleAttempt.userLayers.find((l) => l.id === rootLayerId)?.parentId, null);

  // Single direct layer rule: assigning to child replaces root assignment
  doc = assignOccurrencesToUserLayer(doc, ["comp-1", "comp-2"], rootLayerId);
  assert.equal(doc.componentLayerAssignments["comp-1"], rootLayerId);
  doc = assignOccurrencesToUserLayer(doc, ["comp-1"], childLayerId);
  assert.equal(doc.componentLayerAssignments["comp-1"], childLayerId);
  assert.equal(doc.componentLayerAssignments["comp-2"], rootLayerId);

  // Overlapping groups
  doc = createUserGroup(doc, { name: "Pré-montagem A", memberIds: ["comp-1", "comp-2"] });
  doc = createUserGroup(doc, { name: "Pré-montagem B", memberIds: ["comp-2", "comp-3"] });
  const gA = doc.userGroups[0].id;
  const gB = doc.userGroups[1].id;
  doc = addOccurrencesToUserGroup(doc, gA, ["comp-4"]);
  doc = removeOccurrencesFromUserGroup(doc, gA, ["comp-4"]);

  const view = resolveOrganizationView(pkg.sceneGraph, doc);
  assert.equal(view.source, "user");
  assert.deepEqual(view.componentGroupIds["comp-2"].sort(), [gA, gB].sort());

  // Layer visibility toggles propagate to hiddenByUserLayers
  doc = toggleUserLayerVisibility(doc, rootLayerId, false);
  const hiddenView = resolveOrganizationView(pkg.sceneGraph, doc);
  assert.ok(hiddenView.hiddenByUserLayers.includes("comp-1"));
  assert.ok(hiddenView.hiddenByUserLayers.includes("comp-2"));
  doc = toggleUserLayerVisibility(doc, rootLayerId, true);

  // Explicit layer deletion rule ("move-to-parent" vs "unassign")
  const movedDoc = deleteUserLayer(doc, childLayerId, "move-to-parent");
  assert.equal(movedDoc.componentLayerAssignments["comp-1"], rootLayerId);
  const unassignedDoc = deleteUserLayer(doc, childLayerId, "unassign");
  assert.equal(unassignedDoc.componentLayerAssignments["comp-1"], undefined);

  // CAD source remains completely immutable after copy
  const copied = copyImportedStructureToUser(createEmptyOrganization(), pkg.sceneGraph);
  assert.equal(copied.userLayers.length, 1);
  assert.equal(copied.userGroups.length, 1);
  assert.equal(pkg.sceneGraph.layers["cad-layer-a"].name, "Estrutura CAD");
  pkg.dispose();
});

test("V0.9 Organization JSON validation blocks prototype pollution, unsafe HTML and hash mismatch gracefully", () => {
  const pkg = createSyntheticScenePackage(3);
  let doc = createEmptyOrganization({
    projectId: pkg.sceneGraph.projectTitle,
    revisionId: pkg.sceneGraph.revisionId,
    modelSha256: pkg.binarySha256,
  });
  doc = createUserLayer(doc, { name: "Montagem" });
  doc = assignOccurrencesToUserLayer(doc, ["comp-1"], doc.userLayers[0].id);

  const json = serializeOrganization(doc);
  const parsed = parseAndValidateOrganization(json);
  assert.equal(parsed.userLayers[0].name, "Montagem");

  assert.throws(
    () => parseAndValidateOrganization('{"__proto__":{"polluted":true}}'),
    (err) => err instanceof OrganizationValidationError && err.code === "PROTOTYPE_POLLUTION_KEY"
  );
  assert.throws(
    () =>
      parseAndValidateOrganization(
        JSON.stringify({ ...parsed, userLayers: [{ ...parsed.userLayers[0], name: "<script>alert(1)</script>" }] })
      ),
    (err) => err instanceof OrganizationValidationError && err.code === "UNSAFE_STRING"
  );

  const compat = checkOrganizationCompatibility(
    { ...parsed, modelSha256: "b".repeat(64) },
    pkg.sceneGraph,
    {
      key: "rev",
      projectId: pkg.sceneGraph.projectTitle,
      revisionId: pkg.sceneGraph.revisionId,
      modelSha256: pkg.binarySha256,
    }
  );
  assert.equal(compat.status, "mismatch");
  assert.ok(compat.warnings.length >= 1);
  pkg.dispose();
});

test("V0.9 User Organization integrates with Filters, Quantities (no double count) and Catalog", () => {
  const pkg = createSyntheticScenePackage(4);
  const revision = captureRevision(pkg);
  let doc = createEmptyOrganization();
  doc = createUserLayer(doc, { name: "Piso 01" });
  const ul = doc.userLayers[0].id;
  doc = assignOccurrencesToUserLayer(doc, ["comp-1", "comp-2"], ul);
  doc = createUserGroup(doc, { name: "Lote A", memberIds: ["comp-1", "comp-2"] });
  doc = createUserGroup(doc, { name: "Lote B", memberIds: ["comp-2", "comp-3"] });
  const orgView = resolveOrganizationView(pkg.sceneGraph, doc);

  const hidden = hiddenByFilters(pkg.sceneGraph, { userLayer: [ul] }, [], undefined, orgView);
  assert.deepEqual(hidden.sort(), ["comp-3", "comp-4"]);
  const filterOpts = catalogFor(pkg.sceneGraph, new Map(), "userGroup", orgView);
  assert.equal(filterOpts.length, 2);

  const qRows = collectQuantities(revision, undefined, "", orgView);
  const grouped = groupQuantities(qRows, "userGroup");
  assert.equal(grouped.overlapping, true);
  const summary = summarizeQuantities(qRows);
  assert.equal(summary.components, 4);

  const entries = catalogEntries(revision, compileAssembly([]), new Map(), undefined, undefined, orgView);
  const scoped = scopeCatalog(entries, "userLayer", "Piso 01", {
    selected: new Set(),
    visible: new Set(),
    filtered: new Set(),
  });
  assert.equal(scoped.length, 2);
  assert.equal(projectSearch(entries[0], "piso 01"), true);
  pkg.dispose();
});

test("V0.9 InstancedBatchManager batches repeated meshes cleanly and preserves small pavilion profile", () => {
  const smallPkg = createSyntheticScenePackage(18);
  const smallHost = new Group();
  const smallManager = new InstancedBatchManager(
    smallPkg.model.scene,
    smallHost,
    smallPkg.resolveComponentId
  );
  assert.equal(smallManager.active, false);
  assert.equal(smallManager.batches.length, 0);
  smallManager.dispose();
  smallPkg.dispose();

  const largePkg = createSyntheticScenePackage(120);
  const host = new Group();
  const manager = new InstancedBatchManager(
    largePkg.model.scene,
    host,
    largePkg.resolveComponentId
  );
  assert.equal(manager.active, true);
  assert.equal(manager.batches.length, 1);
  assert.equal(manager.batches[0].slots.length, 120);

  const hitId = manager.resolveHitComponentId({
    distance: 1,
    point: new Vector3(),
    object: manager.batches[0].instancedMesh,
    instanceId: 41,
  });
  assert.equal(hitId, "comp-42");

  const hasOverlay = manager.applyDisplayAndVisibility({
    mode: "shaded",
    opacity: 1,
    shadows: false,
    selected: new Set(["comp-5"]),
    hovered: null,
    hidden: new Set(["comp-10"]),
    isolated: null,
    ghosts: new Set(),
    colorForComponent: () => null,
    clayColor: new MeshStandardMaterial().color,
    selectionColor: new MeshStandardMaterial().color,
    hoverColor: new MeshStandardMaterial().color,
  });
  assert.equal(hasOverlay, true);
  assert.equal(largePkg.objectByComponentId.get("comp-5").visible, true);
  assert.equal(largePkg.objectByComponentId.get("comp-10").visible, false);

  manager.dispose();
  assert.equal(largePkg.objectByComponentId.get("comp-5").userData.ggInstancedManaged, undefined);
  largePkg.dispose();
});

test("V0.9 Callouts optimization caches anchors and caps inspection safely", () => {
  const pkg = createSyntheticScenePackage(10);
  const rev = captureRevision(pkg);
  const entries = catalogEntries(rev, compileAssembly([]), new Map());
  const c1 = makeCallout(entries[0], "auto-1");
  const c2 = makeCallout(entries[0], "auto-2");
  assert.deepEqual(c1.anchor, c2.anchor);

  const cam = new OrthographicCamera(-20, 20, 20, -20, 0.1, 100);
  cam.position.set(0, 0, 10);
  cam.updateMatrixWorld();
  const projected = projectCallouts(
    [{ callout: c1, text: "Barra 1", selected: true }],
    cam,
    800,
    600,
    () => new Matrix4(),
    [],
    (t) => t.length * 7
  );
  assert.equal(projected.length, 1);
  pkg.dispose();
});
