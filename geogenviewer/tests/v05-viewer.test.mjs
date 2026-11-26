import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { AssemblyPose } from "../src/lib/geogen/assembly/pose.ts";
import { compileAssembly, idlePlayback, playbackTime, seekPlayback } from "../src/lib/geogen/assembly/timeline.ts";
import { withAssembly } from "../src/lib/geogen/assembly/manifest.ts";
import { importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { defaultHiddenIds, hiddenByFilters, matchesComponent, visibleIds } from "../src/lib/geogen/domain/visibility.ts";
import { computeVisibilityState } from "../src/lib/geogen/domain/model.ts";
import { useViewerStore } from "../src/features/viewer/state/viewer-store.ts";
import { buildTreeRows } from "../src/features/viewer/tree/build-rows.ts";
import { distanceAtViewHeight, initialPose, orientPose, synchronizePose, viewDirections, viewHeightAtDistance, viewRegions } from "../src/features/viewer/scene/camera-state.ts";
import { preferenceKey, readLocalList, writeLocalList } from "../src/features/viewer/state/local-preferences.ts";
import { defaultDisplay } from "../src/features/viewer/state/presentation-store.ts";
import { SceneDisplay } from "../src/features/viewer/scene/display.ts";

const fixture = new URL("../public/demos/", import.meta.url);
const glb = await readFile(new URL("pavilhao-explosao.glb", fixture));
const manifest = await readFile(new URL("pavilhao-explosao.manifest.json", fixture));
const source = JSON.parse(manifest);
const bytes = (buffer) => Uint8Array.from(buffer).buffer;
const load = () => importGlbWithManifestPackage(bytes(glb), bytes(manifest), source.geometry.file);

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

test("V0.5: orientações Rhino/Three, escala de projeção e enquadramento vertical", () => {
  const center = [5, 6, 7];
  for (const [preset, direction] of Object.entries(viewDirections)) {
    const pose = initialPose(preset, center, 2, 0.6);
    const offset = new Vector3(...pose.position).sub(new Vector3(...center)).normalize();
    closeTo(offset.dot(new Vector3(...direction).normalize()), 1);
    assert.equal(pose.projection, preset === "perspective" ? "perspective" : "orthographic");
    assert.ok(pose.height * 0.6 > 4);
  }
  assert.deepEqual(initialPose("top", center, 2, 1).up, [0, 0, -1]);
  assert.deepEqual(initialPose("bottom", center, 2, 1).up, [0, 0, 1]);
  for (const height of [0.001, 1, 1000]) closeTo(viewHeightAtDistance(distanceAtViewHeight(height)), height);
  const pose = initialPose("perspective", center, 2, 2);
  const ortho = orientPose(pose, viewDirections.perspective, "orthographic");
  assert.deepEqual(ortho.target, pose.target);
  assert.equal(ortho.height, pose.height);
});

test("V0.5: quatro regiões compartilham bordas; sincronização preserva orientação das outras câmeras", () => {
  const regions = viewRegions("quad", null, 1023, 767);
  assert.equal(regions.reduce((area, item) => area + item.width * item.height, 0), 1023 * 767);
  assert.deepEqual(viewRegions("quad", 2, 1023, 767), [{ slot: 2, x: 0, y: 0, width: 1023, height: 767 }]);
  assert.equal(viewRegions("horizontal", null, 990, 600)[1].x, 495);
  assert.equal(viewRegions("vertical", null, 990, 600)[1].y, 300);
  const from = initialPose("top", [2, 3, 4], 3, 1);
  const peer = initialPose("front", [0, 0, 0], 1, 1);
  const synced = synchronizePose(from, peer, true, true);
  assert.deepEqual(synced.target, from.target);
  assert.equal(synced.height, from.height);
  closeTo(synced.position[2] - synced.target[2], peer.position[2]);
  assert.deepEqual(synced.up, peer.up);
});

test("V0.5: preferências locais serializam vistas por projeto e revisão", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const key = preferenceKey("views", source, "", 0);
  const view = { id: "vista", name: "Planta", pose: initialPose("top", [0, 0, 0], 3, 1), display: defaultDisplay,
    visibility: { filters: { category: ["column"] }, hiddenIds: [], isolatedIds: null } };
  assert.equal(writeLocalList(key, [view], storage), true);
  assert.deepEqual(readLocalList(key, storage), [view]);
  const another = { ...source, project: { ...source.project, revisionId: "rev-diferente" } };
  assert.deepEqual(readLocalList(preferenceKey("views", another, "", 0), storage), []);
});

