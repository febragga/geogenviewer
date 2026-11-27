import { componentIdentity, identityText } from "../domain/component-identity.ts";
import type { MeasuredScalar } from "../domain/model.ts";
import type { ResolvedOrganizationView } from "../organization/model.ts";
import { meshMetrics } from "./geometry.ts";
import { authored, type Occurrence, type Revision } from "./revision.ts";

export type QuantityScope = "all" | "visible" | "selected" | "filtered" | "modified" | "category" | "material";
export type Grouping = "category" | "layer" | "material" | "block" | "part" | "type" | "prototype" | "property" | "group" | "userLayer" | "userGroup";
export type QuantityValue = MeasuredScalar & { method: string };

export interface QuantityRow {
  occurrence: Occurrence;
  category: string;
  layer: string | null;
  userLayer: string | null;
  material: string | null;
  prototype: string | null;
  block: string | null;
  part: string | null;
  type: string | null;
  typeId: string | null;
  area: QuantityValue | null;
  volume: QuantityValue | null;
  geometricVolume: QuantityValue | null;
  fabricationVolume: number | null;
  volumeExclusion: string | null;
  groups: string[];
  userGroups: string[];
  property: string | null;
}

function scalar(value: MeasuredScalar | null | undefined, name: string): QuantityValue | null {
  return value && Number.isFinite(value.value) && value.value >= 0 ? { ...value, method: name + "-" + value.source } : null;
}

export function numeric(value: unknown) {
  if (typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) value = Number(value);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function resolveUserLayerPath(org: ResolvedOrganizationView | null | undefined, layerId: string | null): string | null {
  if (!org || !layerId) return null;
  const parts: string[] = [];
  for (let cur: string | null = layerId; cur && parts.length < 16; cur = org.layers[cur]?.parentId ?? null) {
    const rec = org.layers[cur];
    if (!rec) break;
    parts.unshift(rec.name);
  }
  return parts.length ? parts.join(" / ") : null;
}

export function collectQuantities(
  revision: Revision,
  ids?: ReadonlySet<string>,
  property = "",
  organization?: ResolvedOrganizationView | null
): QuantityRow[] {
  const graph = revision.scene.sceneGraph;
  const rows: QuantityRow[] = [];
  for (const occurrence of revision.occurrences.values()) {
    if (ids && !ids.has(occurrence.id)) continue;
    const { record } = occurrence;
    const cad = record.cad;
    const area = scalar(cad?.areaM2, "area");
    const volume = cad?.isClosed === false && cad.volumeM3?.source === "mesh" ? null : scalar(cad?.volumeM3, "volume");
    const metrics = !area || (!volume && cad?.isClosed !== false) ? meshMetrics(occurrence) : null;
    const authoredVolume = numeric(authored(record, "GeoGen:Fabrication:VolumeM3"));
    const material = cad?.fabrication?.material?.trim() || null;
    const part = componentIdentity(record).partIds[0] ?? null;
    const typeId = identityText(authored(record, "GeoGen:TypeId"));
    const type = identityText(authored(record, "GeoGen:TypeCode")) ?? typeId;
    const meshVolume: QuantityValue | null = metrics?.volumeM3 != null
      ? { value: metrics.volumeM3, source: "mesh", method: "volume-closed-mesh" } : null;
    const propertyValue = property ? authored(record, property) : null;
    const userLayerId = organization?.componentLayerId[occurrence.id] ?? null;
    const userGroupIds = organization?.componentGroupIds[occurrence.id] ?? [];
    rows.push({
      occurrence, category: record.category, layer: record.layerId ? graph.layers[record.layerId]?.fullPath ?? record.layerId : null,
      userLayer: resolveUserLayerPath(organization, userLayerId),
      material, prototype: cad?.fabrication?.prototypeId ?? revision.identity.prototypeId, block: record.blockDefinitionId,
      part, type, typeId,
      area: area ?? (metrics?.areaM2 != null ? { value: metrics.areaM2, source: "mesh", method: "area-triangles" } : null),
      volume: volume ?? (authoredVolume !== null ? { value: authoredVolume, source: "authored", method: "volume-authored" } :
        meshVolume),
      geometricVolume: volume ?? meshVolume,
      fabricationVolume: authoredVolume,
      volumeExclusion: volume || authoredVolume !== null || metrics?.volumeM3 != null ? null :
        cad?.isClosed === false ? "open-mesh" : metrics?.volumeExclusion ?? "missing-geometry",
      groups: record.groupIds.map((id) => graph.groups[id]?.name ?? id),
      userGroups: userGroupIds.map((id) => organization?.groups[id]?.name ?? id),
      property: propertyValue === null ? null : String(propertyValue),
    });
  }
  return rows;
}

export function coverage<T>(rows: readonly T[], read: (row: T) => number | null, reason: (row: T) => string) {
  let included = 0, sum = 0;
  const reasons = new Map<string, number>();
  for (const row of rows) {
    const value = read(row);
    if (value !== null) {
      included++;
      sum += value;
    } else {
      const key = reason(row);
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
  }
  return { subtotal: included && Number.isFinite(sum) ? sum : null, included, excluded: rows.length - included,
    percent: rows.length ? 100 * included / rows.length : null, reasons: Object.fromEntries(reasons) };
}

function quantityByMethod(rows: readonly QuantityRow[], field: "area" | "volume" | "geometricVolume") {
  const methods = new Set(rows.flatMap((row) => row[field]?.method ?? []));
  return Object.fromEntries([...methods].map((method) => [method,
    coverage(rows, (row) => row[field]?.method === method ? row[field].value : null,
      (row) => row[field] ? "different-method" : row.volumeExclusion ?? "missing")]));
}

export function summarizeQuantities(input: readonly QuantityRow[], volumeField: "volume" | "geometricVolume" = "volume") {
  const rows = [...new Map(input.map((row) => [row.occurrence.key, row])).values()];
  const types = new Set<string>(), blocks = new Set<string>(), geometries = new Set<string>();
  let occurrences = 0;
  for (const row of rows) {
    occurrences += row.occurrence.count;
    if (row.type) types.add(row.type);
    if (row.block) blocks.add(row.block);
    for (const mesh of row.occurrence.parts) geometries.add(mesh.geometry.uuid);
  }
  return { components: rows.length, occurrences, types: types.size, blocks: blocks.size, uniqueGeometries: geometries.size,
    area: quantityByMethod(rows, "area"), volume: quantityByMethod(rows, volumeField),
    areaCoverage: coverage(rows, (row) => row.area ? 1 : null, () => "missing-geometry"),
    volumeCoverage: coverage(rows, (row) => row[volumeField] ? 1 : null, (row) => row.volumeExclusion ?? "missing") };
}

export function groupQuantities(rows: readonly QuantityRow[], field: Grouping) {
  const groups = new Map<string | null, QuantityRow[]>();
  for (const row of rows) {
    const keys =
      field === "group"
        ? (row.groups.length ? [...new Set(row.groups)] : [null])
        : field === "userGroup"
          ? (row.userGroups.length ? [...new Set(row.userGroups)] : [null])
          : [row[field]];
    for (const key of keys) {
      let group = groups.get(key);
      if (!group) groups.set(key, group = []);
      group.push(row);
    }
  }
  const overlapping =
    (field === "group" && rows.some((row) => new Set(row.groups).size > 1)) ||
    (field === "userGroup" && rows.some((row) => new Set(row.userGroups).size > 1));
  return { groups, overlapping };
}
