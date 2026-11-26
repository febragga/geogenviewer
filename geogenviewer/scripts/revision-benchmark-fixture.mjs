import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../public/demos/revision-lab/proto-01/", import.meta.url);
const source = readFileSync(new URL("model.glb", root));
const jsonLength = source.readUInt32LE(12);
const template = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
const data = source.subarray(20 + jsonLength);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
const mesh = template.nodes[1].mesh;

export function makeBenchmarkFixture(count, variant) {
  const nodes = [{ name: "Benchmark sintético", children: Array.from({ length: count }, (_, index) => index + 1) }];
  const elements = [];
  const size = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < count; index++) {
    const id = "bench-" + index;
    const moved = variant && index % 10 === 0;
    nodes.push({ mesh, extras: { geogenElementId: id }, translation: [
      (index % size) * 0.12 - (size - 1) * 0.06, 0.04 + (moved ? 0.012 : 0), Math.floor(index / size) * 0.11 - (size - 1) * 0.055,
    ], ...(variant && index % 25 === 0 ? { scale: [1.05, 1, 1] } : {}) });
    elements.push({ id, name: "Peça " + index, category: index % 2 === 0 ? "beam" : "connector", layerId: "structure",
      groupIds: [], materialId: "sample-a", isClosed: true,
      fabrication: { material: "sample-a" }, properties: { "GeoGen:TypeCode": index % 2 === 0 ? "A" : "B" } });
  }
  const text = Buffer.from(JSON.stringify({ ...template, nodes }));
  const json = Buffer.alloc((text.length + 3) & ~3, 0x20);
  text.copy(json);
  const header = Buffer.from(source.subarray(0, 20));
  header.writeUInt32LE(header.length + json.length + data.length, 8);
  header.writeUInt32LE(json.length, 12);
  const glb = Buffer.concat([header, json, data]);
  const sha256 = createHash("sha256").update(glb).digest("hex");
  const revisionId = variant ? "bench-b" : "bench-a";
  const output = { ...manifest, project: { ...manifest.project, id: "benchmark-revisions", revisionId, prototypeId: revisionId },
    geometry: { ...manifest.geometry, sha256 }, assembly: null, elements };
  return { glb, manifest: Buffer.from(JSON.stringify(output)) };
}
