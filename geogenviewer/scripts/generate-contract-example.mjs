import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BoxGeometry } from "three";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appDir, "..");
const contractDir = path.join(repoRoot, "exporter-contract");

const box = new BoxGeometry(1, 1, 1);
const attributes = [box.attributes.position, box.attributes.normal, box.index];
const binary = Buffer.concat(
  attributes.map(({ array }) =>
    Buffer.from(array.buffer, array.byteOffset, array.byteLength)
  )
);

let offset = 0;
const bufferViews = attributes.map(({ array }) => {
  const view = { buffer: 0, byteOffset: offset, byteLength: array.byteLength };
  offset += array.byteLength;
  return view;
});

// Meshes: 0 = Pilar/Coluna (blue-grey), 1 = Viga (steel blue), 2 = Peça composta sub-A (warm grey),
// 3 = Peça composta sub-B / pino (ice blue), 4 = Bloco conector compartilhado (amber), 5 = Cubo 100mm (terracotta)
const colors = [
  [0.24, 0.34, 0.42],
  [0.18, 0.42, 0.6],
  [0.54, 0.58, 0.62],
  [0.71, 0.85, 0.95],
  [0.85, 0.66, 0.28],
  [0.92, 0.41, 0.16],
];

// Nodes layout:
// 0: ex-cube-100 (Cubo de 100 mm)
// 1: ex-column-01 (Pilar P01)
// 2: ex-beam-01 (Viga V01)
// 3: ex-composite-01 (Parent component root with 2 child meshes: nodes 4 & 5)
// 4: child mesh A (no geogenElementId -> belongs to parent ex-composite-01)
// 5: child mesh B (no geogenElementId -> belongs to parent ex-composite-01)
// 6: ex-conn-inst-01 (Block instance 1 sharing mesh 4)
// 7: ex-conn-inst-02 (Block instance 2 sharing mesh 4, rotated)
const nodes = [
  {
    name: "Cubo de 100 mm",
    mesh: 5,
    translation: [0.38, 0.05, 0.16],
    scale: [0.1, 0.1, 0.1],
    extras: { geogenElementId: "ex-cube-100" },
  },
  {
    name: "Pilar P01",
    mesh: 0,
    translation: [0, 0.15, 0],
    scale: [0.04, 0.3, 0.04],
    extras: { geogenElementId: "ex-column-01" },
  },
  {
    name: "Viga V01",
    mesh: 1,
    translation: [0.18, 0.32, 0],
    scale: [0.4, 0.04, 0.04],
    extras: { geogenElementId: "ex-beam-01" },
  },
  {
    name: "Base Composta C01",
    translation: [0, 0.015, -0.18],
    children: [4, 5],
    extras: { geogenElementId: "ex-composite-01" },
  },
  {
    name: "Base Composta — Corpo",
    mesh: 2,
    translation: [0, 0, 0],
    scale: [0.14, 0.03, 0.08],
  },
  {
    name: "Base Composta — Pino",
    mesh: 3,
    translation: [0, 0.025, 0],
    scale: [0.03, 0.02, 0.03],
  },
  {
    name: "Conector Bloco A [1]",
    mesh: 4,
    translation: [0.36, 0.32, 0],
    scale: [0.05, 0.05, 0.05],
    extras: { geogenElementId: "ex-conn-inst-01" },
  },
  {
    name: "Conector Bloco A [2]",
    mesh: 4,
    translation: [0.0, 0.32, 0],
    rotation: [0, 0.3826834, 0, 0.9238795],
    scale: [0.05, 0.05, 0.05],
    extras: { geogenElementId: "ex-conn-inst-02" },
  },
];

const doc = {
  asset: { version: "2.0", generator: "GeoGenViewer · contrato de exemplo v1" },
  scene: 0,
  scenes: [{ nodes: [0, 1, 2, 3, 6, 7] }],
  nodes,
  meshes: colors.map((_, material) => ({
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material }],
  })),
  materials: colors.map((rgb) => ({
    pbrMetallicRoughness: {
      baseColorFactor: [...rgb, 1],
      metallicFactor: 0,
      roughnessFactor: 0.78,
    },
  })),
  buffers: [{ byteLength: binary.length }],
  bufferViews,
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: attributes[0].count,
      type: "VEC3",
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    },
    {
      bufferView: 1,
      componentType: 5126,
      count: attributes[1].count,
      type: "VEC3",
    },
    {
      bufferView: 2,
      componentType: 5123,
      count: attributes[2].count,
      type: "SCALAR",
    },
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
const glbBytes = Buffer.concat([header, jsonChunk, binChunk]);
const glbSha256 = createHash("sha256").update(glbBytes).digest("hex");

