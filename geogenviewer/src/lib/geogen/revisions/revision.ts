import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material, type Mesh, type MeshStandardMaterial } from "three";
import type { ComponentRecord } from "../domain/model.ts";
import type { LoadedScenePackage } from "../importers/package.ts";

export type Triple = [number, number, number];
export type Alignment = { source: boolean; translationM: Triple; rotationDeg: Triple };
export const defaultAlignment: Alignment = { source: true, translationM: [0, 0, 0], rotationDeg: [0, 0, 0] };

export interface RevisionIdentity {
  projectId: string | null;
  revisionId: string | null;
  prototypeId: string | null;
  sha256: string | null;
  geometryKind: LoadedScenePackage["sceneGraph"]["geometryKind"];
  scaleDenominator: number | null;
  sourceOrigin: Triple | null;
  sourceUnit: string | null;
  sourceUpAxis: "Y" | "Z" | null;
  metersPerSourceUnit: number | null;
}

export interface MeshPart {
  geometry: BufferGeometry;
  local: Matrix4;
}

export interface Occurrence {
  id: string;
  key: string;
  record: ComponentRecord;
  rest: Matrix4;
  parts: MeshPart[];
  count: number;
  visualMaterials: string[];
}

export interface Revision {
  key: string;
  identity: RevisionIdentity;
  occurrences: Map<string, Occurrence>;
  renderables: { id: string; mesh: Mesh; world: Matrix4 }[];
  scene: LoadedScenePackage;
}

let importSequence = 0;

function visualSignature(material: Material) {
  const surface = material as Partial<MeshStandardMaterial>;
  return JSON.stringify([material.type, material.name, material.side, material.opacity, material.transparent, material.alphaTest,
    surface.color?.toArray(), surface.emissive?.toArray(), surface.emissiveIntensity, surface.roughness, surface.metalness,
    Boolean(surface.map), Boolean(surface.normalMap), Boolean(surface.metalnessMap), Boolean(surface.roughnessMap),
    Boolean(surface.emissiveMap), Boolean(surface.alphaMap)]);
}

/** Capture once immediately after import, before the presentation controllers take ownership. */
export function captureRevision(scene: LoadedScenePackage): Revision {
  const key = String(++importSequence);
  const project = scene.manifest?.project;
  const source = scene.manifest?.source;
  const identity: RevisionIdentity = {
    projectId: project?.id ?? null, revisionId: project?.revisionId ?? null,
    prototypeId: project?.prototypeId ?? null, sha256: scene.binarySha256 ?? null,
    geometryKind: project?.geometryKind ?? "unknown", scaleDenominator: project?.scaleDenominator ?? null,
    sourceOrigin: source?.sourceOrigin ?? null, sourceUnit: source?.sourceUnit ?? null,
    sourceUpAxis: source?.sourceUpAxis ?? null, metersPerSourceUnit: source?.metersPerSourceUnit ?? null,
  };
  const occurrences = new Map<string, Occurrence>();
  scene.model.scene.updateMatrixWorld(true);
  for (const [id, root] of scene.objectByComponentId) {
    const rest = root.matrixWorld.clone();
    occurrences.set(id, { id, key: JSON.stringify([key, id]), record: scene.sceneGraph.components[id],
      rest, parts: [], count: 1, visualMaterials: [] });
  }
  const renderables: Revision["renderables"] = [];
  const visual = new WeakMap<Material, string>();
  scene.model.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const id = scene.resolveComponentId(object);
    const occurrence = id ? occurrences.get(id) : undefined;
    if (!occurrence) return;
    renderables.push({ id: occurrence.id, mesh: mesh.clone(false), world: mesh.matrixWorld.clone() });
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      let signature = visual.get(material);
      if (!signature) { signature = visualSignature(material); visual.set(material, signature); }
      if (!occurrence.visualMaterials.includes(signature)) occurrence.visualMaterials.push(signature);
    }
    const local = new Matrix4();
    const root = scene.objectByComponentId.get(occurrence.id);
    for (let node = object; node !== root && node.parent; node = node.parent) local.premultiply(node.matrix);
    const instances = mesh as InstancedMesh;
    if (!instances.isInstancedMesh) {
      occurrence.parts.push({ geometry: mesh.geometry, local });
      return;
    }
    // The owning component remains the selection key for each GPU batch.
    if (mesh === scene.objectByComponentId.get(occurrence.id)) occurrence.count = instances.count;
    for (let index = 0; index < instances.count; index++) {
      const transform = new Matrix4();
      instances.getMatrixAt(index, transform);
      occurrence.parts.push({ geometry: mesh.geometry, local: local.clone().multiply(transform) });
    }
  });
  return { key, identity, occurrences, renderables, scene };
}

export function needsProjectAssociation(a: Revision, b: Revision) {
  return a.identity.projectId !== b.identity.projectId ||
    (a.identity.projectId === null && a.identity.sha256 !== b.identity.sha256);
}

function sourceOrigin(identity: RevisionIdentity) {
  const { sourceOrigin, sourceUnit, sourceUpAxis, metersPerSourceUnit } = identity;
  if (!sourceOrigin || !sourceUnit || !sourceUpAxis || !metersPerSourceUnit) return null;
  const [x, y, z] = sourceOrigin;
  return new Vector3(...(sourceUpAxis === "Z" ? [x, z, -y] : [x, y, z])).multiplyScalar(metersPerSourceUnit);
}

export function alignmentFor(a: Revision, b: Revision, settings: Alignment) {
  const originA = sourceOrigin(a.identity), originB = sourceOrigin(b.identity);
  const differentScale = a.identity.scaleDenominator !== b.identity.scaleDenominator
    && a.identity.scaleDenominator !== null && b.identity.scaleDenominator !== null;
  const differentKind = a.identity.geometryKind !== b.identity.geometryKind;
  const sourceAvailable = Boolean(originA && originB && !differentKind && !differentScale &&
    a.identity.geometryKind !== "unknown" && a.identity.projectId && a.identity.projectId === b.identity.projectId);
  const offset = settings.source && sourceAvailable ? originB!.sub(originA!) : new Vector3();
  const radians = settings.rotationDeg.map((value) => value * Math.PI / 180) as Triple;
  const rotation = new Quaternion().setFromEuler(new Euler(...radians));
  const matrix = new Matrix4().compose(offset.add(new Vector3(...settings.translationM)), rotation, new Vector3(1, 1, 1));
  return { matrix, sourceAvailable, differentScale, differentKind };
}

export function reverseAlignment(base: Revision, comparison: Revision, prior: Alignment): Alignment {
  const inverse = alignmentFor(comparison, base, prior).matrix.invert();
  const baseline = alignmentFor(base, comparison, { ...defaultAlignment, source: prior.source }).matrix;
  const translationM = new Vector3().setFromMatrixPosition(inverse)
    .sub(new Vector3().setFromMatrixPosition(baseline)).toArray();
  const angles = new Euler().setFromRotationMatrix(inverse);
  const rotationDeg = [angles.x, angles.y, angles.z].map((angle) => angle * 180 / Math.PI) as Triple;
  return { source: prior.source, translationM, rotationDeg };
}

export function authored(record: ComponentRecord, key: string): string | number | boolean | null {
  const cad = record.cad;
  if (!cad) return null;
  if (Object.hasOwn(cad.properties, key)) return cad.properties[key];
  return Object.hasOwn(cad.userText, key) ? cad.userText[key] : null;
}
