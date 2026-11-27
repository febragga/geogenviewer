import {
  Color,
  HalfFloatType,
  LinearFilter,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { displayEffectFactories, type DisplayEffect, type EffectFrame } from "./display-pipeline.ts";
import { ditherDefaults } from "./display-profiles.ts";

const DITHER_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uOrigin: { value: new Vector2(0, 0) },
    uPixelScale: { value: 2 },
    uMatrixSize: { value: 4 },
    uIntensity: { value: 1 },
    uContrast: { value: 1.15 },
    uExposure: { value: 1 },
    uDarkColor: { value: new Color(ditherDefaults.darkColor) },
    uLightColor: { value: new Color(ditherDefaults.lightColor) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uOrigin;
    uniform float uPixelScale;
    uniform float uMatrixSize;
    uniform float uIntensity;
    uniform float uContrast;
    uniform float uExposure;
    uniform vec3 uDarkColor;
    uniform vec3 uLightColor;
    varying vec2 vUv;

    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      int index = x + y * 4;
      if (index == 0) return 0.5 / 16.0;
      if (index == 1) return 8.5 / 16.0;
      if (index == 2) return 2.5 / 16.0;
      if (index == 3) return 10.5 / 16.0;
      if (index == 4) return 12.5 / 16.0;
      if (index == 5) return 4.5 / 16.0;
      if (index == 6) return 14.5 / 16.0;
      if (index == 7) return 6.5 / 16.0;
      if (index == 8) return 3.5 / 16.0;
      if (index == 9) return 11.5 / 16.0;
      if (index == 10) return 1.5 / 16.0;
      if (index == 11) return 9.5 / 16.0;
      if (index == 12) return 15.5 / 16.0;
      if (index == 13) return 7.5 / 16.0;
      if (index == 14) return 13.5 / 16.0;
      return 5.5 / 16.0;
    }

    float bayer2(vec2 p) {
      int x = int(mod(p.x, 2.0));
      int y = int(mod(p.y, 2.0));
      int idx = x + y * 2;
      if (idx == 0) return 0.0;
      if (idx == 1) return 2.0;
      if (idx == 2) return 3.0;
      return 1.0;
    }

    float bayer8(vec2 p) {
      vec2 q = mod(p, 8.0);
      float outer = bayer4(floor(q * 0.5)) * 16.0 - 0.5;
      float inner = bayer2(q);
      return (outer * 4.0 + inner + 0.5) / 64.0;
    }

    vec3 acesApprox(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 toSrgb(vec3 linearRgb) {
      bvec3 cutoff = lessThanEqual(linearRgb, vec3(0.0031308));
      vec3 higher = 1.055 * pow(max(linearRgb, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
      vec3 lower = linearRgb * 12.92;
      return mix(higher, lower, vec3(cutoff));
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      if (texel.a <= 0.005) {
        gl_FragColor = vec4(0.0);
        return;
      }
      vec3 rgb = texel.rgb / max(texel.a, 0.0001);
      vec3 mapped = acesApprox(max(rgb, vec3(0.0)) * uExposure);
      vec3 srgb = toSrgb(mapped);
      float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
      float adjusted = clamp((luma - 0.5) * uContrast + 0.5, 0.0, 1.0);
      vec2 cell = floor(max(gl_FragCoord.xy - uOrigin, vec2(0.0)) / max(uPixelScale, 1.0));
      float threshold = uMatrixSize > 6.0 ? bayer8(cell) : bayer4(cell);
      float bit = step(threshold, adjusted);
      vec3 quantized = mix(uDarkColor, uLightColor, bit);
      vec3 finalLinear = mix(mapped, quantized, uIntensity);
      gl_FragColor = vec4(finalLinear * texel.a, texel.a);
      #include <colorspace_fragment>
    }
  `,
};

const CLAY_COMPOSITE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tAo: { value: null },
    uAoIntensity: { value: 0.85 },
    uToneExposure: { value: 1 },
    uToneMode: { value: 4 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform sampler2D tAo;
    uniform float uAoIntensity;
    uniform float uToneExposure;
    uniform int uToneMode;
    varying vec2 vUv;

    vec3 clayRrtAndOdtFit(vec3 v) {
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return a / b;
    }

    vec3 clayAcesFilmic(vec3 color) {
      const mat3 inputMat = mat3(
        vec3(0.59719, 0.07600, 0.02840),
        vec3(0.35458, 0.90834, 0.13383),
        vec3(0.04823, 0.01566, 0.83777)
      );
      const mat3 outputMat = mat3(
        vec3(1.60475, -0.10208, -0.00327),
        vec3(-0.53108, 1.10813, -0.07276),
        vec3(-0.07367, -0.00605, 1.07602)
      );
      color *= uToneExposure / 0.6;
      color = inputMat * color;
      color = clayRrtAndOdtFit(color);
      color = outputMat * color;
      return clamp(color, 0.0, 1.0);
    }

    vec3 clayApplyToneMapping(vec3 color) {
      if (uToneMode == 1) return clamp(color * uToneExposure, 0.0, 1.0);
      if (uToneMode == 2) {
        vec3 c = color * uToneExposure;
        return clamp(c / (vec3(1.0) + c), 0.0, 1.0);
      }
      if (uToneMode == 4 || uToneMode == 7 || uToneMode == 6) {
        return clayAcesFilmic(color);
      }
      return clamp(color * uToneExposure, 0.0, 1.0);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      if (texel.a <= 0.005) {
        gl_FragColor = vec4(0.0);
        return;
      }
      float aoSample = texture2D(tAo, vUv).r;
      float occlusion = mix(1.0, clamp(aoSample, 0.0, 1.0), clamp(uAoIntensity, 0.0, 1.5));
      vec3 color = clayApplyToneMapping((texel.rgb / max(texel.a, 0.0001)) * occlusion);
      gl_FragColor = vec4(color * texel.a, texel.a);
      #include <colorspace_fragment>
    }
  `,
};

function createSceneRenderTarget(width: number, height: number) {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
}

function renderSceneToTarget(
  renderer: WebGLRenderer,
  target: WebGLRenderTarget,
  physicalWidth: number,
  physicalHeight: number,
  render: () => void,
) {
  renderer.setRenderTarget(target);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, physicalWidth, physicalHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  render();
}

function createDitherEffect(): DisplayEffect {
  let target: WebGLRenderTarget | null = null;
  let width = 0;
  let height = 0;
  const savedViewport = new Vector4();
  const savedScissor = new Vector4();
  const material = new ShaderMaterial({
    uniforms: UniformsUtils.clone(DITHER_SHADER.uniforms),
    vertexShader: DITHER_SHADER.vertexShader,
    fragmentShader: DITHER_SHADER.fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: NoBlending,
  });
  const quad = new FullScreenQuad(material);
  const darkColor = new Color();
  const lightColor = new Color();

  return {
    render(frame: EffectFrame) {
      const { renderer, profile } = frame;
      const destination = renderer.getRenderTarget();
      const dpr = destination ? 1 : renderer.getPixelRatio();
      const physW = Math.max(1, Math.round(frame.width * dpr));
      const physH = Math.max(1, Math.round(frame.height * dpr));
      const maxTex = renderer.capabilities?.maxTextureSize ?? 4096;
      if (physW > maxTex || physH > maxTex) return false;

      if (!target || width !== physW || height !== physH) {
        target?.dispose();
        target = createSceneRenderTarget(physW, physH);
        width = physW;
        height = physH;
      }

      renderer.getViewport(savedViewport);
      renderer.getScissor(savedScissor);
      const savedScissorTest = renderer.getScissorTest();

      renderSceneToTarget(renderer, target, physW, physH, frame.render);

      const dither = profile.dither ?? ditherDefaults;
      darkColor.set(dither.invert ? dither.lightColor : dither.darkColor);
      lightColor.set(dither.invert ? dither.darkColor : dither.lightColor);
      const scaleFactor = frame.capture ? Math.max(1, frame.width / 1280) : dpr;

      material.uniforms.tDiffuse.value = target.texture;
      material.uniforms.uOrigin.value.set(savedViewport.x * dpr, savedViewport.y * dpr);
      material.uniforms.uPixelScale.value = Math.max(1, dither.pixelScale * scaleFactor);
      material.uniforms.uMatrixSize.value = dither.matrixSize;
      material.uniforms.uIntensity.value = dither.intensity;
      material.uniforms.uContrast.value = dither.contrast;
      material.uniforms.uExposure.value = renderer.toneMappingExposure;
      material.uniforms.uDarkColor.value.copy(darkColor);
      material.uniforms.uLightColor.value.copy(lightColor);

      renderer.setRenderTarget(destination);
      if (destination) {
        renderer.setViewport(0, 0, physW, physH);
        renderer.setScissorTest(false);
      } else {
        renderer.setViewport(savedViewport);
        renderer.setScissor(savedScissor);
        renderer.setScissorTest(savedScissorTest);
      }
      quad.render(renderer);
      return true;
    },
    dispose() {
      target?.dispose();
      target = null;
      material.dispose();
      quad.dispose();
    },
  };
}

const sceneRadiusMap = new WeakMap<Scene, number>();

export function setSceneScaleRadius(scene: Scene, radius: number): void {
  if (Number.isFinite(radius) && radius > 0) sceneRadiusMap.set(scene, radius);
}

function calibrateAoRadius(scene: Scene, camera: Camera): number {
  const sceneRadius = sceneRadiusMap.get(scene) ?? 2.0;
  if ((camera as OrthographicCamera).isOrthographicCamera) {
    const ortho = camera as OrthographicCamera;
    const span = Math.abs((ortho.top - ortho.bottom) / Math.max(ortho.zoom, 0.01));
    return Math.max(0.025, Math.min(sceneRadius * 0.24, span * 0.09));
  }
  const persp = camera as PerspectiveCamera;
  const dist = Math.max(0.05, persp.position.length() > 0 ? Math.min(sceneRadius * 3, persp.far * 0.08) : sceneRadius);
  return Math.max(0.025, Math.min(sceneRadius * 0.22, dist * 0.14));
}

function createClayStudioEffect(renderer: WebGLRenderer): DisplayEffect | null {
  if (!renderer.capabilities?.isWebGL2) return null;

  let sceneTarget: WebGLRenderTarget | null = null;
  let gtaoPass: GTAOPass | null = null;
  let physW = 0;
  let physH = 0;
  let aoW = 0;
  let aoH = 0;
  const savedViewport = new Vector4();
  const savedScissor = new Vector4();
  const material = new ShaderMaterial({
    uniforms: UniformsUtils.clone(CLAY_COMPOSITE_SHADER.uniforms),
    vertexShader: CLAY_COMPOSITE_SHADER.vertexShader,
    fragmentShader: CLAY_COMPOSITE_SHADER.fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
    blending: NoBlending,
  });
  const quad = new FullScreenQuad(material);

  return {
    render(frame: EffectFrame) {
      const { renderer: gl, scene, camera, profile } = frame;
      const destination = gl.getRenderTarget();
      const dpr = destination ? 1 : gl.getPixelRatio();
      const targetW = Math.max(1, Math.round(frame.width * dpr));
      const targetH = Math.max(1, Math.round(frame.height * dpr));
      const scale = Math.max(0.25, Math.min(1, frame.scale || 0.5));
      const nextAoW = Math.max(1, Math.round(targetW * scale));
      const nextAoH = Math.max(1, Math.round(targetH * scale));
      const maxTex = gl.capabilities?.maxTextureSize ?? 4096;
      if (targetW > maxTex || targetH > maxTex) return false;

      if (!sceneTarget || physW !== targetW || physH !== targetH) {
        sceneTarget?.dispose();
        sceneTarget = createSceneRenderTarget(targetW, targetH);
        physW = targetW;
        physH = targetH;
      }

      if (!gtaoPass) {
        gtaoPass = new GTAOPass(scene, camera, nextAoW, nextAoH);
        gtaoPass.output = GTAOPass.OUTPUT.Off;
        gtaoPass.updatePdMaterial({ lumaPhi: 8, depthPhi: 8, normalPhi: 6, radius: 3.5, rings: 2, samples: 12 });
        aoW = nextAoW;
        aoH = nextAoH;
      } else {
        gtaoPass.scene = scene;
        gtaoPass.camera = camera;
        if (aoW !== nextAoW || aoH !== nextAoH) {
          gtaoPass.setSize(nextAoW, nextAoH);
          aoW = nextAoW;
          aoH = nextAoH;
        }
      }

      const isPersp = (camera as PerspectiveCamera).isPerspectiveCamera ? 1 : 0;
      if (gtaoPass.gtaoMaterial.defines.PERSPECTIVE_CAMERA !== isPersp) {
        gtaoPass.gtaoMaterial.defines.PERSPECTIVE_CAMERA = isPersp;
        gtaoPass.gtaoMaterial.needsUpdate = true;
      }
      gtaoPass.updateGtaoMaterial({
        radius: calibrateAoRadius(scene, camera),
        distanceExponent: 1.35,
        thickness: 1.0,
        distanceFallOff: 0.9,
        scale: 1.0,
        samples: scale >= 0.7 ? 16 : 12,
      });

      gl.getViewport(savedViewport);
      gl.getScissor(savedScissor);
      const savedScissorTest = gl.getScissorTest();

      renderSceneToTarget(gl, sceneTarget, targetW, targetH, frame.render);

      gl.setScissorTest(false);
      gl.setViewport(0, 0, aoW, aoH);
      gtaoPass.render(gl, sceneTarget, sceneTarget, 0, false);

      material.uniforms.tDiffuse.value = sceneTarget.texture;
      material.uniforms.tAo.value = gtaoPass.gtaoMap;
      material.uniforms.uAoIntensity.value = profile.aoIntensity ?? 0.85;
      material.uniforms.uToneExposure.value = gl.toneMappingExposure;
      material.uniforms.uToneMode.value = gl.toneMapping;

      gl.setRenderTarget(destination);
      if (destination) {
        gl.setViewport(0, 0, targetW, targetH);
        gl.setScissorTest(false);
      } else {
        gl.setViewport(savedViewport);
        gl.setScissor(savedScissor);
        gl.setScissorTest(savedScissorTest);
      }
      quad.render(gl);
      return true;
    },
    dispose() {
      sceneTarget?.dispose();
      sceneTarget = null;
      gtaoPass?.dispose();
      gtaoPass = null;
      material.dispose();
      quad.dispose();
    },
  };
}

let registered = false;

export function registerDisplayEffects() {
  if (registered) return;
  registered = true;
  displayEffectFactories.dither = () => createDitherEffect();
  displayEffectFactories.studio = (renderer) => createClayStudioEffect(renderer);
}
