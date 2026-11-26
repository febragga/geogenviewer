import { cpus, platform, release } from "node:os";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { clippingPlanes, firstVisibleHit, makeSections, setSectionAt, sectionAt } from "../src/lib/geogen/inspection/sections.ts";
import { intersectMeshSection } from "../src/lib/geogen/inspection/section-mesh.ts";
import { snapOnHit } from "../src/lib/geogen/inspection/snapping.ts";

function take(iterations, warm, run) {
  for (let i = 0; i < warm; i++) run(i);
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    run(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a,b) => a-b);
  return { median: samples[Math.floor(samples.length / 2)], p95: samples[Math.floor(samples.length * 0.95)] };
}

const runs = [100, 1000, 10000].map((components) => {
  const start = performance.now();
  const geometry = new BoxGeometry(0.1,0.1,0.1);
  const material = new MeshBasicMaterial({ side: 2 });
  const scene = new Group();
  for (let index = 0; index < components; index++) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(index % 20 * 0.15, Math.floor(index / 20) % 25 * 0.13, Math.floor(index / 500) * 0.12);
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  const setupMs = performance.now() - start;
  const meshes = scene.children;
  const extent = Math.ceil(components / 500) * 0.12 + 1;
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.001, extent + 3);
  camera.position.set(0,0,extent);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0.02,0.02), camera);
  const plane = new Plane(new Vector3(1,0,0), 0);
  const hits = raycaster.intersectObjects(meshes, false);
  const first = firstVisibleHit(hits, [plane], () => true);
  if (!first) throw new Error("A fixture deve interceptar o raio.");
  const snap = { modes: ["vertex", "midpoint", "edge", "surface"], pixels: 12 };
  const sections = makeSections();
  const template = sectionAt(sections, 0);
  const picking = take(100, 20, () => {
    const hits = raycaster.intersectObjects(meshes, false);
    firstVisibleHit(hits, [plane], () => true);
  });
  const snapping = take(1500, 150, () => snapOnHit(first, camera, 800, 800, 408, 392, snap, [plane]));
  const clipping = take(1500, 150, (index) => {
    const planes = template.planes.map((item) => ({ ...item, enabled: true, positionM: index * 0.001 }));
    const settings = setSectionAt(sections, 0, { ...template, planes });
    clippingPlanes(sectionAt(settings, 0));
  });
  const capGeneration = take(25, 5, (index) => {
    plane.constant = -index * 0.001;
    for (const mesh of meshes) intersectMeshSection(geometry, mesh.matrixWorld, plane, true);
  });
  geometry.dispose();
  material.dispose();
  return { components, setupMs, picking, snapping, clipping, capGeneration };
});
console.log(JSON.stringify({ node: process.version, os: platform()+" "+release(), cpu: cpus()[0].model, runs }, null, 2));
