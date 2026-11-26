import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, Path, PlaneGeometry, Quaternion,
  Shape, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const dir = new URL("../public/demos/", import.meta.url);
mkdirSync(dir, { recursive: true });
const nodes = [{ name: "Laboratório de inspeção", children: [] }];
const meshes = [];
const accessors = [];
const bufferViews = [];
const chunks = [];
const elements = [];
let size = 0;

const layers = [
  { id: "calibracao", name: "Calibração", parentId: null, fullPath: "Calibração", visible: true, colorHex: "#58809c" },
  { id: "referencias", name: "Referências", parentId: "calibracao", fullPath: "Calibração::Referências", visible: true, colorHex: "#6dabc0" },
  { id: "estrutura", name: "Estrutura", parentId: null, fullPath: "Estrutura", visible: true, colorHex: "#b38c67" },
  { id: "conexoes", name: "Conexões", parentId: "estrutura", fullPath: "Estrutura::Conexões", visible: true, colorHex: "#557287" },
];
const groups = [
  { id: "medicao", name: "Medição", parentId: null },
  { id: "montagem", name: "Montagem sintética", parentId: null },
];
const colors = [[0.11, 0.48, 0.68], [0.72, 0.51, 0.29], [0.31, 0.48, 0.55], [0.23, 0.59, 0.45]];
const materials = ["Azul de referência", "Madeira sintética", "Metal sintético", "Peça de teste"].map((name, index) => ({
  id: "mat-" + index, name,
}));
const blocks = [{ id: "bloco-ref", name: "Bloco de referência" }];

function append(array, componentType, type, count, bounds, target = 34962) {
  const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const padded = Buffer.alloc((data.length + 3) & ~3);
  data.copy(padded);
  const bufferView = bufferViews.push({ buffer: 0, byteOffset: size, byteLength: data.length, target }) - 1;
  chunks.push(padded);
  size += padded.length;
  return accessors.push({ bufferView, componentType, count, type, ...bounds }) - 1;
}

function geometryMesh(geometry, material) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const pos = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const POSITION = append(pos.array, 5126, "VEC3", pos.count, { min: box.min.toArray(), max: box.max.toArray() });
  const NORMAL = append(normal.array, 5126, "VEC3", normal.count);
  const primitive = { attributes: { POSITION, NORMAL }, material };
  if (geometry.index) primitive.indices = append(geometry.index.array, geometry.index.array instanceof Uint32Array ? 5125 : 5123,
    "SCALAR", geometry.index.count, undefined, 34963);
  return meshes.push({ primitives: [primitive] }) - 1;
}
function polygon(points) {
  const shape = new Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  return shape;
}
function rectangle(w, h) { return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }
function ring(w, h, hole, depth) {
  const shape = polygon(rectangle(w, h));
  const path = new Path();
  const loop = hole.slice().reverse();
  path.moveTo(...loop[0]);
  for (const point of loop.slice(1)) path.lineTo(...point);
  path.closePath();
  shape.holes.push(path);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
}
function shell() {
  const outside = new BoxGeometry(0.1, 0.09, 0.095).toNonIndexed();
  const inside = new BoxGeometry(0.064, 0.057, 0.057).toNonIndexed();
  const pos = inside.getAttribute("position");
  const buffer = pos.array;
  for (let i = 0; i < buffer.length; i += 9) {
    for (let j = 0; j < 3; j++) [buffer[i + 3 + j], buffer[i + 6 + j]] = [buffer[i + 6 + j], buffer[i + 3 + j]];
  }
  inside.computeVertexNormals();
  return mergeGeometries([outside, inside]);
}

