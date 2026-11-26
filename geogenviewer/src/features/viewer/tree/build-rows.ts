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

export function buildTreeRows(
  graph: ViewerSceneGraph | null,
  tab: TreeTab,
  searchQuery: string,
  expandedIds: readonly string[]
): TreeRowItem[] {
  if (!graph) return [];
  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;
  const expandedSet = new Set(expandedIds);
  const rows: TreeRowItem[] = [];

  if (tab === "hierarchy") {
    const visibleCompSet = new Set<string>();
    if (isSearching) {
      for (const comp of Object.values(graph.components)) {
        const hay = `${comp.name} ${comp.id} ${comp.sourceObjectId ?? ""} ${comp.category ?? ""}`.toLowerCase();
        if (hay.includes(query)) {
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
        targetComponentIds: [id],
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
        const layerMatch = `${layer.name} ${layer.fullPath} ${layer.id}`.toLowerCase().includes(query);
        const matchingEls = layer.elementIds.filter((elId) => {
          const comp = graph.components[elId];
          if (!comp) return false;
          return `${comp.name} ${comp.id} ${comp.sourceObjectId ?? ""}`.toLowerCase().includes(query);
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
            return `${layer.name} ${layer.fullPath}`.toLowerCase().includes(query);
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

  // tab === "groups"
  const visitedGroups = new Set<string>();
  for (const groupId of graph.rootGroupIds) {
    if (visitedGroups.has(groupId)) continue;
    visitedGroups.add(groupId);
    const group = graph.groups[groupId];
    if (!group) continue;

    const matchingEls = isSearching
      ? group.elementIds.filter((elId) => {
          const comp = graph.components[elId];
          if (!comp) return false;
          return `${comp.name} ${comp.id} ${group.name}`.toLowerCase().includes(query);
        })
      : group.elementIds;

    const groupNameMatches = `${group.name} ${group.id}`.toLowerCase().includes(query);
    if (isSearching && !groupNameMatches && matchingEls.length === 0) continue;

    const hasChildren = matchingEls.length > 0;
    const isExpanded = isSearching ? true : expandedSet.has(groupId);

    rows.push({
      key: `group:${groupId}`,
      kind: "group",
      id: groupId,
      label: group.name,
      secondaryLabel: `${group.elementIds.length}`,
      depth: 0,
      hasChildren,
      isExpanded,
      targetComponentIds: group.elementIds,
    });

    if (hasChildren && isExpanded) {
      const childrenToRender = groupNameMatches ? group.elementIds : matchingEls;
      for (const elId of childrenToRender) {
        const comp = graph.components[elId];
        if (!comp) continue;
        rows.push({
          key: `group:${groupId}:comp:${elId}`,
          kind: "component",
          id: elId,
          label: comp.name,
          secondaryLabel: comp.id,
          depth: 1,
          hasChildren: false,
          isExpanded: false,
          targetComponentIds: [elId],
          isComposite: comp.isComposite,
          isInstance: comp.isInstance,
          colorHex: comp.cad?.colorHex ?? null,
        });
      }
    }
  }

  return rows;
}
