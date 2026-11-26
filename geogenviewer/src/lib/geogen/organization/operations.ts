import type { ViewerSceneGraph } from "../domain/model.ts";
import {
  MAX_ORGANIZATION_DEPTH,
  MAX_ORGANIZATION_ENTRIES,
  normalizeHexColor,
  toCadGroupRecord,
  toCadLayerRecord,
  type DeleteLayerStrategy,
  type OrganizationSource,
  type ResolvedGroupView,
  type ResolvedLayerView,
  type ResolvedOrganizationView,
  type UserGroupRecord,
  type UserLayerRecord,
  type UserOrganizationDocument,
} from "./model.ts";

function stamp(doc: UserOrganizationDocument): UserOrganizationDocument {
  return {
    ...doc,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeLabel(name: string, fallback: string): string {
  const clean = name.replace(/[\u0000-\u001f<>]/gu, "").trim().slice(0, 120);
  return clean || fallback;
}

function uniqueId(prefix: string, existingIds: Set<string>): string {
  let id: string;
  do {
    const token = globalThis.crypto.randomUUID?.() ??
      Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    id = prefix + "-" + token;
  } while (existingIds.has(id));
  return id;
}

export function wouldCreateCycle<T extends { id: string; parentId: string | null }>(
  nodes: readonly T[],
  nodeId: string,
  candidateParentId: string | null
): boolean {
  if (candidateParentId === null) return false;
  if (candidateParentId === nodeId) return true;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!byId.has(candidateParentId)) return true;

  let current: string | null = candidateParentId;
  let depth = 0;
  while (current !== null) {
    if (current === nodeId) return true;
    depth += 1;
    if (depth > MAX_ORGANIZATION_DEPTH) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  // A moved subtree keeps its existing height under the new parent.
  let subtreeDepth = 1;
  for (const id of subtreeIds(nodes, nodeId)) {
    let itemDepth = 1;
    for (let parent = byId.get(id)?.parentId; parent && id !== nodeId; parent = byId.get(parent)?.parentId) {
      itemDepth += 1;
      if (parent === nodeId || depth + itemDepth > MAX_ORGANIZATION_DEPTH) break;
    }
    subtreeDepth = Math.max(subtreeDepth, itemDepth);
  }
  return depth + subtreeDepth > MAX_ORGANIZATION_DEPTH;
}

export function subtreeIds<T extends { id: string; parentId: string | null }>(
  nodes: readonly T[],
  rootId: string
): string[] {
  const result: string[] = [];
  const childrenMap = new Map<string | null, string[]>();
  for (const node of nodes) {
    const list = childrenMap.get(node.parentId) ?? [];
    list.push(node.id);
    childrenMap.set(node.parentId, list);
  }
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    const children = childrenMap.get(id) ?? [];
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }
  return result;
}

function reindexOrders<T extends { parentId: string | null; order: number }>(items: T[]): T[] {
  const siblingCount = new Map<string | null, number>();
  return items.map((item) => {
    const idx = siblingCount.get(item.parentId) ?? 0;
    siblingCount.set(item.parentId, idx + 1);
    return { ...item, order: idx };
  });
}

export function setOrganizationSource(
  doc: UserOrganizationDocument,
  activeSource: OrganizationSource
): UserOrganizationDocument {
  if (doc.activeSource === activeSource) return doc;
  return stamp({ ...doc, activeSource });
}

export function createUserLayer(
  doc: UserOrganizationDocument,
  input: { name: string; color?: string; parentId?: string | null; visible?: boolean }
): UserOrganizationDocument {
  if (doc.userLayers.length >= MAX_ORGANIZATION_ENTRIES) return doc;
  const existingIds = new Set(doc.userLayers.map((l) => l.id));
  const id = uniqueId("ulayer", existingIds);
  const parentId =
    input.parentId && existingIds.has(input.parentId) ? input.parentId : null;

  if (parentId !== null) {
    let depth = 1;
    let cur: string | null = parentId;
    const byId = new Map(doc.userLayers.map((l) => [l.id, l]));
    while (cur) {
      depth += 1;
      if (depth > MAX_ORGANIZATION_DEPTH) {
        return doc;
      }
      cur = byId.get(cur)?.parentId ?? null;
    }
  }

  const order = doc.userLayers.filter((l) => l.parentId === parentId).length;
  const layer: UserLayerRecord = {
    id,
    name: sanitizeLabel(input.name, `Camada ${doc.userLayers.length + 1}`),
    color: normalizeHexColor(input.color, doc.userLayers.length),
    parentId,
    order,
    visible: input.visible ?? true,
  };
  return stamp({
    ...doc,
    activeSource: "user",
    userLayers: [...doc.userLayers, layer],
  });
}

export function renameUserLayer(
  doc: UserOrganizationDocument,
  layerId: string,
  name: string
): UserOrganizationDocument {
  const existing = doc.userLayers.find((l) => l.id === layerId);
  if (!existing) return doc;
  const clean = sanitizeLabel(name, existing.name);
  if (clean === existing.name) return doc;
  return stamp({
    ...doc,
    userLayers: doc.userLayers.map((l) => (l.id === layerId ? { ...l, name: clean } : l)),
  });
}

export function recolorUserLayer(
  doc: UserOrganizationDocument,
  layerId: string,
  color: string
): UserOrganizationDocument {
  const existing = doc.userLayers.find((l) => l.id === layerId);
  if (!existing) return doc;
  const next = normalizeHexColor(color);
  if (next === existing.color) return doc;
  return stamp({
    ...doc,
    userLayers: doc.userLayers.map((l) => (l.id === layerId ? { ...l, color: next } : l)),
  });
}

export function toggleUserLayerVisibility(
  doc: UserOrganizationDocument,
  layerId: string,
  visible?: boolean
): UserOrganizationDocument {
  const existing = doc.userLayers.find((l) => l.id === layerId);
  if (!existing) return doc;
  const nextVisible = visible ?? !existing.visible;
  const hiddenSet = new Set(doc.hiddenLayerIds);
  if (nextVisible) hiddenSet.delete(layerId);
  else hiddenSet.add(layerId);
  return stamp({
    ...doc,
    userLayers: doc.userLayers.map((l) =>
      l.id === layerId ? { ...l, visible: nextVisible } : l
    ),
    hiddenLayerIds: [...hiddenSet],
  });
}

export function moveUserLayer(
  doc: UserOrganizationDocument,
  layerId: string,
  newParentId: string | null
): UserOrganizationDocument {
  const existing = doc.userLayers.find((l) => l.id === layerId);
  if (!existing) return doc;
  if (wouldCreateCycle(doc.userLayers, layerId, newParentId)) return doc;
  if (existing.parentId === newParentId) return doc;
  const updated = doc.userLayers.map((l) =>
    l.id === layerId ? { ...l, parentId: newParentId } : l
  );
  return stamp({
    ...doc,
    userLayers: reindexOrders(updated),
  });
}

export function reorderUserLayer(
  doc: UserOrganizationDocument,
  layerId: string,
  direction: -1 | 1
): UserOrganizationDocument {
  const target = doc.userLayers.find((l) => l.id === layerId);
  if (!target) return doc;
  const siblings = doc.userLayers
    .filter((l) => l.parentId === target.parentId)
    .sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((l) => l.id === layerId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return doc;
  const neighbor = siblings[swapIdx];
  const updated = doc.userLayers.map((l) => {
    if (l.id === target.id) return { ...l, order: neighbor.order };
    if (l.id === neighbor.id) return { ...l, order: target.order };
    return l;
  });
  return stamp({
    ...doc,
    userLayers: updated.sort((a, b) => a.order - b.order),
  });
}

export function deleteUserLayer(
  doc: UserOrganizationDocument,
  layerId: string,
  strategy: DeleteLayerStrategy
): UserOrganizationDocument {
  const target = doc.userLayers.find((l) => l.id === layerId);
  if (!target) return doc;

  const reparentTo = target.parentId;
  const nextLayers = reindexOrders(
    doc.userLayers
      .filter((l) => l.id !== layerId)
      .map((l) => (l.parentId === layerId ? { ...l, parentId: reparentTo } : l))
  );

  const nextAssignments: Record<string, string> = {};
  for (const [compId, assignedLayerId] of Object.entries(doc.componentLayerAssignments)) {
    if (assignedLayerId === layerId) {
      if (strategy === "move-to-parent" && reparentTo !== null) {
        nextAssignments[compId] = reparentTo;
      }
    } else {
      nextAssignments[compId] = assignedLayerId;
    }
  }

  return stamp({
    ...doc,
    userLayers: nextLayers,
    componentLayerAssignments: nextAssignments,
    hiddenLayerIds: doc.hiddenLayerIds.filter((id) => id !== layerId),
  });
}

export function assignOccurrencesToUserLayer(
  doc: UserOrganizationDocument,
  occurrenceIds: readonly string[],
  layerId: string | null
): UserOrganizationDocument {
  if (occurrenceIds.length === 0) return doc;
  const layerExists = layerId === null || doc.userLayers.some((l) => l.id === layerId);
  if (!layerExists) return doc;

  const nextAssignments = { ...doc.componentLayerAssignments };
  let changed = false;
  for (const occId of occurrenceIds) {
    if (!occId) continue;
    if (layerId === null) {
      if (occId in nextAssignments) {
        delete nextAssignments[occId];
        changed = true;
      }
    } else if (nextAssignments[occId] !== layerId) {
      nextAssignments[occId] = layerId;
      changed = true;
    }
  }
  if (!changed) return doc;
  return stamp({
    ...doc,
    activeSource: "user",
    componentLayerAssignments: nextAssignments,
  });
}

export function createUserGroup(
  doc: UserOrganizationDocument,
  input: {
    name: string;
    color?: string;
    parentId?: string | null;
    memberIds?: readonly string[];
  }
): UserOrganizationDocument {
  if (doc.userGroups.length >= MAX_ORGANIZATION_ENTRIES) return doc;
  const existingIds = new Set(doc.userGroups.map((g) => g.id));
  const id = uniqueId("ugroup", existingIds);
  const parentId =
    input.parentId && existingIds.has(input.parentId) ? input.parentId : null;
  if (wouldCreateCycle(doc.userGroups, id, parentId)) return doc;
  const order = doc.userGroups.filter((g) => g.parentId === parentId).length;
  const group: UserGroupRecord = {
    id,
    name: sanitizeLabel(input.name, `Grupo ${doc.userGroups.length + 1}`),
    color: normalizeHexColor(input.color, doc.userGroups.length + 2),
    parentId,
    order,
    memberIds: [...new Set((input.memberIds ?? []).filter(Boolean))],
  };
  return stamp({
    ...doc,
    activeSource: "user",
    userGroups: [...doc.userGroups, group],
  });
}

export function renameUserGroup(
  doc: UserOrganizationDocument,
  groupId: string,
  name: string
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing) return doc;
  const clean = sanitizeLabel(name, existing.name);
  if (clean === existing.name) return doc;
  return stamp({
    ...doc,
    userGroups: doc.userGroups.map((g) => (g.id === groupId ? { ...g, name: clean } : g)),
  });
}

export function recolorUserGroup(
  doc: UserOrganizationDocument,
  groupId: string,
  color: string
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing) return doc;
  const next = normalizeHexColor(color);
  if (next === existing.color) return doc;
  return stamp({
    ...doc,
    userGroups: doc.userGroups.map((g) => (g.id === groupId ? { ...g, color: next } : g)),
  });
}

