import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OrthographicCamera, Plane, PlaneGeometry, Raycaster, Vector2, Vector3 } from "three";
import { importGlbWithManifestPackage } from "../src/lib/geogen/importers/package.ts";
import { inspectionIdentity, matchesIdentity, parseInspection, validateInspection } from "../src/lib/geogen/inspection/document.ts";
import {
  cadAxes, clippedBounds, clippingPlanes, firstVisibleHit, makeSections, pointSurvives, rangeOnAxis, sectionAt,
  setSectionAt, shareSections, toCad,
} from "../src/lib/geogen/inspection/sections.ts";
import { intersectMeshSection } from "../src/lib/geogen/inspection/section-mesh.ts";
import { compareRestBounds, formatMeasurement, measurementValue, meshReferences, sourceCoordinates } from "../src/lib/geogen/inspection/measurements.ts";
import { snapOnHit } from "../src/lib/geogen/inspection/snapping.ts";
import { AssemblyPose } from "../src/lib/geogen/assembly/pose.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";
import { ExplodedViewController, defaultExplodeParams } from "../src/lib/geogen/explode/controller.ts";

const fixtures = new URL("../public/demos/", import.meta.url);
const read = (file) => readFile(new URL(file, fixtures));
const glb = await read("inspection-lab.glb");
const manifestBytes = await read("inspection-lab.manifest.json");
const expected = JSON.parse(await read("inspection-lab.expected.json"));
const demo = JSON.parse(await read("inspection-lab.inspection.json"));
const load = () => importGlbWithManifestPackage(Uint8Array.from(glb).buffer, Uint8Array.from(manifestBytes).buffer, "inspection-lab.glb");
const close = (actual, wanted, tolerance = expected.toleranceM) => assert.ok(Math.abs(actual - wanted) <= tolerance, `${actual} ≠ ${wanted}`);

function enable(configuration, slot, axis, positionM, flipped = false) {
  const current = sectionAt(configuration, slot);
  return setSectionAt(configuration, slot, {
    ...current, planes: current.planes.map((plane) => plane.axis === axis ? { ...plane, enabled: true, positionM, flipped } : plane),
  });
}

function triangleArea(positions) {
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const a = new Vector3(...positions.slice(i, i + 3));
    const b = new Vector3(...positions.slice(i + 3, i + 6)).sub(a);
    const c = new Vector3(...positions.slice(i + 6, i + 9)).sub(a);
    area += b.cross(c).length() / 2;
  }
  return area;
}

test("V0.6: cortes seguem X, Y invertido e Z vertical no sistema CAD", () => {
  const origin = new Vector3(3700, 5800, -6400);
  const start = makeSections(origin);
  assert.deepEqual(toCad(origin.toArray()), [3700, 6400, 5800]);
  for (const [index, axis] of cadAxes.entries()) {
    const pos = toCad(origin.toArray())[index];
    const active = enable(start, 0, axis, pos);
    const planes = clippingPlanes(sectionAt(active, 0));
    assert.equal(planes.length, 1);
    assert.equal(pointSurvives(origin.clone().addScaledVector(planes[0].normal, 0.001), planes), true);
    assert.equal(pointSurvives(origin.clone().addScaledVector(planes[0].normal, -0.001), planes), false);
    const inverse = clippingPlanes(sectionAt(enable(start, 0, axis, pos, true), 0));
    assert.equal(pointSurvives(origin.clone().addScaledVector(planes[0].normal, -0.001), inverse), true);
  }
  const range = rangeOnAxis(new Box3(new Vector3(2, 3, -8), new Vector3(4, 6, -5)), "Y");
  assert.deepEqual(range, [5, 8]);
});

test("V0.6: regiões independentes, compartilhamento explícito, múltiplos planos e reset", () => {
  const base = makeSections();
  const independent = enable(shareSections(base, 0, false), 2, "Z", 0.3);
  assert.equal(clippingPlanes(sectionAt(independent, 0)).length, 0);
  const multi = enable(independent, 2, "Y", 0.1, true);
  const planes = clippingPlanes(sectionAt(multi, 2));
  assert.equal(planes.length, 2);
  assert.equal(pointSurvives(new Vector3(2, 0.4, 0), planes), true);
  assert.equal(pointSurvives(new Vector3(2, 0.4, -0.2), planes), false);
  const original = new Box3(new Vector3(-1,-1,-1), new Vector3(1,1,1));
  const clipped = clippedBounds(original, planes);
  assert.deepEqual(clipped.min.toArray(), [-1,0.3,-0.1]);
  assert.equal(original.min.y, -1);
  assert.equal(clippingPlanes(sectionAt(shareSections(multi, 2, true), 0)).length, 2);
  assert.equal(clippingPlanes(sectionAt(base, 2)).length, 0);
});

