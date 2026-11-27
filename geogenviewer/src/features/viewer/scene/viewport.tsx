"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  DirectionalLight,
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  LineDashedMaterial,
  LineSegments,
  Object3D,
  PCFShadowMap,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { clippedBounds, firstVisibleHit, sectionAt } from "../../../lib/geogen/inspection/sections";
import { snapOnHit } from "../../../lib/geogen/inspection/snapping";
import { useInspection } from "../state/inspection-store";
import { activeClipping, InspectionScene } from "./inspection-scene";
import { AssemblyPose } from "../../../lib/geogen/assembly/pose";
import { useAssembly } from "../state/assembly-store";
import { usePresentation } from "../state/presentation-store";
import { useOrganizationStore } from "../state/organization-store";
import { resolveOrganizationView } from "../../../lib/geogen/organization/operations";
import { useViewerStore } from "../state/viewer-store";
import { viewportScope } from "../state/viewport-scopes";
import { resolveVisibility } from "../state/visibility-state";
import { defaultLighting, graphicBudget, resolveDisplayProfile } from "./display-profiles";
import { registerDisplayEffects, setSceneScaleRadius } from "./display-effects";
import { SceneDisplay } from "./display";
import { useViewportCameras } from "./viewport-cameras";
import {
  ExplodedViewController,
  type ExplodeParams,
} from "../../../lib/geogen/explode/controller";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { ExplodeTransitionRequest } from "../state/viewer-store";
import { ComparisonScene, type CompareSceneProps } from "./comparison-scene";
import { KnollingPose } from "../../../lib/geogen/documentation/knolling-pose";
import { type LayoutResult, type PlaneName } from "../../../lib/geogen/documentation/knolling";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { useKnollingMotion } from "../state/documentation-store";
import { DocumentationRenderer, type RenderDocumentationImage } from "./documentation-renderer";

function ViewportLighting({ target, sphere, span }: { target: Object3D; sphere: Sphere; span: number }) {
  const width = useThree((state) => state.size.width);
  const settings = usePresentation((state) => state.display);
  const layout = usePresentation((state) => state.layout);
  const maximized = usePresentation((state) => state.maximized);
  const lightRef = useRef<DirectionalLight>(null);
  const budget = graphicBudget(settings.quality, layout !== "single" && maximized === null ? 2 : 1, width < 640);
  const shadows = settings.shadows;
  const profile = resolveDisplayProfile(settings);
  const lighting = profile.lighting ?? defaultLighting;
  const radius = profile.shadows?.radius ?? 1;
  const shadowSize = budget.shadowSize;

  useLayoutEffect(() => {
    const light = lightRef.current;
    return () => {
      const shadow = light?.shadow;
      if (!shadow) return;
      shadow.dispose();
      shadow.map = null;
      shadow.mapPass = null;
    };
  }, [shadowSize, shadows, radius]);

  return <>
    <hemisphereLight intensity={lighting.ambient * settings.light} groundColor={lighting.groundColor} />
    <directionalLight ref={lightRef} position={[sphere.center.x + span, sphere.center.y + span, sphere.center.z + span]}
      intensity={lighting.key * settings.light} castShadow={shadows} shadow-mapSize={[shadowSize, shadowSize]}
      shadow-radius={radius} shadow-camera-left={-span} shadow-camera-right={span} shadow-camera-top={span} shadow-camera-bottom={-span}
      shadow-camera-near={span * 0.01} shadow-camera-far={span * 5} target={target} shadow-normalBias={span * 0.0001} />
    {lighting.fill ? <directionalLight position={[sphere.center.x - span, sphere.center.y + span * 0.85, sphere.center.z - span]}
      intensity={lighting.fill * settings.light} target={target} /> : null}
    {lighting.rim ? <directionalLight position={[sphere.center.x - span * 0.85, sphere.center.y + span * 0.55, sphere.center.z + span * 0.9]}
      intensity={lighting.rim * settings.light} target={target} /> : null}
  </>;
}

