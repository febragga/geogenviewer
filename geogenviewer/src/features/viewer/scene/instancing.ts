import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type BufferGeometry,
  type Intersection,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

export interface BatchedSlot {
  mesh: Mesh;
  componentId: string | null;
  originalVisible: boolean;
  originalMaterial: Material;
  batchIndex: number;
  slotIndex: number;
}

export interface InstancedBatch {
  key: string;
  geometry: BufferGeometry;
  baseMaterial: Material;
  instancedMesh: InstancedMesh;
  slots: BatchedSlot[];
  customMaterials: Map<string, Material>;
  disposed: boolean;
}

const ZERO_MATRIX = new Matrix4().makeScale(0, 0, 0);
const WHITE = new Color(0xffffff);
export const DEFAULT_MIN_BATCH_SIZE = 24;
export const MAX_OVERLAY_PROMOTIONS = 64;

function isBatchableMesh(obj: Object3D): obj is Mesh {
  const mesh = obj as Mesh & {
    isSkinnedMesh?: boolean;
    isInstancedMesh?: boolean;
    morphTargetInfluences?: unknown[];
  };
  if (!mesh.isMesh) return false;
  if (mesh.isSkinnedMesh || mesh.isInstancedMesh) return false;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) return false;
  if (!mesh.geometry || !mesh.material || Array.isArray(mesh.material)) return false;
  return true;
}

/**
 * Groups static single-material meshes sharing the same BufferGeometry and Material
 * into GPU InstancedMesh batches when occurrence count reaches `minBatchSize` (default 24).
 * Leaves smaller scenes (e.g. 18-part pavilion) unbatched to preserve baseline draw profiles.
 */
export class InstancedBatchManager {
  readonly group = new Group();
  readonly batches: InstancedBatch[] = [];
  readonly slotByMesh = new Map<Mesh, BatchedSlot>();
  readonly batchByInstanced = new Map<InstancedMesh, InstancedBatch>();
  private readonly host: Object3D;
  private readonly resolveComponentId: (obj: Object3D | null) => string | null;
  private readonly useLocalMatrix: boolean;
  private matricesDirty = true;
  private disposed = false;

  constructor(
    sourceRoot: Object3D,
    batchHost: Object3D,
    resolveComponentId: (obj: Object3D | null) => string | null,
    minBatchSize = DEFAULT_MIN_BATCH_SIZE,
    useLocalMatrix = false
  ) {
    this.host = batchHost;
    this.resolveComponentId = resolveComponentId;
    this.useLocalMatrix = useLocalMatrix;
    this.group.name = "gg-instanced-batches";
    this.group.userData.ggInstancedContainer = true;

    const candidates = new Map<string, Mesh[]>();
    sourceRoot.updateWorldMatrix(true, true);
    sourceRoot.traverse((obj) => {
      if (!isBatchableMesh(obj)) return;
      const mat = obj.material as Material;
      const key = `${obj.geometry.uuid}:${mat.uuid}`;
      let list = candidates.get(key);
      if (!list) {
        list = [];
        candidates.set(key, list);
      }
      list.push(obj);
    });

    for (const [key, meshes] of candidates.entries()) {
      if (meshes.length < minBatchSize) continue;
      const first = meshes[0];
      const geometry = first.geometry;
      const baseMaterial = first.material as Material;
      const instancedMesh = new InstancedMesh(geometry, baseMaterial, meshes.length);
      instancedMesh.frustumCulled = false;
      instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage);
      instancedMesh.name = `gg-batch-${this.batches.length}`;

      const batchIndex = this.batches.length;
      const slots: BatchedSlot[] = [];
      for (let slotIndex = 0; slotIndex < meshes.length; slotIndex += 1) {
        const mesh = meshes[slotIndex];
        const componentId = this.resolveComponentId(mesh);
        const slot: BatchedSlot = {
          mesh,
          componentId,
          originalVisible: mesh.visible,
          originalMaterial: mesh.material as Material,
          batchIndex,
          slotIndex,
        };
        mesh.userData.ggInstancedManaged = true;
        mesh.userData.ggInstancedVisible = mesh.visible;
        instancedMesh.setMatrixAt(
          slotIndex,
          mesh.visible ? (this.useLocalMatrix ? mesh.matrix : mesh.matrixWorld) : ZERO_MATRIX
        );
        instancedMesh.setColorAt(slotIndex, WHITE);
        slots.push(slot);
        this.slotByMesh.set(mesh, slot);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      const batch: InstancedBatch = {
        key,
        geometry,
        baseMaterial,
        instancedMesh,
        slots,
        customMaterials: new Map(),
        disposed: false,
      };
      this.batches.push(batch);
      this.batchByInstanced.set(instancedMesh, batch);
      this.group.add(instancedMesh);
    }

    if (this.batches.length > 0) {
      this.host.add(this.group);
    }
  }

  get active(): boolean {
    return this.batches.length > 0 && !this.disposed;
  }

  isManaged(mesh: Mesh): boolean {
    return this.slotByMesh.has(mesh);
  }

  markMatricesDirty(): void {
    this.matricesDirty = true;
  }

  resolveHitComponentId(hit: Intersection): string | null {
    const obj = hit.object;
    if ((obj as InstancedMesh).isInstancedMesh && hit.instanceId !== undefined) {
      const batch = this.batchByInstanced.get(obj as InstancedMesh);
      if (batch) {
        return batch.slots[hit.instanceId]?.componentId ?? null;
      }
    }
    return this.resolveComponentId(obj);
  }

