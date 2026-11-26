import { Box3, Matrix3, Matrix4, Vector3, type Object3D } from "three";
import type { LoadedScenePackage } from "../importers/package.ts";

export type ExplodeMode = "radial" | "axial" | "directional" | "hierarchical";
export type ExplodeAxisCad = "X" | "Y" | "Z";
export type ExplodeScope = "all" | "selection" | "layer" | "group";
export type ExplodeGranularity = "component" | "layer" | "group";

export interface ExplodeParams {
  enabled: boolean;
  factor: number;
  mode: ExplodeMode;
  axis: ExplodeAxisCad;
  customDirectionCad: [number, number, number];
  scope: ExplodeScope;
  scopeLayerId: string | null;
  scopeGroupId: string | null;
  granularity: ExplodeGranularity;
  useManifestHints: boolean;
  showReferenceLines: boolean;
}

export const defaultExplodeParams: ExplodeParams = {
  enabled: false,
  factor: 0,
  mode: "radial",
  axis: "Z",
  customDirectionCad: [0, 0, 1],
  scope: "all",
  scopeLayerId: null,
  scopeGroupId: null,
  granularity: "component",
  useManifestHints: true,
  showReferenceLines: true,
};

/**
 * Converts a Rhino CAD vector (right-handed Z-up) into glTF viewer coordinates (right-handed Y-up).
 * Mirrors EXPORTER_CONTRACT.md Section 2: (dx, dy, dz)_CAD -> (dx, dz, -dy)_glTF.
 */
export function cadVectorToGltf(
  cadVec: readonly [number, number, number],
  target = new Vector3()
): Vector3 {
  return target.set(cadVec[0], cadVec[2], -cadVec[1]);
}

export function cadAxisToGltf(
  axis: ExplodeAxisCad,
  target = new Vector3()
): Vector3 {
  if (axis === "X") return target.set(1, 0, 0);
  if (axis === "Y") return target.set(0, 0, -1);
  return target.set(0, 1, 0);
}

interface SnapshotEntry {
  id: string;
  object: Object3D;
  parentSnapIndex: number;
  logicalDepth: number;
  layerDepth: number;
  restLocalPosition: Vector3;
  restWorldCenter: Vector3;
  restWorldBox: Box3;
  parentInvLinear: Matrix3;
  hasValidInvLinear: boolean;
}

const tmpVecA = new Vector3();
const tmpVecB = new Vector3();
const tmpDir = new Vector3();
const tmpNetWorld = new Vector3();
const tmpLocalDelta = new Vector3();
const tmpZero = new Vector3(0, 0, 0);
const tmpMat4 = new Matrix4();
const GOLDEN_ANGLE = 2.399963229728653;

function fallbackDeterministicDir(index: number, out: Vector3): Vector3 {
  const theta = (index + 1) * GOLDEN_ANGLE;
  const elevation = ((index % 5) - 2) * 0.22;
  return out.set(Math.cos(theta), elevation, Math.sin(theta)).normalize();
}

function collectLayerIdsRecursive(
  controllerScene: LoadedScenePackage["sceneGraph"],
  layerId: string
): Set<string> {
  const ids = new Set<string>();
  const stack = [layerId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (ids.has(cur)) continue;
    ids.add(cur);
    const layer = controllerScene.layers[cur];
    if (layer) {
      for (const cid of layer.childLayerIds) stack.push(cid);
    }
  }
  return ids;
}

function collectLayerDepths(
  sceneGraph: LoadedScenePackage["sceneGraph"]
): Record<string, number> {
  const depths: Record<string, number> = {};
  for (const id of Object.keys(sceneGraph.layers)) {
    let d = 0;
    let cursor = sceneGraph.layers[id]?.parentId ?? null;
    const seen = new Set<string>([id]);
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      d += 1;
      cursor = sceneGraph.layers[cursor]?.parentId ?? null;
    }
    depths[id] = d;
  }
  return depths;
}

