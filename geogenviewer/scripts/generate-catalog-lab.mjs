import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BoxGeometry, Quaternion, Vector3 } from "three";

const root = new URL("../public/demos/catalog-lab/", import.meta.url);
const template = JSON.parse(readFileSync(new URL("../public/demos/inspection-lab.inspection.json", import.meta.url)));
const colors = [[0.19, 0.44, 0.62], [0.68, 0.43, 0.20], [0.32, 0.63, 0.49], [0.48, 0.45, 0.57]];
const materials = [
  { id: "render-blue", name: "Azul visual" }, { id: "render-earth", name: "Terracota visual" },
  { id: "print-a", name: "Material físico sintético A", densityKgM3: 1200, costPerKg: { amount: 56, currency: "BRL" } },
  { id: "print-b", name: "Material físico sintético B", densityKgM3: 1450 }, { id: "print-c", name: "Material sem densidade" },
];
const layers = [
  { id: "estrutura", name: "Estrutura", fullPath: "Estrutura", parentId: null },
  { id: "primaria", name: "Peças principais", fullPath: "Estrutura::Peças principais", parentId: "estrutura" },
  { id: "secundaria", name: "Peças secundárias", fullPath: "Estrutura::Peças secundárias", parentId: "estrutura" },
  { id: "conexoes", name: "Conexões", parentId: null },
];
const groups = [{ id: "estrutura", name: "Estrutura", parentId: null }, { id: "revisao", name: "Revisão", parentId: null }];
const pieces = [
  { id: "base", name: "Base", size: [0.52, 0.02, 0.36], pos: [0, 0.01, 0], category: "foundation", part: "B-01", type: "BASE" },
  ...Array.from({ length: 4 }, (_, i) => ({ id: "pilar-" + (i + 1), name: "Pilar " + (i + 1), size: [0.042, 0.22, 0.042],
    pos: [i % 2 ? 0.20 : -0.20, 0.13, i < 2 ? 0.13 : -0.13], category: "column", part: "P-01", type: "PILAR",
    block: "pilar", scale: i === 3 ? [1.13, 1, 1] : undefined })),
  { id: "viga-principal-a", name: "Viga principal A", size: [0.48, 0.035, 0.035], pos: [0, 0.258, 0.13],
    category: "beam", part: "V-01", type: "LONGARINA", material: 1, measured: true },
  { id: "viga-principal-b", name: "Viga principal B", size: [0.48, 0.035, 0.035], pos: [0, 0.258, -0.13],
    category: "beam", part: "V-02", type: "LONGARINA", material: 1, scale: [-1, 1, 1], measured: true },
  { id: "viga-secundaria", name: "Viga secundária", size: [0.32, 0.024, 0.025], pos: [0.14, 0.286, 0],
    category: "beam", layer: "secundaria", part: "V-03", type: "TRAVESSA", material: 1, turn: Math.PI / 2, measured: true },
  { id: "laje", name: "Laje", size: [0.30, 0.018, 0.23], pos: [0.05, 0.312, 0],
    category: "slab", layer: "secundaria", part: "L-01", type: "LAJE", physical: "print-c" },
  { id: "escada", name: "Escada composta", pos: [-0.14, 0.015, 0.115], category: "stair", part: "E-01", type: "ESCADA",
    children: Array.from({ length: 5 }, (_, i) => ({ size: [0.07, (i + 1) * 0.022, 0.026],
      pos: [0, (i + 1) * 0.011, -0.026 * i] })) },
  { id: "pino-1", name: "Pino calibrador", size: [0.009, 0.04, 0.009], pos: [-0.12, 0.052, -0.05], category: "connector", layer: "conexoes", part: "C-01", type: "PINO" },
  { id: "pino-2", name: "Pino reserva", size: [0.009, 0.04, 0.009], pos: [-0.08, 0.052, -0.05], category: "connector", layer: "conexoes", part: "C-01", type: "PINO" },
  { id: "rebaixo", name: "Conector com rebaixo", pos: [0.16, 0.051, -0.04], category: "connector", layer: "conexoes",
    part: "C-02", type: "REBAIXO", physical: "print-b", children: [
      { size: [0.042, 0.012, 0.034], pos: [0, 0, 0] },
      { size: [0.011, 0.028, 0.034], pos: [-0.016, 0.02, 0] },
      { size: [0.011, 0.028, 0.034], pos: [0.016, 0.02, 0] },
    ] },
  { id: "apoio", name: "Apoio sem código", size: [0.033, 0.029, 0.052], pos: [0.08, 0.038, 0.04],
    category: "other", layer: "secundaria", turn: Math.PI / 7 },
  { id: "chapa-larga", name: "Chapa de referência", size: [0.22, 0.012, 0.16], pos: [0.01, 0.03, -0.05],
    category: "slab", layer: "secundaria", part: "L-02", type: "CHAPA", physical: "print-b" },
];

