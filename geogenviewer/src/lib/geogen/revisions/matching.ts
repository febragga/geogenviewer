import { shapeKey } from "./geometry.ts";
import { authored, needsProjectAssociation, type Occurrence, type Revision } from "./revision.ts";

export type ManualMatch = { baseId: string | null; comparisonId: string | null; replacement?: boolean };
export type MatchMethod = "persistent" | "authored" | "manual" | "heuristic" | "ambiguous" | "unmatched";
export interface Match {
  baseId: string | null;
  comparisonId: string | null;
  method: MatchMethod;
  candidates: string[];
  candidateCount: number;
  replacement?: boolean;
  confirmed: boolean;
}

export function validateManual(base: Revision, comparison: Revision, manual: readonly ManualMatch[]) {
  const left = new Set<string>(), right = new Set<string>();
  for (const entry of manual) {
    const { baseId, comparisonId, replacement } = entry;
    if ((!baseId && !comparisonId) || (replacement && (!baseId || !comparisonId)) ||
      (baseId && (!base.occurrences.has(baseId) || left.has(baseId))) ||
      (comparisonId && (!comparison.occurrences.has(comparisonId) || right.has(comparisonId)))) {
      throw new Error("Associação inválida, repetida ou com peça indisponível.");
    }
    if (baseId) left.add(baseId);
    if (comparisonId) right.add(comparisonId);
  }
}

const persistentSource = ({ record }: Occurrence) => record.sourceObjectId
  ? JSON.stringify([record.sourceObjectId, record.instancePath, record.blockDefinitionId]) : null;
const part = ({ record }: Occurrence) => {
  const code = authored(record, "GeoGen:PartId") ?? authored(record, "GeoGen:FabricationCode");
  return typeof code === "string" && code.trim() ? code.trim() : null;
};
const heuristic = (item: Occurrence) => {
  const { record, rest } = item;
  if (item.parts.length === 0) return null;
  // Require context beyond shape. The result remains a suggestion.
  const location = rest.elements.slice(12, 15).map((value) => Math.round(value * 1000));
  return JSON.stringify([record.category, record.layerId, record.blockDefinitionId, location, shapeKey(item)]);
};

function index(items: Map<string, Occurrence>, keyOf: (item: Occurrence) => string | null) {
  const result = new Map<string, string[]>();
  for (const item of items.values()) {
    const key = keyOf(item);
    if (key === null) continue;
    let ids = result.get(key);
    if (!ids) result.set(key, ids = []);
    ids.push(item.id);
  }
  return result;
}

export function matchRevisions(base: Revision, comparison: Revision, manual: readonly ManualMatch[] = [], associated = false) {
  if (needsProjectAssociation(base, comparison) && !associated) {
    throw new Error("Associe explicitamente os projetos para iniciar a comparação.");
  }
  validateManual(base, comparison, manual);
  const left = new Map(base.occurrences), right = new Map(comparison.occurrences);
  const result: Match[] = [];
  const append = (entry: ManualMatch, method: MatchMethod, confirmed: boolean, candidates: string[] = [], candidateCount = candidates.length) => {
    result.push({ ...entry, method, candidates, candidateCount, confirmed });
    if (entry.baseId) left.delete(entry.baseId);
    if (entry.comparisonId) right.delete(entry.comparisonId);
  };
  for (const entry of manual) append(entry, "manual", true);
  const semantic = Boolean(base.identity.projectId && comparison.identity.projectId);
  if (semantic) {
    // A stable manifest ID is scoped to a project. An explicit association permits suggestions across projects.
    if (base.identity.projectId === comparison.identity.projectId) {
      for (const id of left.keys()) if (right.has(id)) append({ baseId: id, comparisonId: id }, "persistent", true);
    }
    const first = index(base.occurrences, persistentSource), second = index(comparison.occurrences, persistentSource);
    for (const [key, ids] of first) {
      const candidates = second.get(key);
      if (ids.length === 1 && candidates?.length === 1 && left.has(ids[0]) && right.has(candidates[0])) {
        append({ baseId: ids[0], comparisonId: candidates[0] }, "persistent", true);
      }
    }
  }
  const blocked = new Set<string>();
  function suggest(keyOf: (item: Occurrence) => string | null, method: "authored" | "heuristic") {
    const first = index(left, keyOf), second = index(right, keyOf);
    for (const [key, ids] of first) {
      const candidates = second.get(key);
      if (!candidates) continue;
      for (const id of candidates) blocked.add(id);
      const kind = ids.length === 1 && candidates.length === 1 ? method : "ambiguous";
      const preview = candidates.slice(0, 32);
      for (const id of ids) append({ baseId: id, comparisonId: null }, kind, false, preview, candidates.length);
    }
  }
  if (semantic) {
    suggest(part, "authored");
    suggest(persistentSource, "heuristic");
  }
  suggest(heuristic, "heuristic");
  for (const id of left.keys()) append({ baseId: id, comparisonId: null }, "unmatched", true);
  for (const id of right.keys()) append({ baseId: null, comparisonId: id }, blocked.has(id) ? "ambiguous" : "unmatched", !blocked.has(id));
  return result;
}
