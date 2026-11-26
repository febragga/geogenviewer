import { Matrix3, Vector3, type Object3D } from "three";
import type { AssemblyTimeline } from "./timeline.ts";

export class AssemblyPose {
  private readonly roots = new Map<string, {
    node: Object3D; rest: Vector3; worldToParent: Matrix3;
  }>();
  private readonly moved = new Set<string>();
  private readonly delta = new Vector3();

  constructor(scene: Object3D, nodes: ReadonlyMap<string, Object3D>) {
    scene.updateWorldMatrix(true, true);
    for (const [id, node] of nodes) {
      const worldToParent = new Matrix3();
      if (node.parent) worldToParent.setFromMatrix4(node.parent.matrixWorld).invert();
      this.roots.set(id, { node, rest: node.position.clone(), worldToParent });
    }
  }

  apply(timeline: AssemblyTimeline, time: number, solo: number | null, ghost: boolean) {
    const sample = timeline.sample(time);
    const active = solo === null ? sample.active : timeline.schedule[solo];
    this.reset();
    const remaining = solo === null ? 1 - sample.progress : 0;
    if (active) this.move(active.step.elementIds, active.step.insertionOffsetM, remaining);
    if (ghost && solo === null) {
      for (const { step } of timeline.schedule.slice(sample.index + 1)) {
        this.move(step.elementIds, step.insertionOffsetM, 1);
      }
    }
    return sample;
  }

  private move(ids: readonly string[], offset: [number, number, number] | undefined, remaining: number) {
    if (!offset || remaining <= 0) return;
    for (const id of ids) {
      const root = this.roots.get(id);
      if (!root) continue;
      const delta = this.delta.fromArray(offset).multiplyScalar(remaining).applyMatrix3(root.worldToParent);
      root.node.position.copy(root.rest).add(delta);
      root.node.updateMatrix();
      this.moved.add(id);
    }
  }

  reset() {
    for (const id of this.moved) {
      const root = this.roots.get(id)!;
      root.node.position.copy(root.rest);
      root.node.updateMatrix();
    }
    this.moved.clear();
  }
}