test("V0.6: picking aceita o elemento atrás do que o corte removeu", () => {
  const geometry = new BoxGeometry(0.1,0.1,0.1);
  const material = new MeshBasicMaterial();
  const front = new Mesh(geometry, material);
  const rear = new Mesh(geometry, material);
  front.position.z = 0.4;
  rear.position.z = -0.3;
  front.updateMatrixWorld();
  rear.updateMatrixWorld();
  const ray = new Raycaster(new Vector3(0,0,1), new Vector3(0,0,-1));
  const hits = ray.intersectObjects([front, rear]);
  assert.equal(firstVisibleHit(hits, [], () => true).object, front);
  const clip = [new Plane(new Vector3(0,0,-1), 0)];
  assert.equal(firstVisibleHit(hits, clip, () => true).object, rear);
  assert.equal(firstVisibleHit(hits, [...clip, new Plane(new Vector3(0,1,0), -1)], () => true), undefined);
  rear.visible = false;
  assert.equal(firstVisibleHit(hits, clip, () => true), undefined);
  geometry.dispose();
  material.dispose();
});

test("V0.6: preenchimento de cubo fechado e contorno da malha aberta", () => {
  const cube = new BoxGeometry(0.1,0.1,0.1);
  const sheet = new PlaneGeometry(0.1,0.1);
  const plane = new Plane(new Vector3(1,0,0), 0);
  const closed = intersectMeshSection(cube, new Matrix4(), plane, true);
  assert.ok(closed.lines.length > 0);
  assert.equal(closed.incomplete, false);
  close(triangleArea(closed.triangles), 0.01);
  const open = intersectMeshSection(sheet, new Matrix4(), plane, true);
  assert.ok(open.lines.length > 0);
  assert.equal(open.incomplete, true);
  assert.equal(open.triangles.length, 0);
  const tangent = intersectMeshSection(cube, new Matrix4(), new Plane(new Vector3(1,0,0), 0.05), true);
  assert.equal(tangent.lines.length, 0);
  cube.dispose();
  sheet.dispose();
});

test("V0.6: caps preservam furo, cavidade e escala de instância", async () => {
  const loaded = await load();
  try {
    loaded.model.scene.updateMatrixWorld(true);
    const hole = loaded.objectByComponentId.get("furo");
    const result = intersectMeshSection(hole.geometry, hole.matrixWorld, new Plane(new Vector3(0,0,1), -0.16), true);
    assert.equal(result.incomplete, false);
    const polygonArea = 16 * 0.024 ** 2 * Math.sin(Math.PI / 16);
    close(triangleArea(result.triangles), 0.105 * 0.09 - polygonArea);
    const cavity = loaded.objectByComponentId.get("cavidade");
    const inner = intersectMeshSection(cavity.geometry, cavity.matrixWorld, new Plane(new Vector3(0,0,1), -0.18), true);
    assert.equal(inner.incomplete, false);
    close(triangleArea(inner.triangles), 0.1 * 0.09 - 0.064 * 0.057);
    const scaled = loaded.objectByComponentId.get("bloco-3");
    assert.equal(scaled.geometry, loaded.objectByComponentId.get("bloco-2").geometry);
    const profile = intersectMeshSection(scaled.geometry, scaled.matrixWorld, new Plane(new Vector3(0,1,0), -0.055), true);
    close(triangleArea(profile.triangles), 0.066 * 1.4 * 0.048 * 0.65);
  } finally { loaded.dispose(); }
});

