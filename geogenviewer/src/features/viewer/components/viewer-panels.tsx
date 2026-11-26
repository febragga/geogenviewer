"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import {
  computeVisibilityState,
  type ComponentRecord,
  type ViewerSceneGraph,
} from "../../../lib/geogen/domain/model";
import { copy } from "../copy";
import { useViewerStore, type TreeTab } from "../state/viewer-store";
import { buildTreeRows, type TreeRowItem } from "../tree/build-rows";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClearSelectionIcon,
  CloseIcon,
  CompositeIcon,
  CubeIcon,
  EyeIcon,
  EyeOffIcon,
  FitViewIcon,
  GroupIcon,
  HierarchyIcon,
  IsolateIcon,
  LayersIcon,
  PartialEyeIcon,
  SearchIcon,
  SlidersIcon,
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
}: {
  onFrameIds: (ids: string[]) => void;
}) {
  const searchInputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(420);

  const sceneGraph = useViewerStore((s) => s.sceneGraph);
  const selectedIds = useViewerStore((s) => s.selectedIds);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const isolatedIds = useViewerStore((s) => s.isolatedIds);
  const expandedIds = useViewerStore((s) => s.expandedIds);
  const treeTab = useViewerStore((s) => s.treeTab);
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const multiSelectMode = useViewerStore((s) => s.multiSelectMode);

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

  const rows = useMemo(
    () => buildTreeRows(sceneGraph, treeTab, searchQuery, expandedIds),
    [expandedIds, sceneGraph, searchQuery, treeTab]
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

  function renderRow(row: TreeRowItem) {
    const vis = computeVisibilityState(
      row.targetComponentIds,
      hiddenSet,
      isolatedSet
    );
    const isRowSelected =
      row.kind === "component"
        ? selectedSet.has(row.id)
        : row.targetComponentIds.length > 0 &&
          row.targetComponentIds.every((id) => selectedSet.has(id));
    const isRowHovered = row.kind === "component" && hoveredId === row.id;

    const visLabel =
      vis === "visible"
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
        } ${vis === "hidden" ? "gg-tree-row--hidden" : ""}`}
        style={{ paddingLeft: `${8 + row.depth * 14}px` }}
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
            <span className="gg-tree-id gg-mono">{row.secondaryLabel}</span>
          )}
        </button>

        <div className="gg-tree-row__actions">
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
              vis === "hidden" ? true : vis === "partial" ? "mixed" : false
            }
            disabled={row.targetComponentIds.length === 0}
            onClick={() => {
              if (row.kind === "component") {
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
                      ? copy.treeEmptyLayers
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
            <dd className="gg-kv-value-wrap">{comp.name}</dd>
          </div>
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
            <dt>{copy.propLayer}</dt>
            <dd>{layer ? layer.fullPath : copy.propNotInformed}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propGroup}</dt>
            <dd>{groupNames.length > 0 ? groupNames.join(", ") : copy.propNotInformed}</dd>
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

      <section className="gg-panel-section gg-panel-section--muted" aria-labelledby="prop-mesh-head">
        <div className="gg-panel-section__head">
          <h2 id="prop-mesh-head" className="gg-panel-section__title">
            {copy.propertiesMeshSection}
          </h2>
          <ProvenanceBadge source="mesh" />
        </div>
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
      </section>

      {hasCadMetrics && cad && (
        <section className="gg-panel-section gg-panel-section--muted" aria-labelledby="prop-cad-head">
          <div className="gg-panel-section__head">
            <h2 id="prop-cad-head" className="gg-panel-section__title">
              {copy.propertiesCadSection}
            </h2>
            <ProvenanceBadge source="cad" />
          </div>
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
        </section>
      )}

      {(userTextEntries.length > 0 || extraPropsEntries.length > 0) && (
        <section className="gg-panel-section gg-panel-section--muted" aria-labelledby="prop-ut-head">
          <div className="gg-panel-section__head">
            <h2 id="prop-ut-head" className="gg-panel-section__title">
              {copy.propertiesUserTextSection}
            </h2>
            <ProvenanceBadge source="manifest" />
          </div>
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
        </section>
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
  const select = useViewerStore((s) => s.select);
  const clearSelection = useViewerStore((s) => s.clearSelection);
  const hideIds = useViewerStore((s) => s.hideIds);
  const isolateIds = useViewerStore((s) => s.isolateIds);

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
              <dt>{copy.propMeshes}</dt>
              <dd className="gg-mono gg-tabular">{sumMeshes}</dd>
            </div>
            <div className="gg-kv-row">
              <dt>{copy.propVerticesTriangles}</dt>
              <dd className="gg-mono gg-tabular">{formatNumber(sumTriangles, 0)} tri.</dd>
            </div>
          </dl>
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
            <dt>{copy.propBounds}</dt>
            <dd className="gg-mono gg-tabular">
              {formatBoundsMm(sceneGraph.sceneBoundsMeters)} (
              {formatVectorMeters(sceneGraph.sceneBoundsMeters)})
            </dd>
          </div>
        </dl>
        <p className="gg-helper-note">{copy.propBoundsNote}</p>
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
  badge,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  onClose: () => void;
}) {
  return (
    <div className="gg-panel__header">
      <div className="gg-panel__title-group">
        {icon}
        <span>{title}</span>
        <span className="gg-badge gg-badge--accent gg-mono">{badge}</span>
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
  onClose,
}: {
  onFrameIds: (ids: string[]) => void;
  onClose: () => void;
}) {
  return (
    <section className="gg-drawer gg-drawer--left" aria-label={copy.panelStructure}>
      <PanelHeader
        icon={<HierarchyIcon size={15} strokeWidth={1.75} />}
        title={copy.panelStructure}
        badge="v0.2"
        onClose={onClose}
      />
      <StructureContent onFrameIds={onFrameIds} />
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
        badge="v0.3"
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
  onClose,
}: {
  activeTab: "structure" | "properties" | null;
  onTabChange: (tab: "structure" | "properties") => void;
  onFrameIds: (ids: string[]) => void;
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
              <StructureContent onFrameIds={onFrameIds} />
            ) : (
              <PropertiesContent onFrameIds={onFrameIds} />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
