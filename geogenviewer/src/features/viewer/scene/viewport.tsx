"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  Color,
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
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";

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

function computeTargetBounds(
  scenePackage: LoadedScenePackage,
  targetIds?: string[]
): Box3 {
  const box = new Box3();
  if (targetIds && targetIds.length > 0) {
    for (const id of targetIds) {
      const obj = scenePackage.objectByComponentId.get(id);
      if (obj) {
        obj.traverse((child) => {
          if (isRenderableObject(child) && child.visible) {
            box.expandByObject(child);
          }
        });
      }
    }
    if (!box.isEmpty()) return box;
  }

  scenePackage.model.scene.traverse((child) => {
    if (isRenderableObject(child) && child.visible) {
      box.expandByObject(child);
    }
  });

  if (box.isEmpty()) {
    return scenePackage.model.bounds.clone();
  }
  return box;
}

function applyCameraCommand(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  scenePackage: LoadedScenePackage,
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
    const bounds =
      command.kind === "reset"
        ? scenePackage.model.bounds
        : computeTargetBounds(scenePackage, command.targetIds);
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

    const modelSphere = scenePackage.model.bounds.getBoundingSphere(new Sphere());
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
  command,
  mode,
  selectedIds,
  hoveredId,
  hiddenIds,
  isolatedIds,
  multiSelectMode,
  onSelect,
  onHover,
  onContextLost,
}: {
  scenePackage: LoadedScenePackage;
  command: CameraCommand;
  mode: NavigationMode;
  selectedIds: string[];
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedIds: string[] | null;
  multiSelectMode: boolean;
  onSelect: (id: string | null, options: { multi: boolean }) => void;
  onHover: (id: string | null) => void;
  onContextLost: () => void;
}) {
  const { camera, gl, invalidate, get } = useThree();
  const controlsRef = useRef<OrbitControls>(null);
  const originalMaterialsRef = useRef<WeakMap<Object3D, Material | Material[]>>(
    new WeakMap()
  );
  const tintCacheRef = useRef<Map<Material, HighlightEntry>>(new Map());
  const callbacksRef = useRef({ onSelect, onHover, multiSelectMode });

  useEffect(() => {
    callbacksRef.current = { onSelect, onHover, multiSelectMode };
  }, [multiSelectMode, onHover, onSelect]);

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
      scenePackage,
      command,
      width / Math.max(height, 1)
    );
    invalidate();
  }, [camera, command, get, gl, invalidate, scenePackage]);

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
    invalidate();
  }, [hiddenIds, invalidate, isolatedIds, scenePackage]);

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

  // Cleanup cached highlight materials on scene change or unmount.
  useEffect(() => {
    const originalMap = originalMaterialsRef.current;
    const tintCache = tintCacheRef.current;
    return () => {
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
  }, [scenePackage]);

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
  onSelect: (id: string | null, options: { multi: boolean }) => void;
  onHover: (id: string | null) => void;
  onContextLost: () => void;
  fallback: ReactNode;
}) {
  const { sphere, origin } = useMemo(() => {
    const s = scenePackage.model.bounds.getBoundingSphere(new Sphere());
    return { sphere: s, origin: scenePackage.model.bounds.min };
  }, [scenePackage]);

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
          command={command}
          mode={mode}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          hiddenIds={hiddenIds}
          isolatedIds={isolatedIds}
          multiSelectMode={multiSelectMode}
          onSelect={onSelect}
          onHover={onHover}
          onContextLost={onContextLost}
        />
      </Canvas>
    </RenderBoundary>
  );
}
