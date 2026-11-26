"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Color, DirectionalLight, Group, HemisphereLight, Matrix4, Raycaster, Scene, Sphere, Vector2, type Camera, type InstancedMesh, type Mesh, type Object3D } from "three";
import { createStore } from "zustand";
import { firstVisibleHit } from "../../../lib/geogen/inspection/sections";
import { defaultHiddenIds, hiddenByFilters } from "../../../lib/geogen/domain/visibility";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import type { RevisionComparison, Side } from "../state/revision-workspace";
import { usePresentation, type PngOptions } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { useInspection } from "../state/inspection-store";
import { SceneDisplay } from "./display";
import { activeClipping, type InspectionScene } from "./inspection-scene";
import { useViewportCameras, type CameraRigState } from "./viewport-cameras";
import type { CameraCommand, NavigationMode } from "./viewport";

export interface CompareSceneProps {
  base: Revision;
  comparison: Revision;
  state: RevisionComparison;
  primaryKey: string;
  compact: boolean;
  onCaptureChange: (capture: (() => Promise<Blob>) | null) => void;
  single?: Side;
  quantitySelection?: readonly string[];
  onQuantitySelect?: (id: string | null, multi: boolean) => void;
}

const sides = ["base", "comparison"] as const;
const still = () => ({ moving: false, pose: "rest" });

function presentRevision(revision: Revision) {
  const group = new Group();
  group.matrixAutoUpdate = false;
  const owners = new WeakMap<Mesh, string>();
  for (const { id, mesh, world } of revision.renderables) {
    const view = mesh.clone(false);
    view.matrixAutoUpdate = false;
    view.matrix.copy(world);
    owners.set(view, id);
    group.add(view);
  }
  const loaded = revision.scene;
  const resolveComponentId: typeof loaded.resolveComponentId = (object) => object ? owners.get(object as Mesh) ?? null : null;
  return { group, loaded: { ...loaded, model: { ...loaded.model, scene: group }, resolveComponentId } };
}

function setTransform(group: Group, matrix: Matrix4 | null) {
  group.matrix.copy(matrix ?? new Matrix4());
  group.matrixWorldNeedsUpdate = true;
}

async function composeComparison(first: Blob, second: Blob, labels: [string, string]) {
  const a = await createImageBitmap(first);
  try {
    const b = await createImageBitmap(second);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = a.width + b.width;
      canvas.height = Math.max(a.height, b.height) + 36;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Composição de imagem indisponível.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(a, 0, 36);
      ctx.drawImage(b, a.width, 36);
      ctx.fillStyle = "#182438";
      ctx.font = "16px sans-serif";
      ctx.fillText(labels[0], 12, 24, a.width - 24);
      ctx.fillText(labels[1], a.width + 12, 24, b.width - 24);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG.")), "image/png"));
    } finally { b.close(); }
  } finally { a.close(); }
}

