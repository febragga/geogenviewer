import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "../../../features/viewer/scene/camera-state";

export interface CubeAxisLabels {
  left: string;
  right: string;
  bottom: string;
  top: string;
  back: string;
  front: string;
}

export interface NavCubeStation {
  id: string;
  vector: Vec3;
  kind: 1 | 2 | 3;
  label: string;
  shortLabel?: string;
  /** Vertices in local Y-up cube coordinates inside [-1, 1]^3 */
  vertices: readonly Vec3[];
  /** Outward unit normal in local Y-up cube coordinates */
  normal: Vec3;
  /** Tangent basis for face text (only defined for kind === 1) */
  tangentU?: Vec3;
  tangentV?: Vec3;
}

export interface ProjectedNavCubeFace {
  station: NavCubeStation;
  index: number;
  points: { x: number; y: number }[];
  center: { x: number; y: number };
  depth: number;
  visible: boolean;
  shade: number;
  textMatrix?: string;
}

const OUTER = 1.0;
const INNER = 0.64;

function buildFaceBasis(vector: Vec3): { tangentU: Vec3; tangentV: Vec3 } | null {
  const [x, y, z] = vector;
  if (Math.abs(x) + Math.abs(y) + Math.abs(z) !== 1) return null;
  if (x === 1) return { tangentU: [0, 0, -1], tangentV: [0, 1, 0] };
  if (x === -1) return { tangentU: [0, 0, 1], tangentV: [0, 1, 0] };
  if (y === 1) return { tangentU: [1, 0, 0], tangentV: [0, 0, -1] };
  if (y === -1) return { tangentU: [1, 0, 0], tangentV: [0, 0, 1] };
  if (z === 1) return { tangentU: [1, 0, 0], tangentV: [0, 1, 0] };
  return { tangentU: [-1, 0, 0], tangentV: [0, 1, 0] };
}

function buildStationPolygon(vector: Vec3): Vec3[] {
  const nonzeroAxes: (0 | 1 | 2)[] = [];
  let zeroAxis: 0 | 1 | 2 = 0;
  for (let axis = 0 as 0 | 1 | 2; axis < 3; axis = (axis + 1) as 0 | 1 | 2) {
    if (vector[axis] !== 0) nonzeroAxes.push(axis);
    else zeroAxis = axis;
  }

  const normalizeOrder = (verts: Vec3[]): Vec3[] => {
    const n = new Vector3(...vector).normalize();
    const c = verts.reduce((acc, v) => acc.add(new Vector3(...v)), new Vector3()).divideScalar(verts.length);
    const ref = new Vector3(...verts[0]).sub(c).normalize();
    const ortho = new Vector3().crossVectors(n, ref).normalize();
    return [...verts].sort((a, b) => {
      const da = new Vector3(...a).sub(c);
      const db = new Vector3(...b).sub(c);
      return Math.atan2(da.dot(ortho), da.dot(ref)) - Math.atan2(db.dot(ortho), db.dot(ref));
    });
  };

  if (nonzeroAxes.length === 1) {
    const primary = nonzeroAxes[0];
    const otherA = ((primary + 1) % 3) as 0 | 1 | 2;
    const otherB = ((primary + 2) % 3) as 0 | 1 | 2;
    const makeVert = (aSign: number, bSign: number): Vec3 => {
      const p: Vec3 = [0, 0, 0];
      p[primary] = vector[primary] * OUTER;
      p[otherA] = aSign * INNER;
      p[otherB] = bSign * INNER;
      return p;
    };
    return normalizeOrder([makeVert(-1, -1), makeVert(1, -1), makeVert(1, 1), makeVert(-1, 1)]);
  }

  if (nonzeroAxes.length === 2) {
    const [axA, axB] = nonzeroAxes;
    const makeVert = (primaryA: boolean, zSign: number): Vec3 => {
      const p: Vec3 = [0, 0, 0];
      p[axA] = vector[axA] * (primaryA ? OUTER : INNER);
      p[axB] = vector[axB] * (primaryA ? INNER : OUTER);
      p[zeroAxis] = zSign * INNER;
      return p;
    };
    return normalizeOrder([makeVert(true, -1), makeVert(true, 1), makeVert(false, 1), makeVert(false, -1)]);
  }

  return normalizeOrder([
    [vector[0] * OUTER, vector[1] * INNER, vector[2] * INNER],
    [vector[0] * INNER, vector[1] * OUTER, vector[2] * INNER],
    [vector[0] * INNER, vector[1] * INNER, vector[2] * OUTER],
  ]);
}