export type CameraCommand = {
  kind: "fit" | "reset" | "closer" | "farther";
  targetIds?: string[];
  seq?: number;
};

export type NavigationMode = "orbit" | "pan";
type KnollingScene = { result: LayoutResult; mask: ReadonlySet<string>; plane: PlaneName };

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
  onContextMenu,
  onContextLost,
  acceptCommand,
  revision,
  knolling,
  annotationVersion,
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
  onContextMenu?: (id: string | null, x: number, y: number) => void;
  onContextLost: () => void;
  acceptCommand: (command: CameraCommand) => boolean;
  revision: Revision;
  knolling?: KnollingScene;
  annotationVersion?: unknown;
}) {
  const { gl, scene: rootScene, invalidate } = useThree();
  const sphere = useMemo(() => controller.restSceneBounds.getBoundingSphere(new Sphere()), [controller]);
  const beforeDraw = useRef<(slot: number, selection?: boolean) => void>(null);
  const onDraw = useCallback((slot: number, selection?: boolean) => beforeDraw.current?.(slot, selection), []);
  const inspector = useRef<InspectionScene | null>(null);
  const sceneDisplayRef = useRef<SceneDisplay | null>(null);
  const motion = useCallback(() => {
    const state = useAssembly.getState();
    const workspace = useViewerStore.getState().workspace;
    const motion = useKnollingMotion.getState();
    const moving = workspace === "knolling" ? motion.playing : workspace === "assembly" ? state.playback.status === "playing" : useViewerStore.getState().explodeTransition !== null;
    return { moving, pose: [controller.factor, state.playback.seconds, workspace === "knolling" ? motion.amount : 0, moving ? performance.now() : 0].join(":") };
  }, [controller]);
  const cameras = useViewportCameras(sphere, onContextLost, onDraw, inspector, motion);
  const assemblyPose = useMemo(() => new AssemblyPose(scenePackage.model.scene, scenePackage.objectByComponentId), [scenePackage]);
  const workspace = useViewerStore((state) => state.workspace);
  const knollPose = useMemo(() => new KnollingPose(revision), [revision]);
  const knollRef = useRef(knolling);
  const lastPlane = useRef<PlaneName | null>(null);
  useEffect(() => {
    knollRef.current = knolling;
    invalidate();
  }, [knolling, annotationVersion, invalidate]);
  const display = usePresentation((state) => state.display);
  const orgDoc = useOrganizationStore((state) => state.doc);
  const lastAppliedAssembly = useRef<{ time: number; timeline: ReturnType<typeof useAssembly.getState>["timeline"]; ghost: boolean; solo: number | null } | null>(null);


  const callbacksRef = useRef({
    onSelect,
    onHover,
    onContextMenu,
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
      onContextMenu,
      multiSelectMode,
      onExplodeAnimationLiveFactor,
      onExplodeAnimationSettled,
      onExplodedBoundsChange,
    };
  }, [
    multiSelectMode,
    onContextMenu,
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
    if (workspace !== "knolling") return;
    const view = usePresentation.getState();
    const access = view.access;
    const previous = access?.pose(view.active);
    const slot = view.active;
    const stop = useKnollingMotion.subscribe((state, old) => {
      if (state.playing !== old.playing || !state.playing) invalidate();
    });
    return () => {
      stop();
      lastPlane.current = null;
      knollPose.reset();
      useKnollingMotion.getState().pause();
      if (previous && usePresentation.getState().access === access) access?.applySlot(slot, previous);
      invalidate();
    };
  }, [workspace, knollPose, invalidate]);

  useEffect(() => {
    if (!acceptCommand(command)) return;
    const layout = knollRef.current;
    let bounds = fitBounds(scenePackage, controller, visibilityRef.current.hiddenIds, visibilityRef.current.isolatedIds, command);
    if (layout && useKnollingMotion.getState().amount > 0) {
      if (!command.targetIds?.length) bounds = layout.result.bounds;
      else {
        const selection = new Box3();
        for (const id of command.targetIds) {
          const object = scenePackage.objectByComponentId.get(id);
          if (object) selection.expandByObject(object);
        }
        if (!selection.isEmpty()) bounds = selection;
      }
    }
    const clipped = command.kind === "fit" ? clippedBounds(bounds, activeClipping(usePresentation.getState().active)) : bounds;
    if (!clipped.isEmpty()) cameras.current?.command(command.kind, clipped.getBoundingSphere(new Sphere()));
  }, [acceptCommand, cameras, command, controller, scenePackage]);

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
    setSceneScaleRadius(rootScene, sphere.radius);
  }, [rootScene, sphere.radius]);

  useEffect(() => {
    const sceneDisplay = new SceneDisplay(scenePackage, rootScene);
    sceneDisplayRef.current = sceneDisplay;
    const runtime = new InspectionScene(gl, rootScene, scenePackage, invalidate);
    inspector.current = runtime;
    const vpVec = new Vector4();
    let last: readonly unknown[] = [];
    beforeDraw.current = (slot, selection = true) => {
      const view = usePresentation.getState();
      const scene = useViewerStore.getState();
      const assembly = useAssembly.getState();
      const scope = viewportScope(slot);
      const hovered = selection && (slot === view.active || view.shareSelection) ? scene.hoveredId : null;
      const config = useInspection.getState().doc?.sections;
      const technical = config && sectionAt(config, slot).mode === "technical" && activeClipping(slot).length > 0;
      const org = useOrganizationStore.getState().doc;
      const inputs = [
        view.display, technical, selection, scene.workspace, scope.selectedIds, hovered, scope.filters, scope.hiddenIds, scope.hiddenGroupKeys,
        scope.isolatedIds, assembly.timeline, assembly.stepIndex, assembly.ghost, assembly.solo, knollRef.current?.mask, org,
      ];
      const changed = inputs.some((value, index) => value !== last[index]);
      if (changed) {
        last = inputs;
        const userFilterOrg = resolveOrganizationView(scenePackage.sceneGraph, { ...org, activeSource: "user" });
        const filterOrg = { ...userFilterOrg, source: org.activeSource };
        const { denied, ghosts } = resolveVisibility(scenePackage.sceneGraph, scope, scene.workspace, assembly, filterOrg);
        const layout = knollRef.current;
        if (scene.workspace === "knolling" && layout) {
          for (const id of scenePackage.sceneGraph.componentOrder) if (!layout.mask.has(id)) denied.add(id);
        }
        const displaySettings = technical ? { ...view.display, mode: "technical" as const } : view.display;
        sceneDisplay.apply(displaySettings, new Set(selection ? scope.selectedIds : []), hovered, denied, scope.isolatedIds ? new Set(scope.isolatedIds) : null, ghosts, undefined, filterOrg);
        if (!view.shareVisibility) syncReferenceLines(explodeRef.current.showReferenceLines, Array.from(denied), scope.isolatedIds);
      }
      const target = gl.getRenderTarget();
      gl.getViewport(vpVec);
      const cssWidth = Math.max(1, gl.domElement.clientWidth);
      const lineScale = target ? Math.max(1, target.width / cssWidth) : 1;
      const edgeW = target ? target.width : Math.max(1, vpVec.z || cssWidth);
      const edgeH = target ? target.height : Math.max(1, vpVec.w || gl.domElement.clientHeight);
      sceneDisplay.syncEdgeResolution(edgeW, edgeH, lineScale);
    };
    return () => {
      beforeDraw.current = null;
      inspector.current = null;
      sceneDisplayRef.current = null;
      runtime.dispose();
      sceneDisplay.dispose();
      assemblyPose.reset();
      animRef.current.active = false;
      controller.reset();
    };
  }, [assemblyPose, controller, gl, invalidate, rootScene, scenePackage, syncReferenceLines]);

  useEffect(() => {
    onDraw(usePresentation.getState().active);
    syncReferenceLines(explodeRef.current.showReferenceLines, hiddenIds, isolatedIds);
    invalidate();
  }, [display, hiddenIds, hoveredId, invalidate, isolatedIds, onDraw, orgDoc, scenePackage, selectedIds, syncReferenceLines, workspace]);

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
      sceneDisplayRef.current?.syncBatchTransforms();
      lastAppliedAssembly.current = { time, timeline, ghost, solo };
    }
    if (playback.status === "playing") invalidate();
  }, -1);



  useEffect(() => {
    if (!knolling || knolling.result.bounds.isEmpty()) return;
    const rig = cameras.current;
    if (lastPlane.current !== knolling.plane) {
      lastPlane.current = knolling.plane;
      usePresentation.getState().access?.preset(knolling.plane === "XY" ? "top" : knolling.plane === "XZ" ? "front" : "right");
    }
    rig?.command("fit", knolling.result.bounds.getBoundingSphere(new Sphere()));
  }, [knolling, cameras]);

  useFrame(() => {
    const layout = knollRef.current;
    if (workspace !== "knolling" || !layout) return;
    const motion = useKnollingMotion.getState();
    knollPose.apply(layout.result, motion.frame(performance.now()));
    sceneDisplayRef.current?.syncBatchTransforms();
    if (motion.playing) invalidate();
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
    sceneDisplayRef.current?.syncBatchTransforms();

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
      sceneDisplayRef.current?.syncBatchTransforms();
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
    sceneDisplayRef.current?.syncBatchTransforms();
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

    function pick(event: PointerEvent, confirm: boolean): string | null {
      const hitRegion = cameras.current?.pick(event.clientX, event.clientY, pointerNdc);
      if (!hitRegion) return null;
      const measuring = useInspection.getState().tool === "measure";
      const runtime = inspector.current;
      onDraw(hitRegion.slot);
      scenePackage.model.scene.updateMatrixWorld();
      raycaster.setFromCamera(pointerNdc, hitRegion.camera);
      const hits = sceneDisplayRef.current?.intersections(raycaster) ??
        raycaster.intersectObject(scenePackage.model.scene, true);
      const { ghost, timeline, stepIndex, solo } = useAssembly.getState();
      const workspace = useViewerStore.getState().workspace;
      const ghostEnabled = workspace === "assembly" && ghost && solo === null;
      const planes = activeClipping(hitRegion.slot);
      const resolveCandidateId = (candidate: (typeof hits)[number]) =>
        sceneDisplayRef.current?.resolveHit(candidate) ?? scenePackage.resolveComponentId(candidate.object);
      const hit = firstVisibleHit(hits, planes, (candidate) => {
        const id = resolveCandidateId(candidate);
        return Boolean(id && (!ghostEnabled || (timeline.byElement.get(id) ?? -1) <= stepIndex));
      });
      const id = hit ? resolveCandidateId(hit) : null;
      if (measuring && runtime) {
        const snap = useInspection.getState().doc?.snap;
        const result = hit && id && snap ? snapOnHit(hit, hitRegion.camera, hitRegion.width, hitRegion.height,
          (pointerNdc.x + 1) * hitRegion.width / 2, (1 - pointerNdc.y) * hitRegion.height / 2,
          snap, planes, event.shiftKey) : null;
        runtime.setCandidate(hitRegion.slot, result);
        if (confirm && result && hit && id) {
          const sourceHit = sceneDisplayRef.current?.sourceIntersection(hit) ?? hit;
          const anchor = runtime.anchor(sourceHit, id, result.point, result.mode);
          if (anchor) useInspection.getState().confirm(anchor, workspace);
        }
      }
      onDraw(usePresentation.getState().active);
      return id;
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
      const hitId = pick(event, false);
      const measuring = useInspection.getState().tool === "measure";
      canvas.style.cursor = hitId ? (measuring ? "crosshair" : "pointer") : "";
      callbacksRef.current.onHover(measuring ? null : hitId);
    }

    function onPointerLeave() {
      canvas.style.cursor = "";
      inspector.current?.clearCandidate();
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

      const hitId = pick(event, true);
      if (useInspection.getState().tool === "measure") return;
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

    function onCanvasContextMenu(event: MouseEvent) {
      if (!callbacksRef.current.onContextMenu) return;
      event.preventDefault();
      const fakePointer = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      } as unknown as PointerEvent;
      const hitId = pick(fakePointer, false);
      callbacksRef.current.onContextMenu(hitId, event.clientX, event.clientY);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("contextmenu", onCanvasContextMenu);

    return () => {
      canvas.style.cursor = "";
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("contextmenu", onCanvasContextMenu);
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
  onContextMenu,
  onContextLost,
  fallback,
  comparison,
  revision,
  knolling,
  onDocumentationRenderer,
  annotationVersion,
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
  onContextMenu?: (id: string | null, x: number, y: number) => void;
  onContextLost: () => void;
  fallback: ReactNode;
  comparison?: CompareSceneProps;
  revision: Revision;
  knolling?: KnollingScene;
  onDocumentationRenderer: (service: RenderDocumentationImage | null) => void;
  annotationVersion?: unknown;
}) {
  const controller = useMemo(
    () => new ExplodedViewController(scenePackage),
    [scenePackage]
  );

  const handledCommand = useRef<CameraCommand | null>(null);
  const acceptCommand = useCallback((next: CameraCommand) => {
    if (handledCommand.current === next) return false;
    handledCommand.current = next;
    return true;
  }, []);

  const settings = usePresentation((state) => state.display);
  const layout = usePresentation((state) => state.layout);
  const maximized = usePresentation((state) => state.maximized);
  const budget = graphicBudget(settings.quality, layout !== "single" && maximized === null ? 2 : 1);
  const profile = resolveDisplayProfile(settings);
  registerDisplayEffects();
  const { sphere, origin } = useMemo(() => {
    const s = controller.restSceneBounds.getBoundingSphere(new Sphere());
    return { sphere: s, origin: controller.restSceneBounds.min };
  }, [controller]);

  const gridPrimary = profile.grid?.primary ?? "#6e8294";
  const gridSecondary = profile.grid?.secondary ?? "#9baab6";
  const grid = useMemo(() => new GridHelper(Math.max(sphere.radius * 4, 0.00001), 20, gridPrimary, gridSecondary), [sphere, gridPrimary, gridSecondary]);
  useEffect(() => () => grid.dispose(), [grid]);
  const showGrid = settings.grid || Boolean(settings.mode === "blueprint" && profile.grid?.defaultVisible);
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
        dpr={budget.dpr === 1 ? 1 : [1, budget.dpr]}
        shadows={settings.shadows ? { type: PCFShadowMap } : false}
        role="region"
        aria-label="Modelo tridimensional"
      >
        <DocumentationRenderer attach={onDocumentationRenderer} />
        {comparison ? <ComparisonScene {...comparison} command={command} acceptCommand={acceptCommand} mode={mode} onContextLost={onContextLost} /> : <>
        <ViewportLighting target={lightTarget} sphere={sphere} span={span} />
        <primitive object={lightTarget} />
        <primitive object={scenePackage.model.scene} />
        <axesHelper visible={settings.axes} userData={{ ggInspectionHelper: "axes" }}
          args={[Math.max(sphere.radius * 0.35, 0.000001)]}
          position={[origin.x, origin.y, origin.z]}
        />
        <primitive object={grid} visible={showGrid} userData={{ ggInspectionHelper: "grid" }}
          position={[sphere.center.x, origin.y - span * 0.0001, sphere.center.z]} />
        {settings.ground && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sphere.center.x, origin.y - span * 0.0002, sphere.center.z]} receiveShadow>
          <planeGeometry args={[span, span]} />
          <meshStandardMaterial color={profile.groundColor ?? "#9ca7ac"} roughness={1} />
        </mesh>}
        <SceneController
          scenePackage={scenePackage}
          revision={revision}
          knolling={knolling}
          annotationVersion={annotationVersion}
          acceptCommand={acceptCommand}
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
          onContextMenu={onContextMenu}
          onContextLost={onContextLost}
        />
        </>}
      </Canvas>
    </RenderBoundary>
  );
}