test("V0.5: filtros unem opções, intersectam campos e respeitam camadas ancestrais", async () => {
  const loaded = await load();
  try {
    const graph = loaded.sceneGraph;
    const hidden = hiddenByFilters(graph, { layer: ["l-estrutura"], category: ["beam", "column"], group: ["g-pre-moldados"] }, []);
    const visible = visibleIds(graph.componentOrder, hidden, null);
    assert.ok(visible.length > 1 && visible.length < graph.componentOrder.length);
    assert.ok(visible.every((id) => {
      const comp = graph.components[id];
      return /beam|column/.test(comp.category) && comp.groupIds.includes("g-pre-moldados");
    }));
    const overlapping = graph.componentOrder.find((id) => graph.components[id].groupIds.length > 1);
    assert.ok(overlapping);
    const groupUnion = hiddenByFilters(graph, { group: graph.components[overlapping].groupIds }, []);
    assert.equal(visibleIds(graph.componentOrder, groupUnion, null).filter((id) => id === overlapping).length, 1);
    const altered = { ...graph, layers: { ...graph.layers, "l-estrutura": { ...graph.layers["l-estrutura"], defaultVisible: false } } };
    assert.ok(visible.every((id) => defaultHiddenIds(altered).includes(id)));
    assert.equal(computeVisibilityState(visible, new Set([visible[0]]), null), "partial");
  } finally { loaded.dispose(); }
});

test("V0.5: busca usa grupo, material, camada, nome e User Text sem alterar identidade", async () => {
  const loaded = await load();
  try {
    const graph = loaded.sceneGraph;
    const column = Object.values(graph.components).find((item) => item.category === "column");
    assert.ok(column);
    for (const term of ["pilares", "madeira laminada", "pre-moldados", column.name, column.id]) {
      assert.equal(matchesComponent(graph, column.id, term), true);
    }
    const rows = buildTreeRows(graph, "groups", "madeira laminada", []);
    assert.ok(rows.some((row) => row.kind === "component" && row.id === column.id));
    assert.equal(new Set(graph.componentOrder).size, graph.componentOrder.length);
  } finally { loaded.dispose(); }
});

test("V0.5: restaura ocultação e filtros depois de uma cadeia de isolamentos", async () => {
  const loaded = await load();
  try {
    const graph = loaded.sceneGraph;
    const [first, second, third] = graph.componentOrder;
    const state = useViewerStore.getState();
    state.setSceneGraph(graph);
    state.hideIds([first]);
    state.setFilters({ category: ["beam"] });
    state.isolateIds([second]);
    state.isolateIds([third]);
    state.setFilters({ selection: ["selected"] });
    state.restoreIsolation();
    assert.deepEqual(useViewerStore.getState().hiddenIds, [first]);
    assert.equal(useViewerStore.getState().isolatedIds, null);
    assert.deepEqual(useViewerStore.getState().filters, { category: ["beam"] });
  } finally { useViewerStore.getState().setSceneGraph(null); loaded.dispose(); }
});

test("V0.5: tempo acumulado, pausa, velocidade, término, loop e scrub produzem o mesmo estado", () => {
  const timeline = compileAssembly(source.assembly.steps);
  closeTo(timeline.total, 5.8);
  const first = timeline.sample(0);
  const completed = timeline.sample(timeline.total);
  assert.equal(first.index, 0);
  assert.ok([...completed.states.values()].every((state) => state === "mounted"));
  assert.equal(first.states.get(source.assembly.steps[1].elementIds[0]), "future");
  const sample = timeline.sample(2.05);
  timeline.sample(4.8);
  assert.deepEqual(timeline.sample(2.05), sample);
  const player = { ...idlePlayback, status: "playing", startedAt: 1000, speed: 2 };
  closeTo(playbackTime(player, timeline.total, 1500), 1);
  closeTo(playbackTime(player, timeline.total, 5000), timeline.total);
  closeTo(playbackTime({ ...player, loop: true }, timeline.total, 4500), 1.2);
  const paused = seekPlayback({ ...player, status: "paused" }, 1.25, timeline.total, 1500);
  assert.equal(paused.status, "paused");
  closeTo(playbackTime(paused, timeline.total, 4000), 1.25);
});

