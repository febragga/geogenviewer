"use client";

import { useEffect, useRef } from "react";
import { Vector3, type Camera } from "three";
import {
  drawCallouts,
  projectCallouts,
  resolveCalloutPalette,
  type annotationModel,
} from "../../../lib/geogen/documentation/callouts";
import { planeBasis, type LayoutResult, type PlaneName, type Rect } from "../../../lib/geogen/documentation/knolling";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { activeClipping } from "../scene/inspection-scene";
import { useAssembly } from "../state/assembly-store";
import { useViewerStore } from "../state/viewer-store";

export type AnnotationModel = ReturnType<typeof annotationModel>;
export type GroupMarkers = { result: LayoutResult; plane: PlaneName; quantities: boolean };

const measuredWidthCache = new Map<string, number>();
function measureCachedText(ctx: CanvasRenderingContext2D, text: string): number {
  const hit = measuredWidthCache.get(text);
  if (hit !== undefined) return hit;
  const w = ctx.measureText(text).width;
  if (measuredWidthCache.size > 2000) measuredWidthCache.clear();
  measuredWidthCache.set(text, w);
  return w;
}

function resolveOverlayAppearance(viewport: Element | null, darkScheme: boolean): { dark: boolean; mode?: "blueprint" | "mono" } {
  const modeBg = viewport?.getAttribute("data-mode-background");
  const bgOverride = viewport?.getAttribute("data-background");
  if (bgOverride === "white") return { dark: false };
  if (bgOverride === "dark") return { dark: true };
  if (modeBg === "blueprint") return { dark: true, mode: "blueprint" };
  if (modeBg === "mono") return { dark: false, mode: "mono" };
  if (modeBg === "neutral" || modeBg === "dither") return { dark: false };
  return { dark: darkScheme };
}

export function drawPublication(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera,
  slot: number,
  revision: Revision,
  annotations: AnnotationModel,
  mask: ReadonlySet<string> | null,
  dark: boolean,
  leaders: boolean,
  groups?: GroupMarkers,
  mode?: "blueprint" | "mono",
) {
  ctx.font = "12px system-ui, sans-serif";
  const palette = resolveCalloutPalette(dark, mode);
  const assembly = useViewerStore.getState().workspace === "assembly" ? useAssembly.getState() : null;
  const reserved: Rect[] = [];
  if (groups) {
    const [u, v] = planeBasis(groups.plane);
    const pointA = new Vector3();
    const pointB = new Vector3();
    ctx.save();
    ctx.font = "600 11.5px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (const { label, count, rect } of groups.result.groups.slice(0, 80)) {
      if (!label || !(rect.w > 0)) continue;
      pointA.copy(u).multiplyScalar(rect.x).addScaledVector(v, rect.y).project(camera);
      pointB.copy(u).multiplyScalar(rect.x).addScaledVector(v, rect.y + Math.max(rect.h, 0)).project(camera);
      if (Math.abs(pointA.x) > 1.2 || Math.abs(pointA.y) > 1.2) continue;
      const ax = (1 + pointA.x) * width / 2;
      const ay = (1 - pointA.y) * height / 2;
      const bx = (1 + pointB.x) * width / 2;
      const by = (1 - pointB.y) * height / 2;
      const x = Math.max(6, Math.min(ax, bx));
      const topY = Math.min(ay, by);
      const title = label + (groups.quantities ? " · " + count : "");
      const maxW = Math.max(40, width - x - 8);
      const badgeW = Math.min(maxW, measureCachedText(ctx, title) + 18);
      const badgeH = 20;
      const badgeY = Math.max(4, topY - badgeH - 6);
      ctx.fillStyle = palette.fill;
      ctx.fillRect(x, badgeY, badgeW, badgeH);
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);
      if (palette.accent) {
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x + 1, badgeY + 1, 3, badgeH - 2);
      }
      ctx.fillStyle = palette.text;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 8, badgeY, Math.max(0, badgeW - 14), badgeH);
      ctx.clip();
      ctx.fillText(title, x + 8, badgeY + badgeH / 2);
      ctx.restore();
      reserved.push({ x, y: badgeY, w: badgeW + 4, h: badgeH + 4 });
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
  }, activeClipping(slot), (text) => measureCachedText(ctx, text), 80, reserved);
  drawCallouts(ctx, labels, dark, leaders, palette);
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
    let lastSignature = "";
    const meta = document.querySelector('meta[name="color-scheme"]');
    let cachedAppearance = resolveOverlayAppearance(parent, meta?.getAttribute("content") === "dark");
    const invalidateSig = () => {
      cachedAppearance = resolveOverlayAppearance(parent, meta?.getAttribute("content") === "dark");
      lastSignature = "";
    };
    const metaObserver = meta ? new MutationObserver(invalidateSig) : null;
    if (meta && metaObserver) metaObserver.observe(meta, { attributes: true, attributeFilter: ["content"] });
    const viewportObserver = new MutationObserver(invalidateSig);
    viewportObserver.observe(parent, { attributes: true, attributeFilter: ["data-background", "data-mode-background"] });

    const update = (event: Event) => {
      const { camera, slot, region } = (event as CustomEvent<{ camera: Camera; slot: number; region?: { x: number; y: number; width: number; height: number } }>).detail;
      if (!camera) return;
      const { clientWidth: width, clientHeight: height } = target;
      const m = camera.matrixWorldInverse.elements;
      const p = camera.projectionMatrix.elements;
      const sig = `${width}x${height}:${slot}:${cachedAppearance.dark}:${cachedAppearance.mode ?? ""}:${m[0].toFixed(3)},${m[4].toFixed(3)},${m[8].toFixed(3)},${m[12].toFixed(3)},${m[13].toFixed(3)},${m[14].toFixed(3)}:${p[0].toFixed(3)},${p[5].toFixed(3)}`;
      if (sig === lastSignature) return;
      lastSignature = sig;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (target.width !== Math.round(width * dpr) || target.height !== Math.round(height * dpr)) {
        target.width = Math.round(width * dpr); target.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.save();
      if (region) {
        context.translate(region.x, region.y);
        context.beginPath(); context.rect(0, 0, region.width, region.height); context.clip();
      }
      drawPublication(
        context,
        region?.width ?? width,
        region?.height ?? height,
        camera,
        slot,
        revision,
        annotations,
        mask,
        cachedAppearance.dark,
        true,
        groups,
        cachedAppearance.mode,
      );
      context.restore();
    };
    parent.addEventListener("geogen-camera-frame", update);
    return () => {
      metaObserver?.disconnect();
      viewportObserver.disconnect();
      parent.removeEventListener("geogen-camera-frame", update);
    };
  }, [revision, annotations, mask, groups]);
  return <canvas className="gg-v08-overlay" ref={canvas} aria-hidden="true" />;
}