const manifest = {
  schemaVersion: "1.0.0",
  project: {
    id: "contrato-exemplo-v1",
    title: "Fixture de Contrato Rhino/GeoGen v1",
    revisionId: "rev-01",
    description:
      "Exemplo sintético contemplando cubo 100 mm, pilar, viga, peça multi-mesh, instâncias de bloco e layers aninhados.",
    geometryKind: "physicalModel",
    scaleDenominator: 50,
    displayUnit: "mm",
    prototypeId: "proto-contrato-01",
  },
  source: {
    application: "Rhino",
    applicationVersion: "8",
    exporterVersion: "contract-example-1.0.0",
    sourceUnit: "mm",
    sourceUpAxis: "Z",
    sourceOrigin: [0, 0, 0],
    metersPerSourceUnit: 0.001,
  },
  geometry: {
    file: "model.example.glb",
    format: "glb",
    coordinateSystem: "RH_Y_UP",
    unit: "m",
    nodeMatchStrategy: "extras",
    sha256: glbSha256,
  },
  layers: [
    {
      id: "l-estrutura",
      name: "Estrutura",
      parentId: null,
      fullPath: "Estrutura",
      colorHex: "#5A7D95",
      visible: true,
    },
    {
      id: "l-estrutura-pilares",
      name: "Pilares",
      parentId: "l-estrutura",
      fullPath: "Estrutura::Pilares",
      colorHex: "#3D576B",
      visible: true,
    },
    {
      id: "l-estrutura-vigas",
      name: "Vigas",
      parentId: "l-estrutura",
      fullPath: "Estrutura::Vigas",
      colorHex: "#2E6B99",
      visible: true,
    },
    {
      id: "l-fabricacao",
      name: "Fabricação",
      parentId: null,
      fullPath: "Fabricação",
      colorHex: "#B5DAF2",
      visible: true,
    },
    {
      id: "l-fabricacao-conectores",
      name: "Conectores",
      parentId: "l-fabricacao",
      fullPath: "Fabricação::Conectores",
      colorHex: "#D9A847",
      visible: true,
    },
    {
      id: "l-referencia",
      name: "Referência Dimensional",
      parentId: null,
      fullPath: "Referência Dimensional",
      colorHex: "#EA6829",
      visible: true,
    },
  ],
  groups: [
    { id: "g-portico", name: "Pórtico de Teste", parentId: null },
    { id: "g-encaixes", name: "Elementos com Encaixe", parentId: null },
    { id: "g-calibracao", name: "Calibração", parentId: null },
  ],
  materials: [
    { id: "mat-pla", name: "PLA Fosco", colorHex: "#8A96A3", densityKgM3: 1240 },
    { id: "mat-acrilico", name: "Acrílico Técnico", colorHex: "#D9A847", densityKgM3: 1180 },
  ],
  blocks: [
    {
      id: "blk-connector-a",
      name: "Conector Encaixe A",
      sourceBlockId: "00000000-0000-4000-8000-00000000b10a",
    },
  ],
  elements: [
    {
      id: "ex-cube-100",
      name: "Cubo de 100 mm",
      category: "other",
      layerId: "l-referencia",
      groupIds: ["g-calibracao"],
      materialId: "mat-pla",
      parentId: null,
      glbNodeName: "Cubo de 100 mm",
      sourceObjectId: "00000000-0000-4000-8000-00000000c100",
      blockDefinitionId: null,
      instancePath: null,
      geometryType: "extrusion",
      colorHex: "#EA6829",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [0.33, 0.0, 0.11], max: [0.43, 0.1, 0.21], source: "cad" },
      dimensions: { lengthM: 0.1, widthM: 0.1, thicknessM: 0.1, source: "cad" },
      areaM2: { value: 0.06, source: "cad" },
      volumeM3: { value: 0.001, source: "cad" },
      centroidM: { value: [0.38, 0.05, 0.16], source: "cad" },
      explodeOffsetM: [0, 0, 0.06],
      assemblyDirectionM: [0, 1, 0],
      connectorIds: [],
      userText: { finalidade: "Calibracao 100 mm" },
      properties: { papel: "Gabarito dimensional" },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "PLA", toleranceMm: 0.2 },
    },
    {
      id: "ex-column-01",
      name: "Pilar P01",
      category: "column",
      layerId: "l-estrutura-pilares",
      groupIds: ["g-portico"],
      materialId: "mat-pla",
      parentId: null,
      glbNodeName: "Pilar P01",
      sourceObjectId: "00000000-0000-4000-8000-00000000p001",
      blockDefinitionId: null,
      instancePath: null,
      geometryType: "brep",
      colorHex: "#3D576B",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [-0.02, 0.0, -0.02], max: [0.02, 0.3, 0.02], source: "cad" },
      dimensions: { lengthM: 0.3, widthM: 0.04, thicknessM: 0.04, source: "cad" },
      areaM2: { value: 0.0512, source: "cad" },
      volumeM3: { value: 0.00048, source: "cad" },
      centroidM: { value: [0, 0.15, 0], source: "cad" },
      explodeOffsetM: [-0.04, 0, 0],
      assemblyDirectionM: [0, 1, 0],
      connectorIds: ["ex-conn-inst-02"],
      userText: { eixo: "A1" },
      properties: { funcao: "Apoio vertical" },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "PLA", toleranceMm: 0.15 },
    },
    {
      id: "ex-beam-01",
      name: "Viga V01",
      category: "beam",
      layerId: "l-estrutura-vigas",
      groupIds: ["g-portico", "g-encaixes"],
      materialId: "mat-pla",
      parentId: null,
      glbNodeName: "Viga V01",
      sourceObjectId: "00000000-0000-4000-8000-00000000b001",
      blockDefinitionId: null,
      instancePath: null,
      geometryType: "brep",
      colorHex: "#2E6B99",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [-0.02, 0.3, -0.02], max: [0.38, 0.34, 0.02], source: "cad" },
      dimensions: { lengthM: 0.4, widthM: 0.04, thicknessM: 0.04, source: "cad" },
      areaM2: { value: 0.0672, source: "cad" },
      volumeM3: { value: 0.00064, source: "cad" },
      centroidM: { value: [0.18, 0.32, 0], source: "cad" },
      explodeOffsetM: [0, 0.08, 0],
      assemblyDirectionM: [0, -1, 0],
      connectorIds: ["ex-conn-inst-01", "ex-conn-inst-02"],
      userText: { vao: "400 mm (maquete)" },
      properties: { engaste: "Sobre conectores" },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "PLA", toleranceMm: 0.15 },
    },
    {
      id: "ex-composite-01",
      name: "Base Composta C01",
      category: "foundation",
      layerId: "l-estrutura",
      groupIds: ["g-portico", "g-encaixes"],
      materialId: "mat-pla",
      parentId: null,
      glbNodeName: "Base Composta C01",
      sourceObjectId: "00000000-0000-4000-8000-00000000f001",
      blockDefinitionId: null,
      instancePath: null,
      geometryType: "composite",
      colorHex: "#8A949E",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [-0.07, 0.0, -0.22], max: [0.07, 0.05, -0.14], source: "cad" },
      dimensions: { lengthM: 0.14, widthM: 0.08, thicknessM: 0.05, source: "cad" },
      areaM2: { value: 0.0378, source: "cad" },
      volumeM3: { value: 0.000354, source: "cad" },
      centroidM: { value: [0, 0.017, -0.18], source: "cad" },
      explodeOffsetM: [0, -0.05, -0.04],
      assemblyDirectionM: [0, 1, 0],
      connectorIds: [],
      userText: { multiMesh: "2 sub-malhas" },
      properties: { composicao: "Sapata + pino guia" },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "PLA", toleranceMm: 0.2 },
    },
    {
      id: "ex-conn-inst-01",
      name: "Conector Bloco A [1]",
      category: "connector",
      layerId: "l-fabricacao-conectores",
      groupIds: ["g-encaixes"],
      materialId: "mat-acrilico",
      parentId: null,
      glbNodeName: "Conector Bloco A [1]",
      sourceObjectId: "00000000-0000-4000-8000-00000000e001",
      blockDefinitionId: "blk-connector-a",
      instancePath: "00000000-0000-4000-8000-00000000e001/0",
      geometryType: "blockInstance",
      colorHex: "#D9A847",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [0.335, 0.295, -0.025], max: [0.385, 0.345, 0.025], source: "cad" },
      dimensions: { lengthM: 0.05, widthM: 0.05, thicknessM: 0.05, source: "cad" },
      areaM2: { value: 0.015, source: "cad" },
      volumeM3: { value: 0.000125, source: "cad" },
      centroidM: { value: [0.36, 0.32, 0], source: "cad" },
      explodeOffsetM: [0.05, 0.04, 0],
      assemblyDirectionM: [0, -1, 0],
      connectorIds: [],
      userText: { tipoEncaixe: "Macho-fêmea" },
      properties: { instancia: 1 },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "Acrílico", toleranceMm: 0.1 },
    },
    {
      id: "ex-conn-inst-02",
      name: "Conector Bloco A [2]",
      category: "connector",
      layerId: "l-fabricacao-conectores",
      groupIds: ["g-encaixes"],
      materialId: "mat-acrilico",
      parentId: null,
      glbNodeName: "Conector Bloco A [2]",
      sourceObjectId: "00000000-0000-4000-8000-00000000e002",
      blockDefinitionId: "blk-connector-a",
      instancePath: "00000000-0000-4000-8000-00000000e002/0",
      geometryType: "blockInstance",
      colorHex: "#D9A847",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min: [-0.035, 0.295, -0.035], max: [0.035, 0.345, 0.035], source: "cad" },
      dimensions: { lengthM: 0.05, widthM: 0.05, thicknessM: 0.05, source: "cad" },
      areaM2: { value: 0.015, source: "cad" },
      volumeM3: { value: 0.000125, source: "cad" },
      centroidM: { value: [0, 0.32, 0], source: "cad" },
      explodeOffsetM: [-0.05, 0.04, 0],
      assemblyDirectionM: [0, -1, 0],
      connectorIds: [],
      userText: { tipoEncaixe: "Macho-fêmea rotacionado 45°" },
      properties: { instancia: 2 },
      fabrication: { prototypeId: "proto-contrato-01", scaleDenominator: 50, material: "Acrílico", toleranceMm: 0.1 },
    },
  ],
  assembly: {
    steps: [
      {
        id: "step-1",
        title: "Posicionar base composta e pilar",
        elementIds: ["ex-composite-01", "ex-column-01"],
        dependsOn: [],
        durationSeconds: 1,
        insertionOffsetM: [0, 0.04, 0],
      },
      {
        id: "step-2",
        title: "Acoplar conectores e viga",
        elementIds: ["ex-conn-inst-01", "ex-conn-inst-02", "ex-beam-01"],
        dependsOn: ["step-1"],
        durationSeconds: 1,
        insertionOffsetM: [0, 0.05, 0],
      },
    ],
  },
};

mkdirSync(contractDir, { recursive: true });
mkdirSync(path.join(appDir, "public", "demos"), { recursive: true });

const manifestText = JSON.stringify(manifest, null, 2) + "\n";
const schemaText = readFileSync(
  path.join(appDir, "schemas", "manifest-v1.schema.json"),
  "utf-8"
);

// Write exporter-contract bundle
writeFileSync(path.join(contractDir, "model.example.glb"), glbBytes);
writeFileSync(path.join(contractDir, "manifest.example.json"), manifestText);
writeFileSync(path.join(contractDir, "manifest.schema.json"), schemaText);

// Also copy public contract example into geogenviewer/public/demos/ for local demo testing
writeFileSync(
  path.join(appDir, "public", "demos", "contrato-exemplo.glb"),
  glbBytes
);
writeFileSync(
  path.join(appDir, "public", "demos", "contrato-exemplo.manifest.json"),
  manifestText
);
console.log("Generated contract example GLB SHA-256:", glbSha256);