function computeGltfDepth(obj: Object3D, sceneRoot: Object3D): number {
  let d = 0;
  let cursor = obj.parent;
  while (cursor && cursor !== sceneRoot) {
    d += 1;
    cursor = cursor.parent;
  }
  return d;
}

function computeParentInvLinear(object: Object3D): {
  invLinear: Matrix3;
  valid: boolean;
} {
  const invLinear = new Matrix3();
  const parent = object.parent;
  if (!parent) {
    invLinear.identity();
    return { invLinear, valid: true };
  }
  tmpMat4.copy(parent.matrixWorld);
  invLinear.setFromMatrix4(tmpMat4);
  const det = invLinear.determinant();
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) {
    return { invLinear, valid: false };
  }
  invLinear.invert();
  return { invLinear, valid: true };
}

/**
 * Non-destructive Exploded View Engine operating on logical components.
 * Preserves rest local transforms, composite groups, geometry instancing,
 * parent-child hierarchies without double displacement, and overlapping group deduplication.
 */
export class ExplodedViewController {
  readonly scenePackage: LoadedScenePackage;
  readonly restSceneBounds: Box3;
  readonly restCenter: Vector3;
  readonly referenceSpan: number;

  private readonly entries: SnapshotEntry[];
  private readonly indexById: Map<string, number>;
  private readonly unitWorldDisplacementsAt1: Vector3[];
  private readonly appliedWorldDeltas: Vector3[];
  private lastSignature = "";
  private currentFactor = 0;

