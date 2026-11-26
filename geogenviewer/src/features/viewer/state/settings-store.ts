"use client";

import { create } from "zustand";
import { usePresentation } from "./presentation-store";

export type ThemePreference = "system" | "light" | "dark";
export type ViewportBackground = "theme" | "white" | "dark";
export type DisplayUnitSystem = "mm" | "cm" | "m";

export interface AppPreferences {
  theme: ThemePreference;
  viewportBackground: ViewportBackground;
  showNavCube: boolean;
  unitSystem: DisplayUnitSystem;
  largeModelAutoMode: boolean;
  largeModelTriangleThreshold: number;
  largeModelOccurrenceThreshold: number;
}

const SETTINGS_KEY = "geogen:v09:settings";

export const defaultAppPreferences: AppPreferences = {
  theme: "system",
  viewportBackground: "theme",
  showNavCube: true,
  unitSystem: "mm",
  largeModelAutoMode: true,
  largeModelTriangleThreshold: 120_000,
  largeModelOccurrenceThreshold: 1_500,
};

function applyThemePreference(theme: ThemePreference): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const value = theme === "system" ? "light dark" : theme;
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
    if (!raw) return defaultAppPreferences;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : defaultAppPreferences.theme,
      viewportBackground:
        parsed.viewportBackground === "white" ||
        parsed.viewportBackground === "dark" ||
        parsed.viewportBackground === "theme"
          ? parsed.viewportBackground
          : defaultAppPreferences.viewportBackground,
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
    presentation.patchDisplay({ background: loaded.viewportBackground });
    set({ ...loaded, hydrated: true });
  },

  patchPreferences(patch) {
    const current = get();
    const next: AppPreferences = {
      theme: patch.theme ?? current.theme,
      viewportBackground: patch.viewportBackground ?? current.viewportBackground,
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
    });
    savePreferences(defaultAppPreferences);
    set({ ...defaultAppPreferences });
  },
}));
