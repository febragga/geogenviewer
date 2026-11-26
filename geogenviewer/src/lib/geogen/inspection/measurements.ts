import { Matrix4, Vector3, type InstancedMesh, type Mesh, type Object3D } from "three";
import type { ComponentRecord, ManifestV1 } from "../domain/model.ts";
import { toCad, type Point3 } from "./sections.ts";

export type MeasureKind = "distance" | "delta" | "point";
export type MeasurementPose = "rest" | "presentation";
export type SnapMode = "surface" | "vertex" | "edge" | "midpoint";

export interface MeshAnchor {
  elementId: string;
  nodePath: number[];
  localM: Point3;
  instanceId: number | null;
  snap: SnapMode;
}

export interface Measurement {
  id: string;
  name: string;
  kind: MeasureKind;
  pose: MeasurementPose;
  anchors: MeshAnchor[];
  valueM: number | Point3;
  visible: boolean;
  provenance: "mesh";
  capturedIn: "explore" | "explode" | "assembly" | "inspect";
}

export interface MeshReferences {
  target: (anchor: MeshAnchor) => Mesh | null;
  valid: (anchor: MeshAnchor) => boolean;
  anchor: (mesh: Mesh, componentId: string, world: Vector3, instanceId: number | undefined, snap: SnapMode) => MeshAnchor | null;
  point: (anchor: MeshAnchor, pose: MeasurementPose) => Vector3 | null;
}

function matrixFor(mesh: Mesh, instanceId: number | null, world = mesh.matrixWorld) {
  if (instanceId === null) return world;
  const instances = mesh as InstancedMesh;
  if (!instances.isInstancedMesh || instanceId < 0 || instanceId >= instances.count) return null;
  const instance = new Matrix4();
  instances.getMatrixAt(instanceId, instance);
  return instance.premultiply(world);
}

export function meshReferences(scene: Object3D, components: ReadonlyMap<string, Object3D>): MeshReferences {
  const rest = new WeakMap<Object3D, Matrix4>();
  scene.updateMatrixWorld(true);
  scene.traverse((object) => { if ((object as Mesh).isMesh) rest.set(object, object.matrixWorld.clone()); });

  function target(anchor: MeshAnchor) {
    let node = components.get(anchor.elementId);
    for (const index of anchor.nodePath) node = node?.children[index];
    if (!node || !(node as Mesh).isMesh || !rest.has(node)) return null;
    const mesh = node as Mesh;
    const instances = mesh as InstancedMesh;
    if (Boolean(instances.isInstancedMesh) !== (anchor.instanceId !== null)) return null;
    if (anchor.instanceId !== null && (anchor.instanceId < 0 || anchor.instanceId >= instances.count)) return null;
    return mesh;
  }

  return {
    target,
    valid(anchor) {
      const mesh = target(anchor);
      if (!mesh) return false;
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box || box.isEmpty()) return false;
      const epsilon = Math.max(box.getSize(new Vector3()).length() * 1e-6, 1e-8);
      return box.clone().expandByScalar(epsilon).containsPoint(new Vector3(...anchor.localM));
    },
    anchor(mesh, componentId, world, instanceId, snap) {
      const root = components.get(componentId);
      const path = [];
      let node: Object3D | null = mesh;
      while (node && node !== root) {
        if (!node.parent) return null;
        path.push(node.parent.children.indexOf(node));
        node = node.parent;
      }
      const matrix = matrixFor(mesh, instanceId ?? null);
      if (!root || !node || !matrix || matrix.determinant() === 0) return null;
      return {
        elementId: componentId, nodePath: path.reverse(), instanceId: instanceId ?? null, snap,
        localM: world.clone().applyMatrix4(matrix.clone().invert()).toArray(),
      };
    },
    point(anchor, pose) {
      const mesh = target(anchor);
      const world = mesh && matrixFor(mesh, anchor.instanceId, pose === "rest" ? rest.get(mesh)! : mesh.matrixWorld);
      return world ? new Vector3(...anchor.localM).applyMatrix4(world) : null;
    },
  };
}

export function measurementValue(kind: MeasureKind, points: readonly Vector3[]): number | Point3 {
  if (kind === "point") return toCad(points[0].toArray());
  if (kind === "distance") return points[0].distanceTo(points[1]);
  return toCad(points[1].clone().sub(points[0]).toArray());
}

export function sourceCoordinates(world: Point3, source: ManifestV1["source"] | undefined): Point3 | null {
  if (!source?.sourceOrigin || !source.metersPerSourceUnit || !source.sourceUpAxis) return null;
  const point = source.sourceUpAxis === "Z" ? toCad(world) : world;
  const origin = source.sourceOrigin;
  const scale = source.metersPerSourceUnit;
  return [point[0] / scale + origin[0], point[1] / scale + origin[1], point[2] / scale + origin[2]];
}

export function compareRestBounds(component: ComponentRecord) {
  const box = component.cad?.boundingBoxM;
  if (box?.source !== "cad") return null;
  return box.max.map((value, index) => {
    const cadM = value - box.min[index];
    const meshM = component.meshBoundsMeters[index];
    const deltaM = Math.abs(cadM - meshM);
    return { cadM, meshM, deltaM, percent: cadM > 0 ? deltaM / cadM * 100 : null };
  });
}

export const unitsPerMeter = { mm: 1000, cm: 100, m: 1 };

export function formatMeasurement(valueM: number | Point3, unit: keyof typeof unitsPerMeter) {
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: unit === "m" ? 4 : 2 });
  const scalar = (value: number) => formatter.format(value * unitsPerMeter[unit]);
  return (Array.isArray(valueM) ? valueM.map(scalar).join(" / ") : scalar(valueM)) + " " + unit;
}
