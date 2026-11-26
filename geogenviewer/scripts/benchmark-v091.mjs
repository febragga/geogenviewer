
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";

const baseline = process.argv[2];
const { InstancedBatchManager } = await import(baseline ? pathToFileURL(resolve(baseline)).href :
  "../src/features/viewer/scene/instancing.ts");
const note = "CPU / Three.js sem WebGL. picking mede o lote renderizado isoladamente. heap após GC é aproximação.";
const percentile = (ordered, q) => Number(ordered[Math.ceil(q * ordered.length) - 1].toFixed(3));
function profile(action, samples = 60) {
  for (let i = 0; i < 10; i++) action(i);
  const timings = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    action(i);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  return { p50: percentile(timings, 0.5), p95: percentile(timings, 0.95) };
}

const rows = [];
for (const count of [100, 1000, 10000]) {
  for (const shape of ["repeated", "mixed"]) {
    globalThis.gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    const host = new Group(), source = new Group();
    host.add(source);
    const common = new BoxGeometry(), alternate = new BoxGeometry(1, 0.7, 0.7);
    const gray = new MeshStandardMaterial(), glass = new MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    const meshes = Array.from({ length: count }, (_, index) => {
      const mesh = new Mesh(shape === "mixed" && index % 4 === 2 ? alternate : common,
        shape === "mixed" && index % 4 === 1 ? glass : gray);
      mesh.position.set((index % 100) * 2, Math.floor(index / 100) * 2, 0);
      mesh.name = String(index);
      source.add(mesh);
      return mesh;
    });
    const start = performance.now();
    const batch = new InstancedBatchManager(source, host, (mesh) => mesh?.name ?? null);
    const buildMs = Number((performance.now() - start).toFixed(3));
    const tint = new Color("#abcdef"), clean = new Set();
    const style = { mode: "material", opacity: 1, shadows: false, selected: clean, hidden: clean, ghosts: clean,
      hovered: null, isolated: null, colorForComponent: () => null, clayColor: tint, selectionColor: tint, hoverColor: tint };
    const apply = profile((index) => batch.applyDisplayAndVisibility({ ...style, hovered: String(index % count) }));
    const transforms = profile((index) => {
      meshes[0].position.z = index % 2 === 0 ? 0.125 : 0;
      batch.syncTransforms(source);
    });
    batch.applyDisplayAndVisibility(style);
    host.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    let expectedHit = null;
    const picking = profile((index) => {
      const x = (index % 25) * 8;
      ray.ray.origin.x = x;
      const hit = ray.intersectObject(batch.group)[0];
      expectedHit = hit ? batch.resolveHitComponentId(hit) : null;
    });
    globalThis.gc?.();
    const heapDeltaMiB = Number(((process.memoryUsage().heapUsed - heapBefore) / 1024 ** 2).toFixed(3));
    const slots = batch.batches.reduce((sum, entry) => sum + entry.slots.length, 0);
    const batches = batch.batches.length;
    batch.dispose();
    const restoredOriginals = meshes.filter((mesh) => mesh.visible).length;
    common.dispose(); alternate.dispose(); gray.dispose(); glass.dispose();
    rows.push({ count, shape, buildMs, slots, batches, estimatedGeometryDraws: count - slots + batches,
      applyMs: apply, transformsMs: transforms, pickingMs: picking, heapDeltaMiB, restoredOriginals, expectedHit });
  }
}

console.log(JSON.stringify({ runtime: process.version, platform: process.platform, arch: process.arch, note, rows }, null, 2));
