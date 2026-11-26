import { useMemo } from "react";
import type { AssemblyTimeline } from "../../../lib/geogen/assembly/timeline";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import { hiddenByFilters, visibleIds } from "../../../lib/geogen/domain/visibility";
import { useAssembly } from "./assembly-store";
import type { VisibilitySnapshot } from "./local-preferences";
import { useViewerStore, type Workspace } from "./viewer-store";

export function resolveVisibility(
  graph: ViewerSceneGraph,
  scope: VisibilitySnapshot & { selectedIds: readonly string[] },
  workspace: Workspace,
  assembly: { timeline: AssemblyTimeline; stepIndex: number; ghost: boolean; solo: number | null },
) {
  const { timeline, stepIndex, ghost, solo } = assembly;
  const sample = timeline.sample(timeline.schedule[workspace === "assembly" ? stepIndex : 0]?.start ?? timeline.total);
  const denied = new Set([...scope.hiddenIds, ...hiddenByFilters(graph, scope.filters, scope.selectedIds, sample.states)]);
  const ghosts = new Set<string>();
  if (workspace === "assembly") {
    if (solo !== null) {
      const only = new Set(timeline.schedule[solo]?.step.elementIds);
      for (const id of graph.componentOrder) if (!only.has(id)) denied.add(id);
    } else {
      for (const [id, state] of sample.states) {
        if (state === "future") {
          if (ghost) ghosts.add(id);
          else denied.add(id);
        }
      }
    }
  }
  return { denied, ghosts };
}

export function useEffectiveVisibility() {
  const graph = useViewerStore((state) => state.sceneGraph);
  const hiddenIds = useViewerStore((state) => state.hiddenIds);
  const isolatedIds = useViewerStore((state) => state.isolatedIds);
  const filters = useViewerStore((state) => state.filters);
  const selectedIds = useViewerStore((state) => state.selectedIds);
  const workspace = useViewerStore((state) => state.workspace);
  const timeline = useAssembly((state) => state.timeline);
  const stepIndex = useAssembly((state) => state.stepIndex);
  const ghost = useAssembly((state) => state.ghost);
  const solo = useAssembly((state) => state.solo);
  return useMemo(() => {
    if (!graph) return { hidden: hiddenIds, visible: [] as string[] };
    const { denied } = resolveVisibility(graph, { hiddenIds, isolatedIds, filters, selectedIds }, workspace, {
      timeline, stepIndex, ghost, solo,
    });
    const hidden = Array.from(denied);
    return { hidden, visible: visibleIds(graph.componentOrder, hidden, isolatedIds) };
  }, [graph, hiddenIds, isolatedIds, filters, selectedIds, workspace, timeline, stepIndex, ghost, solo]);
}
