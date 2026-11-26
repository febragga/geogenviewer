import { Box3, Matrix4, Plane, ShapeUtils, Vector2, Vector3, type BufferGeometry } from "three";

interface GeometryInfo {
  tolerance: number;
  closed: boolean;
}
const geometryInfo = new WeakMap<BufferGeometry, GeometryInfo>();

function pointKey(point: Vector3, tolerance: number) {
  return [point.x, point.y, point.z].map((n) => Math.round(n / tolerance)).join(",");
}

function topology(geometry: BufferGeometry): GeometryInfo {
  const cached = geometryInfo.get(geometry);
  if (cached) return cached;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const extent = geometry.boundingBox?.getSize(new Vector3()).length() ?? 0;
  const tolerance = Math.max(extent * 1e-7, 1e-10);
  const position = geometry.getAttribute("position");
  const keys = Array.from({ length: position.count }, (_, index) => pointKey(new Vector3().fromBufferAttribute(position, index), tolerance));
  const edges = new Map<string, { count: number; balance: number }>();
  const index = geometry.index;
  const count = index?.count ?? position.count;
  const at = (offset: number) => keys[index?.getX(offset) ?? offset];
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const ids = [at(offset), at(offset + 1), at(offset + 2)];
    if (new Set(ids).size !== 3) continue;
    for (let i = 0; i < 3; i++) {
      const from = ids[i];
      const to = ids[(i + 1) % 3];
      const direction = from < to ? 1 : -1;
      const key = direction === 1 ? from + "|" + to : to + "|" + from;
      let edge = edges.get(key);
      if (!edge) {
        edge = { count: 0, balance: 0 };
        edges.set(key, edge);
      }
      edge.count++;
      edge.balance += direction;
    }
  }
  const info = { tolerance, closed: edges.size > 0 && [...edges.values()].every((edge) => edge.count === 2 && edge.balance === 0) };
  geometryInfo.set(geometry, info);
  return info;
}

function contains(polygon: Vector2[], point: Vector2) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function triangulate(loops: Vector3[][], normal: Vector3) {
  const x = new Vector3(Math.abs(normal.x) > 0.8 ? 0 : 1, Math.abs(normal.x) > 0.8 ? 1 : 0, 0)
    .addScaledVector(normal, Math.abs(normal.x) > 0.8 ? -normal.y : -normal.x).normalize();
  const y = new Vector3().crossVectors(normal, x);
  const rings = loops.map((points) => {
    const polygon = points.map((point) => new Vector2(point.dot(x), point.dot(y)));
    return { points, polygon, area: Math.abs(ShapeUtils.area(polygon)), parent: -1, depth: 0 };
  }).sort((a, b) => b.area - a.area);
  const triangles: Vector3[] = [];
  rings.forEach((ring, index) => {
    for (let i = index - 1; i >= 0; i--) {
      if (contains(rings[i].polygon, ring.polygon[0])) {
        ring.parent = i;
        ring.depth = rings[i].depth + 1;
        break;
      }
    }
  });
  rings.forEach((ring, index) => {
    if (ring.depth % 2 || ring.area === 0) return;
    const holes = rings.filter((candidate) => candidate.parent === index);
    const points = [...ring.points, ...holes.flatMap((hole) => hole.points)];
    for (const face of ShapeUtils.triangulateShape(ring.polygon, holes.map((hole) => hole.polygon))) {
      triangles.push(...face.map((i) => points[i]));
    }
  });
  return triangles;
}

export interface MeshSection {
  lines: number[];
  triangles: number[];
  incomplete: boolean;
}

export function intersectMeshSection(geometry: BufferGeometry, world: Matrix4, plane: Plane, fill: boolean): MeshSection {
  const empty = { lines: [], triangles: [], incomplete: false };
  const position = geometry.getAttribute("position");
  if (!position || world.determinant() === 0) return empty;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const local = plane.clone().applyMatrix4(new Matrix4().copy(world).invert());
  if (!geometry.boundingBox || !local.intersectsBox(geometry.boundingBox)) return empty;
  const { tolerance, closed } = topology(geometry);
  const bounds = geometry.boundingBox;
  const center = bounds.getCenter(new Vector3());
  const half = bounds.getSize(new Vector3()).multiplyScalar(0.5);
  const reach = half.x * Math.abs(local.normal.x) + half.y * Math.abs(local.normal.y) + half.z * Math.abs(local.normal.z);
  if (Math.abs(local.distanceToPoint(center)) >= reach - tolerance) return empty;
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  const index = geometry.index;
  const count = index?.count ?? position.count;
  const nodes = new Map<string, { point: Vector3; neighbors: Set<string> }>();
  const segments = new Map<string, [Vector3, Vector3]>();
  function add(a: Vector3, b: Vector3) {
    const start = pointKey(a, tolerance * 3);
    const end = pointKey(b, tolerance * 3);
    if (start === end) return;
    const key = start < end ? start + "|" + end : end + "|" + start;
    if (segments.has(key)) return;
    segments.set(key, [a, b]);
    for (const [id, other, point] of [[start, end, a], [end, start, b]] as const) {
      let node = nodes.get(id);
      if (!node) {
        node = { point, neighbors: new Set() };
        nodes.set(id, node);
      }
      node.neighbors.add(other);
    }
  }
  for (let i = 0; i + 2 < count; i += 3) {
    for (let j = 0; j < 3; j++) vertices[j].fromBufferAttribute(position, index?.getX(i + j) ?? i + j);
    const distance = vertices.map((vertex) => local.distanceToPoint(vertex));
    if (distance.every((d) => d > tolerance) || distance.every((d) => d < -tolerance) || distance.every((d) => Math.abs(d) <= tolerance)) continue;
    const meets: Vector3[] = [];
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3;
      const a = distance[j];
      const b = distance[k];
      if (Math.abs(a) <= tolerance) meets.push(vertices[j].clone());
      else if ((a < -tolerance && b > tolerance) || (a > tolerance && b < -tolerance)) meets.push(vertices[j].clone().lerp(vertices[k], a / (a - b)));
    }
    if (meets.length === 2) add(meets[0], meets[1]);
  }
  if (!segments.size) return empty;
  const canFill = closed && [...nodes.values()].every((node) => node.neighbors.size === 2);
  const triangles: Vector3[][] = [];
  if (fill && canFill) {
    const seen = new Set<string>();
    for (const start of nodes.keys()) {
      if (seen.has(start)) continue;
      const loop: Vector3[] = [];
      let previous = "";
      let next: string | undefined = start;
      while (next && !seen.has(next)) {
        seen.add(next);
        const node: { point: Vector3; neighbors: Set<string> } = nodes.get(next)!;
        loop.push(node.point);
        const after: string | undefined = [...node.neighbors].find((neighbor) => neighbor !== previous);
        previous = next;
        next = after;
      }
      if (next === start && loop.length >= 3) triangles.push(loop);
    }
  }

  const worldExtent = bounds.clone().applyMatrix4(world).getSize(new Vector3()).length();
  const lift = Math.max(worldExtent * 1e-6, 1e-8);
  const flatten = (points: Vector3[]) => points.flatMap((point) => point.clone().applyMatrix4(world).addScaledVector(plane.normal, lift).toArray());
  return {
    lines: flatten([...segments.values()].flat()),
    triangles: flatten(triangulate(triangles, local.normal)),
    incomplete: fill && (!canFill || triangles.length === 0),
  };
}

export function meshSpansPlane(geometry: BufferGeometry, world: Matrix4, plane: Plane) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return !!geometry.boundingBox && plane.intersectsBox(new Box3().copy(geometry.boundingBox).applyMatrix4(world));
}
