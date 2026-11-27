"use client";

import { create } from "zustand";
import { migrateDisplayMode, sanitizeModeOptions, type DisplayMode, type GraphicsQuality, type ModeOptions } from "../scene/display-profiles";
import { usePresentation } from "./presentation-store";

export type ThemePreference = "system" | "light" | "dark";
export type ViewportBackground = "theme" | "white" | "dark";
export type DisplayUnitSystem = "mm" | "cm" | "m";

export interface AppPreferences {
  theme: ThemePreference;
  viewportBackground: ViewportBackground;
  displayMode: DisplayMode;
  graphicsQuality: GraphicsQuality;
  modeOptions: ModeOptions;
  showNavCube: boolean;
  unitSystem: DisplayUnitSystem;
  largeModelAutoMode: boolean;
  largeModelTriangleThreshold: number;
  largeModelOccurrenceThreshold: number;
}

const SETTINGS_KEY = "geogen:v09:settings";
export const THEME_KEY = "geogen-color-scheme";

export const defaultAppPreferences: AppPreferences = {
  theme: "system",
  viewportBackground: "theme",
  displayMode: "shaded", graphicsQuality: "balanced", modeOptions: {},
  showNavCube: true,
  unitSystem: "mm",
  largeModelAutoMode: true,
  largeModelTriangleThreshold: 120_000,
  largeModelOccurrenceThreshold: 1_500,
};

let themeFrame: number | null = null;

export function applyThemePreference(theme: ThemePreference): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const value = theme === "system" ? "light dark" : theme;
  if (meta?.content === value) return;
  const root = document.documentElement;
  root.setAttribute("data-gg-theme-switch", "");
  if (themeFrame !== null) cancelAnimationFrame(themeFrame);
  themeFrame = requestAnimationFrame(() => {
    themeFrame = requestAnimationFrame(() => {
      root.removeAttribute("data-gg-theme-switch");
      themeFrame = null;
    });
  });
  if (meta) {
    meta.content = value;
  } else {
    const next = document.createElement("meta");
    next.name = "color-scheme";
    next.content = value;
    document.head.appendChild(next);
  }
}

export function loadPersistedPreferences(): AppPreferences {
  if (typeof window === "undefined") return defaultAppPreferences;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const parsed = (raw ? JSON.parse(raw) ?? {} : {}) as Partial<AppPreferences>;
    const theme = savedTheme ?? parsed?.theme;
    return {
      theme: theme === "light" || theme === "dark" || theme === "system"
        ? theme : defaultAppPreferences.theme,
      viewportBackground:
        parsed.viewportBackground === "white" ||
        parsed.viewportBackground === "dark" ||
        parsed.viewportBackground === "theme"
          ? parsed.viewportBackground
          : defaultAppPreferences.viewportBackground,
      displayMode: migrateDisplayMode(parsed.displayMode),
      graphicsQuality: parsed.graphicsQuality === "performance" || parsed.graphicsQuality === "high"
        ? parsed.graphicsQuality : defaultAppPreferences.graphicsQuality,
      modeOptions: sanitizeModeOptions(parsed.modeOptions),
      showNavCube:
        typeof parsed.showNavCube === "boolean"
          ? parsed.showNavCube
          : defaultAppPreferences.showNavCube,
      unitSystem:
        parsed.unitSystem === "cm" || parsed.unitSystem === "m" || parsed.unitSystem === "mm"
          ? parsed.unitSystem
          : defaultAppPreferences.unitSystem,
      largeModelAutoMode:
        typeof parsed.largeModelAutoMode === "boolean"
          ? parsed.largeModelAutoMode
          : defaultAppPreferences.largeModelAutoMode,
      largeModelTriangleThreshold:
        typeof parsed.largeModelTriangleThreshold === "number" &&
        Number.isFinite(parsed.largeModelTriangleThreshold) &&
        parsed.largeModelTriangleThreshold >= 10_000
          ? parsed.largeModelTriangleThreshold
          : defaultAppPreferences.largeModelTriangleThreshold,
      largeModelOccurrenceThreshold:
        typeof parsed.largeModelOccurrenceThreshold === "number" &&
        Number.isFinite(parsed.largeModelOccurrenceThreshold) &&
        parsed.largeModelOccurrenceThreshold >= 100
          ? parsed.largeModelOccurrenceThreshold
          : defaultAppPreferences.largeModelOccurrenceThreshold,
    };
  } catch {
    return defaultAppPreferences;
  }
}