function add(id, name, geometry, translation, { category = "other", layerId = "referencias", material = 0,
  groupIds = ["medicao"], geometryType = "mesh", isClosed = true, scale, rotation, sharedMesh, children, cadBox } = {}) {
  const node = { name, translation, extras: { geogenElementId: id } };
  if (scale) node.scale = scale;
  if (rotation) node.rotation = rotation;
  const index = nodes.push(node) - 1;
  nodes[0].children.push(index);
  if (children) {
    node.children = children.map(({ geometry: child, position }) => nodes.push({ mesh: geometryMesh(child, material), translation: position }) - 1);
  } else node.mesh = sharedMesh ?? geometryMesh(geometry, material);
  elements.push({
    id, name, category, layerId, groupIds, materialId: "mat-" + material,
    geometryType, isClosed, isValid: true, ...(sharedMesh === undefined ? {} : { blockDefinitionId: "bloco-ref" }),
    ...(cadBox ? { boundingBoxM: { min: cadBox[0], max: cadBox[1], source: "authored" } } : {}),
  });
}
const cx = -0.32;
const cz = 0.18;
add("cubo-100", "Cubo de 100 mm", new BoxGeometry(0.1, 0.1, 0.1), [cx, 0.05, cz], {
  cadBox: [[cx - 0.05, 0, cz - 0.05], [cx + 0.05, 0.1, cz + 0.05]],
});
add("prisma", "Prisma assimétrico", new ExtrudeGeometry(polygon([[-0.045,-0.035],[0.046,-0.03],[0.03,0.047],[-0.017,0.027]]), { depth: 0.08, bevelEnabled:false }), [-0.16, 0.055, 0.13], { material: 3 });
add("viga", "Viga", new BoxGeometry(0.25, 0.04, 0.035), [-0.17, 0.18, -0.15], { category: "beam", layerId: "estrutura", material: 1, groupIds: ["montagem"] });
add("pilar", "Pilar", new BoxGeometry(0.045, 0.18, 0.05), [-0.24, 0.09, -0.15], { category: "column", layerId: "estrutura", material: 1, groupIds: ["montagem"] });
add("laje", "Laje", new BoxGeometry(0.21, 0.022, 0.105), [-0.14, 0.21, -0.135], { category: "slab", layerId: "estrutura", material: 1, groupIds: ["montagem"] });
add("cilindro", "Cilindro", new CylinderGeometry(0.039, 0.039, 0.10, 32), [0.01, 0.05, 0.18], { material: 2 });
const circle = Array.from({ length: 32 }, (_, i) => [0.024 * Math.cos(i * Math.PI / 16), 0.024 * Math.sin(i * Math.PI / 16)]);
add("furo", "Furo passante", ring(0.105, 0.09, circle, 0.06), [0.15, 0.05, 0.132], { material: 2 });
add("cavidade", "Peça com cavidade interna", shell(), [0.30, 0.047, 0.18], { material: 3 });
add("encaixe-femea", "Conector fêmea", ring(0.08, 0.074, rectangle(0.02026, 0.02026), 0.054), [0.10, 0.075, -0.13], { category: "connector", layerId: "conexoes", material: 2, groupIds: ["medicao", "montagem"] });
add("encaixe-macho", "Conector macho", new BoxGeometry(0.02, 0.02, 0.06), [0.10, 0.075, -0.10], { category: "connector", layerId: "conexoes", material: 3, groupIds: ["medicao", "montagem"] });
add("pino", "Pino cilíndrico", new CylinderGeometry(0.012, 0.012, 0.09, 24), [0.20, 0.045, -0.14], { category: "connector", layerId: "conexoes", material: 2, groupIds: ["montagem"] });
add("rebaixo", "Prisma com rebaixo lateral", new ExtrudeGeometry(polygon([[-0.04,-0.04],[0.04,-0.04],[0.04,0.04],[0.002,0.04],[0.002,0.012],[-0.04,0.012]]), { depth: 0.055, bevelEnabled: false }), [0.31, 0.045, -0.15], { material: 3 });
add("composto", "Conjunto composto", null, [0.05, 0.028, 0.01], { geometryType: "composite", material: 1, children: [
  { geometry: new BoxGeometry(0.09, 0.04, 0.03), position: [0, 0, 0] },
  { geometry: new BoxGeometry(0.025, 0.056, 0.03), position: [0.032, 0.035, 0] },
] });
add("aberta", "Malha aberta", new PlaneGeometry(0.11, 0.09, 2, 2), [0.33, 0.085, 0.005], { material: 0, isClosed: false });
const sharedMesh = geometryMesh(new BoxGeometry(0.066, 0.085, 0.048), 0);
add("bloco-1", "Bloco instanciado", null, [-0.29,0.043,0.015], { sharedMesh, geometryType: "blockInstance" });
add("bloco-2", "Bloco rotacionado", null, [-0.17,0.05,0.01], { sharedMesh, geometryType: "blockInstance",
  rotation: new Quaternion().setFromAxisAngle(new Vector3(0,1,0), Math.PI / 5).toArray() });
add("bloco-3", "Bloco em escala não uniforme", null, [-0.055,0.055,0.025], { sharedMesh, geometryType: "blockInstance", scale: [1.4,1.2,0.65] });

