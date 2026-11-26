import { performance } from "node:perf_hooks";
import { buildTreeRows } from "../src/features/viewer/tree/build-rows.ts";
import {
  importGlbBasicPackage,
  importGlbWithManifestPackage,
  sha256Hex,
} from "../src/lib/geogen/importers/package.ts";
import { parseAndValidateManifest } from "../src/lib/geogen/validation/manifest.ts";

function buildScaledScene(componentCount) {
  // Minimal triangle buffer shared across components
  const bin = Buffer.alloc(44);
  bin.writeFloatLE(0, 0); bin.writeFloatLE(0, 4); bin.writeFloatLE(0, 8);
  bin.writeFloatLE(0.05, 12); bin.writeFloatLE(0, 16); bin.writeFloatLE(0, 20);
  bin.writeFloatLE(0, 24); bin.writeFloatLE(0.05, 28); bin.writeFloatLE(0, 32);
  bin.writeUInt16LE(0, 36); bin.writeUInt16LE(1, 38); bin.writeUInt16LE(2, 40);

  const nodes = [];
  const rootIndices = [];
  const elements = [];

  for (let i = 0; i < componentCount; i++) {
    const id = `el_${String(i).padStart(5, "0")}`;
    const col = i % 50;
    const row = Math.floor(i / 50);
    nodes.push({
      name: `Component_${i}`,
      mesh: 0,
      translation: [col * 0.1, 0, row * 0.1],
      extras: { geogenElementId: id },
    });
    rootIndices.push(i);
    elements.push({
      id,
      name: `Peça ${i}`,
      category: i % 3 === 0 ? "column" : i % 3 === 1 ? "beam" : "slab",
      layerId: `layer_${i % 5}`,
      groupIds: [`group_${i % 4}`],
      materialId: "mat_timber",
      dimensions: { lengthM: 0.1, widthM: 0.05, thicknessM: 0.02, source: "cad" },
    });
  }

  const doc = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: rootIndices }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    materials: [{ name: "MDF", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.72, 0.6, 1] } }],
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
        max: [0.05, 0.05, 0],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 3,
        type: "SCALAR",
      },
    ],
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

  const glbBuf = Buffer.concat([header, jsonHdr, jsonChunk, binHdr, binChunk]);
  const glbAb = glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength);

  return {
    glbAb,
    manifestObj: {
      schemaVersion: "1.0.0",
      project: {
        id: `bench_${componentCount}`,
        title: `Benchmark ${componentCount}`,
        revisionId: "rev_1",
        geometryKind: "physicalModel",
        scaleDenominator: 20,
        displayUnit: "mm",
      },
      source: {
        application: "Synthetic Benchmark",
        sourceUnit: "mm",
        sourceUpAxis: "Z",
        sourceOrigin: [0, 0, 0],
        metersPerSourceUnit: 0.001,
      },
      geometry: {
        file: `bench_${componentCount}.glb`,
        format: "glb",
        coordinateSystem: "RH_Y_UP",
        unit: "m",
        nodeMatchStrategy: "extras",
        sha256: null,
      },
      layers: [0, 1, 2, 3, 4].map((k) => ({ id: `layer_${k}`, name: `Camada ${k}`, parentId: null })),
      groups: [0, 1, 2, 3].map((k) => ({ id: `group_${k}`, name: `Grupo ${k}`, parentId: null })),
      materials: [{ id: "mat_timber", name: "MDF" }],
      elements,
    },
  };
}

async function runBenchmark() {
  const scales = [100, 1000, 10000];
  const results = [];

  for (const count of scales) {
    const { glbAb, manifestObj } = buildScaledScene(count);
    manifestObj.geometry.sha256 = await sha256Hex(glbAb);
    const manifestJson = JSON.stringify(manifestObj);
    const manifestBytes = new TextEncoder().encode(manifestJson).buffer;

    const heapBefore = process.memoryUsage().heapUsed;

    const tVal0 = performance.now();
    parseAndValidateManifest(manifestBytes);
    const validationMs = performance.now() - tVal0;

    const tBasic0 = performance.now();
    const basicPkg = await importGlbBasicPackage(glbAb, `bench_${count}.glb`);
    const basicImportMs = performance.now() - tBasic0;
    basicPkg.dispose();

    const tFull0 = performance.now();
    const fullPkg = await importGlbWithManifestPackage(glbAb, manifestBytes, `bench_${count}.glb`);
    const fullImportMs = performance.now() - tFull0;

    const tTree0 = performance.now();
    const rowsAll = buildTreeRows(fullPkg.sceneGraph, "hierarchy", "", []);
    const treeFlattenMs = performance.now() - tTree0;

    const tSearch0 = performance.now();
    const rowsSearch = buildTreeRows(fullPkg.sceneGraph, "hierarchy", `Peça ${count - 1}`, []);
    const treeSearchMs = performance.now() - tSearch0;

    const tResolve0 = performance.now();
    let resolvedHits = 0;
    for (const obj of fullPkg.objectByComponentId.values()) {
      if (fullPkg.resolveComponentId(obj)) resolvedHits += 1;
    }
    const resolveAllMs = performance.now() - tResolve0;

    const heapAfter = process.memoryUsage().heapUsed;
    fullPkg.dispose();

    results.push({
      components: count,
      glbBytes: glbAb.byteLength,
      manifestBytes: manifestBytes.byteLength,
      validationMs: Number(validationMs.toFixed(2)),
      basicImportMs: Number(basicImportMs.toFixed(2)),
      fullImportMs: Number(fullImportMs.toFixed(2)),
      treeFlattenMs: Number(treeFlattenMs.toFixed(2)),
      treeSearchMs: Number(treeSearchMs.toFixed(2)),
      resolveAllMs: Number(resolveAllMs.toFixed(2)),
      rowsRendered: rowsAll.length,
      searchHits: rowsSearch.length,
      resolvedHits,
      heapDeltaMb: Number(((heapAfter - heapBefore) / (1024 * 1024)).toFixed(2)),
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

await runBenchmark();
