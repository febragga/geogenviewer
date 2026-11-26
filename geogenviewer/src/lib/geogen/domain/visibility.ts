import type { ResolvedOrganizationView } from "../organization/model.ts";
import type { ComponentRecord, ViewerSceneGraph } from "./model.ts";

export type FilterField =
  | "layer"
  | "group"
  | "userLayer"
  | "userGroup"
  | "category"
  | "material"
  | "geometry"
  | "block"
  | "instance"
  | "selection"
  | "assembly";
export type ModelFacet = Exclude<FilterField, "selection" | "assembly">;
export type Filters = Partial<Record<FilterField, string[]>>;
export type AssemblyVisibility = "context" | "future" | "active" | "mounted";

export interface FilterOption { value: string; label: string }

export function layerChain(graph: ViewerSceneGraph, id: string | null) {
  const chain: string[] = [];
  for (let layer = id; layer && !chain.includes(layer); layer = graph.layers[layer]?.parentId ?? null) {
    chain.push(layer);
  }
  return chain;
}

export function userLayerChain(
  organization: ResolvedOrganizationView | null | undefined,
  id: string | null
) {
  const chain: string[] = [];
  if (!organization) return chain;
  for (let layer = id; layer && !chain.includes(layer); layer = organization.layers[layer]?.parentId ?? null) {
    chain.push(layer);
  }
  return chain;
}

function userLayerPath(organization: ResolvedOrganizationView, id: string): string {
  const parts: string[] = [];
  for (let cur: string | null = id; cur && parts.length < 16; cur = organization.layers[cur]?.parentId ?? null) {
    const rec = organization.layers[cur];
    if (!rec) break;
    parts.unshift(rec.name);
  }
  return parts.join(" / ");
}

export function defaultHiddenIds(graph: ViewerSceneGraph) {
  const layers = new Set(Object.values(graph.layers).filter((layer) => !layer.defaultVisible).map((layer) => layer.id));
  return graph.componentOrder.filter((id) => layerChain(graph, graph.components[id].layerId).some((layer) => layers.has(layer)));
}

function filterValues(
  graph: ViewerSceneGraph,
  comp: ComponentRecord,
  field: FilterField,
  organization?: ResolvedOrganizationView | null
): string[] {
  switch (field) {
    case "layer": return layerChain(graph, comp.layerId);
    case "group": return comp.groupIds;
    case "userLayer": return userLayerChain(organization, organization?.componentLayerId[comp.id] ?? null);
    case "userGroup": return organization?.componentGroupIds[comp.id] ?? [];
    case "category": return [comp.category];
    case "material": return comp.materialId ? [comp.materialId] : comp.materialNames;
    case "geometry": return [comp.cad?.geometryType ?? (comp.isComposite ? "composite" : "mesh")];
    case "block": return comp.blockDefinitionId ? [comp.blockDefinitionId] : [];
    case "instance": return comp.isInstance ? [comp.id] : [];
    default: return [];
  }
}

export function catalogFor(
  graph: ViewerSceneGraph,
  blocks: ReadonlyMap<string, string>,
  field: ModelFacet,
  organization?: ResolvedOrganizationView | null
) {
  const buckets = new Map<string, string[]>();
  for (const id of graph.componentOrder) {
    for (const value of filterValues(graph, graph.components[id], field, organization)) {
      let members = buckets.get(value);
      if (!members) {
        members = [];
        buckets.set(value, members);
      }
      members.push(id);
    }
  }
  return Array.from(buckets, ([value, elementIds]) => ({
    value, elementIds,
    label: field === "layer" ? graph.layers[value].fullPath
      : field === "group" ? graph.groups[value].name
        : field === "userLayer" && organization?.layers[value] ? userLayerPath(organization, value)
          : field === "userGroup" && organization?.groups[value] ? organization.groups[value].name
            : field === "material" ? graph.materials[value]?.name ?? value
              : field === "block" ? blocks.get(value) ?? value
                : field === "instance" ? graph.components[value].name + " · " + value
                  : value,
  })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function hiddenByFilters(
  graph: ViewerSceneGraph,
  filters: Filters,
  selectedIds: readonly string[],
  assembly?: ReadonlyMap<string, AssemblyVisibility>,
  organization?: ResolvedOrganizationView | null
) {
  const entries = (Object.keys(filters) as FilterField[]).flatMap((field) => {
    const options = filters[field];
    return options?.length ? [[field, new Set(options)] as const] : [];
  });
  if (!entries.length) return [];
  const selected = new Set(selectedIds);
  return graph.componentOrder.filter((id) => entries.some(([field, options]) => {
    if (field === "selection") return !options.has(selected.has(id) ? "selected" : "unselected");
    if (field === "assembly") return !options.has(assembly?.get(id) ?? "context");
    return !filterValues(graph, graph.components[id], field, organization).some((value) => options.has(value));
  }));
}

export function visibleIds(order: readonly string[], hidden: readonly string[], isolated: readonly string[] | null) {
  const hiddenSet = new Set(hidden);
  const isolatedSet = isolated ? new Set(isolated) : null;
  return order.filter((id) => !hiddenSet.has(id) && (!isolatedSet || isolatedSet.has(id)));
}


export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

const searchIndexes = new WeakMap<ViewerSceneGraph, Map<string, string>>();

export function matchesComponent(graph: ViewerSceneGraph, id: string, query: string) {
  let index = searchIndexes.get(graph);
  if (!index) {
    index = new Map();
    searchIndexes.set(graph, index);
  }
  let haystack = index.get(id);
  if (haystack === undefined) {
    const comp = graph.components[id];
    if (!comp) return false;
    haystack = normalizeSearch([
      comp.name, comp.id, comp.sourceObjectId, comp.category,
      comp.layerId ? graph.layers[comp.layerId]?.fullPath : "",
      ...comp.groupIds.map((group) => graph.groups[group]?.name),
      ...comp.materialNames, ...Object.entries(comp.cad?.userText ?? {}).flat(),
      ...Object.entries(comp.cad?.properties ?? {}).map(([key, value]) => key + " " + String(value)),
    ].join(" "));
    index.set(id, haystack);
  }
  return haystack.includes(normalizeSearch(query));
}
