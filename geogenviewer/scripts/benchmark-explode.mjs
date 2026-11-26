import { performance } from "node:perf_hooks";
import {
  defaultExplodeParams,
  ExplodedViewController,
} from "../src/lib/geogen/explode/controller.ts";
import { importGlbBasicPackage } from "../src/lib/geogen/importers/package.ts";

function buildSyntheticSceneGlb(componentCount) {
  const bin = Buffer.alloc(44);
  bin.writeFloatLE(0, 0); bin.writeFloatLE(0, 4); bin.writeFloatLE(0, 8);
  bin.writeFloatLE(0.05, 12); bin.writeFloatLE(0, 16); bin.writeFloatLE(0, 20);
  bin.writeFloatLE(0, 24); bin.writeFloatLE(0.05, 28); bin.writeFloatLE(0, 32);
  bin.writeUInt16LE(0, 36); bin.writeUInt16LE(1, 38); bin.writeUInt16LE(2, 40);

  const nodes = [];
  const roots = [];
  for (let i = 0; i < componentCount; i++) {
    const col = i % 50;
    const row = Math.floor(i / 50);
    nodes.push({
      name: `Part_${i}`,
      mesh: 0,
      translation: [col * 0.1, (i % 4) * 0.08, row * 0.1],
      extras: { geogenElementId: `part-${i}` },
    });
    roots.push(i);
  }

  const doc = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: roots }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    materials: [{ name: "Default", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.05, 0.05, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  };

  const jsonRaw = Buffer.from(JSON.stringify(doc), "utf8");
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc((4 - (jsonRaw.length % 4)) % 4, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0x00)]);
  const len = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const h = Buffer.alloc(12);
  h.write("glTF", 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(len, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const buf = Buffer.concat([h, jh, jsonChunk, bh, binChunk]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function main() {
  const scales = [100, 1000, 10000];
  const results = [];

  for (const count of scales) {
    const glb = buildSyntheticSceneGlb(count);
    const pkg = await importGlbBasicPackage(glb, `explode_${count}.glb`);
    const heapBefore = process.memoryUsage().heapUsed;

    const tInit0 = performance.now();
    const ctrl = new ExplodedViewController(pkg);
    ctrl.prepare({ ...defaultExplodeParams, enabled: true, mode: "radial" }, []);
    const prepareMs = performance.now() - tInit0;

    // Simulate 60 animation frames applying continuous factors
    const lineBuffer = new Float32Array(count * 6);
    const emptyHidden = new Set();

    const tApply0 = performance.now();
    for (let f = 1; f <= 60; f++) {
      ctrl.applyFactor(f / 60);
    }
    const apply60FramesMs = performance.now() - tApply0;

    const tLines0 = performance.now();
    for (let f = 1; f <= 60; f++) {
      ctrl.writeReferenceSegmentsBuffer(lineBuffer, emptyHidden, null);
    }
    const lines60FramesMs = performance.now() - tLines0;

    const tReset0 = performance.now();
    ctrl.reset();
    const resetMs = performance.now() - tReset0;

    const heapAfter = process.memoryUsage().heapUsed;
    pkg.dispose();

    results.push({
      components: count,
      prepareMs: Number(prepareMs.toFixed(2)),
      applySingleFrameAvgMs: Number((apply60FramesMs / 60).toFixed(3)),
      refLinesSingleFrameAvgMs: Number((lines60FramesMs / 60).toFixed(3)),
      resetMs: Number(resetMs.toFixed(3)),
      heapDeltaMb: Number(((heapAfter - heapBefore) / (1024 * 1024)).toFixed(2)),
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

await main();
