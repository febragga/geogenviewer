export type Provenance = "cad" | "mesh" | "authored";
export type DisplayUnit = "mm" | "cm" | "m";
export type GeometryKind = "physicalModel" | "fullScale" | "unknown";
export type NodeMatchStrategy = "extras" | "nameExact" | "namePrefix";

export type ElementCategory =
  | "column"
  | "beam"
  | "slab"
  | "stair"
  | "foundation"
  | "connector"
  | "wall"
  | "roof"
  | "other";

export type CadGeometryType =
  | "brep"
  | "extrusion"
  | "mesh"
  | "subd"
  | "blockInstance"
  | "composite"
  | "other";

export interface MeasuredScalar {
  value: number;
  source: Provenance;
}

export interface MeasuredVec3 {
  value: [number, number, number];
  source: Provenance;
}

export interface MeasuredBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  source: Provenance;
}

export interface ElementDimensions {
  lengthM?: number | null;
  widthM?: number | null;
  thicknessM?: number | null;
  source: Provenance;
}

export interface ElementFabrication {
  prototypeId?: string | null;
  scaleDenominator?: number | null;
  material?: string | null;
  toleranceMm?: number | null;
  connectorNote?: string | null;
}

export interface ManifestLayer {
  id: string;
  name: string;
  parentId: string | null;
  fullPath?: string | null;
  colorHex?: string | null;
  visible?: boolean;
}

export interface ManifestGroup {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ManifestMaterial {
  id: string;
  name: string;
  colorHex?: string | null;
  densityKgM3?: number | null;
  costPerKg?: { amount: number; currency: string } | null;
}

export interface ManifestBlock {
  id: string;
  name: string;
  sourceBlockId?: string | null;
}

export interface ManifestElement {
  id: string;
  name: string;
  category: ElementCategory;
  layerId: string | null;
  groupIds: string[];
  materialId: string | null;
  parentId?: string | null;
  glbNodeName?: string | null;
  sourceObjectId?: string | null;
  blockDefinitionId?: string | null;
  instancePath?: string | null;
  geometryType?: CadGeometryType | null;
  colorHex?: string | null;
  isClosed?: boolean | null;
  isValid?: boolean | null;
  boundingBoxM?: MeasuredBoundingBox | null;
  dimensions?: ElementDimensions | null;
  areaM2?: MeasuredScalar | null;
  volumeM3?: MeasuredScalar | null;
  centroidM?: MeasuredVec3 | null;
  explodeOffsetM?: [number, number, number] | null;
  assemblyDirectionM?: [number, number, number] | null;
  connectorIds?: string[];
  userText?: Record<string, string>;
  properties?: Record<string, string | number | boolean | null>;
  fabrication?: ElementFabrication | null;
}

export interface ManifestAssemblyStep {
  id: string;
  title: string;
  elementIds: string[];
  dependsOn: string[];
  durationSeconds?: number;
  insertionOffsetM?: [number, number, number];
}

export interface ManifestV1 {
  schemaVersion: string;
  project: {
    id: string;
    title: string;
    revisionId: string;
    description?: string | null;
    geometryKind: GeometryKind;
    scaleDenominator: number | null;
    displayUnit: DisplayUnit;
    prototypeId?: string | null;
  };
  source: {
    application: string | null;
    applicationVersion?: string | null;
    exporterVersion?: string | null;
    sourceUnit: "mm" | "cm" | "m" | "in" | "ft" | null;
    sourceUpAxis: "Z" | "Y" | null;
    sourceOrigin: [number, number, number] | null;
    metersPerSourceUnit: number | null;
  };
  geometry: {
    file: string;
    format: "glb";
    coordinateSystem: "RH_Y_UP";
    unit: "m";
    nodeMatchStrategy?: NodeMatchStrategy;
    sha256?: string | null;
  };
  layers: ManifestLayer[];
  groups: ManifestGroup[];
  materials: ManifestMaterial[];
  blocks?: ManifestBlock[];
  elements: ManifestElement[];
  assembly?: {
    steps: ManifestAssemblyStep[];
  } | null;
}

export interface LayerRecord {
  id: string;
  name: string;
  parentId: string | null;
  fullPath: string;
  colorHex: string | null;
  defaultVisible: boolean;
  childLayerIds: string[];
  elementIds: string[];
}

export interface GroupRecord {
  id: string;
  name: string;
  parentId: string | null;
  childGroupIds: string[];
  elementIds: string[];
}

export interface MaterialRecord {
  id: string;
  name: string;
  colorHex: string | null;
  densityKgM3: number | null;
}

export interface CadMetadataRecord {
  geometryType: CadGeometryType | null;
  colorHex: string | null;
  isClosed: boolean | null;
  isValid: boolean | null;
  boundingBoxM: MeasuredBoundingBox | null;
  dimensions: ElementDimensions | null;
  areaM2: MeasuredScalar | null;
  volumeM3: MeasuredScalar | null;
  centroidM: MeasuredVec3 | null;
  explodeOffsetM: [number, number, number] | null;
  assemblyDirectionM: [number, number, number] | null;
  connectorIds: string[];
  userText: Record<string, string>;
  properties: Record<string, string | number | boolean | null>;
  fabrication: ElementFabrication | null;
}

export interface ComponentRecord {
  id: string;
  name: string;
  category: ElementCategory;
  sourceObjectId: string | null;
  layerId: string | null;
  groupIds: string[];
  materialId: string | null;
  materialNames: string[];
  parentId: string | null;
  childIds: string[];
  blockDefinitionId: string | null;
  instancePath: string | null;
  isComposite: boolean;
  isInstance: boolean;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  meshBoundsMeters: [number, number, number];
  meshMinMaxMeters: {
    min: [number, number, number];
    max: [number, number, number];
  };
  cad: CadMetadataRecord | null;
}

export interface ImportDiagnostics {
  sha256Verified: boolean | null;
  nodeMatchStrategy: NodeMatchStrategy;
  warnings: string[];
  matchedCount: number;
}

export interface ViewerSceneGraph {
  mode: "glb-basic" | "manifest-full";
  fileName: string;
  fileSizeBytes: number;
  projectTitle: string;
  revisionId: string | null;
  geometryKind: GeometryKind;
  scaleDenominator: number | null;
  displayUnit: DisplayUnit;
  sourceApplication: string | null;
  sourceUnit: string | null;
  totalNodes: number;
  totalMeshes: number;
  totalVertices: number;
  totalTriangles: number;
  sceneBoundsMeters: [number, number, number];
  components: Record<string, ComponentRecord>;
  componentOrder: string[];
  rootComponentIds: string[];
  layers: Record<string, LayerRecord>;
  rootLayerIds: string[];
  groups: Record<string, GroupRecord>;
  rootGroupIds: string[];
  materials: Record<string, MaterialRecord>;
  diagnostics: ImportDiagnostics;
}

export type VisibilityState = "visible" | "hidden" | "partial";

export function computeVisibilityState(
  elementIds: readonly string[],
  hiddenSet: ReadonlySet<string>,
  isolatedSet: ReadonlySet<string> | null
): VisibilityState {
  if (elementIds.length === 0) return "visible";
  let visibleCount = 0;
  for (const id of elementIds) {
    const isVisible = isolatedSet
      ? isolatedSet.has(id) && !hiddenSet.has(id)
      : !hiddenSet.has(id);
    if (isVisible) visibleCount += 1;
  }
  if (visibleCount === 0) return "hidden";
  if (visibleCount === elementIds.length) return "visible";
  return "partial";
}
