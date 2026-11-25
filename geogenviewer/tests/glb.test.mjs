import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Box3, Vector3 } from "three";
import { importGlb, validateGlb } from "../src/lib/geogen/importers/glb.ts";

const fixture = readFileSync(new URL("../public/demos/estrutura.glb", import.meta.url));
const arrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function jsonOnly(document) {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, ...document }));
  const buffer = Buffer.alloc(20 + Math.ceil(json.length / 4) * 4, 32);
  buffer.write("glTF");
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(buffer.length - 20, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  return arrayBuffer(buffer);
}

test("preserva oito elementos, identificadores, eixo vertical e cubo de 100 mm", async () => {
  const model = await importGlb(arrayBuffer(fixture));
  assert.equal(model.scene.children.length, 8);
  const ids = model.scene.children.map((node) => node.userData.geogenElementId);
  assert.equal(new Set(ids).size, 8);
  const cube = model.scene.children.find((node) => node.userData.geogenElementId === "c100");
  const size = new Box3().setFromObject(cube).getSize(new Vector3());
  for (const dimension of size.toArray()) assert.ok(Math.abs(dimension - 0.1) < 1e-8);
  assert.ok(Math.abs(model.bounds.max.y - 0.38) < 1e-8);
  let disposals = 0;
  const geometry = cube.geometry;
  geometry.addEventListener("dispose", () => disposals++);
  model.dispose();
  assert.equal(disposals, 1);
});

test("rejeita truncamento, ciclo, recursos externos e compressão obrigatória sem decoder", () => {
  assert.throws(() => validateGlb(arrayBuffer(fixture.subarray(0, -1))), /GLB 2.0/);
  assert.throws(() => validateGlb(jsonOnly({ nodes: [{ children: [1] }, { children: [0] }] })), /hierarquia/);
  for (const collection of ["buffers", "images"]) {
    assert.throws(() => validateGlb(jsonOnly({ [collection]: [{ uri: "https://example.com/resource" }] })), /buffers e imagens/);
  }
  assert.throws(() => validateGlb(jsonOnly({ extensionsRequired: ["KHR_draco_mesh_compression"] })), /Draco/);
  assert.throws(() => validateGlb(jsonOnly({ extensionsRequired: ["VENDOR_unknown"] })), /extensão incompatível/);
});
