import { useCallback, useMemo, useState } from "react";
import { compileAssembly } from "../../../lib/geogen/assembly/timeline";
import { annotationModel } from "../../../lib/geogen/documentation/callouts";
import { catalogEntries, catalogTypes, occurrenceItems, projectSearch, scopeCatalog, type ScopeContext } from "../../../lib/geogen/documentation/catalog";
import { defaultDocumentation, type DocumentationSettings } from "../../../lib/geogen/documentation/document";
import { layoutKnolling } from "../../../lib/geogen/documentation/knolling";
import { normalizeSearch, defaultHiddenIds, hiddenByFilters, visibleIds } from "../../../lib/geogen/domain/visibility";
import { authored, type Revision } from "../../../lib/geogen/revisions/revision";
import type { FabricationSettings } from "../../../lib/geogen/revisions/fabrication";
import type { DiffStatus } from "../../../lib/geogen/revisions/diff";
import { resolveOrganizationView } from "../../../lib/geogen/organization/operations";
import type { RevisionComparison } from "./revision-workspace";
import type { Filters } from "../../../lib/geogen/domain/visibility";
import { preferenceKey, readLocalList, writeLocalList } from "./local-preferences";
import { identityText } from "../../../lib/geogen/domain/component-identity";
import { useAssembly } from "./assembly-store";
import { useOrganizationStore } from "./organization-store";

const noRevisions: string[] = [];
const noEntries: ReturnType<typeof catalogEntries> = [];
const noAnnotations: ReturnType<typeof annotationModel> = [];
const emptyScope = new Set<string>();

export function catalogTimeline(revision: Revision | null) {
  try { return compileAssembly(revision?.scene.manifest?.assembly?.steps ?? []); }
  catch { return compileAssembly([]); }
}

function comparisonStatuses(revision: Revision | null, base: Revision | null, diffs: RevisionComparison["diffs"]) {
  const map = new Map<string, DiffStatus>();
  const isBase = revision?.key === base?.key;
  for (const diff of diffs) {
    const id = isBase ? diff.baseId : diff.comparisonId;
    if (id) map.set(id, diff.status);
  }
  return map;
}

