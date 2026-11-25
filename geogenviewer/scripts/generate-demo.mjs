import { mkdirSync, writeFileSync } from "node:fs";
import { BoxGeometry } from "three";

const box = new BoxGeometry(1, 1, 1);
const parts = [
  ["p01", "Pilar 01", [0, 0.15, 0], [0.04, 0.3, 0.04], 0],
  ["p02", "Pilar 02", [0.48, 0.15, 0], [0.04, 0.3, 0.04], 0],
  ["p03", "Pilar 03", [0, 0.15, -0.28], [0.04, 0.3, 0.04], 0],
  ["p04", "Pilar 04", [0.48, 0.15, -0.28], [0.04, 0.3, 0.04], 0],
  ["v01", "Viga 01", [0.24, 0.325, 0], [0.52, 0.05, 0.04], 1],
  ["v02", "Viga 02", [0.24, 0.325, -0.28], [0.52, 0.05, 0.04], 1],
  ["l01", "Laje 01", [0.24, 0.365, -0.14], [0.56, 0.03, 0.36], 2],
  ["c100", "Cubo de 100 mm", [0.38, 0.05, 0.17], [0.1, 0.1, 0.1], 3],
];
const colors = [[0.19, 0.31, 0.4], [0.18, 0.38, 0.55], [0.46, 0.58, 0.63], [0.95, 0.41, 0.13]];
const attributes = [box.attributes.position, box.attributes.normal, box.index];
const binary = Buffer.concat(attributes.map(({ array }) => Buffer.from(array.buffer, array.byteOffset, array.byteLength)));
let offset = 0;
const bufferViews = attributes.map(({ array }) => {
  const view = { buffer: 0, byteOffset: offset, byteLength: array.byteLength };
  offset += array.byteLength;
  return view;
});
const doc = {
  asset: { version: "2.0", generator: "GeoGenViewer · fixture sintética" },
  scene: 0,
  scenes: [{ nodes: parts.map((_, index) => index) }],
  nodes: parts.map(([id, name, translation, scale, mesh]) => ({ name, mesh, translation, scale, extras: { geogenElementId: id } })),
  meshes: colors.map((_, material) => ({ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material }] })),
  materials: colors.map((rgb) => ({ pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: 0.8 } })),
  buffers: [{ byteLength: binary.length }],
  bufferViews,
  accessors: [
    { bufferView: 0, componentType: 5126, count: attributes[0].count, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: attributes[1].count, type: "VEC3" },
    { bufferView: 2, componentType: 5123, count: attributes[2].count, type: "SCALAR" },
  ],
};

function chunk(payload, type, padding = 0) {
  const padded = Math.ceil(payload.length / 4) * 4;
  const result = Buffer.alloc(8 + padded, padding);
  result.writeUInt32LE(padded, 0);
  result.writeUInt32LE(type, 4);
  payload.copy(result, 8);
  return result;
}

const jsonChunk = chunk(Buffer.from(JSON.stringify(doc)), 0x4e4f534a, 0x20);
const binChunk = chunk(binary, 0x004e4942);
const header = Buffer.alloc(12);
header.write("glTF");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(header.length + jsonChunk.length + binChunk.length, 8);
mkdirSync(new URL("../public/demos/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/demos/estrutura.glb", import.meta.url), Buffer.concat([header, jsonChunk, binChunk]));
