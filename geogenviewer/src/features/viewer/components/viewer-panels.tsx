"use client";

import { Drawer } from "vaul";
import { copy } from "../copy";
import { CloseIcon, CubeIcon, LayersIcon, SlidersIcon } from "./icons";

export interface SceneNodeSummary {
  key: string;
  name: string;
  elementId: string | null;
  hasMesh: boolean;
}

export interface SceneSummary {
  fileSizeBytes: number;
  nodeCount: number;
  meshCount: number;
  boundsMeters: [number, number, number];
  rootNodes: SceneNodeSummary[];
}

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

export function StructureContent({
  modelName,
  summary,
}: {
  modelName?: string;
  summary: SceneSummary | null;
}) {
  return (
    <div className="gg-panel__body">
      <div className="gg-field-disabled">
        <label htmlFor="gg-tree-search" className="visually-hidden">
          {copy.panelSearchPlaceholder}
        </label>
        <input
          id="gg-tree-search"
          type="search"
          className="gg-input"
          placeholder={copy.panelSearchPlaceholder}
          disabled
        />
      </div>

      {!modelName || !summary ? (
        <div className="gg-panel-note">
          <p>{copy.structureEmptyHint}</p>
        </div>
      ) : (
        <div className="gg-panel-section">
          <div className="gg-panel-section__head">
            <span>{copy.structureLoadedSummary}</span>
            <span className="gg-badge gg-badge--neutral gg-mono">
              {summary.rootNodes.length}
            </span>
          </div>
          <ul className="gg-node-list" aria-label="Nós raiz do GLB">
            {summary.rootNodes.map((node) => (
              <li key={node.key} className="gg-node-item">
                <CubeIcon size={14} strokeWidth={1.75} className="gg-node-item__icon" />
                <span className="gg-node-item__name" title={node.name}>
                  {node.name}
                </span>
                {node.elementId && (
                  <span className="gg-node-item__id gg-mono">
                    {node.elementId}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="gg-roadmap-card">
        <div className="gg-roadmap-card__head">
          <LayersIcon size={14} strokeWidth={1.75} />
          <span>{copy.structureFutureTitle}</span>
          <span className="gg-badge gg-badge--accent">v0.2</span>
        </div>
        <p>{copy.structureFutureNote}</p>
      </div>
    </div>
  );
}

export function PropertiesContent({
  modelName,
  summary,
}: {
  modelName?: string;
  summary: SceneSummary | null;
}) {
  if (!modelName || !summary) {
    return (
      <div className="gg-panel__body">
        <div className="gg-panel-note">
          <p>{copy.propertiesEmptyHint}</p>
        </div>
        <div className="gg-roadmap-card">
          <div className="gg-roadmap-card__head">
            <SlidersIcon size={14} strokeWidth={1.75} />
            <span>{copy.propertiesSelectionSection}</span>
            <span className="gg-badge gg-badge--accent">v0.4</span>
          </div>
          <p>{copy.propertiesFutureNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gg-panel__body">
      <section className="gg-panel-section" aria-labelledby="prop-scene-head">
        <h2 id="prop-scene-head" className="gg-panel-section__title gg-section-index">
          {copy.propertiesSceneSection}
        </h2>
        <dl className="gg-kv-list">
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propFile}</dt>
            <dd className="gg-kv-value-wrap">{modelName}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMode}</dt>
            <dd>
              <span className="gg-badge gg-badge--neutral">{copy.modeBasic}</span>
            </dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propSize}</dt>
            <dd className="gg-mono gg-tabular">
              {formatBytes(summary.fileSizeBytes)}
            </dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propNodes}</dt>
            <dd className="gg-mono gg-tabular">{summary.nodeCount}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMeshes}</dt>
            <dd className="gg-mono gg-tabular">{summary.meshCount}</dd>
          </div>
          <div className="gg-kv-row gg-kv-row--stacked">
            <dt>{copy.propBounds}</dt>
            <dd className="gg-mono gg-tabular">
              {formatMillimeters(summary.boundsMeters[0])} ×{" "}
              {formatMillimeters(summary.boundsMeters[1])} ×{" "}
              {formatMillimeters(summary.boundsMeters[2])}
            </dd>
          </div>
        </dl>
        <p className="gg-helper-note">{copy.propBoundsNote}</p>
      </section>

      <section
        className="gg-panel-section gg-panel-section--muted"
        aria-labelledby="prop-selection-head"
      >
        <div className="gg-panel-section__head">
          <h2 id="prop-selection-head" className="gg-panel-section__title">
            {copy.propertiesSelectionSection}
          </h2>
          <span className="gg-badge gg-badge--accent">v0.2 · v0.4</span>
        </div>
        <dl className="gg-kv-list gg-kv-list--disabled">
          <div className="gg-kv-row">
            <dt>{copy.propId}</dt>
            <dd>{copy.propNotAvailable}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propLayer}</dt>
            <dd>{copy.propNotAvailable}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propMaterial}</dt>
            <dd>{copy.propNotAvailable}</dd>
          </div>
          <div className="gg-kv-row">
            <dt>{copy.propDimensions}</dt>
            <dd>{copy.propNotAvailable}</dd>
          </div>
        </dl>
        <p className="gg-helper-note">{copy.propertiesFutureNote}</p>
      </section>
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
  modelName,
  summary,
  onClose,
}: {
  modelName?: string;
  summary: SceneSummary | null;
  onClose: () => void;
}) {
  return (
    <section className="gg-drawer gg-drawer--left" aria-label={copy.panelStructure}>
      <PanelHeader
        icon={<LayersIcon size={15} strokeWidth={1.75} />}
        title={copy.panelStructure}
        badge="v0.2"
        onClose={onClose}
      />
      <StructureContent modelName={modelName} summary={summary} />
    </section>
  );
}

export function RightPropertiesPanel({
  modelName,
  summary,
  onClose,
}: {
  modelName?: string;
  summary: SceneSummary | null;
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
        badge="v0.4"
        onClose={onClose}
      />
      <PropertiesContent modelName={modelName} summary={summary} />
    </section>
  );
}

export function MobileBottomSheet({
  activeTab,
  modelName,
  summary,
  onTabChange,
  onClose,
}: {
  activeTab: "structure" | "properties" | null;
  modelName?: string;
  summary: SceneSummary | null;
  onTabChange: (tab: "structure" | "properties") => void;
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
              <StructureContent modelName={modelName} summary={summary} />
            ) : (
              <PropertiesContent modelName={modelName} summary={summary} />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
