import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { catalogGroup, compareCatalog, type CatalogGroup, type CatalogItem, type CatalogSort } from "./catalog.ts";
import type { Occurrence, Triple } from "../revisions/revision.ts";

export type PlaneName = "XY" | "XZ" | "YZ";
export type LayoutMode = "grid" | "grouped" | "shelf" | "types" | "assembly";
export type Orientation = "preserve" | "world" | "quarter" | "longest" | "manual";
export type PlacementOverride = { rotation: number; fixed: [number, number] | null };
export interface KnollingSettings {
  plane: PlaneName; mode: LayoutMode; orientation: Orientation; group: CatalogGroup; sort: CatalogSort;
  spacingM: number; groupSpacingM: number; widthM: number; marginM: number; columns: number;
  alignment: "start" | "center" | "end"; direction: "forward" | "reverse";
  overrides: Record<string, PlacementOverride>;
}

export function defaultLayout(span: number): KnollingSettings {
  const size = Math.max(span, 0.001);
  const relative = (factor: number) => Number((size * factor).toPrecision(5));
  return { plane: "XY", mode: "grid", orientation: "preserve", group: "category", sort: "name",
    spacingM: relative(0.025), groupSpacingM: relative(0.09), widthM: relative(1.25), marginM: relative(0.04),
    columns: 5, alignment: "center", direction: "forward", overrides: {} };
}

const basis: Record<PlaneName, [Triple, Triple, Triple]> = {
  XY: [[1, 0, 0], [0, 0, -1], [0, 1, 0]], XZ: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], YZ: [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
};

export function planeBasis(plane: PlaneName) {
  return basis[plane].map((vector) => new Vector3(...vector)) as [Vector3, Vector3, Vector3];
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Placement extends Rect {
  item: CatalogItem; world: Matrix4; rotation: Quaternion; delta: Vector3; group: string | null; fixed: boolean;
}
export interface LayoutResult {
  placements: Placement[];
  groups: { label: string | null; count: number; rect: Rect }[];
  bounds: Box3;
  warnings: string[];
}

const normalized = new Matrix4(), rotationMatrix = new Matrix4();
const worldX = new Vector3(1, 0, 0);
const worldZ = new Vector3(0, 0, 1);

function projectedBounds(item: Occurrence, projection: Matrix4) {
  const box = new Box3();
  for (const part of item.parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox.clone().applyMatrix4(
      normalized.multiplyMatrices(projection, part.local)));
  }
  return box;
}

function prepared(item: CatalogItem, config: KnollingSettings, u: Vector3, v: Vector3, n: Vector3) {
  const occurrence = item.representative.occurrence;
  const id = occurrence.id;
  const override = Object.hasOwn(config.overrides, id) ? config.overrides[id] : null;
  const rest = occurrence.rest, linear = rest.clone().setPosition(0, 0, 0);
  const rotation = new Quaternion();
  if (config.orientation === "world" && rest.determinant() !== 0) {
    const original = new Quaternion();
    linear.decompose(new Vector3(), original, new Vector3());
    const frame = new Matrix4().makeBasis(u, n, v.clone().negate());
    rotation.setFromRotationMatrix(frame).multiply(original.invert());
  }
  if (config.orientation === "quarter") rotation.setFromAxisAngle(n, Math.PI / 2);
  if (config.orientation === "longest") {
    const size = projectedBounds(occurrence, new Matrix4()).getSize(new Vector3());
    const vectors = [worldX.clone().multiplyScalar(size.x), new Vector3(0, size.y, 0), worldZ.clone().multiplyScalar(size.z)]
      .map((axis) => axis.applyMatrix4(linear)).sort((a, b) => b.lengthSq() - a.lengthSq());
    if (vectors[0].lengthSq() > 0) rotation.setFromUnitVectors(vectors[0].normalize(), u);
  }
  if (override?.rotation) rotation.premultiply(new Quaternion().setFromAxisAngle(n, override.rotation * Math.PI / 180));
  const presentation = rotationMatrix.makeRotationFromQuaternion(rotation).clone().multiply(linear);
  const frame = new Matrix4().makeBasis(u, v, n).transpose().multiply(presentation);
  const box = projectedBounds(occurrence, frame);
  if (box.isEmpty()) return null;
  const size = box.getSize(new Vector3());
  return { item, box, size, rotation, presentation, fixed: override?.fixed ?? null };
}
type Prepared = NonNullable<ReturnType<typeof prepared>>;