const bin = Buffer.concat(chunks, size);
const gltf = {
  asset: { version: "2.0", generator: "GeoGenViewer inspection-lab" }, scene: 0, scenes: [{ nodes: [0] }],
  nodes, meshes, accessors, bufferViews, buffers: [{ byteLength: bin.length }],
  materials: materials.map(({ name }, index) => ({ name, doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: [...colors[index], 1], roughnessFactor: 0.75, metallicFactor: 0 } })),
};
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc((json.length + 3) & ~3, 0x20);
json.copy(padded);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + 8 + bin.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, padded, binHead, bin]);
const sha256 = createHash("sha256").update(glb).digest("hex");
const fileName = "inspection-lab.glb";
const manifest = {
  schemaVersion: "1.0.0",
  project: { id: "inspection-lab", title: "Laboratório sintético de inspeção", revisionId: "lab-r1",
    geometryKind: "physicalModel", scaleDenominator: 50, displayUnit: "mm",
    description: "Fixture sintética de inspeção. Folga lateral nominal de 0,13 mm entre encaixes." },
  source: { application: "GeoGenViewer Synthetic Generator", sourceUnit: "mm", sourceUpAxis: "Z", sourceOrigin: [1200000, 580000, 27000], metersPerSourceUnit: 0.001 },
  geometry: { file: fileName, format: "glb", coordinateSystem: "RH_Y_UP", unit: "m", nodeMatchStrategy: "extras", sha256 },
  layers, groups, materials, elements, blocks,
  assembly: { steps: [
    { id: "pilares", title: "Inserir o pilar", elementIds: ["pilar"], dependsOn: [], durationSeconds: 1, insertionOffsetM: [0, 0.08, 0] },
    { id: "superior", title: "Inserir viga e laje", elementIds: ["viga", "laje"], dependsOn: ["pilares"], durationSeconds: 2, insertionOffsetM: [0, 0.12, 0] },
  ] },
};
const anchor = (elementId, localM) => ({ elementId, localM, nodePath: [], instanceId: null, snap: "vertex" });
const measurement = (id, name, valueM, anchors) => ({ id, name, kind: "distance", pose: "rest", valueM, anchors,
  visible: true, provenance: "mesh", capturedIn: "inspect" });
const section = {
  planes: ["X", "Y", "Z"].map((axis) => ({ id: axis, axis, name: "Plano " + axis, enabled: false, positionM: 0.05, flipped: false, gizmo: true, gizmoOpacity: 0.65 })),
  mode: "outline", fill: true, fillColor: "#b6c9d5", outlineColor: "#466a82", opacity: 1, lineWidth: 1.5,
};
const inspection = {
  schemaVersion: "1.0.0", model: { projectId: manifest.project.id, revisionId: manifest.project.revisionId, fileName, bytes: glb.length, sha256 },
  sections: { shared: true, views: Array(4).fill(section) },
  snap: { modes: ["surface", "vertex", "edge", "midpoint"], pixels: 12 },
  capture: { width: 1920, background: "white", color: "#f1f5f9", measurements: true, identifiers: false, gizmos: false, grid: false,
    axes: false, selection: false, scale: true },
  measurements: [
    measurement("cubo-lado", "Lado nominal do cubo", 0.1, [
      anchor("cubo-100", [-0.05,0.05,0.05]), anchor("cubo-100", [0.05,0.05,0.05]),
    ]),
    measurement("folga-x", "Folga nominal de referência", 0.00013, [
      { ...anchor("encaixe-macho", [0.010,0.010,0.024]), snap: "surface" },
      { ...anchor("encaixe-femea", [0.01013,0.010,0.054]), snap: "surface" },
    ]),
  ],
};
const write = (name, data) => writeFileSync(new URL(name, dir), JSON.stringify(data, null, 2) + "\n");
writeFileSync(new URL(fileName, dir), glb);
write("inspection-lab.manifest.json", manifest);
write("inspection-lab.inspection.json", inspection);
write("inspection-lab.expected.json", {
  synthetic: true, coordinateSystem: "RH_Y_UP", unit: "m", cubeSizeM: 0.1, cubeFaceDiagonalM: Math.SQRT2 * 0.1,
  cubeSpatialDiagonalM: Math.sqrt(3) * 0.1, maleWidthM: 0.020, openingWidthM: 0.02026, sideClearanceM: 0.00013,
  toleranceM: 0.000002, sha256,
});
console.log(`${elements.length} elementos · ${glb.length} bytes · SHA-256 ${sha256}`);
