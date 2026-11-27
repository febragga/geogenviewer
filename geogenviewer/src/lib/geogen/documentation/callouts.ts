import { componentLabel } from "../domain/component-identity.ts";
import { Matrix4, Vector3, type Camera, type Plane } from "three";
import type { CatalogEntry } from "./catalog.ts";
import type { Rect } from "./knolling.ts";
import type { Occurrence, Revision, Triple } from "../revisions/revision.ts";

export type CalloutKind = "part" | "number" | "technical" | "assembly" | "custom";
export type Leader = "line" | "dot" | "arrow" | "dash" | "none";
export interface Callout {
  id: string; elementId: string; kind: CalloutKind; text: string; anchor: Triple;
  offset: [number, number]; leader: Leader; visible: boolean;
}

const _anchorMin = new Vector3();
const _anchorMax = new Vector3();
const _anchorInv = new Matrix4();
const anchorCache = new WeakMap<Occurrence, Triple>();

function localCenterAnchor(occurrence: Occurrence): Triple {
  const cached = anchorCache.get(occurrence);
  if (cached) return cached;
  const b = occurrence.record.meshMinMaxMeters;
  _anchorMin.fromArray(b.min);
  _anchorMax.fromArray(b.max);
  _anchorMin.lerp(_anchorMax, 0.5);
  const matrix = occurrence.rest;
  const anchor: Triple = matrix.determinant()
    ? _anchorMin.applyMatrix4(_anchorInv.copy(matrix).invert()).toArray()
    : [0, 0, 0];
  anchorCache.set(occurrence, anchor);
  return anchor;
}

export function makeCallout(row: CatalogEntry, id: string, kind: CalloutKind = "part"): Callout {
  return {
    id,
    elementId: row.occurrence.id,
    kind,
    text: "",
    anchor: localCenterAnchor(row.occurrence),
    offset: [16, -22],
    leader: "dot",
    visible: true,
  };
}

export function calloutText(entry: CatalogEntry, label: Callout, index: number, quantity?: number) {
  const name = componentLabel(entry.occurrence.record);
  if (label.kind === "custom") return label.text || name;
  if (label.kind === "number") return String(index + 1).padStart(2, "0");
  if (label.kind === "assembly") return entry.stepLabel ? name + " · " + entry.stepLabel : name;
  if (label.kind === "technical") {
    const length = entry.occurrence.record.cad?.dimensions?.lengthM;
    return [name, entry.material, length == null ? null : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(length * 1000) + " mm"]
      .filter(Boolean).join(" · ");
  }
  return name + (quantity != null && quantity > 1 ? " × " + quantity : "");
}

export interface ProjectedCallout extends Rect {
  id: string; text: string; leader: Leader; from: [number, number];
}
type Annotation = { callout: Callout; text: string; selected: boolean };

export function annotationModel(rows: ReadonlyMap<string, CatalogEntry>, authored: readonly Callout[], automatic: readonly CatalogEntry[],
  selected: ReadonlySet<string>, quantities?: ReadonlyMap<string, number>) {
  const claimed = new Set<string>();
  const entries: Annotation[] = [];
  for (const [index, callout] of authored.entries()) {
    const row = rows.get(callout.elementId);
    if (!row) continue;
    claimed.add(callout.elementId);
    if (!callout.visible) continue;
    entries.push({ callout, text: calloutText(row, callout, index, quantities?.get(callout.elementId)), selected: selected.has(callout.elementId) });
  }
  for (const row of automatic) {
    if (claimed.has(row.occurrence.id)) continue;
    const callout = makeCallout(row, "automatic:" + row.occurrence.key);
    entries.push({ callout, text: calloutText(row, callout, 0, quantities?.get(callout.elementId)), selected: selected.has(callout.elementId) });
  }
  return entries.sort((a, b) => Number(b.selected) - Number(a.selected));
}

export function annotationPoint(revision: Revision, label: Callout): Vector3 | null {
  const object = revision.scene.objectByComponentId.get(label.elementId);
  return object ? new Vector3(...label.anchor).applyMatrix4(object.matrixWorld) : null;
}

