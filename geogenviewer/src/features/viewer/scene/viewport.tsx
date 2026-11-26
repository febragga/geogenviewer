"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineDashedMaterial,
  LineSegments,
  MOUSE,
  PerspectiveCamera,
  Raycaster,
  Sphere,
  TOUCH,
  Vector2,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

const initialDirection = new Vector3(1.3, 0.9, 1.5).normalize();
const selectionTint = new Color("#5cb3e8");
const hoverTint = new Color("#89c9ee");
const dragThresholdPx = 6;
const boundsTmpSize = new Vector3();

interface HighlightEntry {
  selected: Material;
  hovered: Material;
}

function isRenderableObject(obj: Object3D): boolean {
  const candidate = obj as {
    isMesh?: boolean;
    isLine?: boolean;
    isPoints?: boolean;
  };
  return Boolean(candidate.isMesh || candidate.isLine || candidate.isPoints);
}

function createTintedMaterial(
  base: Material,
  mode: "selected" | "hovered"
): Material {
  const cloned = base.clone();
  const std = cloned as Material & {
    emissive?: Color;
    emissiveIntensity?: number;
    color?: Color;
  };
  const tint = mode === "selected" ? selectionTint : hoverTint;
  if (std.emissive && typeof std.emissive.copy === "function") {
    std.emissive.copy(tint);
    std.emissiveIntensity = mode === "selected" ? 0.5 : 0.24;
  } else if (std.color && typeof std.color.lerp === "function") {
    std.color.lerp(tint, mode === "selected" ? 0.55 : 0.28);
  }
  cloned.needsUpdate = true;
  return cloned;
}

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

