import assert from "node:assert/strict";
import test from "node:test";
import { Color, PerspectiveCamera, Scene, Vector4 } from "three";
import { displayEffectFactories, createDisplayPipeline } from "../src/features/viewer/scene/display-pipeline.ts";
import {
  blueprintDefaults,
  clayDefaults,
  displayProfile,
  ditherDefaults,
  graphicBudget,
  monoDefaults,
  resolveDisplayProfile,
  sanitizeModeOptions,
} from "../src/features/viewer/scene/display-profiles.ts";
import { defaultDisplay } from "../src/features/viewer/state/presentation-store.ts";
import { restoreDisplay, validNamedView } from "../src/features/viewer/state/local-preferences.ts";

test("Sprint A/B: vistas legadas e perfis Mono 2.0, Blueprint, Dither e Clay são consistentes", () => {
  const display = { ...defaultDisplay, mode: "clay" };
  assert.ok(validNamedView({
    id: "a",
    name: "A",
    display,
    visibility: { filters: {}, hiddenIds: ["independente"], isolatedIds: null },
    pose: { position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], projection: "perspective", height: 2 },
  }));
  assert.equal(restoreDisplay(display).mode, "mono");

  const mono = displayProfile("mono");
  assert.equal(mono.unlit, true);
  assert.equal(mono.material.color, monoDefaults.surfaceColor);
  assert.equal(mono.edges.color, monoDefaults.edgeColor);
  assert.equal(mono.backgroundColor, monoDefaults.backgroundColor);

  const monoInverted = resolveDisplayProfile({ ...defaultDisplay, mode: "mono", modeOptions: { mono: { invert: true, edgeWidth: 2 } } });
  assert.equal(monoInverted.material.color, "#f5f5f5");
  assert.equal(monoInverted.edges.color, "#151515");
  assert.equal(monoInverted.edges.width, 2);

  const bp = displayProfile("blueprint");
  assert.equal(bp.backgroundColor, blueprintDefaults.backgroundColor);
  assert.equal(bp.material.color, blueprintDefaults.surfaceColor);
  assert.equal(bp.edges.color, blueprintDefaults.edgeColor);
  assert.equal(bp.selection.selected, blueprintDefaults.selectedColor);
  assert.equal(bp.theme, "blueprint");
  assert.equal(resolveDisplayProfile({ ...defaultDisplay, mode: "blueprint", modeOptions: { blueprint: { syncUiTheme: false } } }).theme, undefined);

  const clay = displayProfile("clayStudio");
  assert.equal(clay.material.color, clayDefaults.surfaceColor);
  assert.equal(clay.backgroundColor, clayDefaults.backgroundColor);
  assert.equal(clay.groundColor, clayDefaults.groundColor);
  assert.notEqual(clay.material.color, mono.material.color);

  const dither = resolveDisplayProfile({ ...defaultDisplay, mode: "dither", modeOptions: { dither: { matrixSize: 8, invert: true } } });
  assert.equal(dither.dither.matrixSize, 8);
  assert.equal(dither.backgroundColor, ditherDefaults.darkColor);

  assert.deepEqual(restoreDisplay({
    ...display,
    mode: "clayStudio",
    modeOptions: {
      __corrupt__: { exposure: 1 },
      clayStudio: { exposure: 20 },
    },
  }).modeOptions, { clayStudio: { exposure: 2 } });

  assert.deepEqual(sanitizeModeOptions({
    mono: { edgeWidth: 10, surfaceColor: "bad", invert: true },
    dither: { matrixSize: 8, intensity: 5, contrast: 0.1, pixelScale: 9 },
    clayStudio: { aoIntensity: 3 },
  }), {
    mono: { invert: true, edgeWidth: 3 },
    dither: { matrixSize: 8, intensity: 1, contrast: 0.6, pixelScale: 4 },
    clayStudio: { aoIntensity: 1.5 },
  });

  assert.equal(graphicBudget("performance").effectScale, 0);
  assert.equal(graphicBudget("high", 4).secondary, false);
});