export function useDocumentationWorkspace(primary: Revision | null, peer: Revision | null, base: Revision | null,
  comparison: RevisionComparison, workflow: "knolling" | "catalog" | null, primarySelected: string[],
  primaryVisibility: string[], filters: Filters, fabricationConfigs: Record<string, { settings: FabricationSettings }>,
  peerSelection: { key: string; ids: string[] } | null, setPeerSelection: React.Dispatch<React.SetStateAction<{ key: string; ids: string[] } | null>>) {
  const [settingsByKey, setSettings] = useState<Record<string, DocumentationSettings>>({});
  const [revisionSide, setRevisionSide] = useState<"primary" | "peer">("primary");
  const revision = workflow === "catalog" && revisionSide === "peer" && peer ? peer : primary;
  const isPrimary = revision?.key === primary?.key;
  const stepKey = revision ? preferenceKey("knolling-steps", revision.scene.manifest, revision.scene.sceneGraph.fileName,
    revision.scene.sceneGraph.fileSizeBytes, revision.scene.binarySha256) : null;
  const defaults = useMemo(() => {
    if (!revision) return null;
    const initial = defaultDocumentation(revision);
    initial.layout.stepTitles = Object.fromEntries(readLocalList<{ id: string; name: string }>(stepKey)
      .filter(({ name }) => identityText(name) && name.length <= 160).map(({ id, name }) => [id, name]));
    return initial;
  }, [revision, stepKey]);
  const settings = revision ? settingsByKey[revision.key] ?? defaults : null;
  const change = useCallback((update: (prior: DocumentationSettings) => DocumentationSettings) => {
    if (!revision || !defaults) return;
    setSettings((old) => {
      const kept = Object.fromEntries(Object.entries(old).filter(([key]) => key === primary?.key || key === peer?.key));
      return { ...kept, [revision.key]: update(old[revision.key] ?? defaults) };
    });
  }, [revision, defaults, primary?.key, peer?.key]);

  const renameStep = useCallback((key: string, value: string) => {
    if (!settings) return;
    const titles = { ...settings.layout.stepTitles };
    const title = identityText(value);
    if (title) titles[key] = title.slice(0, 160);
    else delete titles[key];
    change((old) => ({ ...old, layout: { ...old.layout, stepTitles: titles } }));
    writeLocalList(stepKey, Object.entries(titles).map(([id, name]) => ({ id, name })));
  }, [settings, change, stepKey]);

  const authoredTimeline = useAssembly((state) => state.timeline);
  const timeline = useMemo(() => isPrimary ? authoredTimeline : catalogTimeline(revision), [revision, isPrimary, authoredTimeline]);
  const visibleSelected = isPrimary ? primarySelected : peerSelection?.key === revision?.key ? peerSelection?.ids ?? noRevisions : noRevisions;
  const peerSelect = useCallback((ids: string[], multi = false) => {
    if (!revision) return;
    setPeerSelection((old) => {
      const prior = old?.key === revision.key ? old.ids : noRevisions;
      const next = multi && ids.length === 1 && prior.includes(ids[0]) ? prior.filter((id) => id !== ids[0]) :
        multi ? [...new Set([...prior, ...ids])] : ids;
      return { key: revision.key, ids: next };
    });
  }, [revision, setPeerSelection]);

  const active = Boolean(workflow || (settings?.labels && settings.callouts.length));
  const diffs = comparison.diffs;
  const statuses = useMemo(() => active ? comparisonStatuses(revision, base, diffs) : new Map<string, DiffStatus>(),
    [revision, base, active, diffs]);
  const orgDoc = useOrganizationStore((state) => state.doc);
  const userOrg = useMemo(
    () => (revision && isPrimary ? resolveOrganizationView(revision.scene.sceneGraph, { ...orgDoc, activeSource: "user" }) : null),
    [revision, isPrimary, orgDoc]
  );
  const fabrication = revision ? fabricationConfigs[revision.key]?.settings : undefined;
  const stepTitles = settings?.layout.stepTitles;
  const entries = useMemo(() => active && revision ? catalogEntries(revision, timeline, statuses, fabrication, undefined, userOrg, stepTitles, workflow === "knolling") : noEntries,
    [active, revision, timeline, statuses, fabrication, userOrg, stepTitles, workflow]);
  const rows = useMemo(() => new Map(entries.map((entry) => [entry.occurrence.id, entry])), [entries]);

  const scopes = useMemo((): ScopeContext => {
    const graph = revision?.scene.sceneGraph;
    if (!graph || !workflow) return { selected: new Set(visibleSelected), visible: new Set(primaryVisibility), filtered: emptyScope };
    const blocked = new Set(hiddenByFilters(graph, filters, visibleSelected, timeline.sample(0).states, userOrg));
    const visible = isPrimary ? primaryVisibility : visibleIds(graph.componentOrder, [...defaultHiddenIds(graph), ...blocked], null);
    return { selected: new Set(visibleSelected), visible: new Set(visible), filtered: new Set(graph.componentOrder.filter((id) => !blocked.has(id))) };
  }, [revision, workflow, primaryVisibility, filters, visibleSelected, isPrimary, timeline, userOrg]);

  const catalog = settings?.catalog;
  const scope = settings?.scope;
  const scopeValue = settings?.scopeValue;
  const currentScope = workflow === "knolling" ? scope : catalog?.scope;
  const activeIds = currentScope === "selected" || currentScope === "visible" || currentScope === "filtered" ? scopes[currentScope] : emptyScope;
  const scoped = useMemo(() => {
    const activeScopes = { selected: activeIds, visible: activeIds, filtered: activeIds };
    if (!catalog || !workflow || scope === undefined || scopeValue === undefined) return noEntries;
    if (workflow === "knolling") return scopeCatalog(entries, scope, scopeValue, activeScopes);
    const query = normalizeSearch(catalog.query);
    return scopeCatalog(entries, catalog.scope, catalog.scopeValue, activeScopes).filter((row) => {
      if (catalog.filterStatus !== "all" && row.status !== catalog.filterStatus) return false;
      if (catalog.prototype && row.prototype !== catalog.prototype) return false;
      if (catalog.property) {
        const value = authored(row.occurrence.record, catalog.property);
        if (value === null || (catalog.propertyValue && normalizeSearch(String(value)) !== normalizeSearch(catalog.propertyValue))) return false;
      }
      return projectSearch(row, query);
    });
  }, [entries, catalog, scope, scopeValue, workflow, activeIds]);

  const renderedAsType = settings && (workflow === "knolling" ? settings.layout.mode === "types" : settings.catalog.view === "types");
  const types = settings?.types;
  const items = useMemo(() => renderedAsType && types ? catalogTypes(scoped, types) : occurrenceItems(scoped), [scoped, renderedAsType, types]);
  const layoutConfig = settings?.layout;
  const layout = useMemo(() => {
    if (!layoutConfig || workflow !== "knolling") return { value: null, error: "" };
    try { return { value: layoutKnolling(items, layoutConfig), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [items, layoutConfig, workflow]);
  const placements = layout.value?.placements;
  const byPlacement = useMemo(() => new Map(placements?.map((item) => [item.item.representative.occurrence.id, item]) ?? []), [placements]);
  const layoutMask = useMemo(() => new Set(byPlacement.keys()), [byPlacement]);
  const mask = useMemo(() => placements ? new Set(placements.flatMap((item) => {
    const id = item.item.representative.occurrence.id;
    return scopes.visible.has(id) ? [id] : [];
  })) : scopes.visible, [placements, scopes.visible]);
  const annotations = useMemo(() => {
    if (!settings?.labels || !isPrimary) return noAnnotations;
    const automatic = placements?.map((item) => item.item.representative) ?? noEntries;
    const qty = settings.quantities ? new Map(placements?.map((row) => [row.item.representative.occurrence.id, row.item.quantity])) : undefined;
    return annotationModel(rows, settings.callouts, automatic, scopes.selected, qty);
  }, [settings, isPrimary, placements, rows, scopes.selected]);
  const scene = useMemo(() => layout.value && layoutConfig ? { result: layout.value, mask: layoutMask, plane: layoutConfig.plane } : undefined,
    [layout.value, layoutConfig, layoutMask]);
  const showGroups = settings?.groups ?? false;
  const showQuantities = settings?.quantities ?? false;
  const groups = useMemo(() => scene && showGroups ? { result: scene.result, plane: scene.plane, quantities: showQuantities } : undefined,
    [scene, showGroups, showQuantities]);

  return {
    revision, isPrimary, revisionSide: isPrimary ? "primary" as const : "peer" as const, setRevisionSide, peerSelect,
    timeline, settings, change, renameStep, entries, rows, scoped, items, layout, byPlacement, scene, scopes, groups,
    annotations, mask, selected: visibleSelected,
  };
}
export type DocumentationWorkspace = ReturnType<typeof useDocumentationWorkspace>;
