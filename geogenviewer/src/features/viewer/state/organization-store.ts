"use client";

import { create } from "zustand";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import {
  checkOrganizationCompatibility,
  parseAndValidateOrganization,
  serializeOrganization,
  type OrganizationCompatibilityResult,
} from "../../../lib/geogen/organization/document";
import {
  createEmptyOrganization,
  type DeleteLayerStrategy,
  type OrganizationBinding,
  type OrganizationSource,
  type UserOrganizationDocument,
} from "../../../lib/geogen/organization/model";
import {
  addOccurrencesToUserGroup,
  assignOccurrencesToUserLayer,
  copyImportedStructureToUser,
  createUserGroup,
  createUserLayer,
  deleteUserGroup,
  deleteUserLayer,
  moveUserGroup,
  moveUserLayer,
  removeOccurrencesFromUserGroup,
  renameUserGroup,
  renameUserLayer,
  recolorUserGroup,
  recolorUserLayer,
  reorderUserLayer,
  setOrganizationSource,
  toggleUserLayerVisibility,
} from "../../../lib/geogen/organization/operations";

const STORAGE_PREFIX = "geogen:v09:org:";
const MAX_HISTORY = 50;

function storageKey(binding: OrganizationBinding): string {
  const token = binding.modelSha256 || binding.revisionId || binding.projectId || binding.key;
  return `${STORAGE_PREFIX}${token}`;
}

function readPersistedOrganization(binding: OrganizationBinding): UserOrganizationDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(binding));
    if (!raw) return null;
    return parseAndValidateOrganization(raw);
  } catch {
    return null;
  }
}

function writePersistedOrganization(
  binding: OrganizationBinding | null,
  doc: UserOrganizationDocument
): void {
  if (typeof window === "undefined" || !binding) return;
  try {
    window.localStorage.setItem(storageKey(binding), serializeOrganization(doc));
  } catch {
    /* ignore storage quota failures safely */
  }
}

interface OrganizationState {
  binding: OrganizationBinding | null;
  doc: UserOrganizationDocument;
  past: UserOrganizationDocument[];
  future: UserOrganizationDocument[];
  lastImportNotice: string | null;

  initializeForRevision: (sceneGraph: ViewerSceneGraph | null, binding: OrganizationBinding | null) => void;
  setActiveSource: (source: OrganizationSource) => void;
  copyFromImported: (sceneGraph: ViewerSceneGraph) => void;

  createLayer: (input: { name: string; color?: string; parentId?: string | null }) => void;
  renameLayer: (layerId: string, name: string) => void;
  recolorLayer: (layerId: string, color: string) => void;
  toggleLayerVisibility: (layerId: string, visible?: boolean) => void;
  moveLayer: (layerId: string, newParentId: string | null) => void;
  reorderLayer: (layerId: string, direction: -1 | 1) => void;
  deleteLayer: (layerId: string, strategy: DeleteLayerStrategy) => void;
  assignOccurrencesToLayer: (occurrenceIds: readonly string[], layerId: string | null) => void;

  createGroup: (input: { name: string; color?: string; parentId?: string | null; memberIds?: readonly string[] }) => void;
  renameGroup: (groupId: string, name: string) => void;
  recolorGroup: (groupId: string, color: string) => void;
  moveGroup: (groupId: string, newParentId: string | null) => void;
  deleteGroup: (groupId: string) => void;
  addOccurrencesToGroup: (groupId: string, occurrenceIds: readonly string[]) => void;
  removeOccurrencesFromGroup: (groupId: string, occurrenceIds: readonly string[]) => void;

