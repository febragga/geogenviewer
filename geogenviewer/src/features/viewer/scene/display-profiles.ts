import type { DisplaySettings } from "../state/presentation-store.ts";

export const displayModeIds = [
  "shaded", "material", "mono", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial",
  "blueprint", "dither", "clayStudio",
] as const;
export type DisplayMode = typeof displayModeIds[number];
export type BaseDisplayMode = Exclude<DisplayMode, "blueprint" | "dither" | "clayStudio">;
export type GraphicsQuality = "performance" | "balanced" | "high";
export type ModeOptions = Partial<Record<DisplayMode, { exposure?: number }>>;
export type ModeEffect = "dither" | "studio";

export interface DisplayProfile {
  surface: BaseDisplayMode;
  material?: { color: string; roughness: number };
  edges?: { color: string; opacity: number };
  lighting?: { ambient: number; key: number; groundColor: string; fill?: number };
  background?: "blueprint" | "neutral";
  groundColor?: string;
  shadows?: { radius: number };
  theme?: "blueprint";
  effect?: ModeEffect;
  shader?: string;
  ambientOcclusion?: "ssao" | "gtao";
  contactShadows?: boolean;
  exposure?: number;
}

export const legacySurface = { color: "#c9c5ba", roughness: 0.85 };
const profiles: Record<DisplayMode, DisplayProfile> = {
  shaded: { surface: "shaded" }, material: { surface: "material" }, mono: { surface: "mono", material: legacySurface },
  technical: { surface: "technical" }, wireframe: { surface: "wireframe" }, xray: { surface: "xray" },
  layer: { surface: "layer" }, category: { surface: "category" }, semanticMaterial: { surface: "semanticMaterial" },
  blueprint: { surface: "technical", background: "blueprint", theme: "blueprint" },
  dither: { surface: "shaded", effect: "dither", shader: "dither" },
  clayStudio: {
    surface: "mono", material: { color: "#d7d5cf", roughness: 1 }, background: "neutral", groundColor: "#b7b4ae",
    lighting: { ambient: 2.6, key: 1.45, groundColor: "#bcbab5", fill: 0.6 },
    shadows: { radius: 3 }, effect: "studio", ambientOcclusion: "gtao", contactShadows: true, exposure: 1,
  },
};

export const defaultLighting = { ambient: 2.2, key: 2.6, groundColor: "#788698", fill: 0 };
export const defaultEdges = { color: "#354457", opacity: 0.72 };

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
  for (const [key, config] of Object.entries(value)) {
    if (!isDisplayMode(key) || profiles[key].exposure === undefined || !config || typeof config.exposure !== "number" ||
      !Number.isFinite(config.exposure)) continue;
    options[key] = { exposure: Math.max(0.25, Math.min(config.exposure, 2)) };
  }
  return options;
}

export function displayProfile(mode: DisplayMode): DisplayProfile {
  return profiles[migrateDisplayMode(mode)];
}

export function graphicBudget(quality: GraphicsQuality, regions = 1, compact = false) {
  if (quality === "performance") return { dpr: 1, shadowSize: 512, effectScale: 0, secondary: false };
  if (regions > 1 || compact) return { dpr: 1.5, shadowSize: 512, effectScale: 0, secondary: false };
  if (quality === "high") return { dpr: 2, shadowSize: 2048, effectScale: 0.75, secondary: true };
  return { dpr: 1.5, shadowSize: 1024, effectScale: 0.5, secondary: true };
}

export function displayExposure(settings: DisplaySettings) {
  const profile = displayProfile(settings.mode);
  return settings.modeOptions?.[settings.mode]?.exposure ?? profile.exposure ?? 1;
}

export function uniformSurface(mode: string) {
  return mode === "mono" || mode === "clay" || mode === "technical" || mode === "layer" || mode === "category" || mode === "semanticMaterial";
}