export function moveUserGroup(
  doc: UserOrganizationDocument,
  groupId: string,
  newParentId: string | null
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing) return doc;
  if (wouldCreateCycle(doc.userGroups, groupId, newParentId)) return doc;
  if (existing.parentId === newParentId) return doc;
  return stamp({
    ...doc,
    userGroups: reindexOrders(
      doc.userGroups.map((g) => (g.id === groupId ? { ...g, parentId: newParentId } : g))
    ),
  });
}

export function deleteUserGroup(
  doc: UserOrganizationDocument,
  groupId: string
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing) return doc;
  const reparentTo = existing.parentId;
  return stamp({
    ...doc,
    userGroups: reindexOrders(
      doc.userGroups
        .filter((g) => g.id !== groupId)
        .map((g) => (g.parentId === groupId ? { ...g, parentId: reparentTo } : g))
    ),
  });
}

export function addOccurrencesToUserGroup(
  doc: UserOrganizationDocument,
  groupId: string,
  occurrenceIds: readonly string[]
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing || occurrenceIds.length === 0) return doc;
  const members = new Set(existing.memberIds);
  let changed = false;
  for (const id of occurrenceIds) {
    if (id && !members.has(id)) {
      members.add(id);
      changed = true;
    }
  }
  if (!changed) return doc;
  return stamp({
    ...doc,
    activeSource: "user",
    userGroups: doc.userGroups.map((g) =>
      g.id === groupId ? { ...g, memberIds: [...members] } : g
    ),
  });
}

