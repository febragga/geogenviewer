"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  LineDashedMaterial,
  LineSegments,
  Object3D,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { AssemblyPose } from "../../../lib/geogen/assembly/pose";
import { useAssembly } from "../state/assembly-store";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { viewportScope } from "../state/viewport-scopes";
import { resolveVisibility } from "../state/visibility-state";
import { SceneDisplay } from "./display";
import { useViewportCameras } from "./viewport-cameras";
import {
  ExplodedViewController,
  type ExplodeParams,
} from "../../../lib/geogen/explode/controller";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { ExplodeTransitionRequest } from "../state/viewer-store";

export type CameraCommand = {
  kind: "fit" | "reset" | "closer" | "farther";
  targetIds?: string[];
  seq?: number;
};

export type NavigationMode = "orbit" | "pan";

const dragThresholdPx = 6;
const boundsTmpSize = new Vector3();

function resolveRefLineHex(): string {
  if (typeof document === "undefined") return "#8ec8ea";
  const meta = document.querySelector('meta[name="color-scheme"]');
  const content = meta?.getAttribute("content");
  if (content === "light") return "#1d5f82";
  if (content === "dark") return "#89c8fa";
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "#89c8fa" : "#1d5f82";
}

function fitBounds(scenePackage: LoadedScenePackage, controller: ExplodedViewController, hidden: readonly string[], isolated: readonly string[] | null, command: CameraCommand) {
  if (command.kind === "reset") return controller.restSceneBounds;
  if (useViewerStore.getState().workspace !== "assembly") {
    return controller.computeBounds({
      exploded: controller.factor > 1e-6, targetIds: command.targetIds,
      hiddenSet: new Set(hidden), isolatedSet: isolated ? new Set(isolated) : null,
    }, new Box3());
  }
  const bounds = new Box3();
  const hiddenSet = new Set(hidden);
  const isolatedSet = isolated ? new Set(isolated) : null;
  for (const id of command.targetIds ?? scenePackage.sceneGraph.componentOrder) {
    const root = scenePackage.objectByComponentId.get(id);
    if (root && !hiddenSet.has(id) && (!isolatedSet || isolatedSet.has(id))) bounds.expandByObject(root);
  }
  return bounds.isEmpty() ? controller.restSceneBounds : bounds;
}

