import { Box3, Plane, Vector3 } from "three";
import type { Intersection } from "three";

export const cadAxes = ["X", "Y", "Z"] as const;
export type CadAxis = typeof cadAxes[number];
export type Point3 = [number, number, number];
export type SectionMode = "open" | "outline" | "filled" | "technical";

export const axisNormals: Record<CadAxis, Point3> = { X: [1, 0, 0], Y: [0, 0, -1], Z: [0, 1, 0] };
export const clipEpsilon = 1e-8;

export interface SectionPlane {
  id: string;
  name: string;
  axis: CadAxis;
  enabled: boolean;
  positionM: number;
  flipped: boolean;
  gizmo: boolean;
  gizmoOpacity: number;
}

export interface SectionSettings {
  planes: [SectionPlane, SectionPlane, SectionPlane];
  mode: SectionMode;
  fill: boolean;
  fillColor: string;
  outlineColor: string;
  opacity: number;
  lineWidth: number;
}

export interface SectionConfiguration {
  shared: boolean;
  views: [SectionSettings, SectionSettings, SectionSettings, SectionSettings];
}

export function toCad([x, y, z]: Point3): Point3 {
  return [x, -z, y];
}

export function positionOnAxis(point: Vector3, axis: CadAxis) {
  return axis === "X" ? point.x : axis === "Y" ? -point.z : point.y;
}

export function rangeOnAxis(bounds: Box3, axis: CadAxis): [number, number] {
  if (bounds.isEmpty()) return [0, 0];
  const a = positionOnAxis(bounds.min, axis);
  const b = positionOnAxis(bounds.max, axis);
  return [Math.min(a, b), Math.max(a, b)];
}

export function makeSectionSettings(center: Vector3): SectionSettings {
  const plane = (axis: CadAxis): SectionPlane => ({
    id: axis, axis, name: "Plano " + axis, enabled: false,
    positionM: positionOnAxis(center, axis), flipped: false, gizmo: true, gizmoOpacity: 0.65,
  });
  return {
    planes: [plane("X"), plane("Y"), plane("Z")],
    mode: "outline", fill: true, fillColor: "#b6c9d5", outlineColor: "#466a82", opacity: 1, lineWidth: 1.5,
  };
}

export function makeSections(center = new Vector3()): SectionConfiguration {
  const start = makeSectionSettings(center);
  return { shared: true, views: [start, start, start, start] };
}

export function sectionAt(configuration: SectionConfiguration, slot: number) {
  return configuration.views[configuration.shared ? 0 : slot] ?? configuration.views[0];
}

export function setSectionAt(configuration: SectionConfiguration, slot: number, settings: SectionSettings): SectionConfiguration {
  const views = [...configuration.views] as SectionConfiguration["views"];
  views[configuration.shared ? 0 : slot] = settings;
  return { ...configuration, views };
}

export function shareSections(configuration: SectionConfiguration, active: number, shared: boolean): SectionConfiguration {
  if (configuration.shared === shared) return configuration;
  const view = sectionAt(configuration, active);
  return { shared, views: [view, view, view, view] };
}

export function clippingPlanes(settings: SectionSettings): Plane[] {
  return settings.planes.flatMap((plane) => {
    if (!plane.enabled) return [];
    const side = plane.flipped ? -1 : 1;
    return [new Plane(new Vector3(...axisNormals[plane.axis]).multiplyScalar(side), -side * plane.positionM)];
  });
}

export function pointSurvives(point: Vector3, planes: readonly Plane[]) {
  return planes.every((plane) => plane.distanceToPoint(point) >= -clipEpsilon);
}

export function firstVisibleHit(hits: readonly Intersection[], planes: readonly Plane[], selectable: (hit: Intersection) => boolean) {
  return hits.find((hit) => {
    for (let object: typeof hit.object | null = hit.object; object; object = object.parent) {
      if (!object.visible) return false;
    }
    return pointSurvives(hit.point, planes) && selectable(hit);
  });
}

export function clippedBounds(bounds: Box3, planes: readonly Plane[]) {
  const result = bounds.clone();
  for (const { normal, constant } of planes) {
    const axis = Math.abs(normal.x) === 1 ? "x" : Math.abs(normal.y) === 1 ? "y" : "z";
    if (normal[axis] > 0) result.min[axis] = Math.max(result.min[axis], -constant);
    else result.max[axis] = Math.min(result.max[axis], constant);
  }
  return result;
}
