import { Matrix4, Quaternion, Vector3 } from "three";
import type { Occurrence } from "../revisions/revision.ts";

const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
const directions = new WeakMap<Occurrence, { normal: Vector3; principal: Vector3 }>();

function canonical(vector: Vector3) {
  const index = [0, 1, 2].reduce((best, next) =>
    Math.abs(vector.getComponent(next)) > Math.abs(vector.getComponent(best)) ? next : best);
  return vector.getComponent(index) < 0 ? vector.negate() : vector;
}

function geometryDirections(occurrence: Occurrence) {
  const cached = directions.get(occurrence);
  if (cached) return cached;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3(), edge = new Vector3();
  const center = new Vector3(), centroid = new Vector3(), point = new Vector3();
  const rest = occurrence.rest.clone().setPosition(0, 0, 0);
  const span = Math.max(...occurrence.record.meshBoundsMeters, Number.EPSILON);
  const faces = new Map<string, { normal: Vector3; area: number }>();
  let weight = 0;
  const covariance = [0, 0, 0, 0, 0, 0];
  function accumulate({ x, y, z }: Vector3, factor: number) {
    covariance[0] += x * x * factor;
    covariance[1] += y * y * factor;
    covariance[2] += z * z * factor;
    covariance[3] += x * y * factor;
    covariance[4] += x * z * factor;
    covariance[5] += y * z * factor;
  }
  let largest: { normal: Vector3; area: number } | undefined;
  for (const { geometry, local } of occurrence.parts) {
    const position = geometry.getAttribute("position"), index = geometry.index;
    if (!position) continue;
    const matrix = new Matrix4().multiplyMatrices(rest, local);
    const count = Math.floor((index?.count ?? position.count) / 3);
    const stride = Math.max(1, Math.ceil(count / 4096));
    const vertex = (target: Vector3, i: number) => target.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
    for (let i = 0; i < count; i += stride) {
      vertex(a, i * 3);
      vertex(b, i * 3 + 1);
      vertex(c, i * 3 + 2);
      normal.subVectors(b, a).cross(edge.subVectors(c, a));
      const area = normal.length() * Math.min(stride, count - i);
      if (!(area > 0 && Number.isFinite(area))) continue;
      canonical(normal.normalize());
      const key = [normal.x * 1e4, normal.y * 1e4, normal.z * 1e4, normal.dot(a) / span * 1e4]
        .map(Math.round).join(",");
      let face = faces.get(key);
      if (!face) faces.set(key, face = { normal: normal.clone(), area: 0 });
      face.area += area;
      if (!largest || face.area > largest.area * (1 + 1e-8)) largest = face;
      // Combine exact uniform moments within a triangle with the covariance of triangle centroids.
      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      accumulate(point.subVectors(a, centroid), area / 12);
      accumulate(point.subVectors(b, centroid), area / 12);
      accumulate(point.subVectors(c, centroid), area / 12);
      weight += area;
      point.subVectors(centroid, center);
      center.addScaledVector(point, area / weight);
      accumulate(point, area * (1 - area / weight));
    }
  }
  const [xx, yy, zz, xy, xz, yz] = covariance;
  const multiply = ({ x, y, z }: Vector3, target: Vector3) =>
    target.set(xx * x + xy * y + xz * z, xy * x + yy * y + yz * z, xz * x + yz * y + zz * z);
  let principal = axes[0];
  let variance = 0;
  const product = new Vector3();
  for (const seed of axes) {
    const direction = seed.clone();
    for (let i = 0; i < 20; i++) {
      multiply(direction, product);
      if (product.lengthSq() === 0) break;
      direction.copy(product).normalize();
    }
    const score = direction.dot(multiply(direction, product));
    if (score > variance * (1 + 1e-7)) {
      principal = canonical(direction);
      variance = score;
    }
  }
  const result = { normal: largest?.normal ?? axes[1], principal };
  directions.set(occurrence, result);
  return result;
}

function perpendicular(primary: Vector3, preferred: Vector3) {
  const result = preferred.clone().addScaledVector(primary, -primary.dot(preferred));
  if (result.lengthSq() > 1e-10) return result.normalize();
  const alternative = axes.reduce((best, axis) => Math.abs(primary.dot(axis)) < Math.abs(primary.dot(best)) ? axis : best);
  return alternative.clone().addScaledVector(primary, -primary.dot(alternative)).normalize();
}

export function orientForKnolling(occurrence: Occurrence, mode: "largestFace" | "principalAxis", u: Vector3, v: Vector3, n: Vector3) {
  const { normal, principal } = geometryDirections(occurrence);
  const x = mode === "largestFace" ? perpendicular(normal, principal) : principal;
  const z = mode === "largestFace" ? normal : perpendicular(principal, normal);
  const source = new Matrix4().makeBasis(x, z.clone().cross(x), z);
  const target = new Matrix4().makeBasis(u, v, n);
  return new Quaternion().setFromRotationMatrix(target.multiply(source.transpose())).normalize();
}
