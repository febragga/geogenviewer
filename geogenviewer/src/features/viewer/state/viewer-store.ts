import { create } from "zustand";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model.ts";
import {
  defaultExplodeParams,
  type ExplodeParams,
} from "../../../lib/geogen/explode/controller.ts";

export type TreeTab = "hierarchy" | "layers" | "groups";

export interface ExplodeTransitionRequest {
  toFactor: number;
  seq: number;
}

export interface ViewerStoreState {
  sceneGraph: ViewerSceneGraph | null;
  selectedIds: string[];
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedIds: string[] | null;
  expandedIds: string[];
  treeTab: TreeTab;
  searchQuery: string;
  multiSelectMode: boolean;

  explodeOpen: boolean;
  explode: ExplodeParams;
  explodeTransition: ExplodeTransitionRequest | null;
  explodedBoundsMeters: [number, number, number] | null;

  setSceneGraph: (graph: ViewerSceneGraph | null) => void;
  select: (id: string, mode?: "replace" | "toggle" | "add") => void;
  selectMany: (ids: string[], mode?: "replace" | "add") => void;
  clearSelection: () => void;
  setHoveredId: (id: string | null) => void;
  hideIds: (ids: string[]) => void;
  showIds: (ids: string[]) => void;
  toggleComponentVisibility: (id: string) => void;
  toggleCollectionVisibility: (elementIds: string[]) => void;
  isolateIds: (ids: string[]) => void;
  showAll: () => void;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setTreeTab: (tab: TreeTab) => void;
  setSearchQuery: (query: string) => void;
  setMultiSelectMode: (enabled: boolean) => void;

  setExplodeOpen: (open: boolean) => void;
  setExplodeFactor: (factor: number) => void;
  patchExplode: (patch: Partial<ExplodeParams>) => void;
  startExplodeAnimation: (toFactor: number) => void;
  stopExplodeAnimation: (settledFactor?: number) => void;
  resetExplode: () => void;
  setExplodedBoundsMeters: (bounds: [number, number, number] | null) => void;
}

function uniqueStrings(list: readonly string[]): string[] {
  return Array.from(new Set(list));
}

function collectComponentSubtreeIds(
  graph: ViewerSceneGraph | null,
  rootId: string
): string[] {
  if (!graph || !graph.components[rootId]) return [rootId];
  const result: string[] = [];
  const stack = [rootId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    const comp = graph.components[id];
    if (comp) {
      for (const childId of comp.childIds) stack.push(childId);
    }
  }
  return result;
}

