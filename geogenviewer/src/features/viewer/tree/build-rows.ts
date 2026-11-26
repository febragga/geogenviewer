import { catalogFor, matchesComponent, normalizeSearch } from "../../../lib/geogen/domain/visibility.ts";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import type { TreeTab } from "../state/viewer-store";

export interface TreeRowItem {
  key: string;
  kind: "component" | "layer" | "group";
  id: string;
  label: string;
  secondaryLabel: string | null;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  targetComponentIds: string[];
  isComposite?: boolean;
  isInstance?: boolean;
  colorHex?: string | null;
}

function collectLayerElementIds(
  graph: ViewerSceneGraph,
  layerId: string,
  cache: Map<string, string[]>
): string[] {
  const cached = cache.get(layerId);
  if (cached) return cached;
  const layer = graph.layers[layerId];
  if (!layer) return [];
  const ids = new Set<string>(layer.elementIds);
  for (const childId of layer.childLayerIds) {
    for (const elId of collectLayerElementIds(graph, childId, cache)) {
      ids.add(elId);
    }
  }
  const result = Array.from(ids);
  cache.set(layerId, result);
  return result;
}

function collectChildren(graph: ViewerSceneGraph, root: string) {
  const result: string[] = [];
  const pending = [root];
  while (pending.length) {
    const id = pending.pop()!;
    const children = graph.components[id]?.childIds ?? [];
    if (children.length) pending.push(...children);
    else result.push(id);
  }
  return result;
}

