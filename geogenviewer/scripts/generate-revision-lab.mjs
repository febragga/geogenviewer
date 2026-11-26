import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BoxGeometry, PlaneGeometry, Quaternion, Vector3 } from "three";

const directory = new URL("../public/demos/revision-lab/", import.meta.url);
mkdirSync(directory, { recursive: true });
const write = (path, data) => writeFileSync(new URL(path, directory), JSON.stringify(data, null, 2) + "\n");
const inspectionTemplate = JSON.parse(readFileSync(new URL("../public/demos/inspection-lab.inspection.json", import.meta.url)));
const materials = [
  { id: "sample-a", name: "Material sintético A", densityKgM3: 1100, costPerKg: { amount: 72, currency: "BRL" } },
  { id: "sample-b", name: "Material sintético B", densityKgM3: 1350, costPerKg: { amount: 18, currency: "EUR" } },
  { id: "sample-c", name: "Material sem densidade", costPerKg: { amount: 40, currency: "BRL" } },
  { id: "sample-d", name: "Material sem custo", densityKgM3: 980 },
];
const layers = ["structure", "connections"].map((id, i) => ({
  id, name: i ? "Conexões" : "Estrutura", parentId: null, visible: true,
}));
const groups = [{ id: "kit", name: "Kit", parentId: null }, { id: "review", name: "Revisão", parentId: null }];
const up = new Vector3(0, 1, 0);
const stock = new BoxGeometry(0.08, 0.05, 0.06);
const colors = [[0.13, 0.45, 0.66], [0.61, 0.37, 0.19], [0.19, 0.49, 0.31], [0.41, 0.36, 0.55]];
const definition = [
  ["same", "Peça de referência", { areaM2: { value: 0.0236, source: "cad" }, volumeM3: { value: 0.00024, source: "cad" },
    groupIds: ["kit", "review"], properties: { "GeoGen:Fabrication:MeasuredMassKg": 0 } }],
  ["size", "Travessa redimensionada"],
  ["moved", "Conector reposicionado", { category: "connector" }],
  ["rotated", "Viga rotacionada", { category: "beam" }],
  ["material", "Placa com novo material", { category: "slab" }],
  ["tolerance", "Pino com tolerância revisada", { category: "connector" }],
  ["category", "Peça recategorizada", { category: "beam" }],
  ["metadata", "Peça com acabamento", { properties: { Finish: "Fosco" } }],
  ["layer", "Peça em nova camada"],
  ["block-a", "Ocorrência de bloco A", { blockDefinitionId: "standard", sourceObjectId: "instance-root", instancePath: "0/0", geometryType: "blockInstance" }],
  ["block-b", "Ocorrência de bloco B", { blockDefinitionId: "standard", sourceObjectId: "instance-root", instancePath: "0/1", geometryType: "blockInstance" }],
  ["compound", "Conjunto com duas malhas", { geometryType: "composite" }],
  ["tess", "Placa com malha retesselada"],
  ["open", "Superfície aberta", { isClosed: false }],
  ["old-id", "Conector com ID substituído", { sourceObjectId: "stable-source" }],
  ["repeat-a1", "Peça repetida 1", { properties: { "GeoGen:PartId": "REP" } }],
  ["repeat-a2", "Peça repetida 2", { properties: { "GeoGen:PartId": "REP" } }],
  ["removed", "Peça retirada"],
  ["scaled", "Ocorrência escalada", { blockDefinitionId: "standard", geometryType: "blockInstance" }],
  ["mirror", "Ocorrência espelhada", { blockDefinitionId: "standard", geometryType: "blockInstance" }],
  ["assembly", "Peça com etapa revisada"],
];