export function ComparisonScene({ base, comparison, state, primaryKey, compact, onCaptureChange, single, quantitySelection,
  onQuantitySelect, command, acceptCommand, mode, onContextLost }: CompareSceneProps & {
  command: CameraCommand; acceptCommand: (command: CameraCommand) => boolean; mode: NavigationMode; onContextLost: () => void;
}) {
  const { gl, invalidate } = useThree();
  const data = useMemo(() => {
    const scene = new Scene();
    const objects = { base: presentRevision(base), comparison: presentRevision(comparison) };
    const sky = new HemisphereLight("#ffffff", "#788698", 2.2);
    scene.add(objects.base.group, objects.comparison.group, sky);
    const sun = new DirectionalLight("#ffffff", 2.6);
    sun.position.set(1, 2, 1);
    scene.add(sun);
    return { scene, objects, sky, sun, boundsA: new Box3().setFromObject(objects.base.group), boundsB: new Box3().setFromObject(objects.comparison.group) };
  }, [base, comparison]);
  const inspector = useRef<InspectionScene | null>(null);
  const engine = useRef<Record<Side, SceneDisplay> | null>(null);
  const runtime = useRef<(slot: number, selection?: boolean) => void>(null);
  const onDraw = useMemo(() => (slot: number, selection?: boolean) => runtime.current?.(slot, selection), []);
  const live = useRef({ state, compact, single, onQuantitySelect });
  const split = !single && !compact && state.display.mode === "side";
  const separation = state.space?.matrix ?? null;
  const bounds = useMemo(() => {
    const first = data.boundsA.clone();
    const second = data.boundsB.clone();
    // Groups are mounted with their rest transforms; keep the fit in comparison space.
    return single === "base" ? first : single === "comparison" ? second :
      first.union(separation ? second.applyMatrix4(separation) : second);
  }, [data, separation, single]);
  const initialBounds = useMemo(() => {
    const first = base.scene.sceneGraph.sceneBoundsMeters;
    const other = comparison.scene.sceneGraph.sceneBoundsMeters;
    const diameter = Math.max(Math.hypot(...first), Math.hypot(...other), 1e-6);
    const sphere = new Sphere();
    return new Sphere(data.boundsA.getCenter(sphere.center), diameter / 2);
  }, [base, comparison, data]);
  const store = useMemo(() => createStore<CameraRigState>()((set) => ({
    layout: "single", maximized: null, active: 0, syncZoom: false, syncTarget: false, syncOrientation: true,
    shareVisibility: true, shareSelection: true, projections: ["perspective", "perspective", "orthographic", "orthographic"],
    poses: [null, null, null, null],
    setActive: (active) => set({ active }),
  })), []);
  const rigOptions = useMemo(() => ({ scene: data.scene, store }), [data, store]);
  const cameras = useViewportCameras(initialBounds, onContextLost, onDraw, inspector, still, rigOptions);

  useEffect(() => {
    live.current = { state, compact, single, onQuantitySelect };
  }, [state, compact, single, onQuantitySelect]);

  useEffect(() => {
    store.setState({ layout: split ? "horizontal" : "single", active: 0 });
  }, [store, split]);

  useEffect(() => {
    store.setState({ syncOrientation: state.display.sync, syncTarget: true, syncZoom: true });
  }, [store, state.display.sync]);

  useEffect(() => {
    const comparisonGroup = data.objects.comparison.group;
    setTransform(comparisonGroup, single ? null : separation);
    data.scene.updateMatrixWorld(true);
    invalidate();
    return () => {
      setTransform(comparisonGroup, null);
    };
  }, [data, single, separation, invalidate]);

  useEffect(() => {
    const savedPlanes = gl.clippingPlanes;
    const displays = {
      base: new SceneDisplay(data.objects.base.loaded, data.objects.base.group, true),
      comparison: new SceneDisplay(data.objects.comparison.loaded, data.objects.comparison.group, true),
    };
    engine.current = displays;
    return () => {
      runtime.current = null;
      engine.current = null;
      gl.clippingPlanes = savedPlanes;
      for (const side of sides) {
        displays[side].dispose();
        for (const mesh of data.objects[side].group.children) if ((mesh as InstancedMesh).isInstancedMesh) (mesh as InstancedMesh).dispose();
      }
    };
  }, [data, gl]);

  const styles = useMemo(() => {
    type SideStyle = { hidden: Set<string>; ghosts: Set<string>; colors: Map<string, Color>; selected: Set<string> };
    const styles: Record<Side, SideStyle> = {
      base: { hidden: new Set(), ghosts: new Set(), colors: new Map(), selected: new Set() },
      comparison: { hidden: new Set(), ghosts: new Set(), colors: new Map(), selected: new Set() },
    };
    const { display, selection, diffs, inputs } = state;
    for (const row of diffs) {
      for (const [side, id] of [["base", row.baseId], ["comparison", row.comparisonId]] as const) {
        if (!id) continue;
        const entry = styles[side];
        if (display.semantic) entry.colors.set(id, new Color(display.colors[row.status]));
        if (inputs.filter && row.status !== inputs.filter) entry.hidden.add(id);
        if (display.mode === "differences" && row.status === "unchanged") {
          if (display.context) entry.ghosts.add(id);
          else entry.hidden.add(id);
        }
        if (selection && (selection.side === "base" ? selection.id === row.baseId : selection.id === row.comparisonId)) entry.selected.add(id);
      }
    }
    if (selection) styles[selection.side].selected.add(selection.id);
    if (single) styles[single].selected = new Set(quantitySelection ?? []);
    return styles;
  }, [state, single, quantitySelection]);

  useEffect(() => {
    let last: readonly unknown[] = [];
    runtime.current = (slot, selection = true) => {
      const displays = engine.current;
      if (!displays) return;
      const view = usePresentation.getState();
      const { display } = state;
      const viewer = useViewerStore.getState();
      const settings = view.display;
      data.sky.intensity = 2.2 * settings.light;
      data.sun.intensity = 2.6 * settings.light;
      const planes = activeClipping(view.active);
      gl.clippingPlanes = primaryKey === comparison.key && !single && separation ? planes.map((plane) =>
        plane.clone().applyMatrix4(separation)) : planes;
      const showOnly = single ?? (split ? sides[slot] ?? "base" :
        display.mode === "toggle" || (display.mode === "side" && compact) ? display.side : null);
      const visible = sides.filter((side) => showOnly ? side === showOnly : display.visible[side]);
      for (const side of sides) data.objects[side].group.visible = visible.includes(side);
      const inputs = [settings, selection, viewer.hiddenIds, viewer.isolatedIds, viewer.filters, viewer.selectedIds];
      if (inputs.every((value, index) => value === last[index])) return;
      last = inputs;
      for (const side of sides) {
        const revision = side === "base" ? base : comparison;
        const graph = revision.scene.sceneGraph;
        const primary = revision.key === primaryKey;
        const style = styles[side];
        const hidden = new Set(single ? [] : style.hidden);
        for (const id of primary ? viewer.hiddenIds : defaultHiddenIds(graph)) hidden.add(id);
        const selected = selection ? style.selected : new Set<string>();
        for (const id of hiddenByFilters(graph, viewer.filters, [...selected], new Map())) hidden.add(id);
        const isolated = !single && display.isolate && state.selection ? style.selected :
          primary && viewer.isolatedIds ? new Set(viewer.isolatedIds) : null;
        const opacity = !single && !showOnly ? display.opacity[side] : 1;
        const mode = !single && display.semantic ? "shaded" : settings.mode;
        displays[side].apply({ ...settings, mode, opacity: opacity * settings.opacity, shadows: false },
          selected, null, hidden, isolated, single ? new Set() : style.ghosts, single ? undefined : style.colors);
      }
    };
    const stopView = usePresentation.subscribe((a, b) => { if (a.display !== b.display || a.active !== b.active) invalidate(); });
    const stopInspect = useInspection.subscribe(() => invalidate());
    const stopViewer = useViewerStore.subscribe(() => invalidate());
    invalidate();
    return () => { runtime.current = null; stopView(); stopInspect(); stopViewer(); };
  }, [data, base, comparison, primaryKey, compact, state, styles, split, single, separation, gl, invalidate]);

  useEffect(() => { cameras.current?.mode(mode === "pan"); }, [cameras, mode]);

  useEffect(() => {
    cameras.current?.command("reset", bounds.getBoundingSphere(new Sphere()));
  }, [bounds, cameras]);

  useEffect(() => {
    if (!acceptCommand(command)) return;
    const region = bounds.clone();
    if (command.targetIds?.length) {
      const selected = new Box3();
      for (const side of (single ? [single] : sides)) {
        const { group, loaded } = data.objects[side];
        const ids = new Set(command.targetIds);
        for (const child of group.children) {
          const id = loaded.resolveComponentId(child);
          if (id && ids.has(id)) selected.expandByObject(child);
        }
      }
      if (!selected.isEmpty()) region.copy(selected);
    }
    cameras.current?.command(command.kind, region.getBoundingSphere(new Sphere()));
  }, [acceptCommand, bounds, cameras, command, data, single]);

  useEffect(() => {
    const canvas = gl.domElement;
    const ray = new Raycaster(), ndc = new Vector2();
    const pointers = new Set<number>();
    let down: PointerEvent | null = null;
    const start = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointers.add(event.pointerId);
      down = pointers.size === 1 ? event : null;
    };
    const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); down = null; };
    const pick = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      const first = down;
      down = null;
      if (!first || first.pointerId !== event.pointerId || Math.hypot(first.clientX - event.clientX, first.clientY - event.clientY) > 6) return;
      const region = cameras.current?.pick(event.clientX, event.clientY, ndc);
      if (!region) return;
      onDraw(region.slot);
      ray.setFromCamera(ndc, region.camera as Camera);
      const groups = sides.filter((side) => data.objects[side].group.visible);
      const byGroup = new Map(groups.map((side) => [data.objects[side].group, side]));
      const sideOf = (obj: Object3D | null): Side | null => {
        for (let cur = obj; cur; cur = cur.parent) {
          const found = byGroup.get(cur as Group);
          if (found) return found;
        }
        return null;
      };
      const hits = ray.intersectObjects([...byGroup.keys()], true);
      const hit = firstVisibleHit(hits, gl.clippingPlanes, (candidate) =>
        Boolean(candidate.object.visible && sideOf(candidate.object)));
      const side = hit ? sideOf(hit.object) : null;
      const id = side && hit
        ? (engine.current?.[side].resolveHit(hit) ?? data.objects[side].loaded.resolveComponentId(hit.object))
        : null;
      const current = live.current;
      if (current.single) current.onQuantitySelect?.(id, event.ctrlKey || event.metaKey || event.shiftKey);
      else current.state.select(side && id ? { side, id } : null);
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointerup", pick);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("lostpointercapture", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointerup", pick);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
    };
  }, [cameras, data, gl, onDraw]);

  useEffect(() => {
    onCaptureChange(async () => {
      const rig = cameras.current;
      if (!rig) throw new Error("A viewport ainda está carregando.");
      const options: PngOptions = { width: split ? 960 : 1920, transparent: false, background: "#fff" };
      if (!split) return rig.capture(options, 0);
      const [left, right] = await Promise.all([rig.capture(options, 0), rig.capture(options, 1)]);
      return composeComparison(left, right, [base.identity.revisionId ?? "Base", comparison.identity.revisionId ?? "Comparada"]);
    });
    return () => { onCaptureChange(null); };
  }, [onCaptureChange, base, comparison, cameras, split]);

  return null;
}