function pinConflict(pins: readonly Rect[], spacing: number) {
  if (pins.length < 2) return false;
  const edge = spacing / 2;
  const ys = [...new Set(pins.flatMap((r) => [r.y - edge, r.y + r.h + edge]))].sort((a, b) => a - b);
  const index = new Map(ys.map((value, i) => [value, i]));
  const bottom = new Int32Array(ys.length + 1), top = new Int32Array(ys.length + 1);
  const add = (tree: Int32Array, i: number, value: number) => {
    for (let j = i + 1; j < tree.length; j += j & -j) tree[j] += value;
  };
  const count = (tree: Int32Array, i: number) => {
    let result = 0;
    for (let j = i; j > 0; j -= j & -j) result += tree[j];
    return result;
  };
  const events = pins.flatMap((r) => r.w + spacing > 0 && r.h + spacing > 0
    ? [{ x: r.x - edge, start: true, r }, { x: r.x + r.w + edge, start: false, r }] : []);
  events.sort((a, b) => a.x - b.x || Number(a.start) - Number(b.start));
  for (const { start, r } of events) {
    const lo = index.get(r.y - edge)!, hi = index.get(r.y + r.h + edge)!;
    if (start && count(bottom, hi) > count(top, lo + 1)) return true;
    add(bottom, lo, start ? 1 : -1);
    add(top, hi, start ? 1 : -1);
  }
  return false;
}

function stackRows(entries: Prepared[], config: KnollingSettings, kind: "grid" | "shelf") {
  const lines: Prepared[][] = [];
  const columns = Math.max(1, Math.floor(config.columns));
  if (kind === "grid") {
    for (let i = 0; i < entries.length; i += columns) lines.push(entries.slice(i, i + columns));
  } else {
    let line: Prepared[] = [];
    let width = 0;
    for (const entry of entries) {
      if (line.length && width + config.spacingM + entry.size.x > config.widthM) {
        lines.push(line);
        line = [];
        width = 0;
      }
      width += (line.length ? config.spacingM : 0) + entry.size.x;
      line.push(entry);
    }
    if (line.length) lines.push(line);
  }
  return lines;
}

function dimensions(entries: Prepared[], config: KnollingSettings, kind: "grid" | "shelf") {
  const lines = stackRows(entries, config, kind);
  const widths: number[] = [];
  if (kind === "grid") for (const line of lines) for (const [index, item] of line.entries()) {
    widths[index] = Math.max(widths[index] ?? 0, item.size.x);
  }
  return lines.map((items) => ({
    items, widths: kind === "grid" ? widths.slice(0, items.length) : items.map((item) => item.size.x),
    height: items.reduce((height, row) => Math.max(height, row.size.y), 0),
  }));
}

