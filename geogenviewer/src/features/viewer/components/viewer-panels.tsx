"use client";

import { componentIdentity, componentLabel } from "../../../lib/geogen/domain/component-identity.ts";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import {
  computeVisibilityState,
  type ComponentRecord,
  type ViewerSceneGraph,
} from "../../../lib/geogen/domain/model";
import { compareRestBounds } from "../../../lib/geogen/inspection/measurements";
import { USER_ORGANIZATION_PALETTE } from "../../../lib/geogen/organization/model";
import { resolveOrganizationView } from "../../../lib/geogen/organization/operations";
import { copy } from "../copy";
import { useViewerStore, type TreeTab } from "../state/viewer-store";
import { useAssembly } from "../state/assembly-store";
import { useOrganizationStore } from "../state/organization-store";
import { useEffectiveVisibility } from "../state/visibility-state";
import { buildTreeRows, type TreeRowItem } from "../tree/build-rows";
import type { ContextMenuState } from "./context-menu";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClearSelectionIcon,
  CloseIcon,
  CompositeIcon,
  CopyIcon,
  CubeIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  FitViewIcon,
  FolderPlusIcon,
  GroupIcon,
  HierarchyIcon,
  IsolateIcon,
  LayersIcon,
  MoreVerticalIcon,
  PartialEyeIcon,
  PlusIcon,
  RedoIcon,
  SearchIcon,
  SlidersIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
  VerifiedIcon,
} from "./icons";

