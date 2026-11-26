import { Box3, Triangle, Vector3 } from "three";
import type { BufferGeometry, Matrix4 } from "three";
import type { Occurrence } from "./revision.ts";

type Face = [Vector3, Vector3, Vector3];
const faceCache = new WeakMap<BufferGeometry, Face[]>();

function faces(geometry: BufferGeometry) {
  const existing = faceCache.get(geometry);
  if (existing) return existing;
  const position = geometry.getAttribute("position");
  const index = geometry.index;
  const result: Face[] = [];
  if (position) {
    const point = (i: number) => {
      const j = index ? index.getX(i) : i;
      return new Vector3(position.getX(j), position.getY(j), position.getZ(j));
    };
    const count = index?.count ?? position.count;
    for (let i = 0; i + 2 < count; i += 3) result.push([point(i), point(i + 1), point(i + 2)]);
  }
  faceCache.set(geometry, result);
  return result;
}

function transform(face: Face, matrix: Matrix4): Face {
  return face.map((point) => point.clone().applyMatrix4(matrix)) as Face;
}

const asKey = (p: Vector3) => p.toArray().map((value) => value.toPrecision(15)).join(",");
const localCache = new WeakMap<Occurrence, ReturnType<typeof buildLocal>>();
const singlePartCache = new WeakMap<BufferGeometry, ReturnType<typeof buildLocal>>();
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function buildLocal(item: Occurrence) {
  const triangles: Face[] = [];
  const bounds = new Box3();
  for (const part of item.parts) {
    for (const face of faces(part.geometry)) {
      const triangle = transform(face, part.local);
      for (const p of triangle) bounds.expandByPoint(p);
      triangles.push(triangle);
    }
  }
  const signature = triangles.map((face) => face.map(asKey).sort().join("|")).sort().join(";");
  return { triangles, bounds, signature };
}

function local(item: Occurrence) {
  const part = item.parts.length === 1 ? item.parts[0] : null;
  if (part?.local.elements.every((value, index) => value === identity[index])) {
    const existing = singlePartCache.get(part.geometry);
    if (existing) return existing;
    const result = buildLocal(item);
    singlePartCache.set(part.geometry, result);
    return result;
  }
  let result = localCache.get(item);
  if (!result) {
    result = buildLocal(item);
    localCache.set(item, result);
  }
  return result;
}

export function shapeKey(item: Occurrence) {
  return local(item).signature;
}

export type ShapeResult = "identical" | "mesh-different" | "above-tolerance" | "inconclusive";
const maxDistanceChecks = 120_000;

function misses(source: Face[], target: Face[], tolerance: number, samples: number) {
  const nearest = new Vector3(), point = new Vector3();
  const triangle = new Triangle();
  for (let i = 0; i < samples; i++) {
    const face = source[Math.floor(i * source.length / samples)];
    for (let j = 0; j < 4; j++) {
      if (j === 3) point.copy(face[0]).add(face[1]).add(face[2]).multiplyScalar(1 / 3);
      else point.copy(face[j]);
      const within = target.some(([a, b, c]) => triangle.set(a, b, c)
        .closestPointToPoint(point, nearest).distanceToSquared(point) <= tolerance ** 2);
      if (!within) return true;
    }
  }
  return false;
}

export function compareShape(a: Occurrence, b: Occurrence, toleranceM: number): ShapeResult {
  const first = local(a), second = local(b);
  if (first.bounds.isEmpty() || second.bounds.isEmpty()) return "inconclusive";
  if (first.signature === second.signature) return "identical";
  const boundsDiffer = ([first.bounds.min, first.bounds.max] as const).some((p, i) => {
    const q = i === 0 ? second.bounds.min : second.bounds.max;
    return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z)) > toleranceM;
  });
  if (boundsDiffer) return "above-tolerance";
  const total = first.triangles.length + second.triangles.length;
  const limit = Math.min(64, Math.floor(maxDistanceChecks / (4 * total)));
  if (limit === 0) return "inconclusive";
  if (misses(first.triangles, second.triangles, toleranceM, Math.min(limit, first.triangles.length)) ||
    misses(second.triangles, first.triangles, toleranceM, Math.min(limit, second.triangles.length))) return "above-tolerance";
  return "mesh-different";
}

const metricCache = new WeakMap<Occurrence, ReturnType<typeof calculateMeshMetrics>>();
function measurePart(geometry: BufferGeometry, matrix: Matrix4) {
  const list = faces(geometry);
  const origin = list[0]?.[0].clone().applyMatrix4(matrix) ?? new Vector3();
  const edges = new Map<string, { count: number; direction: number }>();
  const cross = new Vector3(), ab = new Vector3(), ac = new Vector3();
  let areaM2 = 0, signed = 0;
  for (const face of list) {
    const [a, b, c] = transform(face, matrix);
    const area = cross.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).length() / 2;
    if (area === 0) continue;
    areaM2 += area;
    const keys = face.map(asKey);
    for (let i = 0; i < 3; i++) {
      const from = keys[i], to = keys[(i + 1) % 3];
      const forwards = from < to;
      const key = forwards ? from + "|" + to : to + "|" + from;
      const edge = edges.get(key) ?? { count: 0, direction: 0 };
      edge.count++;
      edge.direction += forwards ? 1 : -1;
      edges.set(key, edge);
    }
    signed += a.sub(origin).dot(cross.crossVectors(b.sub(origin), c.sub(origin))) / 6;
  }
  const closed = edges.size > 0 && signed !== 0 &&
    [...edges.values()].every((edge) => edge.count === 2 && edge.direction === 0);
  return { areaM2, volumeM3: closed ? Math.abs(signed) : null };
}

const partMetrics = new WeakMap<BufferGeometry, Map<string, ReturnType<typeof measurePart>>>();

function calculateMeshMetrics(item: Occurrence) {
  let areaM2 = 0, volumeM3 = 0, closed = item.parts.length > 0;
  for (const part of item.parts) {
    // Translation does not affect area or volume.
    const matrix = item.rest.clone().multiply(part.local).setPosition(0, 0, 0);
    const key = matrix.elements.join(",");
    let variants = partMetrics.get(part.geometry);
    if (!variants) partMetrics.set(part.geometry, variants = new Map());
    let metrics = variants.get(key);
    if (!metrics) {
      metrics = measurePart(part.geometry, matrix);
      if (variants.size < 128) variants.set(key, metrics);
    }
    areaM2 += metrics.areaM2;
    closed &&= metrics.volumeM3 !== null;
    volumeM3 += metrics.volumeM3 ?? 0;
  }
  return { areaM2: item.parts.length ? areaM2 : null, volumeM3: closed ? volumeM3 : null,
    volumeExclusion: item.parts.length ? "open-or-invalid-mesh" : "missing-geometry" };
}

export function meshMetrics(item: Occurrence) {
  let metrics = metricCache.get(item);
  if (!metrics) {
    metrics = calculateMeshMetrics(item);
    metricCache.set(item, metrics);
  }
  return metrics;
}