export function layoutKnolling(items: readonly CatalogItem[], config: KnollingSettings): LayoutResult {
  if (![config.spacingM, config.groupSpacingM, config.widthM, config.marginM, config.columns].every(Number.isFinite) ||
    config.spacingM < 0 || config.groupSpacingM < 0 || config.widthM <= 0 || config.marginM < 0 ||
    !Number.isInteger(config.columns) || config.columns < 1 || config.columns > 100) throw new Error("Parâmetros de disposição inválidos.");
  const [u, v, n] = planeBasis(config.plane);
  const warnings: string[] = [];
  const entries = items.map((item) => prepared(item, config, u, v, n)).filter((item): item is Prepared => item !== null);
  if (entries.length < items.length) warnings.push((items.length - entries.length) + " peças sem geometria atribuída.");
  const placements: Placement[] = [];
  const groups: LayoutResult["groups"] = [];
  const bounds = new Box3();
  function place(row: Prepared, x: number, y: number, group: string | null) {
    const { box, size, item, rotation, presentation } = row;
    const position = new Vector3().addScaledVector(u, x - box.min.x).addScaledVector(v, y - box.min.y).addScaledVector(n, -box.min.z);
    const world = presentation.clone().setPosition(position);
    const delta = position.sub(new Vector3().setFromMatrixPosition(item.representative.occurrence.rest));
    placements.push({ x, y, w: size.x, h: size.y, item, world, rotation, delta, group, fixed: row.fixed !== null });
    for (const a of [x, x + size.x]) for (const b of [y, y + size.y]) for (const c of [0, size.z]) {
      bounds.expandByPoint(new Vector3().addScaledVector(u, a).addScaledVector(v, b).addScaledVector(n, c));
    }
  }
  const pins = entries.filter((entry) => entry.fixed);
  for (const pin of pins) place(pin, pin.fixed![0], pin.fixed![1], "Fixadas");
  if (pinConflict(placements, config.spacingM)) throw new Error("Posições fixadas se sobrepõem. Ajuste as coordenadas ou o espaçamento.");
  let y = placements.reduce((max, rect) => Math.max(max, rect.y + rect.h + config.groupSpacingM + config.spacingM), config.marginM);
  const space = new Map(entries.map((row) => [row.item.representative.occurrence.key, row.size.x * row.size.y]));
  const order = config.mode === "assembly" ? "assembly" : config.sort;
  const rows = entries.filter((entry) => !entry.fixed).sort((a, b) =>
    compareCatalog(a.item.representative, b.item.representative, order, space));
  if (config.direction === "reverse" && config.mode !== "assembly") rows.reverse();
  const grouped = new Map<string | null, Prepared[]>();
  for (const row of rows) {
    const group = config.mode === "assembly" ? row.item.representative.stepLabel :
      config.mode === "grouped" ? catalogGroup(row.item.representative, config.group) : null;
    let entries = grouped.get(group);
    if (!entries) grouped.set(group, entries = []);
    entries.push(row);
  }
  const offsetFactor = config.alignment === "center" ? 0.5 : config.alignment === "end" ? 1 : 0;
  const kind = config.mode === "shelf" || config.mode === "assembly" ? "shelf" : "grid";
  if (kind === "shelf" && entries.some((entry) => entry.size.x > config.widthM)) {
    warnings.push("Há peças que excedem a largura configurada e ocupam uma linha própria.");
  }
  if (pins.length) groups.push({ label: "Fixadas", count: pins.reduce((sum, item) => sum + item.item.quantity, 0),
    rect: { x: 0, y: 0, w: 0, h: 0 } });
  for (const [group, rows] of grouped) {
    const start = y;
    let groupWidth = 0;
    for (const line of dimensions(rows, config, kind)) {
      let x = config.marginM;
      for (const [index, row] of line.items.entries()) {
        const cell = line.widths[index];
        place(row, x + (cell - row.size.x) * offsetFactor, y + (line.height - row.size.y) * offsetFactor, group);
        x += cell + config.spacingM;
      }
      groupWidth = Math.max(groupWidth, x - config.marginM - config.spacingM);
      y += line.height + config.spacingM;
    }
    const label = config.mode === "assembly" && group === null ? "Sem etapa autorada" :
      config.mode === "grouped" && group === null ? "Sem classificação" : group;
    groups.push({ label, count: rows.reduce((sum, row) => sum + row.item.quantity, 0),
      rect: { x: config.marginM, y: start, w: groupWidth, h: y - start - config.spacingM } });
    y += config.groupSpacingM;
  }
  if (!bounds.isEmpty()) bounds.expandByScalar(config.marginM);
  return { placements, groups, bounds, warnings };
}