function savePreferences(prefs: AppPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, prefs.theme);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore storage quota failures */
  }
}

interface SettingsState extends AppPreferences {
  hydrated: boolean;
  largeModelActive: boolean;
  largeModelReason: string | null;
  hydrate: () => void;
  patchPreferences: (patch: Partial<AppPreferences>) => void;
  evaluateLargeModel: (triangles: number, occurrences: number) => boolean;
  resetPreferences: () => void;
}

export const useAppSettings = create<SettingsState>((set, get) => ({
  ...defaultAppPreferences,
  hydrated: false,
  largeModelActive: false,
  largeModelReason: null,

  hydrate() {
    if (get().hydrated) return;
    const loaded = loadPersistedPreferences();
    applyThemePreference(loaded.theme);
    const presentation = usePresentation.getState();
    presentation.setShowNavCube(loaded.showNavCube);
    presentation.patchDisplay({ background: loaded.viewportBackground, mode: loaded.displayMode,
      modeOptions: loaded.modeOptions, quality: loaded.graphicsQuality });
    set({ ...loaded, hydrated: true });
  },

  patchPreferences(patch) {
    const current = get();
    const next: AppPreferences = {
      theme: patch.theme ?? current.theme,
      viewportBackground: patch.viewportBackground ?? current.viewportBackground,
      displayMode: patch.displayMode ?? current.displayMode,
      graphicsQuality: patch.graphicsQuality ?? current.graphicsQuality,
      modeOptions: patch.modeOptions ?? current.modeOptions,
      showNavCube: patch.showNavCube ?? current.showNavCube,
      unitSystem: patch.unitSystem ?? current.unitSystem,
      largeModelAutoMode: patch.largeModelAutoMode ?? current.largeModelAutoMode,
      largeModelTriangleThreshold:
        patch.largeModelTriangleThreshold ?? current.largeModelTriangleThreshold,
      largeModelOccurrenceThreshold:
        patch.largeModelOccurrenceThreshold ?? current.largeModelOccurrenceThreshold,
    };
    if (patch.theme) applyThemePreference(next.theme);
    if (patch.showNavCube !== undefined) {
      usePresentation.getState().setShowNavCube(next.showNavCube);
    }
    if (patch.viewportBackground) {
      usePresentation.getState().patchDisplay({ background: next.viewportBackground });
    }
    if (patch.displayMode) usePresentation.getState().patchDisplay({ mode: next.displayMode });
    if (patch.graphicsQuality) usePresentation.getState().patchDisplay({ quality: next.graphicsQuality });
    if (patch.modeOptions) usePresentation.getState().patchDisplay({ modeOptions: next.modeOptions });
    savePreferences(next);
    set(next);
  },

  evaluateLargeModel(triangles, occurrences) {
    const {
      largeModelAutoMode,
      largeModelTriangleThreshold,
      largeModelOccurrenceThreshold,
    } = get();
    const byTriangles = triangles >= largeModelTriangleThreshold;
    const byOccurrences = occurrences >= largeModelOccurrenceThreshold;
    const shouldActivate = largeModelAutoMode && (byTriangles || byOccurrences);
    if (shouldActivate) {
      usePresentation.getState().patchDisplay({
        quality: "performance",
        shadows: false,
        edges: false,
      });
      const reasons: string[] = [];
      if (byTriangles) reasons.push(`${triangles.toLocaleString("pt-BR")} triângulos`);
      if (byOccurrences) reasons.push(`${occurrences.toLocaleString("pt-BR")} ocorrências`);
      set({
        largeModelActive: true,
        largeModelReason: `Modo de modelo grande ativado automaticamente (${reasons.join(" · ")}).`,
      });
      return true;
    }
    set({ largeModelActive: false, largeModelReason: null });
    return false;
  },

  resetPreferences() {
    applyThemePreference(defaultAppPreferences.theme);
    usePresentation.getState().setShowNavCube(defaultAppPreferences.showNavCube);
    usePresentation.getState().patchDisplay({
      background: defaultAppPreferences.viewportBackground,
      mode: defaultAppPreferences.displayMode, modeOptions: defaultAppPreferences.modeOptions,
      quality: defaultAppPreferences.graphicsQuality,
    });
    savePreferences(defaultAppPreferences);
    set({ ...defaultAppPreferences });
  },
}));
