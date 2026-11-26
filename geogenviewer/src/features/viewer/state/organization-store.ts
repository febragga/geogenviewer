"use client";

import { create } from "zustand";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import {
  checkOrganizationCompatibility,
  OrganizationValidationError,
  organizationMaxBytes,
  parseAndValidateOrganization,
  serializeOrganization,
  type OrganizationCompatibilityResult,
} from "../../../lib/geogen/organization/document.ts";
import {
  createEmptyOrganization,
  type DeleteLayerStrategy,
  type OrganizationBinding,
  type OrganizationSource,
  type UserOrganizationDocument,
} from "../../../lib/geogen/organization/model.ts";
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
} from "../../../lib/geogen/organization/operations.ts";

const STORAGE_PREFIX = "geogen:v091:org:";
const MAX_HISTORY = 50;
const storageFailure = "O armazenamento local está indisponível. Exporte a organização para guardar as alterações.";

function storageKey(binding: OrganizationBinding): string | null {
  if (!binding.modelSha256 && !(binding.projectId && binding.revisionId)) return null;
  return STORAGE_PREFIX + JSON.stringify([binding.projectId, binding.revisionId, binding.modelSha256?.toLowerCase() ?? null]);
}

function readPersistedOrganization(graph: ViewerSceneGraph, binding: OrganizationBinding) {
  const key = storageKey(binding);
  if (!key || typeof window === "undefined") return { doc: null, notice: null };
  try {
    const store = window.localStorage;
    const legacy = binding.modelSha256 && "geogen:v09:org:" + binding.modelSha256;
    const raw = store.getItem(key) ?? (legacy ? store.getItem(legacy) : null);
    if (!raw) return { doc: null, notice: null };
    const result = checkOrganizationCompatibility(parseAndValidateOrganization(raw), graph, binding);
    return {
      doc: result.status === "mismatch" ? null : result.sanitized,
      notice: result.warnings[0] ?? null,
    };
  } catch (error) {
    return { doc: null, notice: error instanceof OrganizationValidationError ? error.message : storageFailure };
  }
}

function writePersistedOrganization(
  binding: OrganizationBinding | null,
  doc: UserOrganizationDocument
): string | null {
  if (typeof window === "undefined" || !binding) return null;
  const key = storageKey(binding);
  if (!key) return storageFailure;
  try {
    const raw = serializeOrganization(doc);
    if (raw.length > organizationMaxBytes) return storageFailure;
    window.localStorage.setItem(key, raw);
    return null;
  } catch {
    return storageFailure;
  }
}

interface OrganizationState {
  binding: OrganizationBinding | null;
  doc: UserOrganizationDocument;
  past: UserOrganizationDocument[];
  future: UserOrganizationDocument[];
  lastImportNotice: string | null;
  persistenceNotice: string | null;

  initializeForRevision: (sceneGraph: ViewerSceneGraph | null, binding: OrganizationBinding | null) => void;
  setActiveSource: (source: OrganizationSource) => void;
  copyFromImported: (sceneGraph: ViewerSceneGraph) => void;

  createLayer: (input: { name: string; color?: string; parentId?: string | null; memberIds?: readonly string[] }) => boolean;
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
    const persistenceNotice = writePersistedOrganization(binding, next);
    set({
      doc: next,
      persistenceNotice,
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
    persistenceNotice: null,

    initializeForRevision(sceneGraph, binding) {
      if (!sceneGraph || !binding) {
        set({
          binding: null,
          doc: createEmptyOrganization(),
          past: [],
          future: [],
          lastImportNotice: null,
          persistenceNotice: null,
        });
        return;
      }
      const persisted = readPersistedOrganization(sceneGraph, binding);
      const empty = createEmptyOrganization(binding);
      // GLB-only models start directly ready for user layers when no CAD layers exist
      const hasCadHierarchy =
        sceneGraph.mode === "manifest-full" &&
        (Object.keys(sceneGraph.layers).length > 0 || Object.keys(sceneGraph.groups).length > 0);
      set({
        binding,
        doc: persisted.doc ?? { ...empty, activeSource: hasCadHierarchy ? "cad" : "user" },
        past: [],
        future: [],
        lastImportNotice: persisted.notice,
        persistenceNotice: null,
      });
    },

    setActiveSource(source) {
      commit((doc) => setOrganizationSource(doc, source));
    },

    copyFromImported(sceneGraph) {
      commit((doc) => {
        const copied = copyImportedStructureToUser(doc, sceneGraph);
        return parseAndValidateOrganization(serializeOrganization(copied));
      });
    },

    createLayer(input) {
      let created = false;
      commit((doc) => {
        const next = createUserLayer(doc, input);
        if (next === doc) return doc;
        created = true;
        const id = next.userLayers.at(-1)!.id;
        return input.memberIds?.length ? assignOccurrencesToUserLayer(next, input.memberIds, id) : next;
      });
      return created;
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
      const persistenceNotice = writePersistedOrganization(binding, previous);
      set({
        doc: previous,
        persistenceNotice,
        past: past.slice(0, -1),
        future: [doc, ...future].slice(0, MAX_HISTORY),
      });
    },

    redo() {
      const { past, doc, future, binding } = get();
      if (future.length === 0) return;
      const next = future[0];
      const persistenceNotice = writePersistedOrganization(binding, next);
      set({
        doc: next,
        persistenceNotice,
        past: [...past, doc].slice(-MAX_HISTORY),
        future: future.slice(1),
      });
    },

    exportJson() {
      return serializeOrganization(get().doc);
    },

    importJson(rawJson, sceneGraph) {
      const { binding } = get();
      if (!binding) throw new Error("Abra um modelo antes de importar uma organização.");
      const parsed = parseAndValidateOrganization(rawJson);
      const result = checkOrganizationCompatibility(parsed, sceneGraph, binding);
      if (result.status !== "mismatch") commit(() => ({ ...result.sanitized, activeSource: "user" }));
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
