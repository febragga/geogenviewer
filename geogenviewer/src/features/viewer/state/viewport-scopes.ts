import { usePresentation } from "./presentation-store";
import { useViewerStore, type ViewerStoreState } from "./viewer-store";
import type { VisibilitySnapshot } from "./local-preferences";

interface Scope extends VisibilitySnapshot {
  selectedIds: string[];
  beforeIsolation: ViewerStoreState["beforeIsolation"];
}

let scopes: Scope[] = [];

function snapshot(state: ViewerStoreState): Scope {
  return {
    selectedIds: state.selectedIds, hiddenIds: state.hiddenIds, isolatedIds: state.isolatedIds,
    filters: state.filters, beforeIsolation: state.beforeIsolation,
  };
}

export function viewportScope(slot: number): Scope {
  const viewer = useViewerStore.getState();
  const view = usePresentation.getState();
  const local = scopes[slot];
  if (!local || slot === view.active) return snapshot(viewer);
  return {
    selectedIds: view.shareSelection ? viewer.selectedIds : local.selectedIds,
    hiddenIds: view.shareVisibility ? viewer.hiddenIds : local.hiddenIds,
    isolatedIds: view.shareVisibility ? viewer.isolatedIds : local.isolatedIds,
    filters: view.shareVisibility ? viewer.filters : local.filters,
    beforeIsolation: view.shareVisibility ? viewer.beforeIsolation : local.beforeIsolation,
  };
}

export function connectViewportScopes() {
  let switching = false;
  const init = (state: ViewerStoreState) => {
    scopes = Array.from({ length: 4 }, () => snapshot(state));
  };
  init(useViewerStore.getState());

  const stopViewer = useViewerStore.subscribe((state, previous) => {
    if (switching) return;
    if (state.sceneGraph !== previous.sceneGraph) {
      init(state);
      return;
    }
    const { active, shareSelection, shareVisibility } = usePresentation.getState();
    if (!shareSelection || !shareVisibility) scopes[active] = snapshot(state);
  });

  const stopPresentation = usePresentation.subscribe((state, previous) => {
    const current = snapshot(useViewerStore.getState());
    if (previous.shareSelection !== state.shareSelection) {
      scopes = scopes.map((scope) => ({ ...scope, selectedIds: current.selectedIds }));
    }
    if (previous.shareVisibility !== state.shareVisibility) {
      scopes = scopes.map((scope) => ({ ...current, selectedIds: scope.selectedIds }));
    }
    if (state.active === previous.active || (state.shareSelection && state.shareVisibility)) return;
    scopes[previous.active] = current;
    const next = scopes[state.active] ?? current;
    switching = true;
    try {
      useViewerStore.setState({
        selectedIds: state.shareSelection ? current.selectedIds : next.selectedIds,
        hiddenIds: state.shareVisibility ? current.hiddenIds : next.hiddenIds,
        isolatedIds: state.shareVisibility ? current.isolatedIds : next.isolatedIds,
        filters: state.shareVisibility ? current.filters : next.filters,
        beforeIsolation: state.shareVisibility ? current.beforeIsolation : next.beforeIsolation,
        hoveredId: null,
      });
    } finally {
      switching = false;
    }
  });

  return () => {
    stopViewer();
    stopPresentation();
    scopes = [];
  };
}