  applyDisplayAndVisibility(params: {
    mode: string;
    opacity: number;
    shadows: boolean;
    selected: ReadonlySet<string>;
    hovered: string | null;
    hidden: ReadonlySet<string>;
    isolated: ReadonlySet<string> | null;
    ghosts: ReadonlySet<string>;
    colorForComponent: (componentId: string | null) => Color | null;
    overrideColors?: ReadonlyMap<string, Color>;
    clayColor: Color;
    selectionColor: Color;
    hoverColor: Color;
  }): boolean {
    if (!this.active) return false;
    const {
      mode,
      opacity,
      shadows,
      selected,
      hovered,
      hidden,
      isolated,
      ghosts,
      colorForComponent,
      overrideColors,
      clayColor,
      selectionColor,
      hoverColor,
    } = params;

    const usePerInstanceColor =
      mode === "layer" || mode === "category" || mode === "semanticMaterial" || Boolean(overrideColors?.size);
    const totalOverlayCandidates = selected.size + (hovered ? 1 : 0) + ghosts.size;
    const promoteOverlayMeshes = totalOverlayCandidates <= MAX_OVERLAY_PROMOTIONS;
    let overlayActiveCount = 0;

    for (const batch of this.batches) {
      const materialKey = `${mode}:${opacity.toFixed(2)}:${usePerInstanceColor ? "inst" : "flat"}`;
      let mat = batch.customMaterials.get(materialKey);
      if (!mat) {
        if (mode === "material" && opacity >= 1) {
          mat = batch.baseMaterial;
        } else {
          const base = batch.baseMaterial as Material & { color?: Color };
          const baseColor =
            usePerInstanceColor
              ? WHITE
              : mode === "clay" || mode === "technical" || mode === "layer" || mode === "category" || mode === "semanticMaterial"
                ? clayColor
                : base.color ?? clayColor;
          mat = new MeshStandardMaterial({
            color: baseColor,
            roughness: 0.85,
            side: base.side,
            opacity: base.opacity * opacity * (mode === "xray" ? 0.28 : 1),
            transparent: base.transparent || mode === "xray" || opacity < 1,
            depthWrite: base.depthWrite && mode !== "xray" && opacity >= 1,
            alphaTest: base.alphaTest,
            wireframe: mode === "wireframe",
          });
          batch.customMaterials.set(materialKey, mat);
        }
      }
      batch.instancedMesh.material = mat;
      batch.instancedMesh.castShadow = shadows;
      batch.instancedMesh.receiveShadow = shadows;

      let colorsDirty = false;
      for (const slot of batch.slots) {
        const id = slot.componentId;
        const isVisible =
          slot.originalVisible &&
          (id === null || (!hidden.has(id) && (!isolated || isolated.has(id))));
        const isSelected = id !== null && selected.has(id);
        const isHovered = id !== null && id === hovered;
        const isGhost = id !== null && ghosts.has(id);
        const promote = isVisible && promoteOverlayMeshes && (isSelected || isHovered || isGhost);

        slot.mesh.userData.ggInstancedVisible = isVisible;
        slot.mesh.visible = promote;
        if (promote) overlayActiveCount += 1;

        if (!isVisible || promote) {
          batch.instancedMesh.setMatrixAt(slot.slotIndex, ZERO_MATRIX);
        } else {
          if (!this.useLocalMatrix) slot.mesh.updateWorldMatrix(true, false);
          else slot.mesh.updateMatrix();
          batch.instancedMesh.setMatrixAt(
            slot.slotIndex,
            this.useLocalMatrix ? slot.mesh.matrix : slot.mesh.matrixWorld
          );
        }

        if (usePerInstanceColor || !promoteOverlayMeshes) {
          const targetColor =
            !promoteOverlayMeshes && isSelected
              ? selectionColor
              : !promoteOverlayMeshes && isHovered
                ? hoverColor
                : (id ? overrideColors?.get(id) : undefined) ?? colorForComponent(id) ?? clayColor;
          batch.instancedMesh.setColorAt(slot.slotIndex, targetColor);
          colorsDirty = true;
        } else if (batch.instancedMesh.instanceColor) {
          batch.instancedMesh.setColorAt(slot.slotIndex, WHITE);
          colorsDirty = true;
        }
      }
      batch.instancedMesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && batch.instancedMesh.instanceColor) {
        batch.instancedMesh.instanceColor.needsUpdate = true;
      }
    }

    this.matricesDirty = false;
    return overlayActiveCount > 0;
  }

  /** Fast path when transforms move (Explode, Assembly, Knolling) without visibility/mode changes. */
  syncTransforms(rootScene: Object3D): void {
    if (!this.active) return;
    rootScene.updateMatrixWorld();
    for (const batch of this.batches) {
      let dirty = false;
      for (const slot of batch.slots) {
        if (!slot.mesh.userData.ggInstancedVisible || slot.mesh.visible) continue;
        batch.instancedMesh.setMatrixAt(
          slot.slotIndex,
          this.useLocalMatrix ? slot.mesh.matrix : slot.mesh.matrixWorld
        );
        dirty = true;
      }
      if (dirty) batch.instancedMesh.instanceMatrix.needsUpdate = true;
    }
    this.matricesDirty = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const batch of this.batches) {
      batch.disposed = true;
      for (const slot of batch.slots) {
        slot.mesh.visible = slot.originalVisible;
        slot.mesh.material = slot.originalMaterial;
        delete slot.mesh.userData.ggInstancedManaged;
        delete slot.mesh.userData.ggInstancedVisible;
      }
      for (const mat of batch.customMaterials.values()) {
        if (mat !== batch.baseMaterial) mat.dispose();
      }
      batch.customMaterials.clear();
      batch.instancedMesh.dispose();
    }
    this.group.removeFromParent();
    this.batches.length = 0;
    this.slotByMesh.clear();
    this.batchByInstanced.clear();
  }
}