function SceneController({
  scenePackage,
  controller,
  command,
  mode,
  selectedIds,
  hoveredId,
  hiddenIds,
  isolatedIds,
  multiSelectMode,
  explode,
  explodeTransition,
  onExplodeAnimationLiveFactor,
  onExplodeAnimationSettled,
  onExplodedBoundsChange,
  onSelect,
  onHover,
  onContextLost,
}: {
  scenePackage: LoadedScenePackage;
  controller: ExplodedViewController;
  command: CameraCommand;
  mode: NavigationMode;
  selectedIds: string[];
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedIds: string[] | null;
  multiSelectMode: boolean;
  explode: ExplodeParams;
  explodeTransition: ExplodeTransitionRequest | null;
  onExplodeAnimationLiveFactor?: (factor: number) => void;
  onExplodeAnimationSettled: (factor: number) => void;
  onExplodedBoundsChange: (bounds: [number, number, number] | null) => void;
  onSelect: (id: string | null, options: { multi: boolean }) => void;
  onHover: (id: string | null) => void;
  onContextLost: () => void;
}) {
  const { gl, scene: rootScene, invalidate } = useThree();
  const sphere = useMemo(() => controller.restSceneBounds.getBoundingSphere(new Sphere()), [controller]);
  const beforeDraw = useRef<(slot: number) => void>(null);
  const onDraw = useCallback((slot: number) => beforeDraw.current?.(slot), []);
  const cameras = useViewportCameras(sphere, onContextLost, onDraw);
  const assemblyPose = useMemo(() => new AssemblyPose(scenePackage.model.scene, scenePackage.objectByComponentId), [scenePackage]);
  const workspace = useViewerStore((state) => state.workspace);
  const display = usePresentation((state) => state.display);
  const lastAppliedAssembly = useRef<{ time: number; timeline: ReturnType<typeof useAssembly.getState>["timeline"]; ghost: boolean; solo: number | null } | null>(null);
  const appliedCommand = useRef<CameraCommand | null>(null);

  const callbacksRef = useRef({
    onSelect,
    onHover,
    multiSelectMode,
    onExplodeAnimationLiveFactor,
    onExplodeAnimationSettled,
    onExplodedBoundsChange,
  });
  const visibilityRef = useRef({ hiddenIds, isolatedIds });
  const explodeRef = useRef(explode);

  useEffect(() => {
    callbacksRef.current = {
      onSelect,
      onHover,
      multiSelectMode,
      onExplodeAnimationLiveFactor,
      onExplodeAnimationSettled,
      onExplodedBoundsChange,
    };
  }, [
    multiSelectMode,
    onExplodeAnimationLiveFactor,
    onExplodeAnimationSettled,
    onExplodedBoundsChange,
    onHover,
    onSelect,
  ]);

  useEffect(() => {
    visibilityRef.current = { hiddenIds, isolatedIds };
  }, [hiddenIds, isolatedIds]);

  useEffect(() => {
    explodeRef.current = explode;
  }, [explode]);

  // Batched GPU LineSegments stored in ref (allocated & disposed inside useEffect)
  const refLinesRef = useRef<{
    lines: LineSegments;
    geometry: BufferGeometry;
    attr: BufferAttribute;
    material: LineDashedMaterial;
    positions: Float32Array;
  } | null>(null);

  useEffect(() => {
    const count = Math.max(controller.componentCount, 1);
    const positions = new Float32Array(count * 6);
    const geometry = new BufferGeometry();
    const attr = new BufferAttribute(positions, 3);
    geometry.setAttribute("position", attr);

    const span = Math.max(controller.referenceSpan, 0.05);
    const material = new LineDashedMaterial({
      color: resolveRefLineHex(),
      dashSize: span * 0.028,
      gapSize: span * 0.018,
      transparent: true,
      opacity: 0.72,
      depthTest: true,
    });

    const lines = new LineSegments(geometry, material);
    lines.name = "__geogen_explode_reference_lines";
    lines.visible = false;
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    lines.raycast = () => {};

    refLinesRef.current = { lines, geometry, attr, material, positions };
    rootScene.add(lines);

    const updateThemeColor = () => {
      material.color.set(resolveRefLineHex());
      material.needsUpdate = true;
      invalidate();
    };

    const meta = document.querySelector('meta[name="color-scheme"]');
    const observer = meta ? new MutationObserver(updateThemeColor) : null;
    if (meta && observer) {
      observer.observe(meta, { attributes: true, attributeFilter: ["content"] });
    }

    return () => {
      observer?.disconnect();
      rootScene.remove(lines);
      geometry.dispose();
      material.dispose();
      refLinesRef.current = null;
    };
  }, [controller, invalidate, rootScene]);

  const animRef = useRef<{
    active: boolean;
    from: number;
    to: number;
    progress: number;
    duration: number;
  }>({ active: false, from: 0, to: 0, progress: 0, duration: 0.55 });

  useEffect(() => {
    cameras.current?.mode(mode === "pan");
  }, [cameras, mode]);

  useEffect(() => {
    if (appliedCommand.current === command) return;
    appliedCommand.current = command;
    const bounds = fitBounds(scenePackage, controller, visibilityRef.current.hiddenIds, visibilityRef.current.isolatedIds, command);
    cameras.current?.command(command.kind, bounds.getBoundingSphere(new Sphere()));
  }, [cameras, command, controller, scenePackage]);

  const syncReferenceLines = useCallback(
    (
      showLines: boolean,
      hiddenList: readonly string[],
      isolatedList: readonly string[] | null
    ) => {
      const res = refLinesRef.current;
      if (!res) return;
      if (!showLines || controller.factor <= 1e-6) {
        res.lines.visible = false;
        return;
      }
      const hiddenSet = new Set(hiddenList);
      const isolatedSet = isolatedList ? new Set(isolatedList) : null;
      const activeCount = controller.writeReferenceSegmentsBuffer(
        res.positions,
        hiddenSet,
        isolatedSet
      );
      res.attr.needsUpdate = true;
      if (activeCount > 0) {
        res.lines.computeLineDistances();
        res.lines.visible = true;
      } else {
        res.lines.visible = false;
      }
    },
    [controller]
  );

  useEffect(() => {
    const sceneDisplay = new SceneDisplay(scenePackage);
    let last: readonly unknown[] = [];
    beforeDraw.current = (slot) => {
      const view = usePresentation.getState();
      const scene = useViewerStore.getState();
      const assembly = useAssembly.getState();
      const scope = viewportScope(slot);
      const hovered = slot === view.active || view.shareSelection ? scene.hoveredId : null;
      const inputs = [
        view.display, scene.workspace, scope.selectedIds, hovered, scope.filters, scope.hiddenIds,
        scope.isolatedIds, assembly.timeline, assembly.stepIndex, assembly.ghost, assembly.solo,
      ];
      const changed = inputs.some((value, index) => value !== last[index]);
      if (changed) {
        last = inputs;
        const { denied, ghosts } = resolveVisibility(scenePackage.sceneGraph, scope, scene.workspace, assembly);
        sceneDisplay.apply(view.display, new Set(scope.selectedIds), hovered, denied, scope.isolatedIds ? new Set(scope.isolatedIds) : null, ghosts);
        if (!view.shareVisibility) syncReferenceLines(explodeRef.current.showReferenceLines, Array.from(denied), scope.isolatedIds);
      }
    };
    return () => {
      beforeDraw.current = null;
      sceneDisplay.dispose();
      assemblyPose.reset();
      animRef.current.active = false;
      controller.reset();
    };
  }, [assemblyPose, controller, scenePackage, syncReferenceLines]);

  useEffect(() => {
    onDraw(usePresentation.getState().active);
    syncReferenceLines(explodeRef.current.showReferenceLines, hiddenIds, isolatedIds);
    invalidate();
  }, [display, hiddenIds, hoveredId, invalidate, isolatedIds, onDraw, scenePackage, selectedIds, syncReferenceLines, workspace]);

  useEffect(() => {
    if (workspace === "assembly") return useAssembly.subscribe(() => invalidate());
    lastAppliedAssembly.current = null;
    assemblyPose.reset();
  }, [assemblyPose, invalidate, workspace]);

  useFrame(() => {
    if (workspace !== "assembly") return;
    const now = performance.now();
    const time = useAssembly.getState().frame(now);
    const { timeline, playback, ghost, solo } = useAssembly.getState();
    const previous = lastAppliedAssembly.current;
    if (!previous || previous.time !== time || previous.timeline !== timeline || previous.ghost !== ghost || previous.solo !== solo) {
      assemblyPose.apply(timeline, time, solo, ghost);
      lastAppliedAssembly.current = { time, timeline, ghost, solo };
    }
    if (playback.status === "playing") invalidate();
  }, -1);

  // Apply non-destructive Exploded View transforms (when not inside an animated transition)
  const selectionKeyForScope = explode.scope === "selection" ? selectedIds.join(",") : "";

  useEffect(() => {
    controller.prepare(explode, selectionKeyForScope ? selectionKeyForScope.split(",") : []);

    if (animRef.current.active && explodeTransition) {
      invalidate();
      return;
    }

    const effectiveFactor = explode.enabled ? explode.factor : 0;
    controller.applyFactor(effectiveFactor);

    syncReferenceLines(
      explode.showReferenceLines,
      visibilityRef.current.hiddenIds,
      visibilityRef.current.isolatedIds
    );

    if (effectiveFactor > 1e-6) {
      const bounds = controller.computeBounds({ exploded: true }, new Box3());
      bounds.getSize(boundsTmpSize);
      callbacksRef.current.onExplodedBoundsChange([
        boundsTmpSize.x,
        boundsTmpSize.y,
        boundsTmpSize.z,
      ]);
    } else {
      callbacksRef.current.onExplodedBoundsChange(null);
    }

    invalidate();
  }, [
    controller,
    explode,
    explodeTransition,
    invalidate,
    selectionKeyForScope,
    syncReferenceLines,
  ]);

  // Trigger smooth animation on explodeTransition change (respecting prefers-reduced-motion)
  useEffect(() => {
    if (!explodeTransition) {
      animRef.current.active = false;
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const target = explodeTransition.toFactor;
    if (prefersReduced || Math.abs(target - controller.factor) < 1e-4) {
      animRef.current.active = false;
      controller.applyFactor(target);
      syncReferenceLines(
        explodeRef.current.showReferenceLines,
        visibilityRef.current.hiddenIds,
        visibilityRef.current.isolatedIds
      );
      if (target > 1e-6) {
        const bounds = controller.computeBounds({ exploded: true }, new Box3());
        bounds.getSize(boundsTmpSize);
        callbacksRef.current.onExplodedBoundsChange([
          boundsTmpSize.x,
          boundsTmpSize.y,
          boundsTmpSize.z,
        ]);
      } else {
        callbacksRef.current.onExplodedBoundsChange(null);
      }
      callbacksRef.current.onExplodeAnimationSettled(target);
      invalidate();
      return;
    }

    animRef.current = {
      active: true,
      from: controller.factor,
      to: target,
      progress: 0,
      duration: 0.38 + 0.32 * Math.min(1.5, Math.abs(target - controller.factor)),
    };
    invalidate();
  }, [controller, explodeTransition, invalidate, syncReferenceLines]);

  useFrame((_, delta) => {
    const anim = animRef.current;
    if (!anim.active) return;

    anim.progress = Math.min(1, anim.progress + Math.max(delta, 0.008) / anim.duration);
    const t = anim.progress;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const nextFactor = anim.from + (anim.to - anim.from) * eased;

    controller.applyFactor(nextFactor);
    callbacksRef.current.onExplodeAnimationLiveFactor?.(nextFactor);

    syncReferenceLines(
      explodeRef.current.showReferenceLines,
      visibilityRef.current.hiddenIds,
      visibilityRef.current.isolatedIds
    );

    if (anim.progress >= 1) {
      anim.active = false;
      if (anim.to > 1e-6) {
        const bounds = controller.computeBounds({ exploded: true }, new Box3());
        bounds.getSize(boundsTmpSize);
        callbacksRef.current.onExplodedBoundsChange([
          boundsTmpSize.x,
          boundsTmpSize.y,
          boundsTmpSize.z,
        ]);
      } else {
        callbacksRef.current.onExplodedBoundsChange(null);
      }
      callbacksRef.current.onExplodeAnimationSettled(anim.to);
    } else {
      invalidate();
    }
  });



  // Raycasting click/tap picking distinguishing orbit/pan drag from selection click/tap.
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const pointerNdc = new Vector2();
    const activePointers = new Set<number>();
    let downState: {
      pointerId: number;
      x: number;
      y: number;
      pointerType: string;
    } | null = null;
    let multiTouch = false;

    function pickComponent(clientX: number, clientY: number): string | null {
      const hitRegion = cameras.current?.pick(clientX, clientY, pointerNdc);
      if (!hitRegion) return null;
      onDraw(hitRegion.slot);
      raycaster.setFromCamera(pointerNdc, hitRegion.camera);
      const hits = raycaster.intersectObject(scenePackage.model.scene, true);
      const { ghost, timeline, stepIndex, solo } = useAssembly.getState();
      const ghostEnabled = useViewerStore.getState().workspace === "assembly" && ghost && solo === null;
      const hitId = hits.find((hit) => {
        if (!hit.object.visible) return false;
        const id = scenePackage.resolveComponentId(hit.object);
        return id && (!ghostEnabled || (timeline.byElement.get(id) ?? -1) <= stepIndex);
      });
      onDraw(usePresentation.getState().active);
      return hitId ? scenePackage.resolveComponentId(hitId.object) : null;
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      activePointers.add(event.pointerId);
      if (activePointers.size > 1) {
        multiTouch = true;
        downState = null;
        return;
      }
      multiTouch = false;
      downState = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      };
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse" || activePointers.size > 0) return;
      const hitId = pickComponent(event.clientX, event.clientY);
      canvas.style.cursor = hitId ? "pointer" : "";
      callbacksRef.current.onHover(hitId);
    }

    function onPointerLeave() {
      canvas.style.cursor = "";
      callbacksRef.current.onHover(null);
    }

    function onPointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      if (!downState || downState.pointerId !== event.pointerId || multiTouch) {
        if (activePointers.size === 0) multiTouch = false;
        return;
      }
      const distance = Math.hypot(
        event.clientX - downState.x,
        event.clientY - downState.y
      );
      downState = null;
      if (distance >= dragThresholdPx) return;

      const hitId = pickComponent(event.clientX, event.clientY);
      const multi =
        callbacksRef.current.multiSelectMode ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey;

      if (!hitId && multi) return;
      callbacksRef.current.onSelect(hitId, { multi });
    }

    function onPointerCancel(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      downState = null;
      if (activePointers.size === 0) multiTouch = false;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    return () => {
      canvas.style.cursor = "";
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [cameras, gl, onDraw, scenePackage]);

  return null;
}

class RenderBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Viewport({
  scenePackage,
  command,
  mode,
  selectedIds,
  hoveredId,
  hiddenIds,
  isolatedIds,
  multiSelectMode,
  explode,
  explodeTransition,
  onExplodeAnimationLiveFactor,
  onExplodeAnimationSettled,
  onExplodedBoundsChange,
  onSelect,
  onHover,
  onContextLost,
  fallback,
}: {
  scenePackage: LoadedScenePackage;
  command: CameraCommand;
  mode: NavigationMode;
  selectedIds: string[];
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedIds: string[] | null;
  multiSelectMode: boolean;
  explode: ExplodeParams;
  explodeTransition: ExplodeTransitionRequest | null;
  onExplodeAnimationLiveFactor?: (factor: number) => void;
  onExplodeAnimationSettled: (factor: number) => void;
  onExplodedBoundsChange: (bounds: [number, number, number] | null) => void;
  onSelect: (id: string | null, options: { multi: boolean }) => void;
  onHover: (id: string | null) => void;
  onContextLost: () => void;
  fallback: ReactNode;
}) {
  const controller = useMemo(
    () => new ExplodedViewController(scenePackage),
    [scenePackage]
  );

  const settings = usePresentation((state) => state.display);
  const { sphere, origin } = useMemo(() => {
    const s = controller.restSceneBounds.getBoundingSphere(new Sphere());
    return { sphere: s, origin: controller.restSceneBounds.min };
  }, [controller]);

  const grid = useMemo(() => new GridHelper(Math.max(sphere.radius * 4, 0.00001), 20, "#6e8294", "#9baab6"), [sphere]);
  useEffect(() => () => grid.dispose(), [grid]);
  const span = Math.max(sphere.radius * 5, 0.00001);
  const lightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.copy(sphere.center);
    return target;
  }, [sphere]);
  return (
    <RenderBoundary fallback={fallback}>
      <Canvas
        fallback={fallback}
        frameloop="demand"
        dpr={settings.quality === "performance" ? 1 : settings.quality === "high" ? [1, 2] : [1, 1.5]}
        shadows={settings.shadows}
        role="region"
        aria-label="Modelo tridimensional"
      >
        <hemisphereLight intensity={2.2 * settings.light} groundColor="#788698" />
        <directionalLight position={[sphere.center.x + span, sphere.center.y + span, sphere.center.z + span]} intensity={2.6 * settings.light}
          castShadow={settings.shadows} shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-span} shadow-camera-right={span}
          shadow-camera-top={span} shadow-camera-bottom={-span}
          shadow-camera-near={span * 0.01} shadow-camera-far={span * 5}
          target={lightTarget} shadow-normalBias={span * 0.0001} />
        <primitive object={lightTarget} />
        <primitive object={scenePackage.model.scene} />
        {settings.axes && <axesHelper
          args={[Math.max(sphere.radius * 0.35, 0.000001)]}
          position={[origin.x, origin.y, origin.z]}
        />}
        {settings.grid && <primitive object={grid} position={[sphere.center.x, origin.y - span * 0.0001, sphere.center.z]} />}
        {settings.ground && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sphere.center.x, origin.y - span * 0.0002, sphere.center.z]} receiveShadow>
          <planeGeometry args={[span, span]} />
          <meshStandardMaterial color="#9ca7ac" roughness={1} />
        </mesh>}
        <SceneController
          scenePackage={scenePackage}
          controller={controller}
          command={command}
          mode={mode}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          hiddenIds={hiddenIds}
          isolatedIds={isolatedIds}
          multiSelectMode={multiSelectMode}
          explode={explode}
          explodeTransition={explodeTransition}
          onExplodeAnimationLiveFactor={onExplodeAnimationLiveFactor}
          onExplodeAnimationSettled={onExplodeAnimationSettled}
          onExplodedBoundsChange={onExplodedBoundsChange}
          onSelect={onSelect}
          onHover={onHover}
          onContextLost={onContextLost}
        />
      </Canvas>
    </RenderBoundary>
  );
}
