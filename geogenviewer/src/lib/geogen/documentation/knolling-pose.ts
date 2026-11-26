import { Matrix4, Quaternion, Vector3, type Object3D } from "three";
import type { Revision } from "../revisions/revision.ts";
import type { LayoutResult } from "./knolling.ts";

const _zeroPos = new Vector3();

/** The renderer reads temporary local matrices. Authored position, rotation and scale remain intact. */
export class KnollingPose {
  private readonly entries: { id: string; node: Object3D; local: Matrix4; auto: boolean }[] = [];
  private readonly changed = new Set<Object3D>();
  private readonly scene: Object3D;
  private readonly revision: Revision;
  private readonly world = new Matrix4();
  private readonly rotMatrix = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly translation = new Vector3();
  private readonly parentInverses = new Map<Object3D, Matrix4 | null>();
  private result: LayoutResult | null = null;
  private placementById = new Map<string, LayoutResult["placements"][number]>();
  private fraction = 0;

  constructor(revision: Revision) {
    this.revision = revision;
    this.scene = revision.scene.model.scene;
    const ids = new Map([...revision.scene.objectByComponentId].map(([id, node]) => [node, id]));
    this.scene.updateWorldMatrix(true, true);
    this.scene.traverse((node) => {
      const id = ids.get(node);
      if (id) this.entries.push({ id, node, local: node.matrix.clone(), auto: node.matrixAutoUpdate });
    });
  }

  private getParentInverse(parent: Object3D): Matrix4 | null {
    if (this.parentInverses.has(parent)) {
      return this.parentInverses.get(parent) ?? null;
    }
    parent.updateWorldMatrix(true, false);
    if (parent.matrixWorld.determinant() === 0) {
      this.parentInverses.set(parent, null);
      return null;
    }
    const inv = parent.matrixWorld.clone().invert();
    this.parentInverses.set(parent, inv);
    return inv;
  }

  apply(result: LayoutResult | null, fraction: number) {
    const value = Math.min(1, Math.max(0, fraction));
    if (this.result === result && this.fraction === value) return;
    if (!result || value === 0) {
      this.reset();
      return;
    }

    if (this.result !== result) {
      this.reset();
      this.placementById = new Map(
        result.placements.map((placement) => [placement.item.representative.occurrence.id, placement])
      );
    }

    this.parentInverses.clear();
    const byId = this.placementById;

    for (const { id, node } of this.entries) {
      const placement = byId.get(id);
      if (!placement) continue;
      const rest = this.revision.occurrences.get(id)!.rest;
      if (value === 1) {
        this.world.copy(placement.world);
      } else {
        this.rotation.identity().slerp(placement.rotation, value);
        this.translation.setFromMatrixPosition(rest).addScaledVector(placement.delta, value);
        this.world.multiplyMatrices(this.rotMatrix.makeRotationFromQuaternion(this.rotation), rest).setPosition(this.translation);
      }
      if (node.parent) {
        const inv = this.getParentInverse(node.parent);
        if (!inv) continue;
        this.world.premultiply(inv);
      }
      node.matrixAutoUpdate = false;
      node.matrix.copy(this.world);
      node.matrixWorldNeedsUpdate = true;
      this.changed.add(node);
    }
    this.result = result;
    this.fraction = value;
    this.scene.updateMatrixWorld(true);
  }

  reset() {
    if (this.changed.size) {
      for (const { node, local, auto } of this.entries) if (this.changed.has(node)) {
        node.matrixAutoUpdate = auto;
        node.matrix.copy(local);
        node.matrixWorldNeedsUpdate = true;
      }
      this.changed.clear();
      this.scene.updateMatrixWorld(true);
    }
    this.result = null;
    this.placementById.clear();
    this.fraction = 0;
    void _zeroPos;
  }
}