export function buildTreeRows(
  graph: ViewerSceneGraph | null,
  tab: TreeTab,
  searchQuery: string,
  expandedIds: readonly string[],
  blockNames: ReadonlyMap<string, string> = new Map(),
): TreeRowItem[] {
  if (!graph) return [];
  const query = normalizeSearch(searchQuery.trim());
  const isSearching = query.length > 0;
  const expandedSet = new Set(expandedIds);
  const rows: TreeRowItem[] = [];

  if (tab === "hierarchy") {
    const visibleCompSet = new Set<string>();
    if (isSearching) {
      for (const comp of Object.values(graph.components)) {
        if (matchesComponent(graph, comp.id, query)) {
          let cursor: string | null = comp.id;
          while (cursor && !visibleCompSet.has(cursor)) {
            visibleCompSet.add(cursor);
            cursor = graph.components[cursor]?.parentId ?? null;
          }
        }
      }
    }

    const visitComponent = (id: string, depth: number, visited: Set<string>) => {
      if (visited.has(id)) return;
      if (isSearching && !visibleCompSet.has(id)) return;
      const comp = graph.components[id];
      if (!comp) return;
      visited.add(id);

      const childIds = isSearching
        ? comp.childIds.filter((cid) => visibleCompSet.has(cid))
        : comp.childIds;
      const hasChildren = childIds.length > 0;
      const isExpanded = isSearching ? true : expandedSet.has(id);

      rows.push({
        key: `comp:${id}`,
        kind: "component",
        id,
        label: comp.name,
        secondaryLabel: comp.id,
        depth,
        hasChildren,
        isExpanded,
        targetComponentIds: graph.mode === "glb-basic" && hasChildren ? collectChildren(graph, id) : [id],
        isComposite: comp.isComposite,
        isInstance: comp.isInstance,
        colorHex: comp.cad?.colorHex ?? null,
      });

      if (hasChildren && isExpanded) {
        for (const childId of childIds) {
          visitComponent(childId, depth + 1, visited);
        }
      }
    };

    const visited = new Set<string>();
    for (const rootId of graph.rootComponentIds) {
      visitComponent(rootId, 0, visited);
    }
    return rows;
  }

  if (tab === "layers") {
    const layerElementsCache = new Map<string, string[]>();
    const visibleLayerSet = new Set<string>();
    const matchingCompSet = new Set<string>();

    if (isSearching) {
      for (const layer of Object.values(graph.layers)) {
        const layerMatch = normalizeSearch(`${layer.name} ${layer.fullPath} ${layer.id}`).includes(query);
        const matchingEls = layer.elementIds.filter((elId) => {
          const comp = graph.components[elId];
          if (!comp) return false;
          return matchesComponent(graph, elId, query);
        });
        for (const elId of matchingEls) matchingCompSet.add(elId);
        if (layerMatch || matchingEls.length > 0) {
          let cursor: string | null = layer.id;
          while (cursor && !visibleLayerSet.has(cursor)) {
            visibleLayerSet.add(cursor);
            cursor = graph.layers[cursor]?.parentId ?? null;
          }
        }
      }
    }

    const visitLayer = (layerId: string, depth: number, visited: Set<string>) => {
      if (visited.has(layerId)) return;
      if (isSearching && !visibleLayerSet.has(layerId)) return;
      const layer = graph.layers[layerId];
      if (!layer) return;
      visited.add(layerId);

      const childLayers = isSearching
        ? layer.childLayerIds.filter((cid) => visibleLayerSet.has(cid))
        : layer.childLayerIds;
      const directElements = isSearching
        ? layer.elementIds.filter((elId) => {
            if (matchingCompSet.has(elId)) return true;
            return normalizeSearch(`${layer.name} ${layer.fullPath}`).includes(query);
          })
        : layer.elementIds;

      const hasChildren = childLayers.length > 0 || directElements.length > 0;
      const isExpanded = isSearching ? true : expandedSet.has(layerId);
      const allLayerEls = collectLayerElementIds(graph, layerId, layerElementsCache);

      rows.push({
        key: `layer:${layerId}`,
        kind: "layer",
        id: layerId,
        label: layer.name,
        secondaryLabel: `${allLayerEls.length}`,
        depth,
        hasChildren,
        isExpanded,
        targetComponentIds: allLayerEls,
        colorHex: layer.colorHex,
      });

      if (hasChildren && isExpanded) {
        for (const childLayerId of childLayers) {
          visitLayer(childLayerId, depth + 1, visited);
        }
        for (const elId of directElements) {
          const comp = graph.components[elId];
          if (!comp) continue;
          rows.push({
            key: `layer:${layerId}:comp:${elId}`,
            kind: "component",
            id: elId,
            label: comp.name,
            secondaryLabel: comp.id,
            depth: depth + 1,
            hasChildren: false,
            isExpanded: false,
            targetComponentIds: [elId],
            isComposite: comp.isComposite,
            isInstance: comp.isInstance,
            colorHex: comp.cad?.colorHex ?? null,
          });
        }
      }
    };

    const visitedLayers = new Set<string>();
    for (const rootLayerId of graph.rootLayerIds) {
      visitLayer(rootLayerId, 0, visitedLayers);
    }
    return rows;
  }

  if (tab === "categories" || tab === "materials" || tab === "blocks") {
    const field = tab === "categories" ? "category" : tab === "materials" ? "material" : "block";
    for (const { label, value, elementIds: ids } of catalogFor(graph, blockNames, field)) {
      const key = tab + ":" + value;
      const matches = !isSearching || normalizeSearch(label).includes(query) ? ids : ids.filter((id) => matchesComponent(graph, id, query));
      if (!matches.length) continue;
      const isExpanded = isSearching || expandedSet.has(key);
      rows.push({
        key, kind: "group", id: key, label, secondaryLabel: String(ids.length),
        depth: 0, hasChildren: true, isExpanded, targetComponentIds: ids,
      });
      if (isExpanded) {
        for (const id of matches) {
          const comp = graph.components[id];
          rows.push({
            key: key + ":" + id, kind: "component", id, label: comp.name,
            secondaryLabel: id, depth: 1, hasChildren: false, isExpanded: false, targetComponentIds: [id],
            isComposite: comp.isComposite, isInstance: comp.isInstance, colorHex: comp.cad?.colorHex,
          });
        }
      }
    }
    return rows;
  }

  const scene = graph;
  const groups = scene.groups;
  const cache = new Map<string, Set<string>>();
  function elementsFor(id: string): Set<string> {
    const memo = cache.get(id);
    if (memo) return memo;
    const group = groups[id];
    const all = new Set(group.elementIds);
    cache.set(id, all);
    for (const childId of group.childGroupIds) {
      for (const element of elementsFor(childId)) all.add(element);
    }
    return all;
  }

  function visitGroup(id: string, depth: number, inheritedMatch = false) {
    const group = groups[id];
    if (!group) return;
    const all = Array.from(elementsFor(id));
    const groupMatch = inheritedMatch || normalizeSearch(group.name + " " + group.id).includes(query);
    if (isSearching && !groupMatch && !all.some((element) => matchesComponent(scene, element, query))) return;
    const isExpanded = isSearching || expandedSet.has(id);
    const direct = group.elementIds.filter((element) => !isSearching || groupMatch || matchesComponent(scene, element, query));
    rows.push({
      key: "group:" + id, kind: "group", id, label: group.name, secondaryLabel: String(all.length),
      depth, hasChildren: Boolean(direct.length || group.childGroupIds.length), isExpanded, targetComponentIds: all,
    });
    if (!isExpanded) return;
    for (const childId of group.childGroupIds) visitGroup(childId, depth + 1, groupMatch);
    for (const element of direct) {
      const comp = scene.components[element];
      if (!comp) continue;
      rows.push({
        key: "group:" + id + ":comp:" + element, kind: "component", id: element,
        label: comp.name, secondaryLabel: element, depth: depth + 1, hasChildren: false, isExpanded: false,
        targetComponentIds: [element], isComposite: comp.isComposite, isInstance: comp.isInstance, colorHex: comp.cad?.colorHex,
      });
    }
  }
  for (const id of graph.rootGroupIds) visitGroup(id, 0);

  return rows;
}
