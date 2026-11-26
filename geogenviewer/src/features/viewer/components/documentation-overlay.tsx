"use client";

import { useEffect, useRef } from "react";
import { Color, Vector3, type Camera } from "three";
import { drawCallouts, projectCallouts, type annotationModel } from "../../../lib/geogen/documentation/callouts";
import { planeBasis, type LayoutResult, type PlaneName, type Rect } from "../../../lib/geogen/documentation/knolling";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { activeClipping } from "../scene/inspection-scene";
import { useAssembly } from "../state/assembly-store";
import { useViewerStore } from "../state/viewer-store";

export type AnnotationModel = ReturnType<typeof annotationModel>;
export type GroupMarkers = { result: LayoutResult; plane: PlaneName; quantities: boolean };

export function drawPublication(ctx: CanvasRenderingContext2D, width: number, height: number, camera: Camera, slot: number,
  revision: Revision, annotations: AnnotationModel, mask: ReadonlySet<string> | null, dark: boolean, leaders: boolean, groups?: GroupMarkers) {
  ctx.font = "12px system-ui, sans-serif";
  const assembly = useViewerStore.getState().workspace === "assembly" ? useAssembly.getState() : null;
  const reserved: Rect[] = [];
  if (groups) {
    const [u, v] = planeBasis(groups.plane);
    const point = new Vector3(), stroke = new Color(dark ? "#9caebb" : "#405e76");
    ctx.save();
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#" + stroke.getHexString();
    ctx.strokeStyle = ctx.fillStyle;
    for (const { label, count, rect } of groups.result.groups.slice(0, 80)) {
      if (!label || !(rect.w > 0)) continue;
      point.copy(u).multiplyScalar(rect.x).addScaledVector(v, rect.y).project(camera);
      if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
      const x = (1 + point.x) * width / 2, y = (1 - point.y) * height / 2;
      const title = label + (groups.quantities ? " · " + count : "");
      const max = Math.max(30, width - x);
      ctx.fillText(title, x, y - 6, max);
      reserved.push({ x, y: y - 20, w: Math.min(max, ctx.measureText(title).width) + 5, h: 17 });
    }
    ctx.restore();
  }
  const labels = projectCallouts(annotations, camera, width, height, (id) => {
    if (mask && !mask.has(id)) return undefined;
    const step = assembly?.timeline.byElement.get(id);
    if (step !== undefined && assembly && step > assembly.stepIndex) return undefined;
    const node = revision.scene.objectByComponentId.get(id);
    if (!node || (!node.visible && "material" in node)) return undefined;
    return node.matrixWorld;
  }, activeClipping(slot), (text) => ctx.measureText(text).width, 80, reserved);
  drawCallouts(ctx, labels, dark, leaders);
}

export function DocumentationOverlay({ revision, annotations, mask, groups }: {
  revision: Revision; annotations: AnnotationModel; mask: ReadonlySet<string> | null; groups?: GroupMarkers;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = canvas.current;
    const parent = target?.closest(".gg-viewport");
    if (!target || !parent) return;
    const context = target.getContext("2d");
    if (!context) return;
    const update = (event: Event) => {
      const { camera, slot, region } = (event as CustomEvent<{ camera: Camera; slot: number; region?: { x: number; y: number; width: number; height: number } }>).detail;
      if (!camera) return;
      const { clientWidth: width, clientHeight: height } = target;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (target.width !== Math.round(width * dpr) || target.height !== Math.round(height * dpr)) {
        target.width = Math.round(width * dpr); target.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const dark = getComputedStyle(parent).colorScheme === "dark" ||
        document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") === "dark";
      context.save();
      if (region) {
        context.translate(region.x, region.y);
        context.beginPath(); context.rect(0, 0, region.width, region.height); context.clip();
      }
      drawPublication(context, region?.width ?? width, region?.height ?? height, camera, slot, revision, annotations, mask, dark, true, groups);
      context.restore();
    };
    parent.addEventListener("geogen-camera-frame", update);
    return () => parent.removeEventListener("geogen-camera-frame", update);
  }, [revision, annotations, mask, groups]);
  return <canvas className="gg-v08-overlay" ref={canvas} aria-hidden="true" />;
}