test("V0.6: laboratório, dados canônicos, origem e folga de 0,13 mm", async () => {
  const loaded = await load();
  try {
    const model = inspectionIdentity(loaded);
    const refs = meshReferences(loaded.model.scene, loaded.objectByComponentId);
    const doc = parseInspection(JSON.stringify(demo), model, new Set(loaded.sceneGraph.componentOrder), (anchor) => Boolean(refs.target(anchor)));
    assert.equal(model.sha256, expected.sha256);
    for (const record of doc.measurements) close(measurementValue("distance", record.anchors.map((anchor) => refs.point(anchor, "rest"))), record.valueM);
    const cube = loaded.objectByComponentId.get("cubo-100");
    const component = loaded.sceneGraph.components["cubo-100"];
    assert.equal(compareRestBounds(component), null);
    const asCad = { ...component, cad: { ...component.cad, boundingBoxM: { ...component.cad.boundingBoxM, source: "cad" } } };
    for (const difference of compareRestBounds(asCad)) close(difference.deltaM, 0);
    const cubeBounds = new Box3().setFromObject(cube);
    const min = cubeBounds.min;
    const max = cubeBounds.max;
    close(min.distanceTo(max), expected.cubeSpatialDiagonalM);
    close(min.distanceTo(new Vector3(max.x, max.y, min.z)), expected.cubeFaceDiagonalM);
    const delta = measurementValue("delta", [min, max]);
    delta.forEach((value, index) => close(value, [0.1,-0.1,0.1][index]));
    assert.deepEqual(sourceCoordinates([1,2,3], loaded.manifest.source), [1201000,577000,29000]);
    assert.equal(formatMeasurement(0.1, "mm"), "100 mm");
    assert.equal(formatMeasurement(0.1, "cm"), "10 cm");
    assert.equal(formatMeasurement(0.1, "m"), "0,1 m");
    assert.equal(loaded.manifest.project.scaleDenominator, 50);
    const pos = loaded.objectByComponentId.get("encaixe-femea").geometry.getAttribute("position");
    assert.ok(Array.from({ length: pos.count }, (_, index) => pos.getX(index)).some((value) => Math.abs(value - expected.openingWidthM / 2) < 1e-7));
    assert.equal(formatMeasurement(expected.sideClearanceM, "mm"), "0,13 mm");
  } finally { loaded.dispose(); }
});

test("V0.6: âncoras compósitas, instâncias rotacionadas e regimes de pose", async () => {
  const loaded = await load();
  try {
    const { model: { scene }, objectByComponentId: objects } = loaded;
    const refs = meshReferences(scene, objects);
    const component = objects.get("composto");
    const child = component.children[1];
    const initial = child.getWorldPosition(new Vector3());
    const anchor = refs.anchor(child, "composto", initial, undefined, "surface");
    assert.deepEqual(anchor.nodePath, [1]);
    const block = objects.get("bloco-2");
    const point = new Vector3(0.015,0.01,-0.005).applyMatrix4(block.matrixWorld);
    const blockAnchor = refs.anchor(block, "bloco-2", point, undefined, "vertex");
    close(refs.point(blockAnchor, "rest").distanceTo(point), 0);
    assert.equal(refs.target({ ...anchor, nodePath: [99] }), null);
    const explode = new ExplodedViewController(loaded);
    explode.prepare({ ...defaultExplodeParams, enabled: true }, []);
    explode.applyFactor(0.6);
    scene.updateMatrixWorld(true);
    assert.ok(refs.point(anchor, "presentation").distanceTo(initial) > 0.005);
    close(refs.point(anchor, "rest").distanceTo(initial), 0);
    for (let cycle = 0; cycle < 20; cycle++) {
      explode.applyFactor(cycle / 19);
      explode.reset();
      scene.updateMatrixWorld(true);
      close(refs.point(anchor, "presentation").distanceTo(initial), 0);
    }
    const pose = new AssemblyPose(scene, objects);
    const timeline = compileAssembly(loaded.manifest.assembly.steps);
    const column = objects.get("pilar");
    const original = column.getWorldPosition(new Vector3());
    const columnAnchor = refs.anchor(column, "pilar", original, undefined, "surface");
    for (const seconds of [0.5, 2.3, 0.5]) {
      pose.apply(timeline, seconds, null, false);
      scene.updateMatrixWorld(true);
      close(refs.point(columnAnchor, "presentation").y - original.y, seconds === 0.5 ? 0.04 : 0);
      close(refs.point(columnAnchor, "rest").distanceTo(original), 0);
    }
    pose.reset();
    scene.updateMatrixWorld(true);
    close(refs.point(columnAnchor, "presentation").distanceTo(original), 0);
  } finally { loaded.dispose(); }
});

