"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import { useOrganizationStore } from "../state/organization-store";
import { useViewerStore } from "../state/viewer-store";
import { copy } from "../copy";
import {
  ClearSelectionIcon,
  CopyIcon,
  EyeOffIcon,
  FitViewIcon,
  FolderPlusIcon,
  GroupIcon,
  IsolateIcon,
  LayersIcon,
  PlusIcon,
} from "./icons";

export interface ContextMenuState {
  x: number;
  y: number;
  targetIds: string[];
  label: string;
}

export function ViewerContextMenu(props: {
  state: ContextMenuState | null;
  sceneGraph: ViewerSceneGraph | null;
  onClose: () => void;
  onFrameIds: (ids: string[]) => void;
  onNotify?: (message: string) => void;
}) {
  if (!props.state || !props.sceneGraph) return null;
  return (
    <ViewerContextMenuBody
      key={`${props.state.x}:${props.state.y}:${props.state.targetIds.join(",")}`}
      state={props.state}
      sceneGraph={props.sceneGraph}
      onClose={props.onClose}
      onFrameIds={props.onFrameIds}
      onNotify={props.onNotify}
    />
  );
}

function ViewerContextMenuBody({
  state,
  onClose,
  onFrameIds,
  onNotify,
}: {
  state: ContextMenuState;
  sceneGraph: ViewerSceneGraph;
  onClose: () => void;
  onFrameIds: (ids: string[]) => void;
  onNotify?: (message: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [creatingLayer, setCreatingLayer] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newName, setNewName] = useState("");

  const orgDoc = useOrganizationStore((s) => s.doc);
  const createLayer = useOrganizationStore((s) => s.createLayer);
  const assignOccurrencesToLayer = useOrganizationStore((s) => s.assignOccurrencesToLayer);
  const createGroup = useOrganizationStore((s) => s.createGroup);
  const addOccurrencesToGroup = useOrganizationStore((s) => s.addOccurrencesToGroup);
  const removeOccurrencesFromGroup = useOrganizationStore((s) => s.removeOccurrencesFromGroup);

  const hideIds = useViewerStore((s) => s.hideIds);
  const isolateIds = useViewerStore((s) => s.isolateIds);
  const showAll = useViewerStore((s) => s.showAll);
  const clearSelection = useViewerStore((s) => s.clearSelection);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const ids = state.targetIds;
  const hasTargets = ids.length > 0;
  const maxLeft = typeof window !== "undefined" ? Math.max(8, window.innerWidth - 264) : state.x;
  const maxTop = typeof window !== "undefined" ? Math.max(8, window.innerHeight - 360) : state.y;
  const left = Math.min(Math.max(8, state.x), maxLeft);
  const top = Math.min(Math.max(8, state.y), maxTop);

  const singleAssignedLayer =
    ids.length === 1 ? orgDoc.componentLayerAssignments[ids[0]] ?? null : null;

  function submitNewLayer() {
    const trimmed = newName.trim();
    if (!trimmed || !hasTargets) return;
    createLayer({ name: trimmed });
    const latest = useOrganizationStore.getState().doc;
    const created = latest.userLayers[latest.userLayers.length - 1];
    if (created) {
      assignOccurrencesToLayer(ids, created.id);
      onNotify?.(`Camada "${created.name}" criada com ${ids.length} item(ns).`);
    }
    onClose();
  }

  function submitNewGroup() {
    const trimmed = newName.trim();
    if (!trimmed || !hasTargets) return;
    createGroup({ name: trimmed, memberIds: ids });
    onNotify?.(`Grupo "${trimmed}" criado com ${ids.length} item(ns).`);
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="gg-context-menu"
      role="menu"
      aria-label="Menu de ações do componente"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="gg-context-menu__header">
        <strong>{state.label}</strong>
        {ids.length > 1 && <span className="gg-badge gg-badge--accent gg-mono">{ids.length}</span>}
      </div>

      {hasTargets ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              onFrameIds(ids);
              onClose();
            }}
          >
            <FitViewIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.fit}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              isolateIds(ids);
              onClose();
            }}
          >
            <IsolateIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.isolateSelected}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              hideIds(ids);
              onClose();
            }}
          >
            <EyeOffIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.hideSelected}</span>
          </button>

          <div className="gg-context-menu__sep" role="separator" />
          <div className="gg-context-menu__section">
            <LayersIcon size={12} strokeWidth={1.75} aria-hidden="true" />
            <span>Camada do usuário (única)</span>
          </div>

          {orgDoc.userLayers.slice(0, 8).map((layer) => {
            const active = singleAssignedLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="gg-context-menu__item"
                onClick={() => {
                  assignOccurrencesToLayer(ids, layer.id);
                  onNotify?.(`Atribuído à camada "${layer.name}".`);
                  onClose();
                }}
              >
                <span
                  className="gg-swatch"
                  style={{ backgroundColor: layer.color }}
                  aria-hidden="true"
                />
                <span className="gg-context-menu__grow">{layer.name}</span>
                {active && <span className="gg-badge gg-badge--accent">Ativa</span>}
              </button>
            );
          })}

          {ids.some((id) => Boolean(orgDoc.componentLayerAssignments[id])) && (
            <button
              type="button"
              role="menuitem"
              className="gg-context-menu__item"
              onClick={() => {
                assignOccurrencesToLayer(ids, null);
                onNotify?.("Removido da camada do usuário.");
                onClose();
              }}
            >
              <ClearSelectionIcon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Remover da camada do usuário</span>
            </button>
          )}

          {creatingLayer ? (
            <form
              className="gg-context-menu__form"
              onSubmit={(event) => {
                event.preventDefault();
                submitNewLayer();
              }}
            >
              <input
                type="text"
                className="gg-input"
                placeholder="Nome da camada…"
                value={newName}
                maxLength={80}
                autoFocus
                onChange={(event) => setNewName(event.currentTarget.value)}
              />
              <button type="submit" className="gg-btn gg-btn--primary gg-btn--xs" disabled={!newName.trim()}>
                Criar
              </button>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="gg-context-menu__item"
              onClick={() => {
                setCreatingGroup(false);
                setCreatingLayer(true);
                setNewName("");
              }}
            >
              <FolderPlusIcon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Nova camada com seleção…</span>
            </button>
          )}

          <div className="gg-context-menu__sep" role="separator" />
          <div className="gg-context-menu__section">
            <GroupIcon size={12} strokeWidth={1.75} aria-hidden="true" />
            <span>Grupos do usuário (múltiplos)</span>
          </div>

          {orgDoc.userGroups.slice(0, 8).map((group) => {
            const memberSet = new Set(group.memberIds);
            const allIn = ids.every((id) => memberSet.has(id));
            return (
              <button
                key={group.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={allIn}
                className="gg-context-menu__item"
                onClick={() => {
                  if (allIn) {
                    removeOccurrencesFromGroup(group.id, ids);
                    onNotify?.(`Removido do grupo "${group.name}".`);
                  } else {
                    addOccurrencesToGroup(group.id, ids);
                    onNotify?.(`Adicionado ao grupo "${group.name}".`);
                  }
                  onClose();
                }}
              >
                <span
                  className="gg-swatch"
                  style={{ backgroundColor: group.color }}
                  aria-hidden="true"
                />
                <span className="gg-context-menu__grow">{group.name}</span>
                {allIn && <span className="gg-badge gg-badge--accent">✓</span>}
              </button>
            );
          })}

          {creatingGroup ? (
            <form
              className="gg-context-menu__form"
              onSubmit={(event) => {
                event.preventDefault();
                submitNewGroup();
              }}
            >
              <input
                type="text"
                className="gg-input"
                placeholder="Nome do grupo…"
                value={newName}
                maxLength={80}
                autoFocus
                onChange={(event) => setNewName(event.currentTarget.value)}
              />
              <button type="submit" className="gg-btn gg-btn--primary gg-btn--xs" disabled={!newName.trim()}>
                Criar
              </button>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="gg-context-menu__item"
              onClick={() => {
                setCreatingLayer(false);
                setCreatingGroup(true);
                setNewName("");
              }}
            >
              <PlusIcon size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Novo grupo com seleção…</span>
            </button>
          )}

          {ids.length === 1 && (
            <>
              <div className="gg-context-menu__sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="gg-context-menu__item"
                onClick={() => {
                  void navigator.clipboard?.writeText(ids[0]).catch(() => undefined);
                  onNotify?.(`ID copiado: ${ids[0]}`);
                  onClose();
                }}
              >
                <CopyIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                <span>Copiar ID</span>
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              onFrameIds([]);
              onClose();
            }}
          >
            <FitViewIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Enquadrar tudo</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              showAll();
              onClose();
            }}
          >
            <LayersIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.showAll}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gg-context-menu__item"
            onClick={() => {
              clearSelection();
              onClose();
            }}
          >
            <ClearSelectionIcon size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{copy.clearSelection}</span>
          </button>
        </>
      )}
    </div>
  );
}
