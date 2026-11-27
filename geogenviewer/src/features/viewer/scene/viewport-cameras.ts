import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import {
  Matrix4, MOUSE, OrthographicCamera, PerspectiveCamera, Quaternion, Sphere, SRGBColorSpace, TOUCH,
  Vector2, Vector3, Vector4, WebGLRenderTarget, type Scene, type WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  fieldOfView, fittedHeight, initialPose, orientPose, synchronizePose, viewDirections, viewHeightAtDistance,
  viewRegions, viewSlots, type CameraPose, type Vec3, type ViewRegion,
} from "./camera-state";
import { usePresentation, type PngOptions, type RenderStats } from "../state/presentation-store";
import { createDisplayPipeline } from "./display-pipeline";
import { activeClipping, type InspectionScene } from "./inspection-scene";

type ViewCamera = PerspectiveCamera | OrthographicCamera;
type Rig = ReturnType<typeof createRig>;

export type CameraRigState = Pick<ReturnType<typeof usePresentation.getState>,
  "layout" | "maximized" | "poses" | "projections" | "active" | "setActive" | "syncTarget" | "syncZoom" | "shareVisibility" | "shareSelection"> & { syncOrientation?: boolean };
export interface CameraRigStore {
  getState: () => CameraRigState;
  setState: (patch: Partial<CameraRigState>) => void;
  subscribe: (listener: (state: CameraRigState, previous: CameraRigState) => void) => () => void;
}
export interface CameraRigOptions {
  scene: Scene;
  store: CameraRigStore;
}

interface Slot {
  perspective: PerspectiveCamera;
  orthographic: OrthographicCamera;
  controls: OrbitControls;
  transition: { from: CameraPose; to: CameraPose; elapsed: number } | null;
  pose: CameraPose;
  aspect: number;
}

function configure(slot: Slot, pose: CameraPose, aspect: number, radius: number) {
  const camera = pose.projection === "perspective" ? slot.perspective : slot.orthographic;
  const halfHeight = pose.height / 2;
  slot.perspective.aspect = aspect;
  slot.orthographic.left = -halfHeight * aspect;
  slot.orthographic.right = halfHeight * aspect;
  slot.orthographic.top = halfHeight;
  slot.orthographic.bottom = -halfHeight;
  camera.position.fromArray(pose.position);
  camera.up.fromArray(pose.up);
  camera.zoom = 1;
  const distance = camera.position.distanceTo(slot.controls.target.fromArray(pose.target));
  slot.controls.maxDistance = Math.max(radius * 120, distance * 4);
  slot.controls.minDistance = Math.min(radius * 0.01, distance * 0.5);
  camera.near = Math.max(radius * 0.0001, 0.000000001);
  camera.far = Math.max(distance * 3, radius * 128, camera.near * 10);
  camera.updateProjectionMatrix();
  slot.controls.object = camera;
  slot.controls.update();
  camera.position.fromArray(pose.position);
  camera.lookAt(slot.controls.target);
  camera.updateMatrixWorld();
  slot.pose = pose;
  slot.aspect = aspect;
}

function currentPose(slot: Slot): CameraPose {
  const camera = slot.controls.object as ViewCamera;
  const target = slot.controls.target;
  const height = camera instanceof PerspectiveCamera
    ? viewHeightAtDistance(camera.position.distanceTo(target))
    : (camera.top - camera.bottom) / camera.zoom;
  return {
    position: camera.position.toArray(), target: target.toArray(), up: camera.up.toArray(),
    projection: camera instanceof PerspectiveCamera ? "perspective" : "orthographic", height,
  };
}

function interpolatePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const matrix = new Matrix4();
  const target = new Vector3(...to.target);
  const start = new Vector3(...from.position);
  const end = new Vector3(...to.position);
  const startRotation = new Quaternion().setFromRotationMatrix(matrix.lookAt(start, target, new Vector3(...from.up)));
  const endRotation = new Quaternion().setFromRotationMatrix(matrix.lookAt(end, target, new Vector3(...to.up)));
  startRotation.slerp(endRotation, t);
  const distance = start.distanceTo(target) * (1 - t) + end.distanceTo(target) * t;
  return {
    ...to,
    position: new Vector3(0, 0, distance).applyQuaternion(startRotation).add(target).toArray(),
    up: new Vector3(0, 1, 0).applyQuaternion(startRotation).toArray(),
  };
}

