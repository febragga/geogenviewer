import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const demosDir = path.join(repoRoot, "geogenviewer/public/demos");
mkdirSync(demosDir, { recursive: true });

// Builds a unit-box indexed mesh primitive (1×1×1 centered at [0,0,0]) in GLB binary chunk.
function createUnitBoxAndConnectorBuffers() {
  const boxPositions = [
    // +Z
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -Z
    0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    // +Y
    -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // -Y
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // +X
    0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    // -X
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ];
  const boxNormals = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];
  const boxIndices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ];

  const posBuf = Buffer.from(new Float32Array(boxPositions).buffer);
  const normBuf = Buffer.from(new Float32Array(boxNormals).buffer);
  const idxBuf = Buffer.from(new Uint16Array(boxIndices).buffer);
  // Pad index buffer to 4 bytes
  const padLen = (4 - ((posBuf.length + normBuf.length + idxBuf.length) % 4)) % 4;
  const binChunk = Buffer.concat([posBuf, normBuf, idxBuf, Buffer.alloc(padLen, 0)]);

  return {
    binChunk,
    posByteLength: posBuf.length,
    normByteOffset: posBuf.length,
    normByteLength: normBuf.length,
    idxByteOffset: posBuf.length + normBuf.length,
    idxByteLength: idxBuf.length,
  };
}

