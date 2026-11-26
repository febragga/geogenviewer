import { Matrix4, Quaternion, Vector3 } from "three";
import { compareShape, type ShapeResult } from "./geometry.ts";
import type { Match } from "./matching.ts";
import type { Occurrence, Revision } from "./revision.ts";

export const statuses = ["unchanged", "added", "removed", "modified", "unresolved"] as const;
export type DiffStatus = typeof statuses[number];
export type Change = "geometry" | "position" | "rotation" | "scale" | "material" | "layer" |
  "category" | "metadata" | "fabrication" | "assembly" | "replacement";
export interface Diff extends Match { status: DiffStatus; changes: Change[]; shape: ShapeResult | null; transformInconclusive: boolean }

export function stableValue(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableValue).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => JSON.stringify(key) + ":" + stableValue(item)).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

function pose(matrix: Matrix4) {
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  const reconstructed = new Matrix4().compose(position, rotation, scale);
  const invalid = matrix.determinant() === 0 || matrix.elements.some((value, index) =>
    Math.abs(value - reconstructed.elements[index]) > 1e-9 * Math.max(1, Math.abs(value)));
  return { position, rotation, scale, invalid };
}

function assemblyById(revision: Revision) {
  const entries = new Map<string, unknown[]>();
  for (const { elementIds, ...step } of revision.scene.manifest?.assembly?.steps ?? []) {
    for (const id of elementIds) {
      let list = entries.get(id);
      if (!list) entries.set(id, list = []);
      list.push({ ...step, dependsOn: [...step.dependsOn].sort() });
    }
  }
  return entries;
}

function semantic(item: Occurrence, revision: Revision, assembly: Map<string, unknown[]>) {
  const { record } = item;
  const { cad } = record;
  const layer = record.layerId && revision.scene.sceneGraph.layers[record.layerId];
  const material = record.materialId && revision.scene.sceneGraph.materials[record.materialId];
  return {
    material: [record.materialId, material || null, [...item.visualMaterials].sort(), cad?.colorHex, cad?.fabrication?.material],
    layer: [record.layerId, layer && layer.fullPath],
    category: record.category,
    metadata: [record.name, [...record.groupIds].sort(), record.parentId, cad?.geometryType, cad?.isValid,
      cad?.isClosed, cad?.dimensions, cad?.areaM2, cad?.volumeM3,
      Object.fromEntries(Object.entries(cad?.properties ?? {}).filter(([key]) => !key.startsWith("GeoGen:Fabrication:"))),
      Object.fromEntries(Object.entries(cad?.userText ?? {}).filter(([key]) => !key.startsWith("GeoGen:Fabrication:")))],
    fabrication: [cad?.fabrication, ...[cad?.properties, cad?.userText].map((source) =>
      Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => key.startsWith("GeoGen:Fabrication:"))))],
    assembly: [cad?.connectorIds.slice().sort(), cad?.assemblyDirectionM, assembly.get(item.id) ?? []],
  };
}

export function prepareDiff(base: Revision, comparison: Revision, alignment: Matrix4, toleranceM: number) {
  if (!Number.isFinite(toleranceM) || toleranceM < 0) throw new Error("Tolerância geométrica inválida.");
  const assemblyA = assemblyById(base), assemblyB = assemblyById(comparison);
  return (match: Match): Diff => {
    const { baseId, comparisonId } = match;
    const diff: Diff = { ...match, status: "unresolved", changes: [], shape: null, transformInconclusive: false };
    if (!match.confirmed) return diff;
    if (!baseId || !comparisonId) {
      diff.status = baseId ? "removed" : "added";
      return diff;
    }
    const a = base.occurrences.get(baseId)!, b = comparison.occurrences.get(comparisonId)!;
    diff.shape = compareShape(a, b, toleranceM);
    if (diff.shape === "above-tolerance") diff.changes.push("geometry");
    const first = pose(a.rest), second = pose(alignment.clone().multiply(b.rest));
    diff.transformInconclusive = first.invalid || second.invalid;
    if (first.position.distanceTo(second.position) > toleranceM) diff.changes.push("position");
    if (!diff.transformInconclusive) {
      if (first.rotation.angleTo(second.rotation) > 1e-5) diff.changes.push("rotation");
      if (first.scale.distanceTo(second.scale) > 1e-7) diff.changes.push("scale");
    }
    const previous = semantic(a, base, assemblyA), current = semantic(b, comparison, assemblyB);
    for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
      if (key !== "material" && (!a.record.cad || !b.record.cad)) continue;
      if (stableValue(previous[key]) !== stableValue(current[key])) diff.changes.push(key);
    }
    if (match.replacement) diff.changes.push("replacement");
    diff.status = diff.changes.length ? "modified" :
      diff.shape === "inconclusive" || diff.transformInconclusive ? "unresolved" : "unchanged";
    return diff;
  };
}

export function diffRevisions(base: Revision, comparison: Revision, matches: Match[], alignment: Matrix4, toleranceM: number): Diff[] {
  return matches.map(prepareDiff(base, comparison, alignment, toleranceM));
}
