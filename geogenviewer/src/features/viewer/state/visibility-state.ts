import { useMemo } from "react";
import type { AssemblyTimeline } from "../../../lib/geogen/assembly/timeline";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import { hiddenByFilters, hiddenByGroups, visibleIds } from "../../../lib/geogen/domain/visibility";
import type { ResolvedOrganizationView } from "../../../lib/geogen/organization/model";
import { resolveOrganizationView } from "../../../lib/geogen/organization/operations";
import { useAssembly } from "./assembly-store";
import type { VisibilitySnapshot } from "./local-preferences";
import { useOrganizationStore } from "./organization-store";
import { useViewerStore, type Workspace } from "./viewer-store";

export function resolveVisibility(
  graph: ViewerSceneGraph,
  scope: VisibilitySnapshot & { selectedIds: readonly string[] },
  workspace: Workspace,
  assembly: { timeline: AssemblyTimeline; stepIndex: number; ghost: boolean; solo: number | null },
  organization?: ResolvedOrganizationView | null
) {
  const { timeline, stepIndex, ghost, solo } = assembly;
  const sample = timeline.sample(timeline.schedule[workspace === "assembly" ? stepIndex : 0]?.start ?? timeline.total);
  const denied = new Set([
    ...scope.hiddenIds,
    ...hiddenByGroups(graph, scope.hiddenGroupKeys ?? [], organization),
    ...hiddenByFilters(graph, scope.filters, scope.selectedIds, sample.states, organization),
    ...(organization?.source === "user" ? organization.hiddenByUserLayers : []),
  ]);
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
  const hiddenGroupKeys = useViewerStore((state) => state.hiddenGroupKeys);
  const isolatedIds = useViewerStore((state) => state.isolatedIds);
  const filters = useViewerStore((state) => state.filters);
  const selectedIds = useViewerStore((state) => state.selectedIds);
  const workspace = useViewerStore((state) => state.workspace);
  const timeline = useAssembly((state) => state.timeline);
  const stepIndex = useAssembly((state) => state.stepIndex);
  const ghost = useAssembly((state) => state.ghost);
  const solo = useAssembly((state) => state.solo);
  const orgDoc = useOrganizationStore((state) => state.doc);

  const userOrg = useMemo(() => {
    if (!graph) return null;
    // Resolve using user structures so userLayer/userGroup filters always work; hiddenByUserLayers only applies when source === "user"
    const resolved = resolveOrganizationView(graph, { ...orgDoc, activeSource: "user" });
    return { ...resolved, source: orgDoc.activeSource };
  }, [graph, orgDoc]);

  return useMemo(() => {
    if (!graph) return { hidden: hiddenIds, visible: [] as string[] };
    const { denied } = resolveVisibility(graph, { hiddenIds, hiddenGroupKeys, isolatedIds, filters, selectedIds }, workspace, {
      timeline, stepIndex, ghost, solo,
    }, userOrg);
    const hidden = Array.from(denied);
    return { hidden, visible: visibleIds(graph.componentOrder, hidden, isolatedIds) };
  }, [graph, hiddenIds, hiddenGroupKeys, isolatedIds, filters, selectedIds, workspace, timeline, stepIndex, ghost, solo, userOrg]);
}
