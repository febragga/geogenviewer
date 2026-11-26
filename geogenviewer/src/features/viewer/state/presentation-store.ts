import { create } from "zustand";
import type { CameraPose, Projection, Vec3, ViewLayout, ViewPreset } from "../scene/camera-state.ts";

export type DisplayMode = "shaded" | "material" | "clay" | "technical" | "wireframe" | "xray" | "layer" | "category" | "semanticMaterial";
export type GraphicsQuality = "performance" | "balanced" | "high";

export interface DisplaySettings {
  mode: DisplayMode;
  background: "theme" | "white" | "dark";
  grid: boolean;
  axes: boolean;
  ground: boolean;
  edges: boolean;
  shadows: boolean;
  light: number;
  opacity: number;
  quality: GraphicsQuality;
}

export const defaultDisplay: DisplaySettings = {
  mode: "shaded", background: "theme", grid: false, axes: true, ground: false,
  edges: false, shadows: false, light: 1, opacity: 1, quality: "balanced",
};

export interface RenderStats {
  fps: number;
  draws: number;
  triangles: number;
  geometries: number;
  materials: number;
}

export interface PngOptions {
  width: number;
  transparent: boolean;
  background: string;
}

export interface CameraAccess {
  pose: (slot: number) => CameraPose | null;
  apply: (pose: CameraPose) => void;
  preset: (preset: ViewPreset) => void;
  direction: (direction: Vec3) => void;
  projection: (projection: Projection) => void;
  capture: (options: PngOptions) => Promise<Blob>;
  stats: () => RenderStats;
}

interface PresentationState {
  layout: ViewLayout;
  active: number;
  maximized: number | null;
  projections: Projection[];
  syncTarget: boolean;
  syncZoom: boolean;
  shareSelection: boolean;
  shareVisibility: boolean;
  display: DisplaySettings;
  access: CameraAccess | null;
  poses: (CameraPose | null)[];
  setLayout: (layout: ViewLayout) => void;
  setActive: (slot: number) => void;
  toggleMaximize: () => void;
  patchDisplay: (patch: Partial<DisplaySettings>) => void;
  resetViews: () => void;
}

export const usePresentation = create<PresentationState>((set, get) => ({
  layout: "single", active: 0, maximized: null,
  projections: ["perspective", "orthographic", "orthographic", "orthographic"],
  syncTarget: false, syncZoom: false, shareSelection: true, shareVisibility: true, display: defaultDisplay, access: null,
  poses: [null, null, null, null],
  setLayout: (layout) => set({ layout, active: 0, maximized: null }),
  setActive: (slot) => { if (get().active !== slot) set({ active: slot }); },
  toggleMaximize: () => set(({ active, maximized }) => ({ maximized: maximized === null ? active : null })),
  patchDisplay: (patch) => set(({ display }) => ({ display: { ...display, ...patch } })),
  resetViews: () => set({
    layout: "single", active: 0, maximized: null, access: null, poses: [null, null, null, null], shareSelection: true, shareVisibility: true,
    projections: ["perspective", "orthographic", "orthographic", "orthographic"],
  }),
}));