function buildPavilionGlbAndManifest() {
  const {
    binChunk,
    posByteLength,
    normByteOffset,
    normByteLength,
    idxByteOffset,
    idxByteLength,
  } = createUnitBoxAndConnectorBuffers();

  // Materials: Concrete, Timber Column, Glulam Beam, Slab Plywood, Brass Connector, Stair Steel
  const materialsJson = [
    { name: "Concreto Base", pbrMetallicRoughness: { baseColorFactor: [0.56, 0.59, 0.62, 1], roughnessFactor: 0.85 } },
    { name: "Madeira Laminada (Pilar)", pbrMetallicRoughness: { baseColorFactor: [0.76, 0.58, 0.39, 1], roughnessFactor: 0.7 } },
    { name: "Madeira Laminada (Viga)", pbrMetallicRoughness: { baseColorFactor: [0.82, 0.65, 0.45, 1], roughnessFactor: 0.68 } },
    { name: "Painel CLT (Laje)", pbrMetallicRoughness: { baseColorFactor: [0.87, 0.77, 0.62, 1], roughnessFactor: 0.75 } },
    { name: "Conector Metálico", pbrMetallicRoughness: { baseColorFactor: [0.35, 0.55, 0.72, 1], metallicFactor: 0.45, roughnessFactor: 0.38 } },
    { name: "Aço Escada", pbrMetallicRoughness: { baseColorFactor: [0.27, 0.31, 0.35, 1], metallicFactor: 0.4, roughnessFactor: 0.5 } },
  ];

  // Meshes 0..5 share unit box geometry with distinct materials so connector instances share mesh index 4
  const meshesJson = materialsJson.map((_, matIdx) => ({
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: matIdx }],
  }));

  const nodes = [];
  const rootNodeIndices = [];
  const elements = [];

  const addSingleNode = ({
    id,
    name,
    category,
    layerId,
    groupIds,
    materialId,
    meshIndex,
    centerYUp,
    scaleYUp,
    explodeOffsetYUp,
    assemblyDirYUp,
    blockDefinitionId = null,
  }) => {
    const nodeIndex = nodes.length;
    nodes.push({
      name,
      mesh: meshIndex,
      translation: centerYUp,
      scale: scaleYUp,
      extras: { geogenElementId: id },
    });
    rootNodeIndices.push(nodeIndex);

    const min = [
      centerYUp[0] - scaleYUp[0] / 2,
      centerYUp[1] - scaleYUp[1] / 2,
      centerYUp[2] - scaleYUp[2] / 2,
    ];
    const max = [
      centerYUp[0] + scaleYUp[0] / 2,
      centerYUp[1] + scaleYUp[1] / 2,
      centerYUp[2] + scaleYUp[2] / 2,
    ];
    const volume = Number((scaleYUp[0] * scaleYUp[1] * scaleYUp[2]).toFixed(6));
    const area = Number(
      (
        2 *
        (scaleYUp[0] * scaleYUp[1] +
          scaleYUp[1] * scaleYUp[2] +
          scaleYUp[0] * scaleYUp[2])
      ).toFixed(6)
    );

    elements.push({
      id,
      name,
      category,
      layerId,
      groupIds,
      materialId,
      parentId: null,
      glbNodeName: name,
      blockDefinitionId,
      geometryType: blockDefinitionId ? "blockInstance" : "brep",
      isClosed: true,
      isValid: true,
      boundingBoxM: { min, max, source: "cad" },
      dimensions: {
        lengthM: Math.max(...scaleYUp),
        widthM: scaleYUp[0],
        thicknessM: Math.min(...scaleYUp),
        source: "cad",
      },
      areaM2: { value: area, source: "cad" },
      volumeM3: { value: volume, source: "cad" },
      centroidM: { value: centerYUp, source: "cad" },
      explodeOffsetM: explodeOffsetYUp,
      assemblyDirectionM: assemblyDirYUp,
      fabrication: {
        prototypeId: "pavilhao-sintetico-v04",
        scaleDenominator: 25,
        material: materialsJson[meshIndex].name,
        toleranceMm: 0.2,
      },
    });
  };

  // 4 Foundation footings (y = 0..0.04m)
  const corners = [
    ["01", -0.24, -0.18, ["g-portico-norte"]],
    ["02", 0.24, -0.18, ["g-portico-norte"]],
    ["03", -0.24, 0.18, ["g-portico-sul", "g-nucleo-escada"]],
    ["04", 0.24, 0.18, ["g-portico-sul"]],
  ];
  for (const [tag, x, z, grp] of corners) {
    addSingleNode({
      id: `fd-sapata-${tag}`,
      name: `Sapata ${tag}`,
      category: "foundation",
      layerId: "l-fundacao",
      groupIds: grp,
      materialId: "mat-concreto",
      meshIndex: 0,
      centerYUp: [x, 0.02, z],
      scaleYUp: [0.1, 0.04, 0.1],
      explodeOffsetYUp: [x * 0.45, -0.1, z * 0.45],
      assemblyDirYUp: [0, 1, 0],
    });
  }

  // 4 Columns (y = 0.04..0.28m -> height 0.24m, center 0.16m)
  for (const [tag, x, z, grp] of corners) {
    addSingleNode({
      id: `pl-pilar-${tag}`,
      name: `Pilar P${tag}`,
      category: "column",
      layerId: "l-pilares",
      groupIds: [...grp, "g-pre-moldados"],
      materialId: "mat-pilar",
      meshIndex: 1,
      centerYUp: [x, 0.16, z],
      scaleYUp: [0.04, 0.24, 0.04],
      explodeOffsetYUp: [x * 0.75, 0.02, z * 0.75],
      assemblyDirYUp: [0, 1, 0],
    });
  }

  // 4 Shared Connector Instances at column heads (y = 0.29m)
  for (const [tag, x, z, grp] of corners) {
    addSingleNode({
      id: `cn-encaixe-${tag}`,
      name: `Conector Encaixe C${tag}`,
      category: "connector",
      layerId: "l-conectores",
      groupIds: [...grp, "g-pre-moldados"],
      materialId: "mat-conector",
      meshIndex: 4,
      centerYUp: [x, 0.29, z],
      scaleYUp: [0.055, 0.02, 0.055],
      explodeOffsetYUp: [x * 0.85, 0.11, z * 0.85],
      assemblyDirYUp: [0, -1, 0],
      blockDefinitionId: "blk-conector-v04",
    });
  }

  // 2 Longitudinal Beams (spanning X at z = -0.18, +0.18, y = 0.315m)
  addSingleNode({
    id: "vg-long-norte",
    name: "Viga Longitudinal Norte",
    category: "beam",
    layerId: "l-vigas-long",
    groupIds: ["g-portico-norte", "g-pre-moldados"],
    materialId: "mat-viga",
    meshIndex: 2,
    centerYUp: [0, 0.315, -0.18],
    scaleYUp: [0.54, 0.035, 0.04],
    explodeOffsetYUp: [0, 0.16, -0.18],
    assemblyDirYUp: [0, -1, 0],
  });
  addSingleNode({
    id: "vg-long-sul",
    name: "Viga Longitudinal Sul",
    category: "beam",
    layerId: "l-vigas-long",
    groupIds: ["g-portico-sul", "g-pre-moldados"],
    materialId: "mat-viga",
    meshIndex: 2,
    centerYUp: [0, 0.315, 0.18],
    scaleYUp: [0.54, 0.035, 0.04],
    explodeOffsetYUp: [0, 0.16, 0.18],
    assemblyDirYUp: [0, -1, 0],
  });

  // 1 Composite Multi-Mesh Transversal Truss Beam (3 sub-meshes under single component root)
  const compBeamChild1 = nodes.length;
  nodes.push({ name: "Banzo Inferior", mesh: 2, translation: [0, -0.015, 0], scale: [0.03, 0.015, 0.36] });
  const compBeamChild2 = nodes.length;
  nodes.push({ name: "Banzo Superior", mesh: 2, translation: [0, 0.018, 0], scale: [0.032, 0.014, 0.36] });
  const compBeamChild3 = nodes.length;
  nodes.push({ name: "Montante Central", mesh: 4, translation: [0, 0.002, 0], scale: [0.022, 0.028, 0.04] });
  const compBeamRootIdx = nodes.length;
  nodes.push({
    name: "Viga Composta Central",
    translation: [0, 0.335, 0],
    children: [compBeamChild1, compBeamChild2, compBeamChild3],
    extras: { geogenElementId: "vg-composta-central" },
  });
  rootNodeIndices.push(compBeamRootIdx);
  elements.push({
    id: "vg-composta-central",
    name: "Viga Composta Central (Multi-malha)",
    category: "beam",
    layerId: "l-vigas-trans",
    groupIds: ["g-portico-norte", "g-portico-sul", "g-pre-moldados"],
    materialId: "mat-viga",
    parentId: null,
    glbNodeName: "Viga Composta Central",
    geometryType: "composite",
    isClosed: true,
    isValid: true,
    boundingBoxM: { min: [-0.016, 0.3125, -0.18], max: [0.016, 0.36, 0.18], source: "cad" },
    dimensions: { lengthM: 0.36, widthM: 0.032, thicknessM: 0.047, source: "cad" },
    explodeOffsetM: [0, 0.24, 0],
    assemblyDirectionM: [0, -1, 0],
    userText: { construcao: "Viga composta com 3 sub-malhas" },
    fabrication: { prototypeId: "pavilhao-sintetico-v04", scaleDenominator: 25, material: "Madeira + Conector" },
  });

  // 2 Slab Panels (y = 0.365m)
  addSingleNode({
    id: "lj-painel-oeste",
    name: "Laje Painel Oeste",
    category: "slab",
    layerId: "l-lajes",
    groupIds: ["g-pre-moldados"],
    materialId: "mat-laje",
    meshIndex: 3,
    centerYUp: [-0.135, 0.365, 0],
    scaleYUp: [0.24, 0.024, 0.38],
    explodeOffsetYUp: [-0.14, 0.32, 0],
    assemblyDirYUp: [0, -1, 0],
  });
  addSingleNode({
    id: "lj-painel-leste",
    name: "Laje Painel Leste",
    category: "slab",
    layerId: "l-lajes",
    groupIds: ["g-pre-moldados"],
    materialId: "mat-laje",
    meshIndex: 3,
    centerYUp: [0.135, 0.365, 0],
    scaleYUp: [0.24, 0.024, 0.38],
    explodeOffsetYUp: [0.14, 0.32, 0],
    assemblyDirYUp: [0, -1, 0],
  });

  // 1 Composite Multi-Mesh Stair Assembly (4 steps grouped under single element root)
  const stepChildren = [];
  for (let s = 0; s < 4; s++) {
    const idx = nodes.length;
    nodes.push({
      name: `Degrau ${s + 1}`,
      mesh: 5,
      translation: [s * 0.045 - 0.068, s * 0.035, 0],
      scale: [0.048, 0.014, 0.11],
    });
    stepChildren.push(idx);
  }
  const stairRootIdx = nodes.length;
  nodes.push({
    name: "Lance de Escada Principal",
    translation: [-0.14, 0.06, 0.25],
    children: stepChildren,
    extras: { geogenElementId: "esc-lance-01" },
  });
  rootNodeIndices.push(stairRootIdx);
  elements.push({
    id: "esc-lance-01",
    name: "Escada Pré-fabricada (Multi-malha)",
    category: "stair",
    layerId: "l-escada",
    groupIds: ["g-nucleo-escada", "g-portico-sul"],
    materialId: "mat-aco",
    parentId: null,
    glbNodeName: "Lance de Escada Principal",
    geometryType: "composite",
    isClosed: true,
    isValid: true,
    dimensions: { lengthM: 0.22, widthM: 0.11, thicknessM: 0.12, source: "cad" },
    explodeOffsetM: [-0.16, 0.04, 0.22],
    assemblyDirectionM: [0, -1, -1],
    userText: { tipo: "Lance composto com 4 degraus" },
  });

  const gltfDoc = {
    asset: { version: "2.0", generator: "GeoGenViewer-ExplodeDemo-v0.4" },
    scene: 0,
    scenes: [{ nodes: rootNodeIndices }],
    nodes,
    meshes: meshesJson,
    materials: materialsJson,
    buffers: [{ byteLength: binChunk.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posByteLength, target: 34962 },
      { buffer: 0, byteOffset: normByteOffset, byteLength: normByteLength, target: 34962 },
      { buffer: 0, byteOffset: idxByteOffset, byteLength: idxByteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfDoc), "utf8");
  const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);
  const totalLen = 12 + 8 + jsonChunk.length + 8 + binChunk.length;

  const hdr = Buffer.alloc(12);
  hdr.write("glTF", 0);
  hdr.writeUInt32LE(2, 4);
  hdr.writeUInt32LE(totalLen, 8);
  const jHdr = Buffer.alloc(8);
  jHdr.writeUInt32LE(jsonChunk.length, 0);
  jHdr.writeUInt32LE(0x4e4f534a, 4);
  const bHdr = Buffer.alloc(8);
  bHdr.writeUInt32LE(binChunk.length, 0);
  bHdr.writeUInt32LE(0x004e4942, 4);

  const glbBuffer = Buffer.concat([hdr, jHdr, jsonChunk, bHdr, binChunk]);
  const sha256 = createHash("sha256").update(glbBuffer).digest("hex");

  const manifest = {
    schemaVersion: "1.0.0",
    project: {
      id: "pavilhao-explosao-v04",
      title: "Pavilhão Estrutural Sintético (Demo V0.4)",
      revisionId: "rev-04",
      description: "Modelo sintético modular para validação de vista explodida (fundação, pilares, vigas compostas, lajes, escada e conectores).",
      geometryKind: "physicalModel",
      scaleDenominator: 25,
      displayUnit: "mm",
      prototypeId: "pavilhao-sintetico-v04",
    },
    source: {
      application: "Synthetic Geometry Generator",
      exporterVersion: "1.0.0",
      sourceUnit: "mm",
      sourceUpAxis: "Z",
      sourceOrigin: [0, 0, 0],
      metersPerSourceUnit: 0.001,
    },
    geometry: {
      file: "pavilhao-explosao.glb",
      format: "glb",
      coordinateSystem: "RH_Y_UP",
      unit: "m",
      nodeMatchStrategy: "extras",
      sha256,
    },
    layers: [
      { id: "l-fundacao", name: "Fundação", parentId: null, fullPath: "Fundação", colorHex: "#8A949E", visible: true },
      { id: "l-estrutura", name: "Estrutura", parentId: null, fullPath: "Estrutura", colorHex: "#B58D62", visible: true },
      { id: "l-pilares", name: "Pilares", parentId: "l-estrutura", fullPath: "Estrutura::Pilares", colorHex: "#C29463", visible: true },
      { id: "l-vigas", name: "Vigas", parentId: "l-estrutura", fullPath: "Estrutura::Vigas", colorHex: "#D1A673", visible: true },
      { id: "l-vigas-long", name: "Longitudinais", parentId: "l-vigas", fullPath: "Estrutura::Vigas::Longitudinais", colorHex: "#D1A673", visible: true },
      { id: "l-vigas-trans", name: "Transversais Compostas", parentId: "l-vigas", fullPath: "Estrutura::Vigas::Transversais Compostas", colorHex: "#E0BA84", visible: true },
      { id: "l-lajes", name: "Lajes", parentId: null, fullPath: "Lajes", colorHex: "#DEC49E", visible: true },
      { id: "l-escada", name: "Escada", parentId: null, fullPath: "Escada", colorHex: "#4D5761", visible: true },
      { id: "l-conectores", name: "Conectores", parentId: null, fullPath: "Conectores", colorHex: "#5B8DB8", visible: true },
    ],
    groups: [
      { id: "g-portico-norte", name: "Pórtico Norte", parentId: null },
      { id: "g-portico-sul", name: "Pórtico Sul", parentId: null },
      { id: "g-pre-moldados", name: "Pré-moldados", parentId: null },
      { id: "g-nucleo-escada", name: "Núcleo da Escada", parentId: null },
    ],
    materials: [
      { id: "mat-concreto", name: "Concreto Base", colorHex: "#8F969E" },
      { id: "mat-pilar", name: "Madeira Laminada (Pilar)", colorHex: "#C29463" },
      { id: "mat-viga", name: "Madeira Laminada (Viga)", colorHex: "#D1A673" },
      { id: "mat-laje", name: "Painel CLT (Laje)", colorHex: "#DEC49E" },
      { id: "mat-conector", name: "Conector Metálico", colorHex: "#5B8DB8" },
      { id: "mat-aco", name: "Aço Escada", colorHex: "#454F59" },
    ],
    blocks: [{ id: "blk-conector-v04", name: "Conector Estrutural V04" }],
    elements,
  };

  return { glbBuffer, manifest, sha256 };
}

const { glbBuffer, manifest, sha256 } = buildPavilionGlbAndManifest();
writeFileSync(path.join(demosDir, "pavilhao-explosao.glb"), glbBuffer);
writeFileSync(
  path.join(demosDir, "pavilhao-explosao.manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);
console.log(`Generated V0.4 Pavilion Demo: ${manifest.elements.length} elements, GLB SHA-256 = ${sha256}`);
