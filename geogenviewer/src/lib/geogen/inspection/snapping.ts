import { Matrix4, Vector3, Vector4, type Camera, type Intersection, type InstancedMesh, type Mesh, type Plane } from "three";
import { pointSurvives } from "./sections.ts";
import type { SnapMode } from "./measurements.ts";

export interface SnapSettings {
  modes: SnapMode[];
  pixels: number;
}

export function snapOnHit(hit: Intersection, camera: Camera, width: number, height: number, x: number, y: number, settings: SnapSettings, planes: readonly Plane[], bypass = false) {
  const mesh = hit.object as Mesh;
  const face = hit.face;
  const surface = { point: hit.point, mode: "surface" as const };
  if (bypass) return surface;
  if (!mesh.isMesh || !face) return settings.modes.includes("surface") ? surface : null;
  if (!settings.modes.some((mode) => mode !== "surface")) return settings.modes.includes("surface") ? surface : null;

  const world = new Matrix4().copy(mesh.matrixWorld);
  if (hit.instanceId !== undefined && (mesh as InstancedMesh).isInstancedMesh) {
    const instance = new Matrix4();
    (mesh as InstancedMesh).getMatrixAt(hit.instanceId, instance);
    world.multiply(instance);
  }
  const points = [face.a, face.b, face.c].map((index) => mesh.getVertexPosition(index, new Vector3()).applyMatrix4(world));
  const projected = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  function project(point: Vector3) {
    const p = new Vector4(point.x, point.y, point.z, 1).applyMatrix4(projected);
    return { x: (1 + p.x / p.w) * width / 2, y: (1 - p.y / p.w) * height / 2, w: p.w };
  }

  function edgePoint(a: Vector3, b: Vector3) {
    const start = project(a);
    const end = project(b);
    if (start.w <= 0 || end.w <= 0) return a.clone().lerp(b, 0.5);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const square = dx * dx + dy * dy;
    const u = square ? Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / square)) : 0;
    const t = u * start.w / (end.w * (1 - u) + u * start.w);
    return a.clone().lerp(b, t);
  }

  for (const mode of ["vertex", "midpoint", "edge"] as const) {
    if (!settings.modes.includes(mode)) continue;
    const choices = mode === "vertex" ? points : points.map((start, index) => {
      const end = points[(index + 1) % points.length];
      return mode === "midpoint" ? start.clone().lerp(end, 0.5) : edgePoint(start, end);
    });
    let best: Vector3 | null = null;
    let distance = settings.pixels;
    for (const point of choices) {
      if (!pointSurvives(point, planes)) continue;
      const p = project(point);
      const pixels = Math.hypot(p.x - x, p.y - y);
      if (p.w > 0 && pixels <= distance) {
        distance = pixels;
        best = point;
      }
    }
    if (best) return { point: best, mode };
  }

  return settings.modes.includes("surface") ? surface : null;
}
