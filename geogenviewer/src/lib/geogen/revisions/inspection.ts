import { inspectionIdentity, parseInspection } from "../inspection/document.ts";
import { meshReferences, type Measurement } from "../inspection/measurements.ts";
import type { Diff } from "./diff.ts";
import type { Revision } from "./revision.ts";
import { numericDelta } from "./reports.ts";

export type InspectionEntry = { record: Measurement; invalid: boolean };
export function readInspection(text: string, revision: Revision): InspectionEntry[] {
  const references = meshReferences(revision.scene.model.scene, revision.scene.objectByComponentId);
  const document = parseInspection(text, inspectionIdentity(revision.scene), new Set(revision.occurrences.keys()), references.valid, true);
  return document.measurements.map((record) => ({ record, invalid: record.anchors.some((anchor) => !references.valid(anchor)) }));
}

export function pairInspections(base: InspectionEntry[], next: InspectionEntry[], diffs: Diff[], accepted: ReadonlySet<string>) {
  const matching = new Map(diffs.flatMap((diff) => diff.confirmed && diff.baseId ? [[diff.baseId, diff] as const] : []));
  const named = new Map<string, InspectionEntry[]>();
  const used = new Set<string>();
  const key = (record: Measurement, ids: (string | null)[]) => JSON.stringify([record.name, record.kind, record.pose, ids]);
  for (const entry of next) {
    const name = key(entry.record, entry.record.anchors.map((anchor) => anchor.elementId));
    const group = named.get(name) ?? [];
    group.push(entry);
    named.set(name, group);
  }
  const candidates = base.map((a) => {
    const diffs = a.record.anchors.map((anchor) => matching.get(anchor.elementId));
    const removed = diffs.some((diff) => diff?.status === "removed");
    const ids = diffs.map((diff) => diff?.comparisonId ?? null);
    const name = key(a.record, ids);
    return { a, removed, name, candidates: a.record.pose === "rest" && ids.every(Boolean) ? named.get(name) ?? [] : [] };
  });
  const counts = new Map<string, number>();
  for (const row of candidates) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  const result = candidates.map(({ a, removed, name, candidates }) => {
    const b = candidates.length === 1 && counts.get(name) === 1 ? candidates[0] : null;
    if (b) used.add(b.record.id);
    const valid = Boolean(b && !a.invalid && !b.invalid);
    const pairKey = JSON.stringify([a.record.id, b?.record.id]);
    const confirmed = valid && accepted.has(pairKey);
    return { key: pairKey, base: a, comparison: b, removed, valid, confirmed,
      delta: confirmed && typeof a.record.valueM === "number" && typeof b?.record.valueM === "number"
        ? numericDelta(a.record.valueM, b.record.valueM) : null };
  });
  return [...result, ...next.filter((entry) => !used.has(entry.record.id)).map((entry) =>
    ({ key: JSON.stringify([null, entry.record.id]), base: null, comparison: entry, removed: false, valid: false, confirmed: false, delta: null }))];
}