export async function capturePng(renderer: WebGLRenderer, source: ViewCamera, options: PngOptions, draw: () => void,
  composite: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
  const aspect = source instanceof PerspectiveCamera ? source.aspect : (source.right - source.left) / (source.top - source.bottom);
  const limit = renderer.capabilities.maxTextureSize;
  const width = Math.max(1, Math.floor(Math.min(limit, limit * aspect, 4096 * Math.sqrt(aspect), options.width)));
  const height = Math.max(1, Math.round(width / aspect));
  const target = new WebGLRenderTarget(width, height, { colorSpace: SRGBColorSpace });
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest();
  const previous = renderer.getRenderTarget();
  const clear = renderer.getClearAlpha();
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.setClearAlpha(0);
    renderer.clear();
    draw();
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.setClearAlpha(clear);
    target.dispose();
  }
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("PNG indisponível neste navegador.");
  const data = ctx.createImageData(width, height);
  for (let row = 0; row < height; row++) {
    const start = (height - row - 1) * width * 4;
    data.data.set(pixels.subarray(start, start + width * 4), row * width * 4);
  }
  ctx.putImageData(data, 0, 0);
  composite(ctx, width, height);
  if (!options.transparent) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }
  return new Promise<Blob>((resolve, reject) => {
    output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG.")), "image/png");
  });
}