test("Sprint A/B: efeitos têm ciclo próprio, Dither mantém passe em Desempenho e Clay degrada após erro ou clipping", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const target = { width: 100, height: 100 };
  let currentTarget = target;
  let conventional = 0, disposals = 0, calls = 0, ditherCalls = 0;
  const viewport = new Vector4(8, 9, 60, 70);
  const scissor = new Vector4(1, 2, 100, 200);
  const color = new Color(0x123456);
  const renderer = {
    toneMappingExposure: 1,
    autoClear: true,
    render(rendered, active) {
      conventional++;
      assert.equal(rendered, scene);
      assert.equal(active, camera);
      assert.equal(currentTarget, target);
      assert.equal(this.autoClear, true);
    },
    getRenderTarget: () => currentTarget,
    setRenderTarget: (value) => { currentTarget = value; },
    getViewport: (out) => out.copy(viewport),
    getScissor: (out) => out.copy(scissor),
    getClearColor: (out) => out.copy(color),
    getClearAlpha: () => 0,
    getScissorTest: () => true,
    setViewport: (value) => assert.ok(value.equals(viewport)),
    setScissor: (value) => assert.ok(value.equals(scissor)),
    setScissorTest: (value) => assert.equal(value, true),
    setClearColor: (value, alpha) => { assert.ok(value.equals(color)); assert.equal(alpha, 0); },
  };
  displayEffectFactories.studio = () => ({
    render(frame) {
      calls++;
      assert.equal(frame.scale, 0.5);
      assert.equal(frame.renderer.toneMappingExposure, 1.25);
      if (!frame.capture) return true;
      frame.renderer.autoClear = false;
      frame.renderer.setRenderTarget(null);
      throw Error("malha de efeito indisponível durante captura");
    },
    dispose() { disposals++; },
  });
  displayEffectFactories.dither = () => ({
    render(frame) {
      ditherCalls++;
      assert.equal(frame.scale, 1);
      return true;
    },
    dispose() {},
  });
  const pipeline = createDisplayPipeline(renderer, scene);
  const setup = { ...defaultDisplay, mode: "clayStudio", modeOptions: { clayStudio: { exposure: 1.25 } } };
  const frame = { width: 300, height: 250, regions: 1, compact: false };
  try {
    pipeline.draw(camera, setup, frame);
    pipeline.draw(camera, setup, { ...frame, capture: true, transparent: true });
    assert.equal(renderer.toneMappingExposure, 1);
    assert.equal(disposals, 1);
    assert.equal(calls, 2);
    assert.equal(conventional, 1);
    pipeline.draw(camera, setup, { ...frame, clipping: true });
    assert.equal(conventional, 2);
    pipeline.draw(camera, { ...defaultDisplay, mode: "dither", quality: "performance" }, frame);
    assert.equal(ditherCalls, 1);
    pipeline.draw(camera, setup, frame);
    pipeline.draw(camera, defaultDisplay, frame);
    assert.equal(disposals, 2);
    assert.equal(conventional, 3);

    let captureScale;
    displayEffectFactories.studio = () => ({
      render(frame) {
        assert.equal(frame.capture, true);
        assert.equal(frame.renderer.toneMappingExposure, 1.25);
        captureScale = frame.scale;
        return true;
      },
      dispose() {},
    });
    const performanceMode = { ...setup, quality: "performance" };
    pipeline.draw(camera, performanceMode, frame);
    assert.equal(conventional, 4);
    pipeline.draw(camera, performanceMode, { ...frame, capture: true });
    assert.equal(captureScale, 0);
    assert.equal(renderer.toneMappingExposure, 1);
  } finally {
    pipeline.dispose();
    delete displayEffectFactories.studio;
    delete displayEffectFactories.dither;
  }
});