test("V0.5: deslocamento mundial segue bloco rotacionado, escalado e composto durante o scrub", () => {
  const scene = new Group();
  const parent = new Group();
  parent.rotation.set(0.4, -0.9, 0.3);
  parent.scale.set(2, 4, 0.5);
  parent.position.set(8, -3, 11);
  scene.add(parent);
  const root = new Group();
  root.position.set(0.4, 0.2, 0.1);
  root.rotation.y = 0.4;
  parent.add(root);
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const meshA = new Mesh(geometry, material);
  const meshB = new Mesh(geometry, material);
  meshB.position.z = -3;
  root.add(meshA, meshB);
  const rest = [meshA, meshB].map((mesh) => mesh.getWorldPosition(new Vector3()));
  const localRest = root.position.clone();
  const timeline = compileAssembly([{ id: "etapa", title: "Passo", elementIds: ["bloco"], dependsOn: [], durationSeconds: 2, insertionOffsetM: [1, 3, -2] }]);
  const controller = new AssemblyPose(scene, new Map([["bloco", root]]));
  for (let repeat = 0; repeat < 5; repeat++) {
    for (const time of [0, 1, 1.75, 0.3, 2, 1]) {
      controller.apply(timeline, time, null, false);
      [meshA, meshB].forEach((mesh, index) => {
        const offset = mesh.getWorldPosition(new Vector3()).sub(rest[index]);
        closeTo(offset.distanceTo(new Vector3(1, 3, -2).multiplyScalar(1 - time / 2)), 0);
      });
    }
    controller.reset();
    assert.deepEqual(root.position.toArray(), localRest.toArray());
  }
  geometry.dispose();
  material.dispose();
});

test("V0.5: exporta sequência sem mudar GLB; rejeita elementos, dependências e durações inválidas", async () => {
  const before = structuredClone(source);
  const steps = source.assembly.steps;
  const edited = withAssembly(source, steps.map((step, index) => index === 0 ? { ...step, title: "Base revisada" } : step));
  assert.deepEqual(edited.geometry, source.geometry);
  assert.deepEqual(source, before);
  const loaded = await importGlbWithManifestPackage(bytes(glb), bytes(Buffer.from(JSON.stringify(edited))), source.geometry.file);
  assert.equal(loaded.sceneGraph.diagnostics.sha256Verified, true);
  assert.equal(loaded.manifest.assembly.steps[0].title, "Base revisada");
  loaded.dispose();
  for (const bad of [{ elementIds: [] }, { elementIds: ["desconhecido"] }, { durationSeconds: 0 },
    { dependsOn: [steps[1].id] }, { elementIds: steps[1].elementIds }, { id: steps[1].id }]) {
    assert.throws(() => withAssembly(source, [{ ...steps[0], ...bad }, ...steps.slice(1)]));
  }
  assert.throws(() => withAssembly(source, [steps[0], { ...steps[1], dependsOn: [steps[0].id, steps[0].id] }]));
});

test("V0.5: modos preservam materiais GLB e reutilizam arestas de uma geometria compartilhada", async () => {
  const loaded = await load();
  const display = new SceneDisplay(loaded);
  try {
    const meshes = [];
    loaded.model.scene.traverse((object) => { if (object.isMesh) meshes.push(object); });
    const originals = meshes.map((mesh) => mesh.material);
    const existingChildren = meshes.map((mesh) => mesh.children.length);
    const none = new Set();
    for (const mode of ["shaded", "clay", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial", "material"]) {
      display.apply({ ...defaultDisplay, mode }, none, null, none, null, none);
      if (mode === "technical") {
        const edges = new Map();
        for (const mesh of meshes) {
          const lines = mesh.children.find((item) => item.isLineSegments);
          assert.ok(lines);
          if (edges.has(mesh.geometry)) assert.equal(edges.get(mesh.geometry), lines.geometry);
          edges.set(mesh.geometry, lines.geometry);
        }
      }
    }
    meshes.forEach((mesh, index) => assert.equal(mesh.material, originals[index]));
    display.dispose();
    meshes.forEach((mesh, index) => assert.equal(mesh.children.length, existingChildren[index]));
  } finally { loaded.dispose(); }
});