export function removeOccurrencesFromUserGroup(
  doc: UserOrganizationDocument,
  groupId: string,
  occurrenceIds: readonly string[]
): UserOrganizationDocument {
  const existing = doc.userGroups.find((g) => g.id === groupId);
  if (!existing || occurrenceIds.length === 0) return doc;
  const toRemove = new Set(occurrenceIds);
  const nextMembers = existing.memberIds.filter((id) => !toRemove.has(id));
  if (nextMembers.length === existing.memberIds.length) return doc;
  return stamp({
    ...doc,
    userGroups: doc.userGroups.map((g) =>
      g.id === groupId ? { ...g, memberIds: nextMembers } : g
    ),
  });
}

/**
 * Clones the imported CAD layers, groups, and memberships into independent user records
 * without altering the source ViewerSceneGraph or CAD manifest.
 */
export function copyImportedStructureToUser(
  doc: UserOrganizationDocument,
  sceneGraph: ViewerSceneGraph
): UserOrganizationDocument {
  const occupiedIds = [...sceneGraph.componentOrder, ...Object.keys(sceneGraph.layers), ...Object.keys(sceneGraph.groups)];
  const existingLayerIds = new Set([...occupiedIds, ...doc.userLayers.map((l) => l.id)]);
  const layerIdMap = new Map<string, string>();
  const clonedLayers: UserLayerRecord[] = [];
  const cadLayerIds = Object.keys(sceneGraph.layers);

  for (const cadLayerId of cadLayerIds) {
    const newId = uniqueId("ulayer-cad", existingLayerIds);
    existingLayerIds.add(newId);
    layerIdMap.set(cadLayerId, newId);
  }

  for (const [idx, cadLayerId] of cadLayerIds.entries()) {
    const cadLayer = sceneGraph.layers[cadLayerId];
    if (!cadLayer) continue;
    clonedLayers.push({
      id: layerIdMap.get(cadLayerId)!,
      name: sanitizeLabel(cadLayer.name, cadLayer.id),
      color: normalizeHexColor(cadLayer.colorHex ?? undefined, idx),
      parentId: cadLayer.parentId ? (layerIdMap.get(cadLayer.parentId) ?? null) : null,
      order: idx,
      visible: cadLayer.defaultVisible,
    });
  }

  const existingGroupIds = new Set([...occupiedIds, ...doc.userGroups.map((g) => g.id), ...existingLayerIds]);
  const groupIdMap = new Map<string, string>();
  const cadGroupIds = Object.keys(sceneGraph.groups);
  for (const cadGroupId of cadGroupIds) {
    const newId = uniqueId("ugroup-cad", existingGroupIds);
    existingGroupIds.add(newId);
    groupIdMap.set(cadGroupId, newId);
  }
  const clonedGroups: UserGroupRecord[] = [];
  for (const [idx, cadGroupId] of cadGroupIds.entries()) {
    const cadGroup = sceneGraph.groups[cadGroupId];
    if (!cadGroup) continue;
    clonedGroups.push({
      id: groupIdMap.get(cadGroupId)!,
      name: sanitizeLabel(cadGroup.name, cadGroup.id),
      color: normalizeHexColor(undefined, idx + 2),
      parentId: cadGroup.parentId ? (groupIdMap.get(cadGroup.parentId) ?? null) : null,
      order: idx,
      memberIds: [...new Set(cadGroup.elementIds)],
    });
  }

  const nextAssignments: Record<string, string> = {};
  for (const compId of sceneGraph.componentOrder) {
    const comp = sceneGraph.components[compId];
    if (!comp?.layerId) continue;
    const mapped = layerIdMap.get(comp.layerId);
    if (mapped) nextAssignments[compId] = mapped;
  }

  return stamp({
    ...doc,
    activeSource: "user",
    userLayers: clonedLayers,
    userGroups: clonedGroups,
    componentLayerAssignments: nextAssignments,
    hiddenLayerIds: clonedLayers.filter((l) => !l.visible).map((l) => l.id),
  });
}

