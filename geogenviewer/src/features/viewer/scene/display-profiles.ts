import type { DisplaySettings } from "../state/presentation-store.ts";

export const displayModeIds = [
  "shaded", "material", "mono", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial",
  "blueprint", "dither", "clayStudio",
] as const;
export type DisplayMode = typeof displayModeIds[number];
export type BaseDisplayMode = Exclude<DisplayMode, "blueprint" | "dither" | "clayStudio">;
export type GraphicsQuality = "performance" | "balanced" | "high";

export interface MonoModeOptions {
  invert?: boolean;
  edgeWidth?: number;
  surfaceColor?: string;
  edgeColor?: string;
  backgroundColor?: string;
}

export interface BlueprintModeOptions {
  grid?: boolean;
  syncUiTheme?: boolean;
  surfaceColor?: string;
  edgeColor?: string;
  backgroundColor?: string;
}

export interface DitherModeOptions {
  matrixSize?: 4 | 8;
  intensity?: number;
  contrast?: number;
  pixelScale?: number;
  invert?: boolean;
  edges?: boolean;
  lightColor?: string;
  darkColor?: string;
}

export interface ClayStudioModeOptions {
  exposure?: number;
  aoIntensity?: number;
  groundPlane?: boolean;
  surfaceColor?: string;
}

export interface ModeOptions {
  shaded?: { exposure?: number };
  material?: { exposure?: number };
  mono?: MonoModeOptions;
  technical?: { exposure?: number };
  wireframe?: { exposure?: number };
  xray?: { exposure?: number };
  layer?: { exposure?: number };
  category?: { exposure?: number };
  semanticMaterial?: { exposure?: number };
  blueprint?: BlueprintModeOptions;
  dither?: DitherModeOptions;
  clayStudio?: ClayStudioModeOptions;
}

export type ModeEffect = "dither" | "studio";

export interface DisplayProfile {
  surface: BaseDisplayMode;
  unlit?: boolean;
  material?: { color: string; roughness: number; metalness?: number };
  edges?: { color: string; opacity: number; width?: number; threshold?: number; force?: boolean };
  selection?: { selected: string; hover: string };
  lighting?: { ambient: number; key: number; groundColor: string; fill?: number; rim?: number };
  background?: "blueprint" | "neutral" | "mono" | "dither";
  backgroundColor?: string;
  groundColor?: string;
  grid?: { primary: string; secondary: string; defaultVisible?: boolean };
  shadows?: { radius: number };
  theme?: "blueprint";
  effect?: ModeEffect;
  shader?: string;
  ambientOcclusion?: "ssao" | "gtao";
  aoIntensity?: number;
  contactShadows?: boolean;
  exposure?: number;
  dither?: Required<DitherModeOptions>;
}

export const legacySurface = { color: "#c9c5ba", roughness: 0.85 };
export const monoDefaults = {
  surfaceColor: "#151515",
  edgeColor: "#f5f5f5",
  backgroundColor: "#fafaf8",
  edgeWidth: 1.25,
  invert: false,
} as const;
export const blueprintDefaults = {
  surfaceColor: "#234b70",
  edgeColor: "#bcdfff",
  backgroundColor: "#102e50",
  groundColor: "#173c63",
  gridPrimary: "#4a89c4",
  gridSecondary: "#234e78",
  selectedColor: "#54e6ff",
  hoverColor: "#9beeff",
  grid: true,
  syncUiTheme: true,
} as const;
export const ditherDefaults: Required<DitherModeOptions> = {
  matrixSize: 4,
  intensity: 1,
  contrast: 1.15,
  pixelScale: 2,
  invert: false,
  edges: false,
  lightColor: "#f3f1eb",
  darkColor: "#202020",
};
export const clayDefaults = {
  surfaceColor: "#d9d4cb",
  backgroundColor: "#eeece7",
  groundColor: "#e5e2dc",
  exposure: 1,
  aoIntensity: 0.85,
} as const;