  constructor(scenePackage: LoadedScenePackage) {
    this.scenePackage = scenePackage;
    scenePackage.model.scene.updateMatrixWorld(true);

    const rawEntries: Array<
      SnapshotEntry & { gltfDepth: number; object: Object3D }
    > = [];
    const objToComponentId = new Map<Object3D, string>();
    for (const id of scenePackage.sceneGraph.componentOrder) {
      const obj = scenePackage.objectByComponentId.get(id);
      if (obj) objToComponentId.set(obj, id);
    }

    const layerDepths = collectLayerDepths(scenePackage.sceneGraph);
    const restSceneBounds = new Box3();

    for (const id of scenePackage.sceneGraph.componentOrder) {
      const obj = scenePackage.objectByComponentId.get(id);
      const record = scenePackage.sceneGraph.components[id];
      if (!obj || !record) continue;

      let logicalDepth = 0;
      let cursorParent = record.parentId;
      const seenLogical = new Set<string>([id]);
      while (cursorParent && !seenLogical.has(cursorParent)) {
        seenLogical.add(cursorParent);
        logicalDepth += 1;
        cursorParent = scenePackage.sceneGraph.components[cursorParent]?.parentId ?? null;
      }

      const restWorldBox = new Box3().setFromObject(obj);
      const restWorldCenter = new Vector3();
      if (!restWorldBox.isEmpty()) {
        restWorldBox.getCenter(restWorldCenter);
        restSceneBounds.union(restWorldBox);
      } else {
        obj.getWorldPosition(restWorldCenter);
        restWorldBox.setFromCenterAndSize(restWorldCenter, new Vector3(0, 0, 0));
      }

      const { invLinear, valid } = computeParentInvLinear(obj);
      rawEntries.push({
        id,
        object: obj,
        gltfDepth: computeGltfDepth(obj, scenePackage.model.scene),
        parentSnapIndex: -1,
        logicalDepth,
        layerDepth: record.layerId ? (layerDepths[record.layerId] ?? 0) : 0,
        restLocalPosition: obj.position.clone(),
        restWorldCenter,
        restWorldBox,
        parentInvLinear: invLinear,
        hasValidInvLinear: valid,
      });
    }

    // Topological sort (shallowest glTF nodes first) so parent snapshot is always updated before descendants
    rawEntries.sort((a, b) => a.gltfDepth - b.gltfDepth);

    this.entries = rawEntries;
    this.indexById = new Map();
    for (let i = 0; i < rawEntries.length; i++) {
      this.indexById.set(rawEntries[i].id, i);
    }

    // Link nearest component ancestor in GLB scene graph to prevent double displacement
    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i];
      let p = entry.object.parent;
      while (p && p !== scenePackage.model.scene) {
        const compId = objToComponentId.get(p);
        if (compId !== undefined) {
          const idx = this.indexById.get(compId);
          if (idx !== undefined) {
            entry.parentSnapIndex = idx;
            break;
          }
        }
        p = p.parent;
      }
    }

    this.restSceneBounds = restSceneBounds.isEmpty()
      ? scenePackage.model.bounds.clone()
      : restSceneBounds;
    this.restCenter = this.restSceneBounds.isEmpty()
      ? new Vector3(0, 0, 0)
      : this.restSceneBounds.getCenter(new Vector3());
    const size = this.restSceneBounds.isEmpty()
      ? new Vector3(1, 1, 1)
      : this.restSceneBounds.getSize(new Vector3());
    this.referenceSpan = Math.max(size.length(), 0.01);

    this.unitWorldDisplacementsAt1 = rawEntries.map(() => new Vector3());
    this.appliedWorldDeltas = rawEntries.map(() => new Vector3());
  }

  get componentCount(): number {
    return this.entries.length;
  }

  get factor(): number {
    return this.currentFactor;
  }

  private buildSignature(params: ExplodeParams, selectedIds: readonly string[]): string {
    const selKey = params.scope === "selection" ? selectedIds.join(",") : "";
    return [
      params.mode,
      params.axis,
      params.customDirectionCad.join(","),
      params.scope,
      params.scopeLayerId ?? "",
      params.scopeGroupId ?? "",
      params.granularity,
      params.useManifestHints ? "1" : "0",
      selKey,
    ].join("|");
  }

  prepare(params: ExplodeParams, selectedIds: readonly string[]): boolean {
    const signature = this.buildSignature(params, selectedIds);
    if (signature === this.lastSignature) return false;
    this.lastSignature = signature;

    const n = this.entries.length;
    for (let i = 0; i < n; i++) {
      this.unitWorldDisplacementsAt1[i].set(0, 0, 0);
    }
    if (n === 0) return true;

    const sceneGraph = this.scenePackage.sceneGraph;
    const activeSet = new Set<string>();

    if (params.scope === "all") {
      for (let i = 0; i < n; i++) activeSet.add(this.entries[i].id);
    } else if (params.scope === "selection") {
      for (const sid of selectedIds) {
        if (this.indexById.has(sid)) activeSet.add(sid);
      }
    } else if (params.scope === "layer" && params.scopeLayerId) {
      const targetLayers = collectLayerIdsRecursive(sceneGraph, params.scopeLayerId);
      for (const lid of targetLayers) {
        const layer = sceneGraph.layers[lid];
        if (layer) {
          for (const eid of layer.elementIds) {
            if (this.indexById.has(eid)) activeSet.add(eid);
          }
        }
      }
    } else if (params.scope === "group" && params.scopeGroupId) {
      const group = sceneGraph.groups[params.scopeGroupId];
      if (group) {
        for (const eid of group.elementIds) {
          if (this.indexById.has(eid)) activeSet.add(eid);
        }
      }
    }

    if (activeSet.size === 0) return true;

    // Build non-overlapping clusters according to requested granularity
    const clusters: Array<{ key: string; indices: number[]; center: Vector3 }> = [];
    const scopeBounds = new Box3();

    const addToClusterMap = (
      map: Map<string, number[]>,
      key: string,
      entryIndex: number
    ) => {
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(entryIndex);
    };

    const clusterMap = new Map<string, number[]>();
    const assignedToGroup = new Set<string>();

    for (let i = 0; i < n; i++) {
      const entry = this.entries[i];
      if (!activeSet.has(entry.id)) continue;
      scopeBounds.union(entry.restWorldBox);
      const comp = sceneGraph.components[entry.id];

      if (params.granularity === "layer") {
        addToClusterMap(clusterMap, comp?.layerId ?? "__ungrouped__", i);
      } else if (params.granularity === "group") {
        // Deduplicate components present in multiple overlapping groups
        let chosenGroup = "__ungrouped__";
        if (comp && comp.groupIds.length > 0 && !assignedToGroup.has(entry.id)) {
          chosenGroup =
            params.scope === "group" &&
            params.scopeGroupId &&
            comp.groupIds.includes(params.scopeGroupId)
              ? params.scopeGroupId
              : comp.groupIds[0];
          assignedToGroup.add(entry.id);
        }
        addToClusterMap(clusterMap, chosenGroup, i);
      } else {
        addToClusterMap(clusterMap, entry.id, i);
      }
    }

    for (const [key, indices] of clusterMap.entries()) {
      const cBox = new Box3();
      for (const idx of indices) {
        cBox.union(this.entries[idx].restWorldBox);
      }
      const center = new Vector3();
      if (!cBox.isEmpty()) {
        cBox.getCenter(center);
      } else {
        center.copy(this.entries[indices[0]].restWorldCenter);
      }
      clusters.push({ key, indices, center });
    }

    const scopeCenter = scopeBounds.isEmpty()
      ? this.restCenter.clone()
      : scopeBounds.getCenter(new Vector3());
    const scopeSize = scopeBounds.isEmpty()
      ? new Vector3(this.referenceSpan, this.referenceSpan, this.referenceSpan)
      : scopeBounds.getSize(new Vector3());
    const activeSpan = Math.max(scopeSize.length(), this.referenceSpan * 0.25, 0.01);
    const maxRadius = Math.max(activeSpan * 0.5, 0.001);

    const axisDir =
      params.mode === "axial"
        ? cadAxisToGltf(params.axis, new Vector3())
        : cadVectorToGltf(params.customDirectionCad, new Vector3());

    if (params.mode === "directional" && axisDir.lengthSq() < 1e-10) {
      axisDir.set(0, 1, 0);
    } else if (axisDir.lengthSq() >= 1e-10) {
      axisDir.normalize();
    }

    if (params.mode === "radial") {
      // Detect spatially coincident clusters so overlapping components always separate cleanly
      const buckets = new Map<string, number>();
      const clusterBuckets = clusters.map((cluster) => {
        const key = `${Math.round(cluster.center.x * 1000)}:${Math.round(
          cluster.center.y * 1000
        )}:${Math.round(cluster.center.z * 1000)}`;
        const occurrence = buckets.get(key) ?? 0;
        buckets.set(key, occurrence + 1);
        return { key, occurrence };
      });

      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const bucketInfo = clusterBuckets[ci];
        const totalInBucket = buckets.get(bucketInfo.key) ?? 1;
        tmpDir.copy(cluster.center).sub(scopeCenter);
        const rawDist = tmpDir.length();
        if (rawDist < 1e-6) {
          fallbackDeterministicDir(ci, tmpDir);
        } else {
          tmpDir.divideScalar(rawDist);
          if (totalInBucket > 1) {
            fallbackDeterministicDir(bucketInfo.occurrence, tmpVecB);
            tmpDir.addScaledVector(tmpVecB, 0.38).normalize();
          }
        }
        const weight = 0.25 + 0.75 * Math.min(rawDist / maxRadius, 1.5);
        const magnitude = activeSpan * 0.42 * weight;
        for (const idx of cluster.indices) {
          this.unitWorldDisplacementsAt1[idx].copy(tmpDir).multiplyScalar(magnitude);
        }
      }
      return true;
    }

    if (params.mode === "axial") {
      // Sort clusters by signed projection along chosen CAD axis so symmetric or coplanar clusters separate cleanly
      const ranked = clusters
        .map((cluster, ci) => ({
          ci,
          cluster,
          proj: tmpVecA.copy(cluster.center).sub(scopeCenter).dot(axisDir),
        }))
        .sort((a, b) => a.proj - b.proj);

      const mid = (ranked.length - 1) / 2;
      for (let rank = 0; rank < ranked.length; rank++) {
        const { cluster, proj } = ranked[rank];
        const normProj = proj / maxRadius;
        const symmetricBias =
          ranked.length > 1 ? ((rank - mid) / Math.max(mid, 1)) * 0.18 : 0;
        const scalar = (normProj * 0.55 + symmetricBias) * activeSpan;
        for (const idx of cluster.indices) {
          this.unitWorldDisplacementsAt1[idx].copy(axisDir).multiplyScalar(scalar);
        }
      }
      return true;
    }

    if (params.mode === "directional") {
      const isDefaultUp =
        Math.abs(params.customDirectionCad[0]) < 1e-6 &&
        Math.abs(params.customDirectionCad[1]) < 1e-6 &&
        Math.abs(params.customDirectionCad[2] - 1) < 1e-6;

      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const firstComp = sceneGraph.components[this.entries[cluster.indices[0]].id];
        const hintOffset = firstComp?.cad?.explodeOffsetM ?? null;
        const hintDir = firstComp?.cad?.assemblyDirectionM ?? null;

        if (
          params.useManifestHints &&
          params.granularity === "component" &&
          isDefaultUp &&
          hintOffset
        ) {
          this.unitWorldDisplacementsAt1[cluster.indices[0]].set(
            hintOffset[0],
            hintOffset[1],
            hintOffset[2]
          );
          continue;
        }

        if (
          params.useManifestHints &&
          params.granularity === "component" &&
          isDefaultUp &&
          hintDir
        ) {
          tmpVecB.set(hintDir[0], hintDir[1], hintDir[2]);
          if (tmpVecB.lengthSq() > 1e-10) {
            tmpVecB.normalize().multiplyScalar(activeSpan * 0.28);
            this.unitWorldDisplacementsAt1[cluster.indices[0]].copy(tmpVecB);
            continue;
          }
        }

        const proj = tmpVecA.copy(cluster.center).sub(scopeCenter).dot(axisDir);
        const signedWeight = (proj / maxRadius) * 0.5 + 0.35;
        const magnitude = activeSpan * 0.4 * signedWeight;
        for (const idx of cluster.indices) {
          this.unitWorldDisplacementsAt1[idx].copy(axisDir).multiplyScalar(magnitude);
        }
      }
      return true;
    }

    // Hierarchical mode: separate by component logical/layer hierarchy depth without double displacement
    const upDir = cadAxisToGltf("Z", new Vector3());
    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci];
      tmpDir.copy(cluster.center).sub(scopeCenter);
      if (tmpDir.lengthSq() < 1e-6) {
        fallbackDeterministicDir(ci, tmpDir);
      } else {
        tmpDir.normalize();
      }
      for (const idx of cluster.indices) {
        const entry = this.entries[idx];
        const level = entry.logicalDepth + entry.layerDepth;
        const radialPart = activeSpan * (0.18 + 0.16 * level);
        const verticalPart = activeSpan * (0.14 * level);
        this.unitWorldDisplacementsAt1[idx]
          .copy(tmpDir)
          .multiplyScalar(radialPart)
          .addScaledVector(upDir, verticalPart);
      }
    }

    return true;
  }

  /**
   * Applies explosion factor monotonically from cached rest poses.
   * Zero drift on repeated calls and exact restoration at factor === 0.
   */
  applyFactor(factor: number): void {
    const safeFactor = Number.isFinite(factor) ? Math.max(0, factor) : 0;
    this.currentFactor = safeFactor;
    const n = this.entries.length;
    if (n === 0) return;

    if (safeFactor < 1e-7) {
      for (let i = 0; i < n; i++) {
        this.entries[i].object.position.copy(this.entries[i].restLocalPosition);
        this.appliedWorldDeltas[i].set(0, 0, 0);
      }
      this.scenePackage.model.scene.updateMatrixWorld(true);
      return;
    }

    for (let i = 0; i < n; i++) {
      const entry = this.entries[i];
      const desired = tmpVecA
        .copy(this.unitWorldDisplacementsAt1[i])
        .multiplyScalar(safeFactor);
      const parentDelta =
        entry.parentSnapIndex >= 0
          ? this.appliedWorldDeltas[entry.parentSnapIndex]
          : tmpZero;

      tmpNetWorld.copy(desired).sub(parentDelta);

      if (entry.hasValidInvLinear) {
        tmpLocalDelta.copy(tmpNetWorld).applyMatrix3(entry.parentInvLinear);
        entry.object.position.copy(entry.restLocalPosition).add(tmpLocalDelta);
      } else {
        entry.object.position.copy(entry.restLocalPosition);
      }

      this.appliedWorldDeltas[i].copy(desired);
    }

    this.scenePackage.model.scene.updateMatrixWorld(true);
  }

  reset(): void {
    this.applyFactor(0);
  }

  getComponentDelta(id: string, out = new Vector3()): Vector3 {
    const idx = this.indexById.get(id);
    if (idx === undefined) return out.set(0, 0, 0);
    return out.copy(this.appliedWorldDeltas[idx]);
  }

  getReferenceSegment(
    id: string,
    outStart: Vector3,
    outEnd: Vector3
  ): boolean {
    const idx = this.indexById.get(id);
    if (idx === undefined) return false;
    const delta = this.appliedWorldDeltas[idx];
    if (delta.lengthSq() < 1e-10) return false;
    outStart.copy(this.entries[idx].restWorldCenter);
    outEnd.copy(outStart).add(delta);
    return true;
  }

  computeBounds(
    options: {
      exploded: boolean;
      targetIds?: readonly string[];
      hiddenSet?: ReadonlySet<string>;
      isolatedSet?: ReadonlySet<string> | null;
    },
    out = new Box3()
  ): Box3 {
    out.makeEmpty();
    const targetSet =
      options.targetIds && options.targetIds.length > 0
        ? new Set(options.targetIds)
        : null;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (targetSet && !targetSet.has(entry.id)) continue;
      if (!targetSet) {
        const isVisible = options.isolatedSet
          ? options.isolatedSet.has(entry.id) && !(options.hiddenSet?.has(entry.id) ?? false)
          : !(options.hiddenSet?.has(entry.id) ?? false);
        if (!isVisible) continue;
      }

      tmpVecA.copy(entry.restWorldBox.min);
      tmpVecB.copy(entry.restWorldBox.max);
      if (options.exploded) {
        tmpVecA.add(this.appliedWorldDeltas[i]);
        tmpVecB.add(this.appliedWorldDeltas[i]);
      }
      out.expandByPoint(tmpVecA);
      out.expandByPoint(tmpVecB);
    }

    if (out.isEmpty()) {
      out.copy(this.restSceneBounds);
    }
    return out;
  }

  /**
   * Fills a flat Float32Array [x0,y0,z0, x1,y1,z1, ...] for batched LineSegments rendering.
   * Collapsed zero-length segments mark hidden or stationary components without reallocating buffers.
   */
  writeReferenceSegmentsBuffer(
    positions: Float32Array,
    hiddenSet: ReadonlySet<string>,
    isolatedSet: ReadonlySet<string> | null
  ): number {
    let activeSegments = 0;
    const n = this.entries.length;
    for (let i = 0; i < n; i++) {
      const offset = i * 6;
      const entry = this.entries[i];
      const delta = this.appliedWorldDeltas[i];
      const isVisible = isolatedSet
        ? isolatedSet.has(entry.id) && !hiddenSet.has(entry.id)
        : !hiddenSet.has(entry.id);

      if (!isVisible || delta.lengthSq() < 1e-10) {
        positions[offset] = 0;
        positions[offset + 1] = 0;
        positions[offset + 2] = 0;
        positions[offset + 3] = 0;
        positions[offset + 4] = 0;
        positions[offset + 5] = 0;
        continue;
      }

      const start = entry.restWorldCenter;
      positions[offset] = start.x;
      positions[offset + 1] = start.y;
      positions[offset + 2] = start.z;
      positions[offset + 3] = start.x + delta.x;
      positions[offset + 4] = start.y + delta.y;
      positions[offset + 5] = start.z + delta.z;
      activeSegments += 1;
    }
    return activeSegments;
  }
}