export function projectCallouts(entries: readonly Annotation[], camera: Camera, width: number, height: number,
  matrixOf: (id: string) => Matrix4 | undefined, planes: readonly Plane[], measure: (text: string) => number, limit = 80, reserved: readonly Rect[] = []) {
  const boxes = new Map<string, Rect[]>();
  const result: ProjectedCallout[] = [];
  const point = new Vector3(), projected = new Vector3();
  const bucketSize = 40;
  const cells = (rect: Rect) => {
    const keys: string[] = [];
    for (let y = Math.floor(rect.y / bucketSize); y <= Math.floor((rect.y + rect.h) / bucketSize); y++)
      for (let x = Math.floor(rect.x / bucketSize); x <= Math.floor((rect.x + rect.w) / bucketSize); x++) keys.push(x + ":" + y);
    return keys;
  };
  function remember(rect: Rect, keys: string[]) {
    for (const key of keys) {
      let box = boxes.get(key);
      if (!box) boxes.set(key, box = []);
      box.push(rect);
    }
  }
  for (const rect of reserved) remember(rect, cells(rect));
  let inspected = 0;
  const inspectionCap = limit * 8;
  for (const { callout, text, selected } of entries) {
    if (++inspected > inspectionCap) break;
    const matrix = matrixOf(callout.elementId);
    if (!matrix) continue;
    point.fromArray(callout.anchor).applyMatrix4(matrix);
    if (planes.some((plane) => plane.distanceToPoint(point) < -1e-9)) continue;
    projected.copy(point).project(camera);
    if (![projected.x, projected.y, projected.z].every((coordinate) => Number.isFinite(coordinate) && Math.abs(coordinate) <= 1)) continue;
    const from: [number, number] = [(projected.x + 1) * width / 2, (1 - projected.y) * height / 2];
    const w = Math.min(width - 6, 220, Math.max(34, measure(text) + 16));
    if (w <= 0 || height < 25) break;
    const h = 23;
    for (const [dx, dy] of [[0, 0], [0, -26], [0, 26], [-w - 24, 0], [0, 52], [0, -52]]) {
      const x = Math.max(3, Math.min(width - w - 3, from[0] + callout.offset[0] + dx));
      const y = Math.max(3, Math.min(height - h - 3, from[1] + callout.offset[1] + dy));
      const rect = { x, y, w, h };
      const keys = cells(rect);
      const overlap = keys.some((key) => boxes.get(key)?.some((b) => rect.x < b.x + b.w && b.x < rect.x + rect.w &&
        rect.y < b.y + b.h && b.y < rect.y + rect.h));
      if (overlap) continue;
      remember(rect, keys);
      result.push({ ...rect, id: callout.id, text, leader: callout.leader, from });
      break;
    }
    if (result.length >= limit) break;
    if (!selected && result.length === 0 && width < 100) break;
  }
  return result;
}

export function drawCallouts(ctx: CanvasRenderingContext2D, labels: readonly ProjectedCallout[], dark: boolean, leaderLines = true) {
  ctx.save();
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (const label of labels) {
    const { x, y, w, h, from, leader } = label;
    ctx.strokeStyle = dark ? "#bbd8ec" : "#405e76";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1;
    const end = [Math.max(x, Math.min(x + w, from[0])), y + h / 2];
    if (leader !== "none" && leaderLines) {
      ctx.setLineDash(leader === "dash" ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(...from); ctx.lineTo(end[0], end[1]); ctx.stroke();
      ctx.setLineDash([]);
      if (leader === "dot") { ctx.beginPath(); ctx.arc(...from, 2.5, 0, Math.PI * 2); ctx.fill(); }
      if (leader === "arrow") {
        const angle = Math.atan2(end[1] - from[1], end[0] - from[0]);
        ctx.beginPath(); ctx.moveTo(from[0] + 7 * Math.cos(angle - 0.4), from[1] + 7 * Math.sin(angle - 0.4));
        ctx.lineTo(...from); ctx.lineTo(from[0] + 7 * Math.cos(angle + 0.4), from[1] + 7 * Math.sin(angle + 0.4)); ctx.stroke();
      }
    }
    ctx.fillStyle = dark ? "#20282f" : "#ffffff";
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = dark ? "#edf5fb" : "#172b3d";
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 7, y, w - 14, h); ctx.clip();
    ctx.fillText(label.text, x + 7, y + h / 2);
    ctx.restore();
  }
  ctx.restore();
}