const profiles: Record<DisplayMode, DisplayProfile> = {
  shaded: { surface: "shaded" },
  material: { surface: "material" },
  mono: {
    surface: "mono",
    unlit: true,
    material: { color: monoDefaults.surfaceColor, roughness: 1, metalness: 0 },
    edges: { color: monoDefaults.edgeColor, opacity: 0.98, width: monoDefaults.edgeWidth, threshold: 25, force: true },
    selection: { selected: "#38bdf8", hover: "#7dd3fc" },
    lighting: { ambient: 1.35, key: 0.2, groundColor: "#e5e5e5", fill: 0 },
    background: "mono",
    backgroundColor: monoDefaults.backgroundColor,
    groundColor: "#efefec",
  },
  technical: {
    surface: "technical",
    edges: { color: "#2d4054", opacity: 0.88, width: 1.1, threshold: 23, force: true },
  },
  wireframe: { surface: "wireframe" },
  xray: { surface: "xray" },
  layer: { surface: "layer" },
  category: { surface: "category" },
  semanticMaterial: { surface: "semanticMaterial" },
  blueprint: {
    surface: "technical",
    material: { color: blueprintDefaults.surfaceColor, roughness: 0.92, metalness: 0 },
    edges: { color: blueprintDefaults.edgeColor, opacity: 0.94, width: 1.15, threshold: 24, force: true },
    selection: { selected: blueprintDefaults.selectedColor, hover: blueprintDefaults.hoverColor },
    lighting: { ambient: 2.15, key: 1.4, groundColor: "#143556", fill: 0.55 },
    background: "blueprint",
    backgroundColor: blueprintDefaults.backgroundColor,
    groundColor: blueprintDefaults.groundColor,
    grid: { primary: blueprintDefaults.gridPrimary, secondary: blueprintDefaults.gridSecondary, defaultVisible: true },
    theme: "blueprint",
  },
  dither: {
    surface: "shaded",
    material: { color: "#dcd8cf", roughness: 0.85, metalness: 0 },
    edges: { color: ditherDefaults.darkColor, opacity: 0.84, width: 1.1, threshold: 24 },
    lighting: { ambient: 1.85, key: 2.8, groundColor: "#4a4a4a", fill: 0.35 },
    background: "dither",
    backgroundColor: ditherDefaults.lightColor,
    groundColor: "#e7e4dc",
    effect: "dither",
    shader: "dither",
    exposure: 1,
    dither: { ...ditherDefaults },
  },
  clayStudio: {
    surface: "mono",
    material: { color: clayDefaults.surfaceColor, roughness: 0.96, metalness: 0 },
    edges: { color: "#57524b", opacity: 0.42, width: 1, threshold: 25 },
    lighting: { ambient: 2.1, key: 1.65, groundColor: "#c9c3b8", fill: 0.72, rim: 0.42 },
    background: "neutral",
    backgroundColor: clayDefaults.backgroundColor,
    groundColor: clayDefaults.groundColor,
    shadows: { radius: 3.5 },
    effect: "studio",
    ambientOcclusion: "gtao",
    aoIntensity: clayDefaults.aoIntensity,
    contactShadows: true,
    exposure: clayDefaults.exposure,
  },
};

export const defaultLighting = { ambient: 2.2, key: 2.6, groundColor: "#788698", fill: 0, rim: 0 };
export const defaultEdges = { color: "#354457", opacity: 0.72, width: 1, threshold: 22, force: false };
export const defaultSelectionColors = { selected: "#5cb3e8", hover: "#89c9ee" };

function validHex(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toLowerCase() : undefined;
}

function clampFinite(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
}

export function isDisplayMode(value: unknown): value is DisplayMode {
  return displayModeIds.some((mode) => mode === value);
}

export function migrateDisplayMode(value: unknown): DisplayMode {
  if (value === "clay") return "mono";
  return isDisplayMode(value) ? value : "shaded";
}

export function sanitizeModeOptions(value: unknown): ModeOptions {
  if (!value || typeof value !== "object") return {};
  const options: ModeOptions = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isDisplayMode(key) || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const config = raw as Record<string, unknown>;
    if (key === "mono") {
      const next: MonoModeOptions = {};
      if (typeof config.invert === "boolean") next.invert = config.invert;
      const edgeWidth = clampFinite(config.edgeWidth, 0.75, 3);
      if (edgeWidth !== undefined) next.edgeWidth = edgeWidth;
      const surfaceColor = validHex(config.surfaceColor);
      if (surfaceColor) next.surfaceColor = surfaceColor;
      const edgeColor = validHex(config.edgeColor);
      if (edgeColor) next.edgeColor = edgeColor;
      const backgroundColor = validHex(config.backgroundColor);
      if (backgroundColor) next.backgroundColor = backgroundColor;
      if (Object.keys(next).length) options.mono = next;
    } else if (key === "blueprint") {
      const next: BlueprintModeOptions = {};
      if (typeof config.grid === "boolean") next.grid = config.grid;
      if (typeof config.syncUiTheme === "boolean") next.syncUiTheme = config.syncUiTheme;
      const surfaceColor = validHex(config.surfaceColor);
      if (surfaceColor) next.surfaceColor = surfaceColor;
      const edgeColor = validHex(config.edgeColor);
      if (edgeColor) next.edgeColor = edgeColor;
      const backgroundColor = validHex(config.backgroundColor);
      if (backgroundColor) next.backgroundColor = backgroundColor;
      if (Object.keys(next).length) options.blueprint = next;
    } else if (key === "dither") {
      const next: DitherModeOptions = {};
      if (config.matrixSize === 4 || config.matrixSize === 8) next.matrixSize = config.matrixSize;
      const intensity = clampFinite(config.intensity, 0.2, 1);
      if (intensity !== undefined) next.intensity = intensity;
      const contrast = clampFinite(config.contrast, 0.6, 2);
      if (contrast !== undefined) next.contrast = contrast;
      const pixelScale = clampFinite(config.pixelScale, 1, 4);
      if (pixelScale !== undefined) next.pixelScale = Math.round(pixelScale * 2) / 2;
      if (typeof config.invert === "boolean") next.invert = config.invert;
      if (typeof config.edges === "boolean") next.edges = config.edges;
      const lightColor = validHex(config.lightColor);
      if (lightColor) next.lightColor = lightColor;
      const darkColor = validHex(config.darkColor);
      if (darkColor) next.darkColor = darkColor;
      if (Object.keys(next).length) options.dither = next;
    } else if (key === "clayStudio") {
      const next: ClayStudioModeOptions = {};
      const exposure = clampFinite(config.exposure, 0.25, 2);
      if (exposure !== undefined) next.exposure = exposure;
      const aoIntensity = clampFinite(config.aoIntensity, 0, 1.5);
      if (aoIntensity !== undefined) next.aoIntensity = aoIntensity;
      if (typeof config.groundPlane === "boolean") next.groundPlane = config.groundPlane;
      const surfaceColor = validHex(config.surfaceColor);
      if (surfaceColor) next.surfaceColor = surfaceColor;
      if (Object.keys(next).length) options.clayStudio = next;
    } else if (profiles[key].exposure !== undefined) {
      const exposure = clampFinite(config.exposure, 0.25, 2);
      if (exposure !== undefined) options[key] = { exposure };
    }
  }
  return options;
}