export function resolveOrganizationView(
  sceneGraph: ViewerSceneGraph,
  doc: UserOrganizationDocument
): ResolvedOrganizationView {
  if (doc.activeSource === "cad") {
    const layers: Record<string, ResolvedLayerView> = Object.create(null);
    const groups: Record<string, ResolvedGroupView> = Object.create(null);
    const componentLayerId: Record<string, string | null> = Object.create(null);
    const componentGroupIds: Record<string, string[]> = Object.create(null);
    const cadLayerIds = Object.keys(sceneGraph.layers);
    const cadGroupIds = Object.keys(sceneGraph.groups);

    for (const [idx, id] of cadLayerIds.entries()) {
      const layer = sceneGraph.layers[id];
      if (layer) layers[id] = toCadLayerRecord(layer, idx);
    }
    for (const [idx, id] of cadGroupIds.entries()) {
      const group = sceneGraph.groups[id];
      if (group) groups[id] = toCadGroupRecord(group, idx);
    }
    for (const compId of sceneGraph.componentOrder) {
      const comp = sceneGraph.components[compId];
      componentLayerId[compId] = comp?.layerId ?? null;
      componentGroupIds[compId] = comp ? [...comp.groupIds] : [];
    }
    return {
      source: "cad",
      layers,
      layerOrder: cadLayerIds,
      groups,
      groupOrder: cadGroupIds,
      componentLayerId,
      componentGroupIds,
      hiddenByUserLayers: [],
    };
  }

  const validComponents = new Set(sceneGraph.componentOrder);
  const layers: Record<string, ResolvedLayerView> = Object.create(null);
  const sortedLayers = [...doc.userLayers].sort((a, b) => a.order - b.order);
  const hiddenSet = new Set(doc.hiddenLayerIds);

  for (const layer of sortedLayers) {
    layers[layer.id] = {
      id: layer.id,
      name: layer.name,
      color: layer.color,
      parentId: layer.parentId,
      childIds: [],
      componentIds: [],
      directComponentIds: [],
      visible: layer.visible && !hiddenSet.has(layer.id),
      source: "user",
      order: layer.order,
    };
  }

  for (const layer of sortedLayers) {
    if (layer.parentId && layers[layer.parentId]) {
      layers[layer.parentId].childIds.push(layer.id);
    }
  }

  const componentLayerId: Record<string, string | null> = Object.create(null);
  const hiddenByUserLayers = new Set<string>();
  for (const compId of sceneGraph.componentOrder) {
    const assigned = doc.componentLayerAssignments[compId];
    if (assigned && layers[assigned]) {
      componentLayerId[compId] = assigned;
      layers[assigned].directComponentIds.push(compId);
      layers[assigned].componentIds.push(compId);
      if (!isLayerEffectivelyVisible(layers, assigned)) {
        hiddenByUserLayers.add(compId);
      }
    } else {
      componentLayerId[compId] = null;
    }
  }

  const groups: Record<string, ResolvedGroupView> = Object.create(null);
  const sortedGroups = [...doc.userGroups].sort((a, b) => a.order - b.order);
  const componentGroupIds: Record<string, string[]> = Object.create(null);
  for (const compId of sceneGraph.componentOrder) {
    componentGroupIds[compId] = [];
  }

  for (const group of sortedGroups) {
    const members = group.memberIds.filter((id) => validComponents.has(id));
    groups[group.id] = {
      id: group.id,
      name: group.name,
      color: group.color,
      parentId: group.parentId,
      childIds: [],
      componentIds: members,
      source: "user",
      order: group.order,
    };
    for (const memberId of members) {
      componentGroupIds[memberId]?.push(group.id);
    }
  }
  for (const group of sortedGroups) {
    if (group.parentId && groups[group.parentId]) {
      groups[group.parentId].childIds.push(group.id);
    }
  }

  return {
    source: "user",
    layers,
    layerOrder: sortedLayers.map((l) => l.id),
    groups,
    groupOrder: sortedGroups.map((g) => g.id),
    componentLayerId,
    componentGroupIds,
    hiddenByUserLayers: [...hiddenByUserLayers],
  };
}

function isLayerEffectivelyVisible(
  layers: Record<string, ResolvedLayerView>,
  layerId: string
): boolean {
  let current: string | null = layerId;
  let guard = 0;
  while (current && guard < MAX_ORGANIZATION_DEPTH + 2) {
    const layer: ResolvedLayerView | undefined = layers[current];
    if (!layer) return true;
    if (!layer.visible) return false;
    current = layer.parentId;
    guard += 1;
  }
  return true;
}

export function descendantLayerIdsForUserLayer(
  doc: UserOrganizationDocument,
  layerId: string
): string[] {
  return subtreeIds(doc.userLayers, layerId);
}
