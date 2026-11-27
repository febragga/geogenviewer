import { Color, Vector4, type Camera, type Scene, type WebGLRenderer } from "three";
import type { DisplaySettings } from "../state/presentation-store.ts";
import { displayExposure, graphicBudget, resolveDisplayProfile, type DisplayProfile, type ModeEffect } from "./display-profiles.ts";

export interface EffectFrame {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  profile: DisplayProfile;
  width: number;
  height: number;
  scale: number;
  capture: boolean;
  transparent: boolean;
  render: () => void;
}

export interface DisplayEffect {
  /** Return false when this target, inspection pass, or renderer is unsupported. */
  render: (frame: EffectFrame) => boolean;
  dispose: () => void;
}
type EffectFactory = (renderer: WebGLRenderer, profile: DisplayProfile) => DisplayEffect | null;

// Sprint B can attach a disposable Three.js effect per pipeline without changing camera or capture APIs.
export const displayEffectFactories: Partial<Record<ModeEffect, EffectFactory>> = {};

export function createDisplayPipeline(renderer: WebGLRenderer, scene: Scene) {
  let effect: DisplayEffect | null = null;
  let key = "";
  const viewport = new Vector4(), scissor = new Vector4(), clearColor = new Color();
  function releaseEffect() {
    const previous = effect;
    effect = null;
    try { previous?.dispose(); } catch { /* A faulty effect cannot disable the conventional renderer. */ }
  }
  function dispose() {
    releaseEffect();
    key = "";
  }

  function draw(camera: Camera, settings: DisplaySettings, frame: {
    width: number; height: number; regions: number; compact: boolean; capture?: boolean; transparent?: boolean; technical?: boolean; clipping?: boolean;
  }) {
    const profile = resolveDisplayProfile(settings);
    const budget = graphicBudget(settings.quality, frame.regions, frame.compact);
    const allowEffect = !frame.technical && !frame.clipping &&
      (profile.effect === "dither" || budget.secondary || frame.capture);
    const effectId = allowEffect ? profile.effect : undefined;
    const nextKey = effectId ? [settings.mode, effectId, settings.quality].join(":") : "";
    const render = () => renderer.render(scene, camera);
    const exposure = renderer.toneMappingExposure;
    try {
      if (!frame.technical) renderer.toneMappingExposure = exposure * displayExposure(settings);
      if (key !== nextKey) {
        dispose();
        key = nextKey;
        try {
          if (effectId) effect = displayEffectFactories[effectId]?.(renderer, profile) ?? null;
        } catch {
          // Conventional rendering remains available if this implementation cannot initialize.
        }
      }
      if (!effect) return render();

      const target = renderer.getRenderTarget(), scissorTest = renderer.getScissorTest();
      const clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
      const override = scene.overrideMaterial, background = scene.background;
      renderer.getViewport(viewport);
      renderer.getScissor(scissor);
      renderer.getClearColor(clearColor);
      let rendered = false;
      try {
        const scale = effectId === "dither" ? 1 : budget.effectScale;
        rendered = effect.render({ renderer, scene, camera, profile, width: frame.width, height: frame.height,
          scale, capture: frame.capture ?? false, transparent: frame.transparent ?? false, render });
      } catch {
        releaseEffect();
      } finally {
        scene.overrideMaterial = override;
        scene.background = background;
        renderer.autoClear = autoClear;
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
        renderer.setRenderTarget(target);
        renderer.setClearColor(clearColor, clearAlpha);
      }
      if (!rendered) render();
    } finally {
      renderer.toneMappingExposure = exposure;
    }
  }

  return { draw, dispose };
}
