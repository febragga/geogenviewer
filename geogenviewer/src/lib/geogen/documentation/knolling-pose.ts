import { Matrix4, Quaternion, Vector3, type Object3D } from "three";
import type { Revision } from "../revisions/revision.ts";
import type { LayoutResult } from "./knolling.ts";

/** The renderer reads temporary local matrices. Authored position, rotation and scale remain intact. */
export class KnollingPose {
  private readonly entries: { id: string; node: Object3D; local: Matrix4; auto: boolean }[] = [];
  private readonly changed = new Set<Object3D>();
  private readonly scene: Object3D;
  private readonly revision: Revision;
  private readonly world = new Matrix4();
  private readonly parentInverse = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly translation = new Vector3();
  private result: LayoutResult | null = null;
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

  apply(result: LayoutResult | null, fraction: number) {
    const value = Math.min(1, Math.max(0, fraction));
    if (this.result === result && this.fraction === value) return;
    this.reset();
    if (!result || value === 0) return;
    const byId = new Map(result.placements.map((placement) => [placement.item.representative.occurrence.id, placement]));
    // Parents are visited first. Inverting the current parent matrix gives independently placed children their own targets.
    for (const { id, node } of this.entries) {
      const placement = byId.get(id);
      if (!placement) continue;
      const rest = this.revision.occurrences.get(id)!.rest;
      if (value === 1) this.world.copy(placement.world);
      else {
        this.rotation.identity().slerp(placement.rotation, value);
        this.translation.setFromMatrixPosition(rest).addScaledVector(placement.delta, value);
        this.world.makeRotationFromQuaternion(this.rotation).multiply(rest).setPosition(this.translation);
      }
      if (node.parent) {
        node.parent.updateWorldMatrix(true, false);
        if (node.parent.matrixWorld.determinant() === 0) continue;
        this.world.premultiply(this.parentInverse.copy(node.parent.matrixWorld).invert());
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
    this.fraction = 0;
  }
}
