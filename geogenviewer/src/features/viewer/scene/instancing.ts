import { uniformSurface } from "./display-profiles.ts";
import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
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
const IDENTITY_MATRIX = new Matrix4();
const WHITE = new Color(0xffffff);
export const DEFAULT_MIN_BATCH_SIZE = 24;
export const MAX_OVERLAY_PROMOTIONS = 64;

function isBatchableMesh(obj: Object3D, sourceRoot: Object3D, useLocalMatrix: boolean): obj is Mesh {
  const mesh = obj as Mesh & {
    isSkinnedMesh?: boolean;
    isInstancedMesh?: boolean;
    morphTargetInfluences?: unknown[];
  };
  if (!mesh.isMesh) return false;
  if (mesh.isSkinnedMesh || mesh.isInstancedMesh) return false;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) return false;
  if (!mesh.geometry || !mesh.material || Array.isArray(mesh.material)) return false;
  const { material } = mesh;
  if (material.transparent || material.opacity !== 1 || !material.depthWrite ||
      ("transmission" in material && Number(material.transmission) > 0) ||
      mesh.children.length || mesh.layers.mask !== 1) return false;

  for (let parent = mesh.parent; parent && parent !== sourceRoot; parent = parent.parent) {
    if (!parent.visible || (parent as Mesh).isMesh) return false;
  }
  const matrix = useLocalMatrix ? mesh.matrix : mesh.matrixWorld;
  const determinant = matrix.determinant();
  if (!Number.isFinite(determinant) || determinant <= 0) return false;
  const [a, b, c, , d, e, f, , g, h, i] = matrix.elements;
  const x = Math.hypot(a, b, c), y = Math.hypot(d, e, f), z = Math.hypot(g, h, i);
  const tolerance = 1e-6;
  return Math.abs(a * d + b * e + c * f) <= tolerance * x * y &&
    Math.abs(a * g + b * h + c * i) <= tolerance * x * z &&
    Math.abs(d * g + e * h + f * i) <= tolerance * y * z;
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
  private readonly sourceRoot: Object3D;
  private readonly inverseBatchWorld = new Matrix4();
  private readonly relativeMatrix = new Matrix4();
  private originalPath = false;
  private batchWorldIsIdentity = true;
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
    this.sourceRoot = sourceRoot;
    this.useLocalMatrix = useLocalMatrix;
    this.group.name = "gg-instanced-batches";
    this.group.userData.ggInstancedContainer = true;

    this.host.add(this.group);
    this.updateSourceMatrices();
    const candidates = new Map<string, Mesh[]>();
    sourceRoot.traverse((obj) => {
      if (!isBatchableMesh(obj, sourceRoot, useLocalMatrix)) return;
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
          mesh.visible ? this.batchMatrix(mesh) : ZERO_MATRIX
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

    if (this.batches.length === 0) this.group.removeFromParent();
  }

  get active(): boolean {
    return this.batches.length > 0 && !this.disposed;
  }

  isManaged(mesh: Mesh): boolean {
    return !this.originalPath && this.slotByMesh.has(mesh);
  }

  private updateSourceMatrices(): void {
    if (this.useLocalMatrix) return;
    this.group.updateWorldMatrix(true, false);
    this.batchWorldIsIdentity = this.group.matrixWorld.equals(IDENTITY_MATRIX);
    if (!this.batchWorldIsIdentity) this.inverseBatchWorld.copy(this.group.matrixWorld).invert();
    this.sourceRoot.parent?.updateWorldMatrix(true, false);
    this.sourceRoot.updateMatrixWorld();
  }

  private batchMatrix(mesh: Mesh): Matrix4 {
    if (this.useLocalMatrix) return mesh.matrix;
    return this.batchWorldIsIdentity ? mesh.matrixWorld :
      this.relativeMatrix.multiplyMatrices(this.inverseBatchWorld, mesh.matrixWorld);
  }

  sourceIntersection(hit: Intersection): Intersection {
    const slot = hit.instanceId === undefined ? undefined :
      this.batchByInstanced.get(hit.object as InstancedMesh)?.slots[hit.instanceId];
    return slot ? { ...hit, object: slot.mesh, instanceId: undefined } : hit;
  }

  resolveHitComponentId(hit: Intersection): string | null {
    const source = this.sourceIntersection(hit);
    return this.resolveComponentId(source.object);
  }

  applyDisplayAndVisibility(params: {
    mode: string;
    opacity: number;
    shadows: boolean;
    edges?: boolean;
    unlit?: boolean;
    selected: ReadonlySet<string>;
    hovered: string | null;
    hidden: ReadonlySet<string>;
    isolated: ReadonlySet<string> | null;
    ghosts: ReadonlySet<string>;
    colorForComponent: (componentId: string | null) => Color | null;
    overrideColors?: ReadonlyMap<string, Color>;
    clayColor: Color;
    roughness?: number;
    selectionColor: Color;
    hoverColor: Color;
  }): boolean {
    if (!this.active) return false;
    const {
      mode,
      opacity,
      shadows,
      unlit = false,
      selected,
      hovered,
      hidden,
      isolated,
      ghosts,
      colorForComponent,
      overrideColors,
      clayColor,
      roughness = 0.85,
      selectionColor,
      hoverColor,
    } = params;

    this.originalPath = Boolean(params.edges || mode === "xray" || mode === "technical" || opacity < 1);
    this.group.visible = !this.originalPath;
    if (this.originalPath) {
      for (const slot of this.slotByMesh.values()) delete slot.mesh.userData.ggInstancedManaged;
      return false;
    }
    this.updateSourceMatrices();
    const usePerInstanceColor =
      mode === "layer" || mode === "category" || mode === "semanticMaterial" || Boolean(overrideColors?.size);
    const totalOverlayCandidates = selected.size + (hovered ? 1 : 0);
    const promoteOverlayMeshes = totalOverlayCandidates <= MAX_OVERLAY_PROMOTIONS;
    let overlayActiveCount = 0;

    for (const batch of this.batches) {
      const materialKey = `${mode}:${unlit ? "u" : "l"}:${clayColor.getHexString()}:${roughness.toFixed(2)}:${opacity.toFixed(2)}:${usePerInstanceColor ? "inst" : "flat"}`;
      let mat = batch.customMaterials.get(materialKey);
      if (!mat) {
        if (mode === "material" && opacity >= 1) {
          mat = batch.baseMaterial;
        } else {
          const base = batch.baseMaterial as Material & { color?: Color };
          const baseColor =
            usePerInstanceColor
              ? WHITE
              : uniformSurface(mode)
                ? clayColor
                : base.color ?? clayColor;
          mat = unlit
            ? new MeshBasicMaterial({
                color: baseColor,
                side: base.side,
                opacity: base.opacity * opacity,
                transparent: base.transparent || opacity < 1,
                depthWrite: base.depthWrite && opacity >= 1,
                alphaTest: base.alphaTest,
              })
            : new MeshStandardMaterial({
                color: baseColor,
                roughness,
                metalness: 0,
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
        const promote = isVisible && (isGhost || (promoteOverlayMeshes && (isSelected || isHovered)));

        slot.mesh.userData.ggInstancedManaged = true;
        slot.mesh.userData.ggInstancedVisible = isVisible;
        slot.mesh.visible = promote;
        if (promote) overlayActiveCount += 1;

        if (!isVisible || promote) {
          batch.instancedMesh.setMatrixAt(slot.slotIndex, ZERO_MATRIX);
        } else {
          batch.instancedMesh.setMatrixAt(slot.slotIndex, this.batchMatrix(slot.mesh));
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
      batch.instancedMesh.boundingSphere = null;
      batch.instancedMesh.instanceMatrix.needsUpdate = true;
      if (colorsDirty && batch.instancedMesh.instanceColor) {
        batch.instancedMesh.instanceColor.needsUpdate = true;
      }
    }

    return overlayActiveCount > 0;
  }

  /** Fast path when transforms move (Explode, Assembly, Knolling) without visibility/mode changes. */
  syncTransforms(): void {
    if (!this.active || this.originalPath) return;
    this.updateSourceMatrices();
    for (const batch of this.batches) {
      let dirty = false;
      for (const slot of batch.slots) {
        if (!slot.mesh.userData.ggInstancedVisible || slot.mesh.visible) continue;
        batch.instancedMesh.setMatrixAt(slot.slotIndex, this.batchMatrix(slot.mesh));
        dirty = true;
      }
      if (dirty) {
        batch.instancedMesh.boundingSphere = null;
        batch.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  resetDisplayMaterials(): void {
    for (const batch of this.batches) {
      batch.instancedMesh.material = batch.baseMaterial;
      for (const material of batch.customMaterials.values()) material.dispose();
      batch.customMaterials.clear();
    }
  }

  dispose(): void {
    this.resetDisplayMaterials();
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
      batch.instancedMesh.dispose();
    }
    this.group.removeFromParent();
    this.batches.length = 0;
    this.slotByMesh.clear();
    this.batchByInstanced.clear();
  }
}