export const useViewerStore = create<ViewerStoreState>((set, get) => ({
  sceneGraph: null,
  selectedIds: [],
  hoveredId: null,
  hiddenIds: [],
  isolatedIds: null,
  expandedIds: [],
  treeTab: "hierarchy",
  searchQuery: "",
  multiSelectMode: false,

  explodeOpen: false,
  explode: { ...defaultExplodeParams },
  explodeTransition: null,
  explodedBoundsMeters: null,

  setSceneGraph(graph) {
    if (!graph) {
      set({
        sceneGraph: null,
        selectedIds: [],
        hoveredId: null,
        hiddenIds: [],
        isolatedIds: null,
        expandedIds: [],
        searchQuery: "",
        explodeOpen: false,
        explode: { ...defaultExplodeParams },
        explodeTransition: null,
        explodedBoundsMeters: null,
      });
      return;
    }

    // Respect layer default visibility if defined in manifest
    const initialHidden: string[] = [];
    for (const layer of Object.values(graph.layers)) {
      if (layer.defaultVisible === false) {
        initialHidden.push(...layer.elementIds);
      }
    }

    // Expand top-level groups/layers automatically for immediate discoverability
    const defaultExpanded = uniqueStrings([
      ...graph.rootLayerIds,
      ...graph.rootGroupIds,
      ...(graph.rootComponentIds.length <= 24 ? graph.rootComponentIds : []),
    ]);

    set({
      sceneGraph: graph,
      selectedIds: [],
      hoveredId: null,
      hiddenIds: uniqueStrings(initialHidden),
      isolatedIds: null,
      expandedIds: defaultExpanded,
      treeTab: "hierarchy",
      searchQuery: "",
      explodeOpen: false,
      explode: {
        ...defaultExplodeParams,
        scopeLayerId: graph.rootLayerIds[0] ?? null,
        scopeGroupId: graph.rootGroupIds[0] ?? null,
      },
      explodeTransition: null,
      explodedBoundsMeters: null,
    });
  },

  select(id, mode = "replace") {
    const { selectedIds, sceneGraph } = get();
    if (sceneGraph && !sceneGraph.components[id]) return;

    if (mode === "toggle") {
      const exists = selectedIds.includes(id);
      set({
        selectedIds: exists
          ? selectedIds.filter((item) => item !== id)
          : [...selectedIds, id],
      });
      return;
    }
    if (mode === "add") {
      if (selectedIds.includes(id)) return;
      set({ selectedIds: [...selectedIds, id] });
      return;
    }
    set({ selectedIds: [id] });
  },

  selectMany(ids, mode = "replace") {
    const { selectedIds, sceneGraph } = get();
    const valid = ids.filter((id) => !sceneGraph || Boolean(sceneGraph.components[id]));
    if (mode === "add") {
      set({ selectedIds: uniqueStrings([...selectedIds, ...valid]) });
      return;
    }
    set({ selectedIds: uniqueStrings(valid) });
  },

  clearSelection() {
    if (get().selectedIds.length === 0) return;
    set({ selectedIds: [] });
  },

  setHoveredId(id) {
    if (get().hoveredId === id) return;
    set({ hoveredId: id });
  },

  hideIds(ids) {
    const { hiddenIds, sceneGraph } = get();
    const expanded = new Set(hiddenIds);
    for (const id of ids) {
      for (const subId of collectComponentSubtreeIds(sceneGraph, id)) {
        expanded.add(subId);
      }
    }
    set({ hiddenIds: Array.from(expanded) });
  },

  showIds(ids) {
    const { hiddenIds, isolatedIds, sceneGraph } = get();
    const toShow = new Set<string>();
    for (const id of ids) {
      for (const subId of collectComponentSubtreeIds(sceneGraph, id)) {
        toShow.add(subId);
      }
    }
    const nextHidden = hiddenIds.filter((id) => !toShow.has(id));
    const nextIsolated = isolatedIds
      ? uniqueStrings([...isolatedIds, ...toShow])
      : null;
    set({ hiddenIds: nextHidden, isolatedIds: nextIsolated });
  },

  toggleComponentVisibility(id) {
    const { hiddenIds, isolatedIds, sceneGraph } = get();
    const subtree = collectComponentSubtreeIds(sceneGraph, id);
    const hiddenSet = new Set(hiddenIds);
    const isolatedSet = isolatedIds ? new Set(isolatedIds) : null;
    const currentlyVisible = subtree.some((subId) =>
      isolatedSet ? isolatedSet.has(subId) && !hiddenSet.has(subId) : !hiddenSet.has(subId)
    );
    if (currentlyVisible) {
      get().hideIds(subtree);
    } else {
      get().showIds(subtree);
    }
  },

  toggleCollectionVisibility(elementIds) {
    if (elementIds.length === 0) return;
    const { hiddenIds, isolatedIds } = get();
    const hiddenSet = new Set(hiddenIds);
    const isolatedSet = isolatedIds ? new Set(isolatedIds) : null;
    const anyVisible = elementIds.some((id) =>
      isolatedSet ? isolatedSet.has(id) && !hiddenSet.has(id) : !hiddenSet.has(id)
    );
    if (anyVisible) {
      get().hideIds(elementIds);
    } else {
      get().showIds(elementIds);
    }
  },

  isolateIds(ids) {
    const { sceneGraph, hiddenIds } = get();
    if (ids.length === 0) return;
    const targetSet = new Set<string>();
    for (const id of ids) {
      for (const subId of collectComponentSubtreeIds(sceneGraph, id)) {
        targetSet.add(subId);
      }
    }
    set({
      isolatedIds: Array.from(targetSet),
      hiddenIds: hiddenIds.filter((id) => !targetSet.has(id)),
    });
  },

  showAll() {
    set({ hiddenIds: [], isolatedIds: null });
  },

  toggleExpanded(id) {
    const { expandedIds } = get();
    const exists = expandedIds.includes(id);
    set({
      expandedIds: exists
        ? expandedIds.filter((item) => item !== id)
        : [...expandedIds, id],
    });
  },

  expandAll() {
    const { sceneGraph } = get();
    if (!sceneGraph) return;
    set({
      expandedIds: uniqueStrings([
        ...sceneGraph.componentOrder,
        ...Object.keys(sceneGraph.layers),
        ...Object.keys(sceneGraph.groups),
      ]),
    });
  },

  collapseAll() {
    set({ expandedIds: [] });
  },

  setTreeTab(treeTab) {
    set({ treeTab });
  },

  setSearchQuery(searchQuery) {
    set({ searchQuery });
  },

  setMultiSelectMode(multiSelectMode) {
    set({ multiSelectMode });
  },

  setExplodeOpen(explodeOpen) {
    set((state) => ({
      explodeOpen,
      explode: explodeOpen && !state.explode.enabled
        ? { ...state.explode, enabled: true }
        : state.explode,
    }));
  },

  setExplodeFactor(factor) {
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(factor) ? factor : 0));
    set((state) => ({
      explodeTransition: null,
      explode: {
        ...state.explode,
        enabled: clamped > 0 ? true : state.explode.enabled,
        factor: clamped,
      },
      explodedBoundsMeters: clamped <= 1e-6 ? null : state.explodedBoundsMeters,
    }));
  },

  patchExplode(patch) {
    set((state) => ({
      explodeTransition: null,
      explode: {
        ...state.explode,
        ...patch,
      },
    }));
  },

  startExplodeAnimation(toFactor) {
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(toFactor) ? toFactor : 0));
    set((state) => ({
      explode: {
        ...state.explode,
        enabled: true,
      },
      explodeTransition: {
        toFactor: clamped,
        seq: (state.explodeTransition?.seq ?? 0) + 1,
      },
    }));
  },

  stopExplodeAnimation(settledFactor) {
    set((state) => {
      if (settledFactor === undefined) {
        return { explodeTransition: null };
      }
      const clamped = Math.max(0, Math.min(1.5, settledFactor));
      return {
        explodeTransition: null,
        explode: {
          ...state.explode,
          factor: clamped,
          enabled: clamped > 1e-6 ? true : state.explode.enabled,
        },
        explodedBoundsMeters: clamped <= 1e-6 ? null : state.explodedBoundsMeters,
      };
    });
  },

  resetExplode() {
    set((state) => ({
      explodeTransition: null,
      explodedBoundsMeters: null,
      explode: {
        ...state.explode,
        enabled: false,
        factor: 0,
      },
    }));
  },

  setExplodedBoundsMeters(explodedBoundsMeters) {
    set({ explodedBoundsMeters });
  },
}));
