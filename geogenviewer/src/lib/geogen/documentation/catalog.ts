import { stableValue, type DiffStatus } from "../revisions/diff.ts";
import { analyzeFabrication, defaultFabrication, type FabricationSettings } from "../revisions/fabrication.ts";
import { collectQuantities, type QuantityRow } from "../revisions/quantities.ts";
import { authored, type Revision } from "../revisions/revision.ts";
import type { AssemblyTimeline } from "../assembly/timeline.ts";
import { normalizeSearch } from "../domain/visibility.ts";

export type CatalogGroup = "category" | "layer" | "material" | "group" | "type" | "assembly" | "prototype";
export type CatalogSort = "name" | "part" | "type" | "category" | "layer" | "material" | "length" | "projected" | "area" | "volume" | "mass" | "assembly";
export type CatalogScope = "all" | "selected" | "visible" | "filtered" | "layer" | "group" | "category" | "material" | "type" | "assembly" | "modified";
export interface TypeSettings {
  overrides: Record<string, string>;
  confirmed: string[];
  blocks: boolean;
}
export const defaultTypes: TypeSettings = { overrides: {}, confirmed: [], blocks: false };

export function catalogEntries(revision: Revision, timeline: AssemblyTimeline, status: ReadonlyMap<string, DiffStatus>, fabrication: FabricationSettings = defaultFabrication, ids?: ReadonlySet<string>) {
  const quantities = collectQuantities(revision, ids);
  const analysis = analyzeFabrication(revision, quantities, fabrication);
  return quantities.map((row, index) => {
    const { occurrence } = row;
    const typeId = authored(occurrence.record, "GeoGen:TypeId");
    const step = timeline.byElement.get(occurrence.id);
    const assembly = step === undefined ? null : timeline.schedule[step];
    return {
      ...row,
      type: typeof typeId === "string" && typeId.trim() ? typeId.trim() : row.type,
      step: step ?? null, stepLabel: assembly ? (step! + 1) + " · " + assembly.step.title : null,
      status: status.get(occurrence.id) ?? null, fabrication: analysis[index],
    };
  });
}
export type CatalogEntry = ReturnType<typeof catalogEntries>[number];
export interface CatalogItem {
  key: string;
  label: string | null;
  representative: CatalogEntry;
  members: CatalogEntry[];
  quantity: number;
  inconsistent: boolean;
}
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
export const distinctEntries = <T extends QuantityRow>(rows: readonly T[]) =>
  [...new Map(rows.map((entry) => [entry.occurrence.key, entry])).values()];

function physicalSignature(row: CatalogEntry) {
  const { record, rest } = row.occurrence;
  const m = rest.elements;
  const scale = [0, 4, 8].map((i) => Math.round(Math.hypot(m[i], m[i + 1], m[i + 2]) * 1e6));
  return stableValue([row.material, record.cad?.dimensions, record.cad?.fabrication?.toleranceMm, scale, rest.determinant() < 0]);
}

export function catalogTypes(rows: readonly CatalogEntry[], settings: TypeSettings): CatalogItem[] {
  const byType = new Map<string, CatalogEntry[]>();
  const items: CatalogItem[] = [];
  for (const row of distinctEntries(rows)) {
    const id = row.occurrence.id;
    const manual = Object.hasOwn(settings.overrides, id) ? settings.overrides[id] : null;
    const label = manual || row.type || (settings.blocks && row.block ? "Bloco · " + row.block : null);
    if (!label) {
      items.push({ key: row.occurrence.key, label: null, representative: row, members: [row], quantity: row.occurrence.count, inconsistent: false });
      continue;
    }
    let group = byType.get(label);
    if (!group) byType.set(label, group = []);
    group.push(row);
  }
  const confirmed = new Set(settings.confirmed);
  for (const [label, rows] of byType) {
    const ordered = [...rows].sort((a, b) => collator.compare(a.occurrence.id, b.occurrence.id) || a.occurrence.id.localeCompare(b.occurrence.id));
    const variants = new Map<string, CatalogEntry[]>();
    for (const row of ordered) {
      const key = physicalSignature(row);
      let members = variants.get(key);
      if (!members) variants.set(key, members = []);
      members.push(row);
    }
    const inconsistent = variants.size > 1;
    const groups = inconsistent && !confirmed.has(label) ? [...variants.values()] : [ordered];
    for (let i = 0; i < groups.length; i++) {
      const members = groups[i];
      items.push({ key: JSON.stringify([members[0].occurrence.key, label]), label, representative: members[0], members,
        quantity: members.reduce((total, row) => total + row.occurrence.count, 0), inconsistent });
    }
  }
  return items;
}

export function occurrenceItems(rows: readonly CatalogEntry[]): CatalogItem[] {
  return distinctEntries(rows).map((row) => ({
    key: row.occurrence.key, label: row.part, representative: row, members: [row], quantity: row.occurrence.count, inconsistent: false,
  }));
}

export function catalogGroup(row: CatalogEntry, group: CatalogGroup) {
  if (group === "assembly") return row.stepLabel;
  if (group === "group") return [...row.groups].sort(collator.compare)[0] ?? null;
  return row[group];
}

export function projectSearch(row: CatalogEntry, query: string) {
  if (!query) return true;
  const { record, id } = row.occurrence;
  const properties = [...Object.entries(record.cad?.properties ?? {}), ...Object.entries(record.cad?.userText ?? {})];
  return normalizeSearch([id, record.name, row.part, row.type, row.layer, ...row.groups, row.category,
    row.material, ...record.materialNames, row.prototype, row.stepLabel, row.status, ...properties.flat()].join(" ")).includes(query);
}

export interface ScopeContext {
  selected: ReadonlySet<string>; visible: ReadonlySet<string>; filtered: ReadonlySet<string>;
}

export function scopeCatalog(rows: readonly CatalogEntry[], scope: CatalogScope, value: string, ctx: ScopeContext) {
  return rows.filter((row) => {
    if (scope === "all") return true;
    if (scope === "selected" || scope === "visible" || scope === "filtered") return ctx[scope].has(row.occurrence.id);
    if (scope === "modified") return row.status === "modified";
    if (scope === "group") return row.groups.includes(value);
    return catalogGroup(row, scope) === (value || null);
  });
}

export function compareCatalog(a: CatalogEntry, b: CatalogEntry, sort: CatalogSort, projected = new Map<string, number>()) {
  function read(row: CatalogEntry) {
    if (sort === "name") return row.occurrence.record.name;
    if (sort === "length") return row.occurrence.record.cad?.dimensions?.lengthM ?? null;
    if (sort === "area" || sort === "volume") return row[sort]?.value ?? null;
    if (sort === "mass") return row.fabrication.mass.measured?.value ?? row.fabrication.mass.slicer?.value
      ?? row.fabrication.mass.solid?.value ?? row.fabrication.mass.estimate?.value ?? null;
    if (sort === "projected") return projected.get(row.occurrence.key) ?? null;
    if (sort === "assembly") return row.step;
    return row[sort];
  }
  const first = read(a), second = read(b);
  const order = first == null || second == null ? Number(first == null) - Number(second == null) :
    typeof first === "number" && typeof second === "number" ? first - second : collator.compare(String(first), String(second));
  return order || collator.compare(a.occurrence.id, b.occurrence.id) || a.occurrence.id.localeCompare(b.occurrence.id);
}