export function buildNavCubeStations(axisLabels: CubeAxisLabels): NavCubeStation[] {
  const axes: [string, string][] = [
    [axisLabels.left, axisLabels.right],
    [axisLabels.bottom, axisLabels.top],
    [axisLabels.back, axisLabels.front],
  ];
  const shortMap: Record<string, string> = {
    "0,1,0": "SUP",
    "0,-1,0": "INF",
    "0,0,1": "FRT",
    "0,0,-1": "POS",
    "-1,0,0": "ESQ",
    "1,0,0": "DIR",
  };

  const stations: NavCubeStation[] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (x === 0 && y === 0 && z === 0) continue;
        const vector: Vec3 = [x, y, z];
        const parts: string[] = [];
        if (x !== 0) parts.push(axes[0][x > 0 ? 1 : 0]);
        if (y !== 0) parts.push(axes[1][y > 0 ? 1 : 0]);
        if (z !== 0) parts.push(axes[2][z > 0 ? 1 : 0]);
        const kind = parts.length as 1 | 2 | 3;
        const n = new Vector3(x, y, z).normalize();
        const basis = buildFaceBasis(vector);
        stations.push({
          id: vector.join(","),
          vector,
          kind,
          label: parts.join(" · "),
          shortLabel: kind === 1 ? shortMap[vector.join(",")] ?? parts[0].slice(0, 3).toUpperCase() : undefined,
          vertices: buildStationPolygon(vector),
          normal: [n.x, n.y, n.z],
          tangentU: basis?.tangentU,
          tangentV: basis?.tangentV,
        });
      }
    }
  }
  return stations;
}

const _lightDir = new Vector3(-0.32, 0.58, 0.74).normalize();
const _invQ = new Quaternion();
const _v = new Vector3();
const _n = new Vector3();
const _u = new Vector3();
const _w = new Vector3();

/**
 * Projects all 26 faces of the solid chamfered Navigation Cube into a normalized SVG coordinate
 * frame (default 100x100 centered at 50,50) sorted back-to-front by centroid depth.
 */
export function projectNavCube(
  stations: readonly NavCubeStation[],
  cameraOrientation: Quaternion,
  viewBoxSize = 100,
  radiusPx = 28
): ProjectedNavCubeFace[] {
  const half = viewBoxSize / 2;
  _invQ.copy(cameraOrientation).invert();

  const projected: ProjectedNavCubeFace[] = stations.map((station, index) => {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    const points = station.vertices.map((vert) => {
      _v.set(vert[0], vert[1], vert[2]).applyQuaternion(_invQ);
      const x = half + _v.x * radiusPx;
      const y = half - _v.y * radiusPx;
      sumX += x;
      sumY += y;
      sumZ += _v.z;
      return { x, y };
    });

    const count = points.length;
    const center = { x: sumX / count, y: sumY / count };
    const depth = sumZ / count;

    _n.set(station.normal[0], station.normal[1], station.normal[2]).applyQuaternion(_invQ);
    const visible = _n.z > 0.015;
    const light = Math.max(0, Math.min(1, 0.35 + 0.65 * Math.max(0, _n.dot(_lightDir))));

    let textMatrix: string | undefined;
    if (visible && station.kind === 1 && station.tangentU && station.tangentV) {
      _u.set(station.tangentU[0], station.tangentU[1], station.tangentU[2]).applyQuaternion(_invQ);
      _w.set(station.tangentV[0], station.tangentV[1], station.tangentV[2]).applyQuaternion(_invQ);
      const a = _u.x.toFixed(4);
      const b = (-_u.y).toFixed(4);
      const c = (-_w.x).toFixed(4);
      const d = _w.y.toFixed(4);
      const e = center.x.toFixed(2);
      const f = center.y.toFixed(2);
      textMatrix = `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
    }

    return {
      station,
      index,
      points,
      center,
      depth,
      visible,
      shade: light,
      textMatrix,
    };
  });

  return projected.sort((a, b) => a.depth - b.depth);
}

export function defaultNavCubeOrientation(): Quaternion {
  const forward = new Vector3(1.3, 0.9, 1.5).normalize();
  return new Quaternion().setFromUnitVectors(forward, new Vector3(0, 0, 1)).invert();
}