  undo: () => void;
  redo: () => void;
  exportJson: () => string;
  importJson: (
    rawJson: string,
    sceneGraph: ViewerSceneGraph
  ) => OrganizationCompatibilityResult;
  clearOrganization: () => void;
  clearImportNotice: () => void;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => {
  function commit(mutator: (doc: UserOrganizationDocument) => UserOrganizationDocument) {
    const { doc, past, binding } = get();
    const next = mutator(doc);
    if (next === doc) return;
    const nextPast = [...past, doc].slice(-MAX_HISTORY);
    writePersistedOrganization(binding, next);
    set({
      doc: next,
      past: nextPast,
      future: [],
    });
  }

  return {
    binding: null,
    doc: createEmptyOrganization(),
    past: [],
    future: [],
    lastImportNotice: null,

    initializeForRevision(sceneGraph, binding) {
      if (!sceneGraph || !binding) {
        set({
          binding: null,
          doc: createEmptyOrganization(),
          past: [],
          future: [],
          lastImportNotice: null,
        });
        return;
      }
      const persisted = readPersistedOrganization(binding);
      if (persisted) {
        const checked = checkOrganizationCompatibility(persisted, sceneGraph, binding);
        set({
          binding,
          doc: checked.sanitized,
          past: [],
          future: [],
          lastImportNotice: checked.warnings[0] ?? null,
        });
        return;
      }
      const empty = createEmptyOrganization(binding);
      // GLB-only models start directly ready for user layers when no CAD layers exist
      const hasCadHierarchy =
        sceneGraph.mode === "manifest-full" &&
        (Object.keys(sceneGraph.layers).length > 0 || Object.keys(sceneGraph.groups).length > 0);
      set({
        binding,
        doc: { ...empty, activeSource: hasCadHierarchy ? "cad" : "user" },
        past: [],
        future: [],
        lastImportNotice: null,
      });
    },

    setActiveSource(source) {
      commit((doc) => setOrganizationSource(doc, source));
    },

    copyFromImported(sceneGraph) {
      commit((doc) => copyImportedStructureToUser(doc, sceneGraph));
    },

    createLayer(input) {
      commit((doc) => createUserLayer(doc, input));
    },

    renameLayer(layerId, name) {
      commit((doc) => renameUserLayer(doc, layerId, name));
    },

    recolorLayer(layerId, color) {
      commit((doc) => recolorUserLayer(doc, layerId, color));
    },

    toggleLayerVisibility(layerId, visible) {
      commit((doc) => toggleUserLayerVisibility(doc, layerId, visible));
    },

    moveLayer(layerId, newParentId) {
      commit((doc) => moveUserLayer(doc, layerId, newParentId));
    },

    reorderLayer(layerId, direction) {
      commit((doc) => reorderUserLayer(doc, layerId, direction));
    },

    deleteLayer(layerId, strategy) {
      commit((doc) => deleteUserLayer(doc, layerId, strategy));
    },

    assignOccurrencesToLayer(occurrenceIds, layerId) {
      commit((doc) => assignOccurrencesToUserLayer(doc, occurrenceIds, layerId));
    },

    createGroup(input) {
      commit((doc) => createUserGroup(doc, input));
    },

    renameGroup(groupId, name) {
      commit((doc) => renameUserGroup(doc, groupId, name));
    },

    recolorGroup(groupId, color) {
      commit((doc) => recolorUserGroup(doc, groupId, color));
    },

    moveGroup(groupId, newParentId) {
      commit((doc) => moveUserGroup(doc, groupId, newParentId));
    },

    deleteGroup(groupId) {
      commit((doc) => deleteUserGroup(doc, groupId));
    },

    addOccurrencesToGroup(groupId, occurrenceIds) {
      commit((doc) => addOccurrencesToUserGroup(doc, groupId, occurrenceIds));
    },

    removeOccurrencesFromGroup(groupId, occurrenceIds) {
      commit((doc) => removeOccurrencesFromUserGroup(doc, groupId, occurrenceIds));
    },

    undo() {
      const { past, doc, future, binding } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      writePersistedOrganization(binding, previous);
      set({
        doc: previous,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, MAX_HISTORY),
      });
    },

    redo() {
      const { past, doc, future, binding } = get();
      if (future.length === 0) return;
      const next = future[0];
      writePersistedOrganization(binding, next);
      set({
        doc: next,
        past: [...past, doc].slice(-MAX_HISTORY),
        future: future.slice(1),
      });
    },

    exportJson() {
      return serializeOrganization(get().doc);
    },

    importJson(rawJson, sceneGraph) {
      const binding = get().binding ?? {
        key: "session",
        projectId: sceneGraph.projectTitle,
        revisionId: sceneGraph.revisionId,
        modelSha256: null,
      };
      const parsed = parseAndValidateOrganization(rawJson);
      const result = checkOrganizationCompatibility(parsed, sceneGraph, binding);
      commit(() => ({ ...result.sanitized, activeSource: "user" }));
      set({ lastImportNotice: result.warnings[0] ?? null });
      return result;
    },

    clearOrganization() {
      const { binding } = get();
      commit(() => createEmptyOrganization(binding ?? undefined));
    },

    clearImportNotice() {
      set({ lastImportNotice: null });
    },
  };
});