const write = (file, value) => writeFileSync(new URL(file, root), JSON.stringify(value, null, 2) + "\n");
function create(second) {
  const input = pieces.filter((piece) => !second || piece.id !== "pino-2").map((piece) =>
    second && piece.id === "viga-secundaria" ? { ...piece, size: [0.37, ...piece.size.slice(1)], pos: [0.15, 0.286, 0] } : piece);
  if (second) input.push({ id: "escora", name: "Escora adicionada", size: [0.025, 0.15, 0.03], pos: [0.09, 0.09, 0.08], category: "column", part: "P-03", type: "ESCORA" });
  const nodes = [{ name: "Catálogo sintético", children: [] }];
  const meshes = [], accessors = [], bufferViews = [], chunks = [], reusable = new Map();
  let offset = 0;
  function append(array, componentType, count, type, extra = {}, target = 34962) {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const padded = Buffer.alloc((bytes.length + 3) & ~3); bytes.copy(padded);
    const bufferView = bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }) - 1;
    chunks.push(padded); offset += padded.length;
    return accessors.push({ bufferView, componentType, count, type, ...extra }) - 1;
  }
  function mesh(size, material) {
    const key = size.join(",") + ":" + material;
    if (reusable.has(key)) return reusable.get(key);
    const geometry = new BoxGeometry(...size); geometry.computeBoundingBox();
    const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
    const POSITION = append(position.array, 5126, position.count, "VEC3",
      { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() });
    const NORMAL = append(normal.array, 5126, normal.count, "VEC3");
    const index = append(geometry.index.array, 5123, geometry.index.count, "SCALAR", {}, 34963);
    const m = meshes.push({ primitives: [{ attributes: { POSITION, NORMAL }, indices: index, material }] }) - 1;
    reusable.set(key, m);
    return m;
  }
  const elements = input.map((piece) => {
    const node = { name: piece.name, translation: piece.pos, extras: { geogenElementId: piece.id } };
    nodes[0].children.push(nodes.push(node) - 1);
    if (piece.children) node.children = piece.children.map(({ size, pos }) =>
      nodes.push({ translation: pos, mesh: mesh(size, piece.material ?? 0) }) - 1);
    else node.mesh = mesh(piece.size, piece.material ?? 0);
    if (piece.scale) node.scale = piece.scale;
    if (piece.turn) node.rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), piece.turn).toArray();
    const properties = {};
    if (piece.part) properties["GeoGen:PartId"] = piece.part;
    if (piece.type) properties["GeoGen:TypeCode"] = piece.type;
    if (piece.measured) properties["GeoGen:Fabrication:SlicerMassKg"] = piece.size[0] * 0.2;
    const dimensions = piece.measured ? { lengthM: piece.size[0], widthM: piece.size[2], thicknessM: piece.size[1], source: "authored" } : undefined;
    return { id: piece.id, name: piece.name, category: piece.category, layerId: piece.layer ?? "primaria",
      groupIds: piece.id === "base" || piece.id === "pino-1" ? ["estrutura", "revisao"] : ["estrutura"],
      materialId: piece.material === 1 ? "render-earth" : "render-blue", geometryType: piece.children ? "composite" : piece.block ? "blockInstance" : "mesh",
      isClosed: true, sourceObjectId: "source-" + piece.id, blockDefinitionId: piece.block ?? null, properties, dimensions,
      fabrication: piece.part ? { material: piece.physical ?? "print-a", toleranceMm: piece.category === "connector" ? 0.13 : 0.20 } : null };
  });
  const binary = Buffer.concat(chunks);
  const gltf = { asset: { version: "2.0", generator: "GeoGenViewer catalog-lab" }, scene: 0, scenes: [{ nodes: [0] }],
    nodes, meshes, accessors, bufferViews, buffers: [{ byteLength: binary.length }], materials: materials.map((item, i) => ({ name: item.name,
      pbrMetallicRoughness: { baseColorFactor: [...colors[i % colors.length], 1], metallicFactor: 0, roughnessFactor: 0.75 } })) };
  const text = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc((text.length + 3) & ~3, 0x20);
  text.copy(json);
  const header = Buffer.alloc(20), bin = Buffer.alloc(8);
  [0x46546c67, 2, 28 + json.length + binary.length, json.length, 0x4e4f534a].forEach((value, i) => header.writeUInt32LE(value, i * 4));
  bin.writeUInt32LE(binary.length, 0); bin.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, json, bin, binary]), sha256 = createHash("sha256").update(glb).digest("hex");
  const revisionId = second ? "rev-02" : "rev-01";
  const steps = [
    { id: "fixar-base", title: "Posicionar base", elementIds: ["base"], dependsOn: [], durationSeconds: 1, insertionOffsetM: [0, 0.1, 0] },
    { id: "instalar-pilares", title: "Instalar pilares", elementIds: ["pilar-1", "pilar-2", "pilar-3", "pilar-4"], dependsOn: ["fixar-base"],
      durationSeconds: 2, insertionOffsetM: [0, 0.18, 0] },
    { id: "instalar-vigas", title: "Instalar vigas", elementIds: ["viga-principal-a", "viga-principal-b", "viga-secundaria"],
      dependsOn: ["instalar-pilares"], durationSeconds: 2, insertionOffsetM: [0.07, 0.15, 0] },
    { id: "superior", title: "Instalar laje e escada", elementIds: ["laje", "escada"], dependsOn: ["instalar-vigas"],
      durationSeconds: 2, insertionOffsetM: [0, 0.17, 0] },
  ];
  const manifest = { schemaVersion: "1.0.0", project: { id: "catalog-lab", title: "Laboratório sintético de catálogo",
    revisionId, prototypeId: second ? "prot-02" : "prot-01", geometryKind: "physicalModel", scaleDenominator: 50, displayUnit: "mm" },
    source: { application: "GeoGenViewer Synthetic Generator", sourceUnit: "mm", sourceUpAxis: "Z", sourceOrigin: [0, 0, 0], metersPerSourceUnit: 0.001 },
    geometry: { file: "model.glb", format: "glb", coordinateSystem: "RH_Y_UP", unit: "m", nodeMatchStrategy: "extras", sha256 },
    layers, groups, materials, blocks: [{ id: "pilar", name: "Pilar sintético" }], elements, assembly: { steps } };
  const inspection = { ...template, model: { projectId: manifest.project.id, revisionId, fileName: "model.glb", bytes: glb.length, sha256 },
    measurements: [{ id: "comprimento-viga", name: "Comprimento na malha da viga principal", kind: "distance", pose: "rest", valueM: 0.48,
      anchors: [-0.24, 0.24].map((x) => ({ elementId: "viga-principal-a", localM: [x, 0, 0],
        nodePath: [], instanceId: null, snap: "surface" })), visible: true, provenance: "mesh", capturedIn: "inspect" }] };
  mkdirSync(new URL(revisionId + "/", root), { recursive: true });
  writeFileSync(new URL(revisionId + "/model.glb", root), glb);
  write(revisionId + "/manifest.json", manifest);
  write(revisionId + "/inspection.json", inspection);
}
create(false);
create(true);
write("expected.json", { components: 15, columns: 4, typePilar: 4, pilarVariants: [1, 3], composite: "escada", groupOverlap: ["base", "pino-1"],
  assemblySteps: 4, missingType: "apoio", removed: "pino-2", added: "escora", modified: "viga-secundaria",
  positionCheck: { gapMeters: 0.005, planes: ["XY", "XZ", "YZ"], boundsMustBeDisjoint: true } });