export function displayProfile(mode: DisplayMode, modeOptions?: ModeOptions): DisplayProfile {
  const normalized = migrateDisplayMode(mode);
  const base = profiles[normalized];
  if (!modeOptions) return base;

  if (normalized === "mono" && modeOptions.mono) {
    const opts = modeOptions.mono;
    const invert = opts.invert ?? monoDefaults.invert;
    const defaultSurface = invert ? monoDefaults.edgeColor : monoDefaults.surfaceColor;
    const defaultEdge = invert ? monoDefaults.surfaceColor : monoDefaults.edgeColor;
    const defaultBg = invert ? monoDefaults.surfaceColor : monoDefaults.backgroundColor;
    return {
      ...base,
      material: { ...base.material!, color: opts.surfaceColor ?? defaultSurface },
      edges: { ...base.edges!, color: opts.edgeColor ?? defaultEdge, width: opts.edgeWidth ?? monoDefaults.edgeWidth },
      backgroundColor: opts.backgroundColor ?? defaultBg,
    };
  }

  if (normalized === "blueprint" && modeOptions.blueprint) {
    const opts = modeOptions.blueprint;
    return {
      ...base,
      theme: opts.syncUiTheme === false ? undefined : "blueprint",
      material: { ...base.material!, color: opts.surfaceColor ?? blueprintDefaults.surfaceColor },
      edges: { ...base.edges!, color: opts.edgeColor ?? blueprintDefaults.edgeColor },
      backgroundColor: opts.backgroundColor ?? blueprintDefaults.backgroundColor,
      grid: { ...base.grid!, defaultVisible: opts.grid ?? blueprintDefaults.grid },
    };
  }

  if (normalized === "dither" && modeOptions.dither) {
    const opts = { ...ditherDefaults, ...modeOptions.dither };
    return {
      ...base,
      backgroundColor: opts.invert ? opts.darkColor : opts.lightColor,
      edges: { ...base.edges!, color: opts.invert ? opts.lightColor : opts.darkColor, force: opts.edges },
      dither: opts,
    };
  }

  if (normalized === "clayStudio" && modeOptions.clayStudio) {
    const opts = modeOptions.clayStudio;
    return {
      ...base,
      material: { ...base.material!, color: opts.surfaceColor ?? clayDefaults.surfaceColor },
      exposure: opts.exposure ?? clayDefaults.exposure,
      aoIntensity: opts.aoIntensity ?? clayDefaults.aoIntensity,
    };
  }

  return base;
}

export function resolveDisplayProfile(settings: Pick<DisplaySettings, "mode" | "modeOptions">): DisplayProfile {
  return displayProfile(settings.mode, settings.modeOptions);
}

export function graphicBudget(quality: GraphicsQuality, regions = 1, compact = false) {
  if (quality === "performance") return { dpr: 1, shadowSize: 512, effectScale: 0, secondary: false };
  if (regions > 1 || compact) return { dpr: 1.5, shadowSize: 512, effectScale: 0, secondary: false };
  if (quality === "high") return { dpr: 2, shadowSize: 2048, effectScale: 0.75, secondary: true };
  return { dpr: 1.5, shadowSize: 1024, effectScale: 0.5, secondary: true };
}

export function displayExposure(settings: DisplaySettings) {
  const profile = resolveDisplayProfile(settings);
  const custom = (settings.modeOptions?.[settings.mode] as { exposure?: number } | undefined)?.exposure;
  return custom ?? profile.exposure ?? 1;
}

export function uniformSurface(mode: string) {
  return mode === "mono" || mode === "clay" || mode === "technical" || mode === "layer" || mode === "category" || mode === "semanticMaterial";
}