test("V0.6: âncora de instância GPU mantém a ocorrência correta", () => {
  const geometry = new BoxGeometry(0.1,0.1,0.1);
  const material = new MeshBasicMaterial();
  const node = new InstancedMesh(geometry, material, 2);
  node.setMatrixAt(0, new Matrix4().makeTranslation(0.2,0,0));
  node.setMatrixAt(1, new Matrix4().makeScale(2,1,0.5).setPosition(0.6,0,0));
  const group = new Group();
  group.add(node);
  const refs = meshReferences(group, new Map([["repetido",node]]));
  const world = new Vector3(0.7,0.02,0);
  const point = refs.anchor(node, "repetido", world, 1, "surface");
  assert.equal(point.instanceId, 1);
  assert.equal(refs.valid(point), true);
  close(point.localM[0], 0.05);
  node.position.y = 0.25;
  group.updateMatrixWorld(true);
  close(refs.point(point, "rest").distanceTo(world), 0);
  close(refs.point(point, "presentation").y, 0.27);
  assert.equal(refs.valid({ ...point, instanceId: 2 }), false);
  geometry.dispose();
  material.dispose();
});

test("V0.6: snap local em vértice, aresta e meio, tolerância visual e bypass", () => {
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({ side: 2 });
  const mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const camera = new OrthographicCamera(-1,1,1,-1,0.01,20);
  camera.position.z = 2;
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  const width = 500;
  function measure(x, y, mode, options = {}) {
    ray.setFromCamera(new Vector2(x, y), camera);
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit);
    return snapOnHit(hit, camera, width,width, (x+1)*width/2, (1-y)*width/2,
      { modes: [mode], pixels: 12 }, options.planes ?? [], options.bypass);
  }
  const vertex = measure(0.48,0.48,"vertex");
  assert.equal(vertex.mode, "vertex");
  assert.deepEqual(vertex.point.toArray(), [0.5,0.5,0]);
  const midpoint = measure(0.48,0.005,"midpoint");
  assert.equal(midpoint.mode, "midpoint");
  assert.deepEqual(midpoint.point.toArray(), [0.5,0,0]);
  const edge = measure(0.48,0.14,"edge");
  close(edge.point.x, 0.5);
  close(edge.point.y, 0.14);
  assert.equal(measure(0.30,0.30,"vertex"), null);
  assert.equal(measure(0.48,0.48,"vertex",{ planes:[new Plane(new Vector3(-1,0,0),0.49)] }), null);
  assert.equal(measure(0.48,0.48,"vertex",{ bypass:true }).mode, "surface");
  geometry.dispose();
  material.dispose();
});

test("V0.6: JSON valida versão, referências, medidas e identidade semântica/binária", async () => {
  const loaded = await load();
  try {
    const identity = inspectionIdentity(loaded);
    const ids = new Set(loaded.sceneGraph.componentOrder);
    const ref = meshReferences(loaded.model.scene, loaded.objectByComponentId);
    const exists = (anchor) => ref.valid(anchor);
    validateInspection(demo, identity, ids, exists);
    const reject = (mutate) => {
      const bad = structuredClone(demo);
      mutate(bad);
      assert.throws(() => validateInspection(bad, identity, ids, exists));
    };
    reject((bad) => { bad.schemaVersion = "2.0.0"; });
    reject((bad) => { bad.sections.views[0].planes[0].axis = "Z"; });
    reject((bad) => { bad.measurements.push(bad.measurements[0]); });
    reject((bad) => { bad.measurements[0].anchors[0].elementId = "missing"; });
    reject((bad) => { bad.measurements[0].anchors[0].nodePath = [343]; });
    reject((bad) => { bad.measurements[0].anchors[0].localM[0] = Infinity; });
    reject((bad) => { bad.measurements[0].anchors[0].localM[0] = 10; });
    reject((bad) => { bad.measurements[0].anchors.pop(); });
    reject((bad) => { bad.model.sha256 = "0".repeat(64); });
    assert.equal(matchesIdentity(identity, { ...identity, revisionId: "lab-r2" }), false);
    assert.throws(() => parseInspection(" ".repeat(2 * 1024 * 1024 + 1), identity, ids), /2 MB/);
  } finally { loaded.dispose(); }
});
