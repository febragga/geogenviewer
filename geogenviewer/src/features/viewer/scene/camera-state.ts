import { Vector3 } from "three";

export type Vec3 = [number, number, number];
export type Projection = "perspective" | "orthographic";
export type ViewLayout = "single" | "horizontal" | "vertical" | "quad";

export const viewDirections = {
  perspective: [1.3, 0.9, 1.5],
  axonometric: [1, 1, 1],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
} satisfies Record<string, Vec3>;

export type ViewPreset = keyof typeof viewDirections;

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  projection: Projection;
  height: number;
}

export const viewSlots: ViewPreset[] = ["perspective", "top", "front", "right"];
export const fieldOfView = 50;
const halfTangent = Math.tan(fieldOfView * Math.PI / 360);

export function viewUp(direction: Vec3): Vec3 {
  if (direction[0] === 0 && direction[2] === 0) {
    return [0, 0, direction[1] > 0 ? -1 : 1];
  }
  return [0, 1, 0];
}

export function viewHeightAtDistance(distance: number) {
  return 2 * distance * halfTangent;
}

export function distanceAtViewHeight(height: number) {
  return height / (2 * halfTangent);
}

export function fittedHeight(radius: number, aspect: number, projection: Projection) {
  const size = Math.max(radius, 0.000001) * 1.16;
  if (projection === "orthographic") return 2 * size / Math.min(1, Math.max(aspect, 0.01));
  const angle = Math.atan(halfTangent * Math.min(1, Math.max(aspect, 0.01)));
  return viewHeightAtDistance(size / Math.sin(angle));
}

export function orientPose(pose: CameraPose, direction: Vec3, projection = pose.projection): CameraPose {
  const target = new Vector3(...pose.target);
  const distance = projection === "perspective"
    ? distanceAtViewHeight(pose.height)
    : Math.max(new Vector3(...pose.position).distanceTo(target), distanceAtViewHeight(pose.height));
  return {
    ...pose,
    position: new Vector3(...direction).setLength(distance).add(target).toArray(),
    up: viewUp(direction),
    projection,
  };
}

export function initialPose(preset: ViewPreset, target: Vec3, radius: number, aspect: number): CameraPose {
  const projection = preset === "perspective" ? "perspective" : "orthographic";
  return orientPose({
    target, position: target, up: [0, 1, 0], projection,
    height: fittedHeight(radius, aspect, projection),
  }, viewDirections[preset]);
}

export interface ViewRegion {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function viewRegions(layout: ViewLayout, maximized: number | null, width: number, height: number): ViewRegion[] {
  if (maximized !== null || layout === "single") {
    return [{ slot: maximized ?? 0, x: 0, y: 0, width, height }];
  }
  const columns = layout === "vertical" ? 1 : 2;
  const rows = layout === "horizontal" ? 1 : 2;
  return Array.from({ length: columns * rows }, (_, slot) => {
    const column = slot % columns;
    const row = Math.floor(slot / columns);
    const x = Math.floor(width * column / columns);
    const y = Math.floor(height * row / rows);
    return {
      slot, x, y,
      width: Math.floor(width * (column + 1) / columns) - x,
      height: Math.floor(height * (row + 1) / rows) - y,
    };
  });
}

export function synchronizePose(source: CameraPose, peer: CameraPose, target: boolean, zoom: boolean): CameraPose {
  const position = new Vector3(...peer.position);
  if (target) position.sub(new Vector3(...peer.target)).add(new Vector3(...source.target));
  return {
    ...peer,
    position: position.toArray(),
    target: target ? source.target : peer.target,
    height: zoom && source.projection === "orthographic" && peer.projection === "orthographic"
      ? source.height : peer.height,
  };
}