function applyCameraCommand(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  controller: ExplodedViewController,
  hiddenIds: readonly string[],
  isolatedIds: readonly string[] | null,
  command: CameraCommand,
  aspect: number
) {
  if (command.kind === "closer" || command.kind === "farther") {
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length() * (command.kind === "closer" ? 0.8 : 1.25);
    camera.position
      .copy(controls.target)
      .add(
        offset.setLength(
          Math.min(controls.maxDistance, Math.max(controls.minDistance, distance))
        )
      );
  } else {
    const isExploded = controller.factor > 1e-6;
    const hiddenSet = new Set(hiddenIds);
    const isolatedSet = isolatedIds ? new Set(isolatedIds) : null;
    const bounds =
      command.kind === "reset"
        ? controller.computeBounds({ exploded: isExploded }, new Box3())
        : controller.computeBounds(
            {
              exploded: isExploded,
              targetIds: command.targetIds,
              hiddenSet,
              isolatedSet,
            },
            new Box3()
          );
    const sphere = bounds.getBoundingSphere(new Sphere());
    const radius = Math.max(sphere.radius, 0.000001);
    const vertical = (camera.fov * Math.PI) / 360;
    const horizontal = Math.atan(Math.tan(vertical) * Math.max(aspect, 0.01));
    const distance = (1.16 * radius) / Math.sin(Math.min(vertical, horizontal));
    const direction =
      command.kind === "reset"
        ? initialDirection
        : camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);

    const modelSphere = controller.restSceneBounds.getBoundingSphere(new Sphere());
    const modelRadius = Math.max(modelSphere.radius, 0.000001);
    controls.minDistance = Math.min(radius, modelRadius) * 0.02;
    controls.maxDistance = Math.max(distance, modelRadius * 4) * 30;
    camera.near = Math.min(radius, modelRadius) * 0.001;
    camera.far = controls.maxDistance + 4 * modelRadius;
    camera.updateProjectionMatrix();
  }
  controls.update();
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
  const { camera, gl, scene: rootScene, invalidate, get } = useThree();
  const controlsRef = useRef<OrbitControls>(null);
  const originalMaterialsRef = useRef<WeakMap<Object3D, Material | Material[]>>(
    new WeakMap()
  );
  const tintCacheRef = useRef<Map<Material, HighlightEntry>>(new Map());

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
    const canvas = gl.domElement;
    const controls = new OrbitControls(camera, canvas);
    controlsRef.current = controls;
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    canvas.setAttribute("tabindex", "0");
    controls.listenToKeyEvents(canvas);
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => {
      controlsRef.current = null;
      controls.removeEventListener("change", onChange);
      controls.dispose();
      canvas.removeEventListener("webglcontextlost", onContextLost);
    };
  }, [camera, gl, invalidate, onContextLost]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.LEFT = mode === "pan" ? MOUSE.PAN : MOUSE.ROTATE;
    controls.touches.ONE = mode === "pan" ? TOUCH.PAN : TOUCH.ROTATE;
  }, [camera, gl, mode]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { width, height } = get().size;
    applyCameraCommand(
      camera as PerspectiveCamera,
      controls,
      controller,
      visibilityRef.current.hiddenIds,
      visibilityRef.current.isolatedIds,
      command,
      width / Math.max(height, 1)
    );
    invalidate();
  }, [camera, command, controller, get, gl, invalidate]);

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

  // Apply component visibility cleanly on renderables so isolating a child inside a hidden parent stays visible.
  useEffect(() => {
    const hiddenSet = new Set(hiddenIds);
    const isolatedSet = isolatedIds ? new Set(isolatedIds) : null;

    scenePackage.model.scene.traverse((obj) => {
      if (!isRenderableObject(obj)) return;
      const id = scenePackage.resolveComponentId(obj);
      if (!id) {
        obj.visible = true;
        return;
      }
      obj.visible = isolatedSet
        ? isolatedSet.has(id) && !hiddenSet.has(id)
        : !hiddenSet.has(id);
    });

    syncReferenceLines(
      explodeRef.current.showReferenceLines,
      hiddenIds,
      isolatedIds
    );
    invalidate();
  }, [hiddenIds, invalidate, isolatedIds, scenePackage, syncReferenceLines]);

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

  // Apply non-destructive material highlight for selected and hovered components.
  useEffect(() => {
    const selectedSet = new Set(selectedIds);
    const originalMap = originalMaterialsRef.current;
    const tintCache = tintCacheRef.current;

    const getTint = (base: Material, state: "selected" | "hovered"): Material => {
      let entry = tintCache.get(base);
      if (!entry) {
        entry = {
          selected: createTintedMaterial(base, "selected"),
          hovered: createTintedMaterial(base, "hovered"),
        };
        tintCache.set(base, entry);
      }
      return entry[state];
    };

    scenePackage.model.scene.traverse((obj) => {
      if (!isRenderableObject(obj)) return;
      const renderable = obj as Mesh;
      if (!renderable.material) return;

      if (!originalMap.has(renderable)) {
        originalMap.set(renderable, renderable.material);
      }
      const original = originalMap.get(renderable)!;
      const compId = scenePackage.resolveComponentId(renderable);
      const state: "selected" | "hovered" | null =
        compId && selectedSet.has(compId)
          ? "selected"
          : compId && hoveredId === compId
            ? "hovered"
            : null;

      if (!state) {
        if (renderable.material !== original) {
          renderable.material = original;
        }
        return;
      }

      renderable.material = Array.isArray(original)
        ? original.map((mat) => getTint(mat, state))
        : getTint(original, state);
    });

    invalidate();
  }, [hoveredId, invalidate, scenePackage, selectedIds]);

  // Cleanup cached highlight materials & restore rest pose on unmount
  useEffect(() => {
    const originalMap = originalMaterialsRef.current;
    const tintCache = tintCacheRef.current;
    return () => {
      animRef.current.active = false;
      controller.reset();
      scenePackage.model.scene.traverse((obj) => {
        if (!isRenderableObject(obj)) return;
        const renderable = obj as Mesh;
        const original = originalMap.get(renderable);
        if (original) {
          renderable.material = original;
        }
      });
      for (const entry of tintCache.values()) {
        entry.selected.dispose();
        entry.hovered.dispose();
      }
      tintCache.clear();
    };
  }, [controller, scenePackage]);

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
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(scenePackage.model.scene, true);
      for (const hit of hits) {
        if (!hit.object.visible) continue;
        const id = scenePackage.resolveComponentId(hit.object);
        if (id) return id;
      }
      return null;
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
  }, [camera, gl, scenePackage]);

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

  const { sphere, origin } = useMemo(() => {
    const s = controller.restSceneBounds.getBoundingSphere(new Sphere());
    return { sphere: s, origin: controller.restSceneBounds.min };
  }, [controller]);

  return (
    <RenderBoundary fallback={fallback}>
      <Canvas
        fallback={fallback}
        frameloop="demand"
        dpr={[1, 1.5]}
        role="region"
        aria-label="Modelo tridimensional"
      >
        <hemisphereLight intensity={2.2} groundColor="#788698" />
        <directionalLight position={[3, 5, 4]} intensity={2.6} />
        <primitive object={scenePackage.model.scene} />
        <axesHelper
          args={[Math.max(sphere.radius * 0.35, 0.000001)]}
          position={[origin.x, origin.y, origin.z]}
        />
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