const rowHeightPx = 32;
const virtualThreshold = 100;
const virtualOverscan = 8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MB`;
}

function formatMillimeters(meters: number): string {
  const mm = meters * 1000;
  return `${mm.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} mm`;
}

function formatNumber(value: number, maxDigits = 3): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: maxDigits,
  });
}

function formatVectorMeters(vec: [number, number, number]): string {
  return `${formatNumber(vec[0], 3)} × ${formatNumber(vec[1], 3)} × ${formatNumber(vec[2], 3)} m`;
}

function formatBoundsMm(bounds: [number, number, number]): string {
  return `${formatMillimeters(bounds[0])} × ${formatMillimeters(bounds[1])} × ${formatMillimeters(bounds[2])}`;
}

export function StructureContent({
  onFrameIds,
  onOpenContextMenu,
}: {
  onFrameIds: (ids: string[]) => void;
  onOpenContextMenu?: (state: ContextMenuState) => void;
}) {
  const searchInputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const importOrgRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);

  const [newItemKind, setNewItemKind] = useState<"layer" | "group" | null>(null);
  const [newItemParentId, setNewItemParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemColor, setNewItemColor] = useState<string>(USER_ORGANIZATION_PALETTE[0]);
  const [renamingTarget, setRenamingTarget] = useState<{ kind: "layer" | "group"; id: string; name: string } | null>(null);
  const [deletingLayer, setDeletingLayer] = useState<{ id: string; name: string; parentId: string | null; count: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);

  const sceneGraph = useViewerStore((s) => s.sceneGraph);
  const selectedIds = useViewerStore((s) => s.selectedIds);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const { hidden: hiddenIds } = useEffectiveVisibility();
  const manifest = useAssembly((state) => state.source);
  const isolatedIds = useViewerStore((s) => s.isolatedIds);
  const expandedIds = useViewerStore((s) => s.expandedIds);
  const treeTab = useViewerStore((s) => s.treeTab);
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const multiSelectMode = useViewerStore((s) => s.multiSelectMode);

  const orgDoc = useOrganizationStore((s) => s.doc);
  const orgPast = useOrganizationStore((s) => s.past);
  const orgFuture = useOrganizationStore((s) => s.future);
  const lastImportNotice = useOrganizationStore((s) => s.lastImportNotice);
  const persistenceNotice = useOrganizationStore((s) => s.persistenceNotice);
  const setOrgSource = useOrganizationStore((s) => s.setActiveSource);
  const copyFromImported = useOrganizationStore((s) => s.copyFromImported);
  const createLayer = useOrganizationStore((s) => s.createLayer);
  const renameLayer = useOrganizationStore((s) => s.renameLayer);
  const recolorLayer = useOrganizationStore((s) => s.recolorLayer);
  const toggleUserLayerVis = useOrganizationStore((s) => s.toggleLayerVisibility);
  const moveLayer = useOrganizationStore((s) => s.moveLayer);
  const reorderLayer = useOrganizationStore((s) => s.reorderLayer);
  const deleteLayer = useOrganizationStore((s) => s.deleteLayer);
  const assignOccurrencesToLayer = useOrganizationStore((s) => s.assignOccurrencesToLayer);
  const createGroup = useOrganizationStore((s) => s.createGroup);
  const renameGroup = useOrganizationStore((s) => s.renameGroup);
  const recolorGroup = useOrganizationStore((s) => s.recolorGroup);
  const deleteGroup = useOrganizationStore((s) => s.deleteGroup);
  const addOccurrencesToGroup = useOrganizationStore((s) => s.addOccurrencesToGroup);
  const undoOrg = useOrganizationStore((s) => s.undo);
  const redoOrg = useOrganizationStore((s) => s.redo);
  const exportOrgJson = useOrganizationStore((s) => s.exportJson);
  const importOrgJson = useOrganizationStore((s) => s.importJson);
  const clearImportNotice = useOrganizationStore((s) => s.clearImportNotice);

  const resolvedOrg = useMemo(
    () => (sceneGraph ? resolveOrganizationView(sceneGraph, orgDoc) : null),
    [orgDoc, sceneGraph]
  );

  useEffect(() => {
    const dlg = deleteDialogRef.current;
    if (!dlg) return;
    if (deletingLayer && !dlg.open) dlg.showModal();
    else if (!deletingLayer && dlg.open) dlg.close();
  }, [deletingLayer]);

  const setTreeTab = useViewerStore((s) => s.setTreeTab);
  const setSearchQuery = useViewerStore((s) => s.setSearchQuery);
  const select = useViewerStore((s) => s.select);
  const selectMany = useViewerStore((s) => s.selectMany);
  const setHoveredId = useViewerStore((s) => s.setHoveredId);
  const toggleExpanded = useViewerStore((s) => s.toggleExpanded);
  const expandAll = useViewerStore((s) => s.expandAll);
  const collapseAll = useViewerStore((s) => s.collapseAll);
  const toggleComponentVisibility = useViewerStore((s) => s.toggleComponentVisibility);
  const toggleCollectionVisibility = useViewerStore((s) => s.toggleCollectionVisibility);
  const showAll = useViewerStore((s) => s.showAll);
  const hiddenGroupKeys = useViewerStore((s) => s.hiddenGroupKeys);
  const toggleGroupVisibility = useViewerStore((s) => s.toggleGroupVisibility);

  const rows = useMemo(
    () =>
      buildTreeRows(
        sceneGraph,
        treeTab,
        searchQuery,
        expandedIds,
        new Map(manifest?.blocks?.map((block) => [block.id, block.name])),
        resolvedOrg
      ),
    [expandedIds, manifest, resolvedOrg, sceneGraph, searchQuery, treeTab]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const isolatedSet = useMemo(
    () => (isolatedIds ? new Set(isolatedIds) : null),
    [isolatedIds]
  );

  // Measure container height for windowed rendering on large scenes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sceneGraph]);

  // Expand ancestors and scroll when a single component is picked in the 3D scene
  useEffect(() => {
    if (!sceneGraph || selectedIds.length !== 1 || treeTab !== "hierarchy") return;
    const selectedId = selectedIds[0];
    const comp = sceneGraph.components[selectedId];
    if (!comp) return;
    let cursor = comp.parentId;
    const missingAncestors: string[] = [];
    while (cursor) {
      if (!expandedIds.includes(cursor)) {
        missingAncestors.push(cursor);
      }
      cursor = sceneGraph.components[cursor]?.parentId ?? null;
    }
    if (missingAncestors.length > 0) {
      for (const anc of missingAncestors) toggleExpanded(anc);
    }
  }, [expandedIds, sceneGraph, selectedIds, toggleExpanded, treeTab]);

  const useVirtual = rows.length > virtualThreshold;
  const startIndex = useVirtual
    ? Math.max(0, Math.floor(scrollTop / rowHeightPx) - virtualOverscan)
    : 0;
  const endIndex = useVirtual
    ? Math.min(
        rows.length,
        Math.ceil((scrollTop + viewportHeight) / rowHeightPx) + virtualOverscan
      )
    : rows.length;
  const visibleRows = rows.slice(startIndex, endIndex);
  const paddingTop = startIndex * rowHeightPx;
  const paddingBottom = Math.max(0, (rows.length - endIndex) * rowHeightPx);

  const hasVisibilityOverrides =
    hiddenIds.length > 0 || isolatedIds !== null;

  function openMenuForRow(row: TreeRowItem, clientX: number, clientY: number) {
    if (!onOpenContextMenu) return;
    const ids =
      row.kind === "component"
        ? selectedSet.has(row.id) && selectedIds.length > 1
          ? selectedIds
          : [row.id]
        : row.targetComponentIds;
    onOpenContextMenu({
      x: clientX,
      y: clientY,
      targetIds: ids,
      label: ids.length > 1 ? `${ids.length} componentes` : row.label,
    });
  }

  function renderRow(row: TreeRowItem) {
    const isUserNode = row.origin === "user" && (row.kind === "layer" || row.kind === "group") && row.id !== "__unassigned__";
    const userLayerRec = isUserNode && row.kind === "layer" ? orgDoc.userLayers.find((l) => l.id === row.id) : null;
    const vis =
      userLayerRec && !userLayerRec.visible
        ? "hidden"
        : computeVisibilityState(row.targetComponentIds, hiddenSet, isolatedSet);
    const isRowSelected =
      row.kind === "component"
        ? selectedSet.has(row.id)
        : row.targetComponentIds.length > 0 &&
          row.targetComponentIds.every((id) => selectedSet.has(id));
    const isRowHovered = row.kind === "component" && hoveredId === row.id;
    const isRenaming = renamingTarget && renamingTarget.id === row.id && renamingTarget.kind === row.kind;

    const groupKey = row.kind === "group" ? (row.origin ?? "cad") + ":" + row.id : null;
    const groupHidden = groupKey ? hiddenGroupKeys.includes(groupKey) : null;
    const visLabel = groupHidden !== null
      ? `${groupHidden ? copy.treeVisibilityShow : copy.treeVisibilityHide} ${row.label}`
      : vis === "visible"
        ? `${copy.treeVisibilityHide} ${row.label}`
        : vis === "hidden"
          ? `${copy.treeVisibilityShow} ${row.label}`
          : `${copy.treeVisibilityPartial}: ${row.label}`;

    return (
      <div
        key={row.key}
        role="treeitem"
        aria-level={row.depth + 1}
        aria-selected={isRowSelected}
        aria-expanded={row.hasChildren ? row.isExpanded : undefined}
        className={`gg-tree-row ${isRowSelected ? "gg-tree-row--selected" : ""} ${
          isRowHovered ? "gg-tree-row--hovered" : ""
        } ${vis === "hidden" ? "gg-tree-row--hidden" : ""} ${
          dragOverKey === row.key ? "gg-tree-row--dragover" : ""
        }`}
        style={{ paddingLeft: `${8 + row.depth * 14}px` }}
        draggable={row.kind === "component" || isUserNode}
        onDragStart={(event) => {
          if (row.kind === "component") {
            const dragIds = selectedSet.has(row.id) && selectedIds.length > 1 ? selectedIds : [row.id];
            event.dataTransfer.setData("application/x-geogen-drag", JSON.stringify({ kind: "occurrences", ids: dragIds }));
            event.dataTransfer.effectAllowed = "move";
          } else if (isUserNode && row.kind === "layer") {
            event.dataTransfer.setData("application/x-geogen-drag", JSON.stringify({ kind: "layer", id: row.id }));
            event.dataTransfer.effectAllowed = "move";
          }
        }}
        onDragOver={(event) => {
          if (!isUserNode && row.id !== "__unassigned__") return;
          if (!event.dataTransfer.types.includes("application/x-geogen-drag")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverKey(row.key);
        }}
        onDragLeave={() => {
          if (dragOverKey === row.key) setDragOverKey(null);
        }}
        onDrop={(event) => {
          setDragOverKey(null);
          const raw = event.dataTransfer.getData("application/x-geogen-drag");
          if (!raw) return;
          event.preventDefault();
          try {
            const payload = JSON.parse(raw) as { kind: "occurrences" | "layer"; ids?: string[]; id?: string };
            if (payload.kind === "occurrences" && payload.ids?.length) {
              if (row.kind === "layer") {
                assignOccurrencesToLayer(payload.ids, row.id === "__unassigned__" ? null : row.id);
              } else if (row.kind === "group") {
                addOccurrencesToGroup(row.id, payload.ids);
              }
            } else if (payload.kind === "layer" && payload.id && row.kind === "layer") {
              if (row.id === "__unassigned__") moveLayer(payload.id, null);
              else if (payload.id !== row.id) moveLayer(payload.id, row.id);
            }
          } catch {
            /* ignore malformed drag payload */
          }
        }}
        onContextMenu={(event) => {
          if (!onOpenContextMenu) return;
          event.preventDefault();
          openMenuForRow(row, event.clientX, event.clientY);
        }}
        onMouseEnter={() => {
          if (row.kind === "component") setHoveredId(row.id);
        }}
        onMouseLeave={() => {
          if (row.kind === "component" && hoveredId === row.id) {
            setHoveredId(null);
          }
        }}
      >
        {row.hasChildren ? (
          <button
            type="button"
            className="gg-tree-chevron"
            aria-label={row.isExpanded ? copy.treeCollapseAll : copy.treeExpandAll}
            onClick={() => toggleExpanded(row.id)}
          >
            {row.isExpanded ? (
              <ChevronDownIcon size={13} strokeWidth={1.75} />
            ) : (
              <ChevronRightIcon size={13} strokeWidth={1.75} />
            )}
          </button>
        ) : (
          <span className="gg-tree-chevron-spacer" aria-hidden="true" />
        )}

        {isRenaming ? (
          <form
            className="gg-tree-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (renamingTarget.kind === "layer") renameLayer(renamingTarget.id, renamingTarget.name);
              else renameGroup(renamingTarget.id, renamingTarget.name);
              setRenamingTarget(null);
            }}
          >
            <input
              type="text"
              className="gg-input"
              value={renamingTarget.name}
              autoFocus
              maxLength={80}
              onChange={(event) => setRenamingTarget({ ...renamingTarget, name: event.currentTarget.value })}
              onBlur={() => setRenamingTarget(null)}
            />
          </form>
        ) : (
          <button
            type="button"
            className="gg-tree-select-btn"
            onClick={(event) => {
              const multi =
                multiSelectMode || event.shiftKey || event.ctrlKey || event.metaKey;
              if (row.kind === "component") {
                select(row.id, multi ? "toggle" : "replace");
              } else {
                selectMany(row.targetComponentIds, multi ? "add" : "replace");
              }
            }}
          >
            {row.colorHex ? (
              <span
                className="gg-swatch"
                style={{ backgroundColor: row.colorHex }}
                aria-hidden="true"
              />
            ) : row.kind === "layer" ? (
              <LayersIcon size={13} strokeWidth={1.75} className="gg-tree-icon" />
            ) : row.kind === "group" ? (
              <GroupIcon size={13} strokeWidth={1.75} className="gg-tree-icon" />
            ) : row.isComposite ? (
              <CompositeIcon size={13} strokeWidth={1.75} className="gg-tree-icon" />
            ) : (
              <CubeIcon size={13} strokeWidth={1.75} className="gg-tree-icon" />
            )}

            <span className="gg-tree-label" title={`${row.label} (${row.id})`}>
              {row.label}
            </span>

            {row.secondaryLabel && (
              <span className="gg-tree-id gg-mono" title={row.secondaryLabel}>
                {row.secondaryLabel}
              </span>
            )}
          </button>
        )}

        <div className="gg-tree-row__actions">
          {isUserNode && (
            <>
              <label className="gg-tree-color-pick" title="Alterar cor">
                <span className="visually-hidden">Alterar cor de {row.label}</span>
                <input
                  type="color"
                  value={row.colorHex ?? "#3B82F6"}
                  onChange={(event) => {
                    if (row.kind === "layer") recolorLayer(row.id, event.currentTarget.value);
                    else recolorGroup(row.id, event.currentTarget.value);
                  }}
                />
              </label>
              {row.kind === "layer" && (
                <button
                  type="button"
                  className="gg-tree-action-btn"
                  title="Nova subcamada"
                  aria-label={`Nova subcamada em ${row.label}`}
                  onClick={() => {
                    setNewItemKind("layer");
                    setNewItemParentId(row.id);
                    setNewItemName("");
                    setNewItemColor(USER_ORGANIZATION_PALETTE[orgDoc.userLayers.length % USER_ORGANIZATION_PALETTE.length]);
                  }}
                >
                  <PlusIcon size={12} strokeWidth={1.75} />
                </button>
              )}
              <button
                type="button"
                className="gg-tree-action-btn"
                title="Renomear"
                aria-label={`Renomear ${row.label}`}
                onClick={() => setRenamingTarget({ kind: row.kind === "layer" ? "layer" : "group", id: row.id, name: row.label })}
              >
                <EditIcon size={12} strokeWidth={1.75} />
              </button>
              {row.kind === "layer" && (
                <button
                  type="button"
                  className="gg-tree-action-btn"
                  title="Subir na ordem"
                  aria-label={`Subir ${row.label}`}
                  onClick={() => reorderLayer(row.id, -1)}
                >
                  ↑
                </button>
              )}
              <button
                type="button"
                className="gg-tree-action-btn"
                title="Excluir"
                aria-label={`Excluir ${row.label}`}
                onClick={() => {
                  if (row.kind === "layer") {
                    setDeletingLayer({
                      id: row.id,
                      name: row.label,
                      parentId: userLayerRec?.parentId ?? null,
                      count: row.targetComponentIds.length,
                    });
                  } else {
                    deleteGroup(row.id);
                  }
                }}
              >
                <TrashIcon size={12} strokeWidth={1.75} />
              </button>
            </>
          )}

          {onOpenContextMenu && (row.kind === "component" || isUserNode) && (
            <button
              type="button"
              className="gg-tree-action-btn"
              aria-label={`Ações para ${row.label}`}
              title="Mais ações"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                openMenuForRow(row, rect.left, rect.bottom + 4);
              }}
            >
              <MoreVerticalIcon size={12} strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            className="gg-tree-action-btn"
            aria-label={`${copy.fit} ${row.label}`}
            title={copy.fit}
            disabled={row.targetComponentIds.length === 0}
            onClick={() => onFrameIds(row.targetComponentIds)}
          >
            <FitViewIcon size={12} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className={`gg-tree-action-btn ${
              vis !== "visible" ? "gg-tree-action-btn--active" : ""
            }`}
            aria-label={visLabel}
            aria-pressed={
              groupHidden ?? (vis === "hidden" ? true : vis === "partial" ? "mixed" : false)
            }
            disabled={!isUserNode && row.targetComponentIds.length === 0}
            onClick={() => {
              if (userLayerRec) {
                toggleUserLayerVis(userLayerRec.id);
              } else if (groupKey) {
                toggleGroupVisibility(groupKey);
              } else if (row.kind === "component") {
                toggleComponentVisibility(row.id);
              } else {
                toggleCollectionVisibility(row.targetComponentIds);
              }
            }}
          >
            {vis === "visible" ? (
              <EyeIcon size={13} strokeWidth={1.75} />
            ) : vis === "hidden" ? (
              <EyeOffIcon size={13} strokeWidth={1.75} />
            ) : (
              <PartialEyeIcon size={13} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-panel__body gg-panel__body--tree">
      <div className="gg-search-field">
        <SearchIcon size={13} strokeWidth={1.75} className="gg-search-field__icon" />
        <label htmlFor={searchInputId} className="visually-hidden">
          {copy.panelSearchPlaceholder}
        </label>
        <input
          id={searchInputId}
          type="search"
          className="gg-input gg-input--search"
          placeholder={copy.panelSearchPlaceholder}
          value={searchQuery}
          disabled={!sceneGraph}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </div>

      {!sceneGraph ? (
        <div className="gg-panel-note">
          <p>{copy.structureEmptyHint}</p>
        </div>
      ) : (
        <>
          <div
            className="gg-tabs gg-tabs--compact"
            role="tablist"
            aria-label="Organização da estrutura"
          >
            {(
              [
                ["hierarchy", copy.treeTabComponents],
                ["layers", copy.treeTabLayers],
                ["groups", copy.treeTabGroups],
              ] as [TreeTab, string][]
            ).map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                className="gg-tab"
                aria-selected={treeTab === tabKey}
                onClick={() => setTreeTab(tabKey)}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          <label className="gg-browser-grouping">
            <span className="visually-hidden">Agrupar por</span>
            <select value={["categories", "materials", "blocks"].includes(treeTab) ? treeTab : ""}
              onChange={(event) => setTreeTab((event.currentTarget.value || "hierarchy") as TreeTab)}>
              <option value="">Mais agrupamentos</option>
              <option value="categories">Categorias</option>
              <option value="materials">Materiais</option>
              <option value="blocks">Blocos e instâncias</option>
            </select>
          </label>

          {(treeTab === "layers" || treeTab === "groups") && (
            <div className="gg-org-bar">
              <div className="gg-org-bar__sources" role="group" aria-label="Origem da organização">
                <button
                  type="button"
                  className="gg-org-source-btn"
                  aria-pressed={orgDoc.activeSource === "cad"}
                  onClick={() => setOrgSource("cad")}
                >
                  Importada do CAD
                </button>
                <button
                  type="button"
                  className="gg-org-source-btn"
                  aria-pressed={orgDoc.activeSource === "user"}
                  onClick={() => setOrgSource("user")}
                >
                  Personalizada
                </button>
              </div>
              <div className="gg-org-bar__actions">
                <button
                  type="button"
                  className="gg-btn gg-btn--secondary gg-btn--xs"
                  onClick={() => {
                    setOrgSource("user");
                    setNewItemKind(treeTab === "layers" ? "layer" : "group");
                    setNewItemParentId(null);
                    setNewItemName("");
                    setNewItemColor(USER_ORGANIZATION_PALETTE[(orgDoc.userLayers.length + orgDoc.userGroups.length) % USER_ORGANIZATION_PALETTE.length]);
                  }}
                >
                  <FolderPlusIcon size={12} strokeWidth={1.75} aria-hidden="true" />
                  <span>{treeTab === "layers" ? "+ Camada" : "+ Grupo"}</span>
                </button>
                {(Object.keys(sceneGraph.layers).length > 0 || Object.keys(sceneGraph.groups).length > 0) && (
                  <button
                    type="button"
                    className="gg-btn gg-btn--ghost gg-btn--xs"
                    title="Clonar camadas e grupos importados para edição do usuário"
                    onClick={() => {
                      if ((orgDoc.userLayers.length || orgDoc.userGroups.length) &&
                          !window.confirm("Substituir a organização personalizada pela estrutura CAD?")) return;
                      try {
                        copyFromImported(sceneGraph);
                        setOrgMessage("Estrutura importada copiada para camadas/grupos do usuário.");
                      } catch (error) {
                        setOrgMessage(error instanceof Error ? error.message : String(error));
                      }
                    }}
                  >
                    <CopyIcon size={12} strokeWidth={1.75} aria-hidden="true" />
                    <span>Copiar CAD</span>
                  </button>
                )}
                <button
                  type="button"
                  className="gg-btn gg-btn--ghost gg-btn--icon-sm"
                  title="Desfazer organização"
                  aria-label="Desfazer organização"
                  disabled={orgPast.length === 0}
                  onClick={undoOrg}
                >
                  <UndoIcon size={12} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="gg-btn gg-btn--ghost gg-btn--icon-sm"
                  title="Refazer organização"
                  aria-label="Refazer organização"
                  disabled={orgFuture.length === 0}
                  onClick={redoOrg}
                >
                  <RedoIcon size={12} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="gg-btn gg-btn--ghost gg-btn--icon-sm"
                  title="Exportar organization.json"
                  aria-label="Exportar organization.json"
                  onClick={() => {
                    const blob = new Blob([exportOrgJson()], { type: "application/json;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "organization.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <DownloadIcon size={12} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="gg-btn gg-btn--ghost gg-btn--icon-sm"
                  title="Importar organization.json"
                  aria-label="Importar organization.json"
                  onClick={() => importOrgRef.current?.click()}
                >
                  <UploadIcon size={12} strokeWidth={1.75} />
                </button>
                <input
                  ref={importOrgRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file || !sceneGraph) return;
                    try {
                      const binding = useOrganizationStore.getState().binding;
                      if (file.size > 12 * 1024 * 1024) throw new Error("O arquivo organization.json excede 12 MiB.");
                      const text = await file.text();
                      if (binding !== useOrganizationStore.getState().binding) return;
                      const result = importOrgJson(text, sceneGraph);
                      setOrgMessage(
                        result.warnings[0] ?? `Organização importada (${result.matchedOccurrences} vínculos).`
                      );
                    } catch (err) {
                      setOrgMessage(err instanceof Error ? err.message : "Falha ao importar organization.json.");
                    }
                  }}
                />
              </div>

              {newItemKind && (
                <form
                  className="gg-org-create-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const trimmed = newItemName.trim();
                    if (!trimmed) return;
                    if (newItemKind === "layer") {
                      createLayer({ name: trimmed, color: newItemColor, parentId: newItemParentId, memberIds: selectedIds });
                    } else {
                      createGroup({ name: trimmed, color: newItemColor, memberIds: selectedIds });
                    }
                    setNewItemKind(null);
                    setNewItemName("");
                  }}
                >
                  <input
                    type="color"
                    aria-label="Cor"
                    value={newItemColor}
                    onChange={(event) => setNewItemColor(event.currentTarget.value)}
                  />
                  <input
                    type="text"
                    className="gg-input"
                    placeholder={newItemKind === "layer" ? "Nome da camada…" : "Nome do grupo…"}
                    value={newItemName}
                    maxLength={80}
                    autoFocus
                    onChange={(event) => setNewItemName(event.currentTarget.value)}
                  />
                  <button type="submit" className="gg-btn gg-btn--primary gg-btn--xs" disabled={!newItemName.trim()}>
                    Salvar
                  </button>
                  <button type="button" className="gg-btn gg-btn--ghost gg-btn--xs" onClick={() => setNewItemKind(null)}>
                    ×
                  </button>
                </form>
              )}

              {persistenceNotice && <p className="gg-org-notice" role="status">{persistenceNotice}</p>}
              {(orgMessage || lastImportNotice) && (
                <div className="gg-org-notice" role="status">
                  <span>{orgMessage ?? lastImportNotice}</span>
                  <button
                    type="button"
                    className="gg-mini-link-btn"
                    onClick={() => {
                      setOrgMessage(null);
                      clearImportNotice();
                    }}
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="gg-tree-meta-bar">
            <span className="gg-tree-meta-bar__summary">
              {sceneGraph.mode === "manifest-full"
                ? copy.structureLoadedManifestSummary
                : copy.structureLoadedBasicSummary}
              {" · "}
              <span className="gg-mono">{sceneGraph.componentOrder.length}</span>
            </span>

            <div className="gg-tree-meta-bar__btns">
              {hasVisibilityOverrides && (
                <button
                  type="button"
                  className="gg-mini-link-btn"
                  onClick={showAll}
                >
                  {copy.showAll}
                </button>
              )}
              <button
                type="button"
                className="gg-mini-link-btn"
                onClick={expandAll}
              >
                {copy.treeExpandAll}
              </button>
              <button
                type="button"
                className="gg-mini-link-btn"
                onClick={collapseAll}
              >
                {copy.treeCollapseAll}
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="gg-tree-scroll"
            role="tree"
            aria-label={copy.panelStructure}
            aria-multiselectable="true"
            onScroll={(event) => {
              if (useVirtual) {
                setScrollTop(event.currentTarget.scrollTop);
              }
            }}
          >
            {rows.length === 0 ? (
              <div className="gg-panel-note">
                <p>
                  {searchQuery.trim()
                    ? copy.treeEmptySearch
                    : treeTab === "layers"
                      ? orgDoc.activeSource === "user"
                        ? "Nenhuma camada personalizada ainda. Crie uma camada ou copie a estrutura do CAD."
                        : copy.treeEmptyLayers
                      : orgDoc.activeSource === "user"
                        ? "Nenhum grupo personalizado ainda. Crie um grupo ou copie do CAD."
                        : copy.treeEmptyGroups}
                </p>
              </div>
            ) : useVirtual ? (
              <div
                style={{
                  paddingTop: `${paddingTop}px`,
                  paddingBottom: `${paddingBottom}px`,
                }}
              >
                {visibleRows.map(renderRow)}
              </div>
            ) : (
              <div className="gg-tree-list">{rows.map(renderRow)}</div>
            )}
          </div>

          <dialog
            ref={deleteDialogRef}
            className="gg-org-dialog"
            aria-labelledby="gg-delete-layer-title"
            onClose={() => setDeletingLayer(null)}
          >
            {deletingLayer && (
              <div className="gg-org-dialog__body">
                <h3 id="gg-delete-layer-title">Excluir camada “{deletingLayer.name}”</h3>
                <p>
                  {deletingLayer.count > 0
                    ? `Esta camada possui ${deletingLayer.count} ocorrência(s) vinculada(s). O que deseja fazer com elas?`
                    : "Confirmar exclusão desta camada personalizada?"}
                </p>
                <div className="gg-org-dialog__actions">
                  {deletingLayer.count > 0 && deletingLayer.parentId && (
                    <button
                      type="button"
                      className="gg-btn gg-btn--primary gg-btn--xs"
                      onClick={() => {
                        deleteLayer(deletingLayer.id, "move-to-parent");
                        setDeletingLayer(null);
                      }}
                    >
                      Mover para camada superior
                    </button>
                  )}
                  <button
                    type="button"
                    className="gg-btn gg-btn--secondary gg-btn--xs"
                    onClick={() => {
                      deleteLayer(deletingLayer.id, "unassign");
                      setDeletingLayer(null);
                    }}
                  >
                    {deletingLayer.count > 0 ? "Remover atribuição de camada" : "Excluir camada"}
                  </button>
                  <button
                    type="button"
                    className="gg-btn gg-btn--ghost gg-btn--xs"
                    onClick={() => setDeletingLayer(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </dialog>
        </>
      )}
    </div>
  );
}

function ProvenanceBadge({
  source,
}: {
  source: "cad" | "mesh" | "manifest";
}) {
  const label =
    source === "cad"
      ? copy.provenanceCad
      : source === "manifest"
        ? copy.provenanceDeclared
        : copy.provenanceMesh;
  return (
    <span
      className={`gg-badge ${
        source === "cad" ? "gg-badge--accent" : "gg-badge--neutral"
      }`}
    >
      {label}
    </span>
  );
}

function SingleComponentDetails({
  sceneGraph,
  comp,
  onFrameSelected,
  onHideSelected,
  onIsolateSelected,
  onClearSelection,
}: {
  sceneGraph: ViewerSceneGraph;
  comp: ComponentRecord;
  onFrameSelected: () => void;
  onHideSelected: () => void;
  onIsolateSelected: () => void;
  onClearSelection: () => void;
}) {
  const orgDoc = useOrganizationStore((s) => s.doc);
  const assignOccurrencesToLayer = useOrganizationStore((s) => s.assignOccurrencesToLayer);
  const addOccurrencesToGroup = useOrganizationStore((s) => s.addOccurrencesToGroup);
  const removeOccurrencesFromGroup = useOrganizationStore((s) => s.removeOccurrencesFromGroup);
  const userLayerId = orgDoc.componentLayerAssignments[comp.id] ?? "";
  const userLayer = userLayerId ? orgDoc.userLayers.find((l) => l.id === userLayerId) : null;
  const userGroups = orgDoc.userGroups.filter((g) => g.memberIds.includes(comp.id));

  const layer = comp.layerId ? sceneGraph.layers[comp.layerId] : null;
  const groupNames = comp.groupIds
    .map((gid) => sceneGraph.groups[gid]?.name ?? gid)
    .filter(Boolean);
  const cad = comp.cad;
  const dimensionParts: string[] = [];
  if (typeof cad?.dimensions?.lengthM === "number") {
    dimensionParts.push(`C: ${formatMillimeters(cad.dimensions.lengthM)}`);
  }
  if (typeof cad?.dimensions?.widthM === "number") {
    dimensionParts.push(`L: ${formatMillimeters(cad.dimensions.widthM)}`);
  }
  if (typeof cad?.dimensions?.thicknessM === "number") {
    dimensionParts.push(`E: ${formatMillimeters(cad.dimensions.thicknessM)}`);
  }
  const userTextEntries = Object.entries(cad?.userText ?? {});
  const extraPropsEntries = Object.entries(cad?.properties ?? {});

  const hasCadMetrics = Boolean(
    cad &&
      (cad.geometryType ||
        cad.isClosed !== null ||
        cad.isValid !== null ||
        dimensionParts.length > 0 ||
        cad.boundingBoxM ||
        cad.areaM2 !== null ||
        cad.volumeM3 !== null ||
        cad.centroidM ||
        cad.fabrication)
  );

  return (
    <div className="gg-panel__body">
      <div className="gg-selection-actions" role="group" aria-label={copy.propertiesSelectionSection}>
        <button
          type="button"
          className="gg-btn gg-btn--secondary gg-btn--xs"
          onClick={onFrameSelected}
        >
          <FitViewIcon size={13} strokeWidth={1.75} />
          <span>{copy.fit}</span>
        </button>
        <button
          type="button"
          className="gg-btn gg-btn--secondary gg-btn--xs"
          onClick={onHideSelected}
        >
          <EyeOffIcon size={13} strokeWidth={1.75} />
          <span>{copy.hideSelected}</span>
        </button>
        <button
          type="button"
          className="gg-btn gg-btn--secondary gg-btn--xs"
          onClick={onIsolateSelected}
        >
          <IsolateIcon size={13} strokeWidth={1.75} />
          <span>{copy.isolateSelected}</span>
        </button>
        <button
          type="button"
          className="gg-btn gg-btn--ghost gg-btn--xs"
          onClick={onClearSelection}
          aria-label={copy.clearSelection}
        >
          <ClearSelectionIcon size={13} strokeWidth={1.75} />
        </button>
      </div>

      <section className="gg-panel-section" aria-labelledby="prop-sel-identity">
        <div className="gg-panel-section__head">
          <h2 id="prop-sel-identity" className="gg-panel-section__title gg-section-index">
            {copy.propertiesSelectionSection}
          </h2>
          <ProvenanceBadge
            source={sceneGraph.mode === "manifest-full" ? "manifest" : "mesh"}
          />
        </div>

        <dl className="gg-kv-list">
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propName}</dt>
            <dd className="gg-kv-value-wrap">{componentLabel(comp)}</dd>
          </div>
          {([
            [copy.propManifestName, componentIdentity(comp).manifestName],
            [copy.propCadName, componentIdentity(comp).cadNames.join(" · ")],
            [copy.propGlbName, componentIdentity(comp).glbNames.join(" · ")],
          ] as const).map(([label, value]) => value && value !== componentLabel(comp) && (
            <div className="gg-kv-row gg-kv-row--stacked" key={label}>
              <dt>{label}</dt>
              <dd className="gg-kv-value-wrap">{value}</dd>
            </div>
          ))}
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propId}</dt>
            <dd className="gg-mono gg-kv-value-wrap">{comp.id}</dd>
          </div>
          {comp.sourceObjectId && (
            <div className="gg-kv-row gg-kv-row--stacked">
              <dt>{copy.propSourceId}</dt>
              <dd className="gg-mono gg-kv-value-wrap">{comp.sourceObjectId}</dd>
            </div>
          )}
          <div className="gg-kv-row">
            <dt>{copy.propCategory}</dt>
            <dd>{comp.category ?? copy.propNotInformed}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propLayer} (CAD)</dt>
            <dd>{layer ? layer.fullPath : copy.propNotInformed}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>Camada do usuário</dt>
            <dd className="gg-chip-row">
              {userLayer && (
                <span
                  className="gg-swatch"
                  style={{ backgroundColor: userLayer.color }}
                  aria-hidden="true"
                />
              )}
              <select
                className="gg-kv-select"
                aria-label="Camada do usuário do componente"
                value={userLayerId}
                onChange={(event) => assignOccurrencesToLayer([comp.id], event.currentTarget.value || null)}
              >
                <option value="">Sem camada atribuída</option>
                {orgDoc.userLayers.map((ul) => (
                  <option key={ul.id} value={ul.id}>{ul.name}</option>
                ))}
              </select>
            </dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propGroup} (CAD)</dt>
            <dd>{groupNames.length > 0 ? groupNames.join(", ") : copy.propNotInformed}</dd>
          </div>
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>Grupos do usuário</dt>
            <dd className="gg-chip-row">
              {userGroups.length > 0 ? (
                userGroups.map((ug) => (
                  <span key={ug.id} className="gg-badge gg-badge--neutral">
                    <span className="gg-swatch" style={{ backgroundColor: ug.color }} aria-hidden="true" />
                    <span>{ug.name}</span>
                    <button
                      type="button"
                      className="gg-chip-remove"
                      aria-label={`Remover de ${ug.name}`}
                      onClick={() => removeOccurrencesFromGroup(ug.id, [comp.id])}
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="gg-helper-note">{copy.propNotInformed}</span>
              )}
              {orgDoc.userGroups.some((g) => !g.memberIds.includes(comp.id)) && (
                <select
                  className="gg-kv-select"
                  aria-label="Adicionar componente a grupo do usuário"
                  value=""
                  onChange={(event) => {
                    if (event.currentTarget.value) {
                      addOccurrencesToGroup(event.currentTarget.value, [comp.id]);
                    }
                  }}
                >
                  <option value="">+ Adicionar a grupo…</option>
                  {orgDoc.userGroups
                    .filter((g) => !g.memberIds.includes(comp.id))
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
              )}
            </dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMaterial}</dt>
            <dd>
              {comp.materialNames.length > 0
                ? comp.materialNames.join(", ")
                : comp.materialId ?? copy.propNotInformed}
            </dd>
          </div>
          {(comp.isComposite || comp.isInstance) && (
            <div className="gg-kv-row">
              <dt>{copy.propGeometryType}</dt>
              <dd className="gg-chip-row">
                {comp.isComposite && (
                  <span className="gg-badge gg-badge--neutral">{copy.propComposite}</span>
                )}
                {comp.isInstance && (
                  <span className="gg-badge gg-badge--neutral">{copy.propInstance}</span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <details className="gg-panel-section gg-panel-section--muted gg-panel-details" open>
        <summary className="gg-panel-section__head">
          <h2 id="prop-mesh-head" className="gg-panel-section__title">
            {copy.propertiesMeshSection}
          </h2>
          <ProvenanceBadge source="mesh" />
        </summary>
        <dl className="gg-kv-list">
          <div className="gg-kv-row">
            <dt>{copy.propMeshes}</dt>
            <dd className="gg-mono gg-tabular">{comp.meshCount}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propVerticesTriangles}</dt>
            <dd className="gg-mono gg-tabular">
              {formatNumber(comp.vertexCount, 0)} / {formatNumber(comp.triangleCount, 0)}
            </dd>
          </div>
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propMeshBounds}</dt>
            <dd className="gg-mono gg-tabular">
              {formatBoundsMm(comp.meshBoundsMeters)}
            </dd>
          </div>
        </dl>
        <p className="gg-helper-note">{copy.propBoundsNote}</p>
      </details>

      {hasCadMetrics && cad && (
        <details className="gg-panel-section gg-panel-section--muted gg-panel-details" open>
          <summary className="gg-panel-section__head">
            <h2 id="prop-cad-head" className="gg-panel-section__title">
              {copy.propertiesCadSection}
            </h2>
            <ProvenanceBadge source="cad" />
          </summary>
          <dl className="gg-kv-list">
            {cad.geometryType && (
              <div className="gg-kv-row">
                <dt>{copy.propGeometryType}</dt>
                <dd className="gg-mono">{cad.geometryType}</dd>
              </div>
            )}
            {cad.isClosed !== null && (
              <div className="gg-kv-row">
                <dt>{copy.propClosedSolid}</dt>
                <dd>{cad.isClosed ? copy.boolYes : copy.boolNo}</dd>
              </div>
            )}
            {cad.isValid !== null && (
              <div className="gg-kv-row">
                <dt>{copy.propValidCad}</dt>
                <dd>{cad.isValid ? copy.boolYes : copy.boolNo}</dd>
              </div>
            )}
            {dimensionParts.length > 0 && (
              <div className="gg-kv-row gg-kv-row--stacked">
                <dt>
                  {copy.propDimensionsCad} ({cad.dimensions?.source ?? "cad"})
                </dt>
                <dd className="gg-mono gg-tabular">{dimensionParts.join(" · ")}</dd>
              </div>
            )}
            {cad.boundingBoxM && (
              <div className="gg-kv-row gg-kv-row--stacked">
                <dt>
                  {copy.propCadBounds} ({cad.boundingBoxM.source})
                </dt>
                <dd className="gg-mono gg-tabular">
                  min ({cad.boundingBoxM.min.map((n) => formatNumber(n, 3)).join(", ")})
                  {" / "}
                  max ({cad.boundingBoxM.max.map((n) => formatNumber(n, 3)).join(", ")}) m
                </dd>
              </div>
            )}
            {cad.boundingBoxM?.source === "cad" && (
              <div className="gg-kv-row gg-kv-row--stacked">
                <dt>Diferenças entre envolventes de repouso · CAD × Malha</dt>
                <dd className="gg-mono gg-tabular">{compareRestBounds(comp)?.map(({ deltaM, percent }, index) => (
                  <div key={index}>{["X", "Z", "Y"][index]} · {formatMillimeters(deltaM)} ({percent === null ? "—" : formatNumber(percent, 2) + "%"})</div>
                ))}</dd>
              </div>
            )}
            {cad.areaM2 && (
              <div className="gg-kv-row">
                <dt>{copy.propArea}</dt>
                <dd className="gg-mono gg-tabular">
                  {formatNumber(cad.areaM2.value, 4)} m² ({cad.areaM2.source})
                </dd>
              </div>
            )}
            {(cad.volumeM3 !== null || cad.isClosed === false) && (
              <div className="gg-kv-row">
                <dt>{copy.propVolume}</dt>
                <dd className="gg-mono gg-tabular">
                  {cad.volumeM3
                    ? `${formatNumber(cad.volumeM3.value, 6)} m³ (${cad.volumeM3.source})`
                    : "Superfície aberta"}
                </dd>
              </div>
            )}
            {cad.centroidM && (
              <div className="gg-kv-row gg-kv-row--stacked">
                <dt>
                  {copy.propCentroid} ({cad.centroidM.source})
                </dt>
                <dd className="gg-mono gg-tabular">
                  ({cad.centroidM.value.map((n) => formatNumber(n, 3)).join(", ")}) m
                </dd>
              </div>
            )}
            {cad.fabrication && (
              <div className="gg-kv-row gg-kv-row--stacked">
                <dt>{copy.propFabrication}</dt>
                <dd className="gg-kv-value-wrap">
                  {[
                    cad.fabrication.prototypeId
                      ? `protótipo ${cad.fabrication.prototypeId}`
                      : null,
                    cad.fabrication.scaleDenominator
                      ? `1:${cad.fabrication.scaleDenominator}`
                      : null,
                    cad.fabrication.material,
                    typeof cad.fabrication.toleranceMm === "number"
                      ? `tol. ±${formatNumber(cad.fabrication.toleranceMm, 2)} mm`
                      : null,
                    cad.fabrication.connectorNote,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
          </dl>
        </details>
      )}

      {(userTextEntries.length > 0 || extraPropsEntries.length > 0) && (
        <details className="gg-panel-section gg-panel-section--muted gg-panel-details">
          <summary className="gg-panel-section__head">
            <h2 id="prop-ut-head" className="gg-panel-section__title">
              {copy.propertiesUserTextSection} ({userTextEntries.length + extraPropsEntries.length})
            </h2>
            <ProvenanceBadge source="manifest" />
          </summary>
          <dl className="gg-kv-list">
            {userTextEntries.map(([key, val]) => (
              <div key={`ut:${key}`} className="gg-kv-row gg-kv-row--stacked">
                <dt>{key}</dt>
                <dd className="gg-kv-value-wrap">{val}</dd>
              </div>
            ))}
            {extraPropsEntries.map(([key, val]) => (
              <div key={`pr:${key}`} className="gg-kv-row gg-kv-row--stacked">
                <dt>{key}</dt>
                <dd className="gg-kv-value-wrap">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

export function PropertiesContent({
  onFrameIds,
}: {
  onFrameIds: (ids: string[]) => void;
}) {
  const sceneGraph = useViewerStore((s) => s.sceneGraph);
  const selectedIds = useViewerStore((s) => s.selectedIds);
  const explodedBoundsMeters = useViewerStore((s) => s.explodedBoundsMeters);
  const select = useViewerStore((s) => s.select);
  const clearSelection = useViewerStore((s) => s.clearSelection);
  const hideIds = useViewerStore((s) => s.hideIds);
  const isolateIds = useViewerStore((s) => s.isolateIds);
  const orgDoc = useOrganizationStore((s) => s.doc);
  const assignOccurrencesToLayer = useOrganizationStore((s) => s.assignOccurrencesToLayer);
  const addOccurrencesToGroup = useOrganizationStore((s) => s.addOccurrencesToGroup);
  const createLayer = useOrganizationStore((s) => s.createLayer);
  const createGroup = useOrganizationStore((s) => s.createGroup);

  if (!sceneGraph) {
    return (
      <div className="gg-panel__body">
        <div className="gg-panel-note">
          <p>{copy.propertiesEmptyHint}</p>
        </div>
      </div>
    );
  }

  if (selectedIds.length === 1) {
    const comp = sceneGraph.components[selectedIds[0]];
    if (comp) {
      return (
        <SingleComponentDetails
          sceneGraph={sceneGraph}
          comp={comp}
          onFrameSelected={() => onFrameIds([comp.id])}
          onHideSelected={() => hideIds([comp.id])}
          onIsolateSelected={() => isolateIds([comp.id])}
          onClearSelection={clearSelection}
        />
      );
    }
  }

  if (selectedIds.length > 1) {
    const selectedComponents = selectedIds
      .map((id) => sceneGraph.components[id])
      .filter(Boolean);
    const sumMeshes = selectedComponents.reduce((acc, c) => acc + c.meshCount, 0);
    const sumTriangles = selectedComponents.reduce(
      (acc, c) => acc + c.triangleCount,
      0
    );
    const summarizeField = (values: (string | null | undefined)[]) => {
      const normalized = new Set(values.map((v) => v?.trim() || "—"));
      if (normalized.size === 1) return Array.from(normalized)[0];
      return `Vários (${normalized.size})`;
    };
    const commonCategory = summarizeField(selectedComponents.map((c) => c.category));
    const commonMaterial = summarizeField(
      selectedComponents.map((c) => c.materialNames[0] ?? c.materialId)
    );
    const commonCadLayer = summarizeField(
      selectedComponents.map((c) => (c.layerId ? sceneGraph.layers[c.layerId]?.name : null))
    );
    const commonUserLayer = summarizeField(
      selectedComponents.map((c) => {
        const lid = orgDoc.componentLayerAssignments[c.id];
        return lid ? orgDoc.userLayers.find((l) => l.id === lid)?.name ?? lid : null;
      })
    );

    return (
      <div className="gg-panel__body">
        <div className="gg-selection-actions" role="group" aria-label={copy.propertiesMultiTitle}>
          <button
            type="button"
            className="gg-btn gg-btn--secondary gg-btn--xs"
            onClick={() => onFrameIds(selectedIds)}
          >
            <FitViewIcon size={13} strokeWidth={1.75} />
            <span>{copy.fit}</span>
          </button>
          <button
            type="button"
            className="gg-btn gg-btn--secondary gg-btn--xs"
            onClick={() => hideIds(selectedIds)}
          >
            <EyeOffIcon size={13} strokeWidth={1.75} />
            <span>{copy.hideSelected}</span>
          </button>
          <button
            type="button"
            className="gg-btn gg-btn--secondary gg-btn--xs"
            onClick={() => isolateIds(selectedIds)}
          >
            <IsolateIcon size={13} strokeWidth={1.75} />
            <span>{copy.isolateSelected}</span>
          </button>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--xs"
            onClick={clearSelection}
          >
            <ClearSelectionIcon size={13} strokeWidth={1.75} />
            <span>{copy.clearSelection}</span>
          </button>
        </div>

        <section className="gg-panel-section" aria-labelledby="prop-multi-head">
          <div className="gg-panel-section__head">
            <h2 id="prop-multi-head" className="gg-panel-section__title gg-section-index">
              {copy.propertiesMultiTitle}
            </h2>
            <span className="gg-badge gg-badge--accent gg-mono">
              {selectedComponents.length}
            </span>
          </div>
          <p className="gg-helper-note">{copy.propertiesMultiHint}</p>
          <dl className="gg-kv-list">
            <div className="gg-kv-row">
              <dt>{copy.propCategory}</dt>
              <dd>{commonCategory}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>{copy.propMaterial}</dt>
              <dd>{commonMaterial}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>{copy.propLayer} (CAD)</dt>
              <dd>{commonCadLayer}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>Camada do usuário</dt>
              <dd>{commonUserLayer}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>{copy.propMeshes}</dt>
              <dd className="gg-mono gg-tabular">{sumMeshes}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>{copy.propVerticesTriangles}</dt>
              <dd className="gg-mono gg-tabular">{formatNumber(sumTriangles, 0)} tri.</dd>
            </div>
          </dl>
        </section>

        <section className="gg-panel-section gg-panel-section--muted" aria-label="Organizar seleção">
          <div className="gg-panel-section__head">
            <h2 className="gg-panel-section__title">Organização do usuário</h2>
          </div>
          <div className="gg-v05-fields">
            <label>
              Atribuir camada do usuário
              <select
                value=""
                onChange={(event) => {
                  const val = event.currentTarget.value;
                  if (val === "__new__") {
                    createLayer({ name: `Camada (${selectedIds.length})` });
                    const latest = useOrganizationStore.getState().doc;
                    const created = latest.userLayers[latest.userLayers.length - 1];
                    if (created) assignOccurrencesToLayer(selectedIds, created.id);
                  } else if (val === "__clear__") {
                    assignOccurrencesToLayer(selectedIds, null);
                  } else if (val) {
                    assignOccurrencesToLayer(selectedIds, val);
                  }
                }}
              >
                <option value="">Escolher camada…</option>
                {orgDoc.userLayers.map((ul) => (
                  <option key={ul.id} value={ul.id}>{ul.name}</option>
                ))}
                <option value="__new__">+ Criar nova camada com seleção</option>
                <option value="__clear__">Remover atribuição de camada</option>
              </select>
            </label>
            <label>
              Adicionar a grupo do usuário
              <select
                value=""
                onChange={(event) => {
                  const val = event.currentTarget.value;
                  if (val === "__new__") {
                    createGroup({ name: `Grupo (${selectedIds.length})`, memberIds: selectedIds });
                  } else if (val) {
                    addOccurrencesToGroup(val, selectedIds);
                  }
                }}
              >
                <option value="">Escolher grupo…</option>
                {orgDoc.userGroups.map((ug) => (
                  <option key={ug.id} value={ug.id}>{ug.name}</option>
                ))}
                <option value="__new__">+ Criar novo grupo com seleção</option>
              </select>
            </label>
          </div>
        </section>

        <section className="gg-panel-section gg-panel-section--muted" aria-label={copy.propertiesMultiTitle}>
          <ul className="gg-node-list">
            {selectedComponents.slice(0, 60).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="gg-node-item gg-node-item--btn"
                  onClick={() => select(c.id, "replace")}
                >
                  <CubeIcon size={13} strokeWidth={1.75} className="gg-node-item__icon" />
                  <span className="gg-node-item__name">{c.name}</span>
                  <span className="gg-node-item__id gg-mono">{c.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="gg-panel__body">
      <section className="gg-panel-section" aria-labelledby="prop-scene-head">
        <div className="gg-panel-section__head">
          <h2 id="prop-scene-head" className="gg-panel-section__title gg-section-index">
            {copy.propertiesSceneSection}
          </h2>
          <ProvenanceBadge
            source={sceneGraph.mode === "manifest-full" ? "manifest" : "mesh"}
          />
        </div>
        <dl className="gg-kv-list">
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propFile}</dt>
            <dd className="gg-kv-value-wrap">{sceneGraph.fileName}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMode}</dt>
            <dd>
              <span
                className={`gg-badge ${
                  sceneGraph.mode === "manifest-full"
                    ? "gg-badge--accent"
                    : "gg-badge--neutral"
                }`}
              >
                {sceneGraph.mode === "manifest-full"
                  ? copy.modeManifest
                  : copy.modeBasic}
              </span>
            </dd>
          </div>
          {sceneGraph.projectTitle && (
            <div className="gg-kv-row gg-kv-row--stacked">
              <dt>{copy.propProject}</dt>
              <dd className="gg-kv-value-wrap">{sceneGraph.projectTitle}</dd>
            </div>
          )}
          {sceneGraph.sourceApplication && (
            <div className="gg-kv-row">
              <dt>{copy.propSourceApp}</dt>
              <dd>
                {sceneGraph.sourceApplication}
                {sceneGraph.sourceUnit ? ` (${sceneGraph.sourceUnit})` : ""}
              </dd>
            </div>
          )}
          {sceneGraph.diagnostics.sha256Verified !== null && (
            <div className="gg-kv-row">
              <dt>{copy.propShaVerified}</dt>
              <dd className="gg-inline-status">
                <VerifiedIcon size={13} strokeWidth={1.75} />
                <span>{sceneGraph.diagnostics.sha256Verified ? copy.boolYes : copy.boolNo}</span>
              </dd>
            </div>
          )}
          <div className="gg-kv-row">
            <dt>{copy.propMatchStrategy}</dt>
            <dd className="gg-mono">{sceneGraph.diagnostics.nodeMatchStrategy}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propSize}</dt>
            <dd className="gg-mono gg-tabular">{formatBytes(sceneGraph.fileSizeBytes)}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propComponents}</dt>
            <dd className="gg-mono gg-tabular">{sceneGraph.componentOrder.length}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMeshes}</dt>
            <dd className="gg-mono gg-tabular">{sceneGraph.totalMeshes}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propVerticesTriangles}</dt>
            <dd className="gg-mono gg-tabular">
              {formatNumber(sceneGraph.totalVertices, 0)} /{" "}
              {formatNumber(sceneGraph.totalTriangles, 0)}
            </dd>
          </div>
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>
              {explodedBoundsMeters ? copy.propOriginalBounds : copy.propBounds}
            </dt>
            <dd className="gg-mono gg-tabular">
              {formatBoundsMm(sceneGraph.sceneBoundsMeters)} (
              {formatVectorMeters(sceneGraph.sceneBoundsMeters)})
            </dd>
          </div>
          {explodedBoundsMeters && (
            <div className="gg-kv-row gg-kv-row--stacked">
              <dt>
                {copy.propExplodedBounds}{" "}
                <span className="gg-badge gg-badge--accent">
                  {copy.propTemporaryBadge}
                </span>
              </dt>
              <dd className="gg-mono gg-tabular">
                {formatBoundsMm(explodedBoundsMeters)} (
                {formatVectorMeters(explodedBoundsMeters)})
              </dd>
            </div>
          )}
        </dl>
        <p className="gg-helper-note">
          {explodedBoundsMeters ? copy.propTemporaryExplodeNote : copy.propBoundsNote}
        </p>
      </section>

      <div className="gg-panel-note">
        <p>{copy.propertiesNoSelectionHint}</p>
      </div>
    </div>
  );
}

export function PanelHeader({
  icon,
  title,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="gg-panel__header">
      <div className="gg-panel__title-group">
        {icon}
        <span>{title}</span>
      </div>
      <button
        type="button"
        className="gg-btn gg-btn--ghost gg-btn--icon-sm"
        aria-label={copy.panelClose}
        onClick={onClose}
      >
        <CloseIcon size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function LeftHierarchyPanel({
  onFrameIds,
  onOpenContextMenu,
  onClose,
}: {
  onFrameIds: (ids: string[]) => void;
  onOpenContextMenu?: (state: ContextMenuState) => void;
  onClose: () => void;
}) {
  return (
    <section className="gg-drawer gg-drawer--left" aria-label={copy.panelStructure}>
      <PanelHeader
        icon={<HierarchyIcon size={15} strokeWidth={1.75} />}
        title={copy.panelStructure}
        onClose={onClose}
      />
      <StructureContent onFrameIds={onFrameIds} onOpenContextMenu={onOpenContextMenu} />
    </section>
  );
}

export function RightPropertiesPanel({
  onFrameIds,
  onClose,
}: {
  onFrameIds: (ids: string[]) => void;
  onClose: () => void;
}) {
  return (
    <section
      className="gg-drawer gg-drawer--right"
      aria-label={copy.panelProperties}
    >
      <PanelHeader
        icon={<SlidersIcon size={15} strokeWidth={1.75} />}
        title={copy.panelProperties}
        onClose={onClose}
      />
      <PropertiesContent onFrameIds={onFrameIds} />
    </section>
  );
}

export function MobileBottomSheet({
  activeTab,
  onTabChange,
  onFrameIds,
  onOpenContextMenu,
  onClose,
}: {
  activeTab: "structure" | "properties" | null;
  onTabChange: (tab: "structure" | "properties") => void;
  onFrameIds: (ids: string[]) => void;
  onOpenContextMenu?: (state: ContextMenuState) => void;
  onClose: () => void;
}) {
  return (
    <Drawer.Root
      open={Boolean(activeTab)}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="gg-vaul-overlay" />
        <Drawer.Content className="gg-bottom-sheet">
          <Drawer.Title className="visually-hidden">
            {activeTab === "structure"
              ? copy.panelStructure
              : copy.panelProperties}
          </Drawer.Title>
          <div className="gg-vaul-handle-wrap">
            <Drawer.Handle className="gg-vaul-handle" />
          </div>
          <div className="gg-bottom-sheet__bar">
            <div className="gg-tabs" role="tablist" aria-label="Painéis do modelo">
              <button
                type="button"
                role="tab"
                className="gg-tab"
                aria-selected={activeTab === "structure"}
                onClick={() => onTabChange("structure")}
              >
                {copy.panelStructure}
              </button>
              <button
                type="button"
                role="tab"
                className="gg-tab"
                aria-selected={activeTab === "properties"}
                onClick={() => onTabChange("properties")}
              >
                {copy.panelProperties}
              </button>
            </div>
            <button
              type="button"
              className="gg-btn gg-btn--ghost gg-btn--icon-sm"
              aria-label={copy.panelClose}
              onClick={onClose}
            >
              <CloseIcon size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="gg-bottom-sheet__content">
            {activeTab === "structure" ? (
              <StructureContent onFrameIds={onFrameIds} onOpenContextMenu={onOpenContextMenu} />
            ) : (
              <PropertiesContent onFrameIds={onFrameIds} />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
