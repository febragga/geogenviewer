import assert from "node:assert/strict";
import test from "node:test";
import { Color, PerspectiveCamera, Scene, Vector4 } from "three";
import { displayEffectFactories, createDisplayPipeline } from "../src/features/viewer/scene/display-pipeline.ts";
import { displayProfile, graphicBudget } from "../src/features/viewer/scene/display-profiles.ts";
import { defaultDisplay } from "../src/features/viewer/state/presentation-store.ts";
import { restoreDisplay, validNamedView } from "../src/features/viewer/state/local-preferences.ts";

test("Sprint A: vistas legadas e preferências gráficas conservam o significado", () => {
  const display = { ...defaultDisplay, mode: "clay" };
  assert.ok(validNamedView({ id: "a", name: "A", display,
    visibility: { filters: {}, hiddenIds: ["independente"], isolatedIds: null },
    pose: { position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0], projection: "perspective", height: 2 } }));
  assert.equal(restoreDisplay(display).mode, "mono");
  assert.equal(displayProfile("mono").material.color, "#c9c5ba");
  assert.notEqual(displayProfile("clayStudio").material.color, displayProfile("mono").material.color);
  assert.deepEqual(restoreDisplay({ ...display, mode: "clayStudio", modeOptions: {
    __corrupt__: { exposure: 1 }, clayStudio: { exposure: 20 },
  } }).modeOptions, { clayStudio: { exposure: 2 } });
  assert.equal(graphicBudget("performance").effectScale, 0);
  assert.equal(graphicBudget("high", 4).secondary, false);
});

test("Sprint A: efeitos têm ciclo próprio e recuperam o renderer após erro", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const target = { width: 100, height: 100 };
  let currentTarget = target;
  let conventional = 0, disposals = 0, calls = 0;
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
    pipeline.draw(camera, setup, frame);
    pipeline.draw(camera, defaultDisplay, frame);
    assert.equal(disposals, 2);
    assert.equal(conventional, 3);
  } finally {
    pipeline.dispose();
    delete displayEffectFactories.studio;
  }
});
