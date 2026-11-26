import { cpus, platform, release } from "node:os";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { AssemblyPose } from "../src/lib/geogen/assembly/pose.ts";
import { compileAssembly } from "../src/lib/geogen/assembly/timeline.ts";

const runs = [100, 1000, 10000].map((count) => {
  const scene = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const objects = new Map();
  const steps = Array.from({ length: 10 }, (_, index) => ({
    id: String(index), title: "Etapa " + index,
    elementIds: [], dependsOn: index ? [String(index - 1)] : [], insertionOffsetM: [0, 0.6, 0],
  }));
  for (let index = 0; index < count; index++) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(index % 100, Math.floor(index / 100), 0);
    scene.add(mesh);
    objects.set(String(index), mesh);
    steps[index % steps.length].elementIds.push(String(index));
  }
  const start = performance.now();
  const timeline = compileAssembly(steps);
  const pose = new AssemblyPose(scene, objects);
  const setupMs = performance.now() - start;

  function measure(ghost) {
    const samples = [];
    for (let frame = 0; frame < 480; frame++) {
      const before = performance.now();
      pose.apply(timeline, (frame * 0.03) % timeline.total, null, ghost);
      if (frame >= 120) samples.push(performance.now() - before);
    }
    samples.sort((a, b) => a - b);
    return {
      medianMs: samples[Math.floor(samples.length / 2)],
      p95Ms: samples[Math.floor(samples.length * 0.95)],
    };
  }

  const result = { count, setupMs, normal: measure(false), ghosts: measure(true) };
  geometry.dispose();
  material.dispose();
  return result;
});

console.log(JSON.stringify({ node: process.version, os: platform() + " " + release(), cpu: cpus()[0].model, runs }, null, 2));