function createRig(
  gl: WebGLRenderer, scene: Scene, sphere: Sphere, invalidate: () => void,
  onContextLost: () => void, beforeDraw: (slot: number, selection?: boolean) => void,
  inspector: RefObject<InspectionScene | null>, motion: () => { moving: boolean; pose: string },
  viewStore: CameraRigStore = usePresentation,
) {
  const canvas = gl.domElement;
  const displayPipeline = viewStore === usePresentation ? createDisplayPipeline(gl, scene) : null;
  const radius = Math.max(sphere.radius, 0.000001);
  const center = sphere.center.toArray();
  let regions: ViewRegion[] = [];
  let width = 1;
  let height = 1;
  let applying = false;
  const pointers = new Set<number>();
  let stats: RenderStats = { fps: 0, draws: 0, triangles: 0, geometries: 0, materials: 0 };
  let previousFrame = 0;

  function aspect(slot: number) {
    const region = regions.find((item) => item.slot === slot);
    return region ? Math.max(region.width / Math.max(region.height, 1), 0.01) : Math.max(width / height, 0.01);
  }

  function apply(slot: number, pose: CameraPose) {
    applying = true;
    try {
      configure(slots[slot], pose, aspect(slot), radius);
    } finally {
      applying = false;
    }
  }

  function updateProjection(index: number, pose: CameraPose) {
    const { projections } = viewStore.getState();
    if (projections[index] === pose.projection) return;
    viewStore.setState({ projections: projections.map((p, slot) => slot === index ? pose.projection : p) });
  }

  const slots: Slot[] = viewSlots.map((preset, index) => {
    const perspective = new PerspectiveCamera(fieldOfView);
    const orthographic = new OrthographicCamera();
    const controls = new OrbitControls(perspective, canvas);
    controls.enabled = index === 0;
    controls.touches.TWO = TOUCH.DOLLY_PAN;
    controls.minDistance = radius * 0.01;
    controls.maxDistance = radius * 120;
    controls.minZoom = 0.01;
    controls.maxZoom = 100;
    const pose = viewStore.getState().poses[index] ?? initialPose(preset, center, radius, 1);
    controls.addEventListener("change", () => {
      if (applying) return;
      slots[index].transition = null;
      slots[index].pose = currentPose(slots[index]);
      syncPeers(index);
      invalidate();
    });
    return { controls, perspective, orthographic, pose, transition: null, aspect: 1 };
  });

  function syncPeers(index: number) {
    const { syncTarget, syncZoom, syncOrientation } = viewStore.getState() as CameraRigState;
    if (!syncTarget && !syncZoom && !syncOrientation) return;
    for (const [peer, slot] of slots.entries()) {
      if (peer === index) continue;
      slot.transition = null;
      const source = slots[index].pose;
      const next = syncOrientation ? source : synchronizePose(source, slot.pose, syncTarget, syncZoom);
      if (syncOrientation === false && syncZoom && next.projection === "perspective") {
        const target = new Vector3(...next.target);
        const distance = source.height / viewHeightAtDistance(1);
        const position = new Vector3(...next.position).sub(target).setLength(distance).add(target);
        apply(peer, { ...next, position: position.toArray(), height: source.height });
      } else apply(peer, next);
    }
  }

  function pick(clientX: number, clientY: number, ndc: Vector2) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * width / Math.max(rect.width, 1);
    const y = (clientY - rect.top) * height / Math.max(rect.height, 1);
    const region = regions.find((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
    if (!region) return null;
    ndc.set(2 * (x - region.x) / region.width - 1, 1 - 2 * (y - region.y) / region.height);
    return { ...region, camera: slots[region.slot].controls.object as ViewCamera };
  }

  const ndc = new Vector2();
  function activate(event: PointerEvent | WheelEvent) {
    if (pointers.size === 0) {
      const hit = pick(event.clientX, event.clientY, ndc);
      if (hit) viewStore.getState().setActive(hit.slot);
      const active = viewStore.getState().active;
      for (const [index, slot] of slots.entries()) slot.controls.enabled = index === active;
      slots[active].transition = null;
    }
    if ("pointerId" in event) pointers.add(event.pointerId);
  }

  function release(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }

  function synchronizeControls() {
    const active = viewStore.getState().active;
    const activeControl = slots[active].controls;
    for (const slot of slots) slot.controls.stopListenToKeyEvents();
    activeControl.listenToKeyEvents(canvas);
    if (pointers.size === 0) {
      for (const slot of slots) slot.controls.enabled = slot.controls === activeControl;
    }
    invalidate();
  }

  canvas.addEventListener("pointerdown", activate, true);
  canvas.addEventListener("wheel", activate, { capture: true, passive: true });
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.tabIndex = 0;
  const unsubscribe = viewStore.subscribe((state, old) => {
    if (state.active !== old.active) synchronizeControls();
    if (state.layout !== old.layout || state.maximized !== old.maximized) resize(width, height, false);
    if (state.shareVisibility !== old.shareVisibility || state.shareSelection !== old.shareSelection) invalidate();
    if ((state as CameraRigState).syncOrientation && !(old as CameraRigState).syncOrientation) syncPeers(state.active);
  });
  synchronizeControls();

  function resize(w: number, h: number, first: boolean) {
    width = Math.max(1, Math.floor(w));
    height = Math.max(1, Math.floor(h));
    const { layout, maximized, poses } = viewStore.getState();
    regions = viewRegions(layout, maximized, width, height);
    slots.forEach((slot, index) => {
      const nextAspect = aspect(index);
      if (!regions.some((region) => region.slot === index)) return;
      const previousAspect = slot.aspect;
      if (first) {
        const locked = viewStore.getState().syncOrientation;
        apply(index, poses[index] ?? initialPose(locked ? "perspective" : viewSlots[index], center, radius, nextAspect));
      } else {
        const scale = Math.min(1, previousAspect) / Math.min(1, nextAspect);
        const pose = slot.pose;
        const next = { ...pose, height: pose.height * scale };
        if (pose.projection === "perspective") {
          const offset = new Vector3(...pose.position).sub(new Vector3(...pose.target)).multiplyScalar(scale);
          next.position = offset.add(new Vector3(...pose.target)).toArray();
        }
        slot.transition = null;
        apply(index, next);
      }
    });
    invalidate();
  }

  function activeSlot() { return viewStore.getState().active; }
  function activePose() { return slots[activeSlot()].pose; }
  function applyActive(pose: CameraPose) {
    const index = activeSlot();
    slots[index].transition = null;
    apply(index, pose);
    updateProjection(index, pose);
    syncPeers(index);
    invalidate();
  }

  function transitionTo(to: CameraPose) {
    const index = activeSlot();
    const pose = activePose();
    if (to.projection !== pose.projection || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyActive(to);
      return;
    }
    slots[index].transition = { from: pose, to, elapsed: 0 };
    invalidate();
  }

  function direction(vector: Vec3, projection = activePose().projection) {
    const pose = activePose();
    transitionTo(orientPose(pose, vector, projection));
  }

  const access = {
    pose: (slot: number) => slots[slot]?.pose ?? null,
    apply: applyActive,
    applySlot: (index: number, pose: CameraPose) => {
      if (!slots[index]) return;
      slots[index].transition = null;
      apply(index, pose);
      updateProjection(index, pose);
      invalidate();
    },
    direction,
    preset: (preset: (typeof viewSlots)[number]) => direction(viewDirections[preset], preset === "perspective" ? "perspective" : "orthographic"),
    home: () => {
      const slot = activeSlot();
      transitionTo(initialPose("perspective", center, radius, aspect(slot)));
    },
    rotate90: (dir: 1 | -1) => {
      const pose = activePose();
      const target = new Vector3(...pose.target);
      const offset = new Vector3(...pose.position).sub(target);
      const length = Math.max(offset.length(), 1e-6);
      const forward = offset.clone().divideScalar(length);
      if (Math.abs(forward.y) > 0.985) {
        const nextUp = new Vector3(...pose.up).applyAxisAngle(forward, -dir * (Math.PI / 2)).normalize();
        transitionTo({ ...pose, up: [nextUp.x, nextUp.y, nextUp.z] });
        return;
      }
      const worldUp = new Vector3(0, 1, 0);
      const rotated = offset.clone().applyAxisAngle(worldUp, dir * (Math.PI / 2));
      const nextUp = new Vector3(...pose.up).applyAxisAngle(worldUp, dir * (Math.PI / 2)).normalize();
      transitionTo({
        ...pose,
        position: rotated.add(target).toArray(),
        up: [nextUp.x, nextUp.y, nextUp.z],
      });
    },
    projection: (projection: CameraPose["projection"]) => {
      const pose = activePose();
      if (projection !== pose.projection) {
        const vector = new Vector3(...pose.position).sub(new Vector3(...pose.target));
        if (projection === "perspective") vector.setLength(pose.height / viewHeightAtDistance(1));
        applyActive({ ...pose, projection, position: vector.add(new Vector3(...pose.target)).toArray() });
      }
    },
    capture: (options: PngOptions, slot?: number) => {
      const index = slot ?? activeSlot();
      const region = regions.find((item) => item.slot === index) ?? { slot: index, x: 0, y: 0, width, height };
      const camera = slots[index].controls.object as ViewCamera;
      beforeDraw(index, options.technical?.selection);
      const runtime = inspector.current;
      const settings = options.technical;
      const render = () => {
        beforeDraw(index, options.technical?.selection);
        if (!displayPipeline) return gl.render(scene, camera);
        const target = gl.getRenderTarget();
        displayPipeline.draw(camera, usePresentation.getState().display, {
          width: target?.width ?? region.width, height: target?.height ?? region.height, regions: regions.length, compact: width < 640,
          capture: true, transparent: options.transparent, technical: Boolean(settings), clipping: activeClipping(index).length > 0,
        });
      };
      const { moving, pose } = motion();
      const result = capturePng(gl, camera, options,
        () => {
          if (runtime) runtime.draw({ slot: index, camera, region, render, technical: settings, capture: true }, moving, pose);
          else render();
        },
        (ctx, outputWidth, outputHeight) => {
          if (settings) runtime?.capture(index, camera, ctx, outputWidth, outputHeight, region.width, settings);
          options.decorate?.(ctx, outputWidth, outputHeight, camera, index);
        });
      beforeDraw(index);
      invalidate();
      return result;
    },
    stats: () => {
      const materials = new Set();
      scene.traverseVisible((object) => {
        if ("material" in object) {
          const material = object.material;
          for (const item of Array.isArray(material) ? material : [material]) materials.add(item);
        }
      });
      return { ...stats, fps: performance.now() - previousFrame > 650 ? 0 : stats.fps, materials: materials.size + (inspector.current?.activeCapMaterials ?? 0) };
    },
  };
  usePresentation.setState({ access });

  return {
    pick, resize, capture: access.capture,
    mode(pan: boolean) {
      for (const { controls } of slots) {
        controls.mouseButtons.LEFT = pan ? MOUSE.PAN : MOUSE.ROTATE;
        controls.touches.ONE = pan ? TOUCH.PAN : TOUCH.ROTATE;
      }
    },
    command(kind: "fit" | "reset" | "closer" | "farther", bounds: Sphere) {
      const slot = activeSlot();
      const pose = activePose();
      const vector = new Vector3(...pose.position).sub(new Vector3(...pose.target));
      if (kind === "closer" || kind === "farther") {
        const factor = kind === "closer" ? 0.8 : 1.25;
        const nextHeight = Math.min(radius * 100, Math.max(radius * 0.005, pose.height * factor));
        if (pose.projection === "perspective") vector.multiplyScalar(nextHeight / pose.height);
        applyActive({ ...pose, height: nextHeight, position: vector.add(new Vector3(...pose.target)).toArray() });
      } else {
        const preset = viewSlots[slot];
        const target = bounds.center.toArray();
        if (kind === "reset") applyActive(initialPose(preset, target, bounds.radius, aspect(slot)));
        else {
          const fitted = orientPose({ ...pose, target, height: fittedHeight(bounds.radius, aspect(slot), pose.projection) }, vector.toArray());
          applyActive({ ...fitted, up: pose.up });
        }
      }
    },
    render(delta: number) {
      for (const [index, slot] of slots.entries()) {
        const transition = slot.transition;
        if (!transition) continue;
        transition.elapsed += Math.min(delta, 0.05);
        const progress = Math.min(transition.elapsed / 0.28, 1);
        apply(index, progress === 1 ? transition.to : interpolatePose(transition.from, transition.to, progress * progress * (3 - 2 * progress)));
        if (progress === 1) slot.transition = null;
        else invalidate();
      }
      const now = performance.now();
      const elapsed = now - previousFrame;
      previousFrame = now;
      gl.info.reset();
      gl.info.autoReset = false;
      try {
        gl.setScissorTest(true);
        const runtime = inspector.current;
        runtime?.beginFrame();
        const { moving, pose } = motion();
        for (const region of regions) {
          const y = height - region.y - region.height;
          gl.setViewport(region.x, y, region.width, region.height);
          gl.setScissor(region.x, y, region.width, region.height);
          beforeDraw(region.slot);
          const camera = slots[region.slot].controls.object;
          const render = () => {
            if (!displayPipeline) return gl.render(scene, camera);
            displayPipeline.draw(camera, usePresentation.getState().display, {
              width: region.width, height: region.height, regions: regions.length, compact: width < 640,
              clipping: activeClipping(region.slot).length > 0,
            });
          };
          if (runtime) runtime.draw({ slot: region.slot, camera, region, render }, moving, pose);
          else render();
        }
      } finally {
        gl.setScissorTest(false);
        gl.setViewport(0, 0, width, height);
        gl.info.autoReset = true;
        beforeDraw(activeSlot());
      }
      stats = {
        fps: elapsed > 0 && elapsed < 500 ? 1000 / elapsed : 0,
        draws: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        materials: stats.materials,
      };
      if (typeof CustomEvent !== "undefined") {
        canvas.dispatchEvent(new CustomEvent("geogen-camera-frame", { bubbles: true, detail: { orientation: slots[activeSlot()].controls.object.quaternion, pose: activePose(), camera: slots[activeSlot()].controls.object, slot: activeSlot(), region: regions.find((item) => item.slot === activeSlot()) } }));
      }
    },
    dispose() {
      displayPipeline?.dispose();
      unsubscribe();
      if (usePresentation.getState().access === access) {
        const poses = slots.map((slot) => slot.pose);
        if (viewStore === usePresentation) usePresentation.setState({ access: null, poses });
        else { viewStore.setState({ poses }); usePresentation.setState({ access: null }); }
      }
      for (const slot of slots) slot.controls.dispose();
      canvas.removeEventListener("pointerdown", activate, true);
      canvas.removeEventListener("wheel", activate, true);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("lostpointercapture", release);
      canvas.removeEventListener("webglcontextlost", onContextLost);
    },
  };
}

export function useViewportCameras(sphere: Sphere, onContextLost: () => void, onDraw: (slot: number, selection?: boolean) => void,
  inspector: RefObject<InspectionScene | null>, motion: () => { moving: boolean; pose: string }, options?: CameraRigOptions) {
  const { gl, scene, invalidate } = useThree();
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const rig = useRef<Rig | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const next = createRig(gl, options?.scene ?? scene, sphere, invalidate, onContextLost, onDraw, inspector, motion, options?.store);
    rig.current = next;
    first.current = true;
    return () => { next.dispose(); rig.current = null; };
  }, [gl, scene, sphere, invalidate, onContextLost, onDraw, inspector, motion, options]);
  useEffect(() => {
    rig.current?.resize(width, height, first.current);
    first.current = false;
  }, [gl, sphere, width, height, onContextLost]);
  useFrame((_state, delta) => rig.current?.render(delta), 1);
  return rig;
}