function make(second) {
  const nodes = [{ name: "Laboratório de revisões", children: [] }];
  const elements = [], meshes = [], bufferViews = [], accessors = [], buffers = [], reused = new Map();
  let offset = 0;

  function append(array, componentType, type, count, rest = {}, target = 34962) {
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const aligned = Buffer.alloc((data.length + 3) & ~3);
    data.copy(aligned);
    const bufferView = bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, target }) - 1;
    buffers.push(aligned);
    offset += aligned.length;
    return accessors.push({ bufferView, componentType, count, type, ...rest }) - 1;
  }

  function mesh(geometry, material) {
    const key = geometry.uuid + ":" + material;
    if (reused.has(key)) return reused.get(key);
    geometry.computeBoundingBox();
    const positions = geometry.getAttribute("position");
    const NORMAL = geometry.getAttribute("normal");
    const POSITION = append(positions.array, 5126, "VEC3", positions.count,
      { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() });
    const indices = append(geometry.index.array, 5123, "SCALAR", geometry.index.count, {}, 34963);
    const id = meshes.push({ primitives: [{ attributes: { POSITION, NORMAL: append(NORMAL.array, 5126, "VEC3", NORMAL.count) }, indices, material }] }) - 1;
    reused.set(key, id);
    return id;
  }

  definition.forEach(([key, name, options = {}], index) => {
    const id = second ? ({ removed: "added", "old-id": "new-id", "repeat-a1": "repeat-b1", "repeat-a2": "repeat-b2" })[key] ?? key : key;
    const materialIndex = key === "material" && second ? 1 : key === "open" ? 2 : key === "layer" ? 3 : 0;
    const materialId = materials[materialIndex].id;
    const shift = second ? [0.5, 0, -0.25] : [0, 0, 0];
    const x = ((index % 5) - 2) * 0.13 + (second && key === "moved" ? 0.036 : 0);
    const y = 0.03 + (index % 3) * 0.018;
    const z = (Math.floor(index / 5) - 2) * 0.115 + (second && key === "removed" ? -0.045 : 0);
    const node = { name: "n" + index, translation: [x - shift[0], y, z - shift[2]], extras: { geogenElementId: id } };
    let geometry = stock;
    if (key === "open") geometry = new PlaneGeometry(0.11, 0.06);
    if (key === "size" && second) geometry = new BoxGeometry(0.11, 0.05, 0.06);
    if (key === "tess") geometry = new BoxGeometry(0.08, 0.05, 0.06, second ? 2 : 1, second ? 2 : 1, second ? 2 : 1);
    if (key === "rotated" && second) node.rotation = new Quaternion().setFromAxisAngle(up, Math.PI / 5).toArray();
    if (key === "scaled" && second) node.scale = [1.23, 1.15, 0.9];
    if (key === "mirror" && second) node.scale = [-1, 1, 1];
    nodes[0].children.push(nodes.push(node) - 1);
    if (key === "compound") {
      node.children = [
        nodes.push({ mesh: mesh(stock, 0), translation: [-0.035, 0, 0] }) - 1,
        nodes.push({ mesh: mesh(stock, 0), translation: [0.043, 0.014, 0] }) - 1,
      ];
    } else node.mesh = mesh(geometry, materialIndex);
    const properties = { "GeoGen:TypeCode": key.startsWith("block") ? "BLOCO" : "PADRAO", ...options.properties };
    if (key === "metadata" && second) properties.Finish = "Texturizado";
    if (key === "size") properties["GeoGen:Fabrication:SlicerMassKg"] = second ? 0.12 : 0.1;
    if (key === "material") properties["GeoGen:Fabrication:MachineTimeSeconds"] = 360;
    elements.push({ id, name: key === "removed" ? second ? "Peça acrescentada" : name : name,
      category: "other", layerId: "structure", groupIds: ["kit"], materialId,
      geometryType: "mesh", isClosed: true, isValid: true,
      ...options, properties,
      ...(key === "category" && second ? { category: "column" } : {}),
      ...(key === "layer" && second ? { layerId: "connections" } : {}),
      ...(key === "size" ? { dimensions: { lengthM: second ? 0.11 : 0.08, widthM: 0.06, thicknessM: 0.05, source: "authored" } } : {}),
      fabrication: { material: materialId, toleranceMm: key === "tolerance" && second ? 0.13 : 0.1 },
    });
  });

  const binary = Buffer.concat(buffers);
  const gltf = {
    asset: { version: "2.0", generator: "GeoGenViewer revision-lab" },
    scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, bufferViews, accessors, buffers: [{ byteLength: binary.length }],
    materials: materials.map(({ name }, index) => ({ name, doubleSided: true,
      pbrMetallicRoughness: { baseColorFactor: [...colors[index], 1], metallicFactor: 0, roughnessFactor: 0.75 } })),
  };
  const source = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.alloc((source.length + 3) & ~3, 0x20);
  source.copy(json);
  const header = Buffer.alloc(20);
  [0x46546c67, 2, header.length + json.length + 8 + binary.length, json.length, 0x4e4f534a]
    .forEach((value, index) => header.writeUInt32LE(value, index * 4));
  const bin = Buffer.alloc(8);
  bin.writeUInt32LE(binary.length, 0);
  bin.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, json, bin, binary]);
  const sha256 = createHash("sha256").update(glb).digest("hex");
  const revisionId = second ? "proto-02" : "proto-01";
  const manifest = {
    schemaVersion: "1.0.0",
    project: { id: "revision-lab", title: "Laboratório sintético de revisões", revisionId,
      prototypeId: revisionId, geometryKind: "physicalModel", scaleDenominator: 50, displayUnit: "mm" },
    geometry: { file: "model.glb", format: "glb", coordinateSystem: "RH_Y_UP", unit: "m", nodeMatchStrategy: "extras", sha256 },
    source: second
      ? { application: "GeoGenViewer Synthetic Generator", sourceUnit: "m", sourceUpAxis: "Z", sourceOrigin: [1200.5, 580.25, 27], metersPerSourceUnit: 1 }
      : { application: "GeoGenViewer Synthetic Generator", sourceUnit: "mm", sourceUpAxis: "Z", sourceOrigin: [1200000, 580000, 27000], metersPerSourceUnit: 0.001 },
    layers, groups, materials, blocks: [{ id: "standard", name: "Bloco sintético" }], elements,
    assembly: { steps: [{ id: "demo-assembly", title: "Inserir peça", elementIds: ["assembly"], dependsOn: [],
      durationSeconds: second ? 2 : 1, insertionOffsetM: [0, 0.1, 0] }] },
  };
  const anchor = (elementId, x) => ({ elementId, localM: [x, 0.025, 0.03], nodePath: [], instanceId: null, snap: "vertex" });
  const measure = (id, name, elementId, width) => ({ id, name, kind: "distance", pose: "rest", valueM: width,
    anchors: [anchor(elementId, -width / 2), anchor(elementId, width / 2)], visible: true, provenance: "mesh", capturedIn: "inspect" });
  const inspection = {
    ...inspectionTemplate,
    model: { projectId: manifest.project.id, revisionId, fileName: "model.glb", bytes: glb.length, sha256 },
    measurements: [measure("width", "Comprimento da travessa", "size", second ? 0.11 : 0.08),
      second ? measure("invalid", "Referência ausente", "missing-element", 0.08)
        : measure("removed", "Comprimento da peça retirada", "removed", 0.08)],
  };
  mkdirSync(new URL(revisionId + "/", directory), { recursive: true });
  writeFileSync(new URL(revisionId + "/model.glb", directory), glb);
  write(revisionId + "/manifest.json", manifest);
  write(revisionId + "/inspection.json", inspection);
}

make(false);
make(true);
write("expected-differences.json", {
  toleranceM: 0.0001, sourceOffsetM: [0.5, 0, -0.25],
  stable: ["same", "block-a", "block-b", "compound", "open"],
  modified: { size: ["geometry", "metadata", "fabrication"], moved: ["position"], rotated: ["rotation"],
    material: ["material", "fabrication"], tolerance: ["fabrication"], category: ["category"], metadata: ["metadata"],
    layer: ["layer"], scaled: ["scale"], mirror: ["scale"], assembly: ["assembly"] },
  retessellated: "tess", removed: "removed", added: "added", replacedId: ["old-id", "new-id"],
  ambiguous: ["repeat-a1", "repeat-a2", "repeat-b1", "repeat-b2"],
});
write("expected-quantities.json", { components: 21, occurrences: 21, blocks: 1, types: 2, openMesh: "open",
  prototype01SlicerKg: 0.1, prototype02SlicerKg: 0.12, knownCadVolumeM3: 0.00024, measuredKg: 0 });
