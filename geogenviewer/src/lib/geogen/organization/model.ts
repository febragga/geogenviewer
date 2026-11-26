import type { GroupRecord, LayerRecord, ViewerSceneGraph } from "../domain/model.ts";

export type OrganizationSource = "cad" | "user";
export type DeleteLayerStrategy = "move-to-parent" | "unassign";

export interface OrganizationBinding {
  key: string;
  projectId: string | null;
  revisionId: string | null;
  modelSha256: string | null;
}

export interface UserLayerRecord {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  order: number;
  visible: boolean;
}

export interface UserGroupRecord {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  order: number;
  memberIds: string[];
}

export interface UserOrganizationDocument {
  schemaVersion: "1.0.0";
  projectId: string | null;
  revisionId: string | null;
  modelSha256: string | null;
  updatedAt: string;
  activeSource: OrganizationSource;
  userLayers: UserLayerRecord[];
  userGroups: UserGroupRecord[];
  /** Each occurrence ID maps to at most one direct userLayerId. */
  componentLayerAssignments: Record<string, string>;
  hiddenLayerIds: string[];
}

export interface ResolvedLayerView {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  childIds: string[];
  componentIds: string[];
  directComponentIds: string[];
  visible: boolean;
  source: OrganizationSource;
  order: number;
}

export interface ResolvedGroupView {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  childIds: string[];
  componentIds: string[];
  source: OrganizationSource;
  order: number;
}

export interface ResolvedOrganizationView {
  source: OrganizationSource;
  layers: Record<string, ResolvedLayerView>;
  layerOrder: string[];
  groups: Record<string, ResolvedGroupView>;
  groupOrder: string[];
  componentLayerId: Record<string, string | null>;
  componentGroupIds: Record<string, string[]>;
  hiddenByUserLayers: string[];
}

export const USER_ORGANIZATION_PALETTE = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#64748B",
] as const;

export const MAX_ORGANIZATION_DEPTH = 16;
export const MAX_ORGANIZATION_ENTRIES = 2_000;

export function createEmptyOrganization(
  binding?: Partial<OrganizationBinding>
): UserOrganizationDocument {
  return {
    schemaVersion: "1.0.0",
    projectId: binding?.projectId ?? null,
    revisionId: binding?.revisionId ?? null,
    modelSha256: binding?.modelSha256 ?? null,
    updatedAt: new Date().toISOString(),
    activeSource: "cad",
    userLayers: [],
    userGroups: [],
    componentLayerAssignments: {},
    hiddenLayerIds: [],
  };
}

export function hasUserOrganizationData(doc: UserOrganizationDocument): boolean {
  return (
    doc.userLayers.length > 0 ||
    doc.userGroups.length > 0 ||
    Object.keys(doc.componentLayerAssignments).length > 0
  );
}

export function normalizeHexColor(value: string | undefined, fallbackIndex = 0): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return USER_ORGANIZATION_PALETTE[Math.abs(fallbackIndex) % USER_ORGANIZATION_PALETTE.length];
}

export function toCadLayerRecord(
  layer: LayerRecord,
  order: number
): ResolvedLayerView {
  return {
    id: layer.id,
    name: layer.name,
    color: normalizeHexColor(layer.colorHex ?? undefined, order),
    parentId: layer.parentId,
    childIds: [...layer.childLayerIds],
    componentIds: [...layer.elementIds],
    directComponentIds: [...layer.elementIds],
    visible: layer.defaultVisible,
    source: "cad",
    order,
  };
}

export function toCadGroupRecord(
  group: GroupRecord,
  order: number
): ResolvedGroupView {
  return {
    id: group.id,
    name: group.name,
    color: normalizeHexColor(undefined, order),
    parentId: group.parentId,
    childIds: [...group.childGroupIds],
    componentIds: [...group.elementIds],
    source: "cad",
    order,
  };
}

export function cadStructureSummary(sceneGraph: ViewerSceneGraph): {
  layerCount: number;
  groupCount: number;
} {
  return {
    layerCount: Object.keys(sceneGraph.layers).length,
    groupCount: Object.keys(sceneGraph.groups).length,
  };
}
