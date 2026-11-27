import { create } from "zustand";
import type { TechnicalOptions } from "../../../lib/geogen/inspection/document.ts";
import type { CameraPose, Projection, Vec3, ViewLayout, ViewPreset } from "../scene/camera-state.ts";

import type { DisplayMode, GraphicsQuality, ModeOptions } from "../scene/display-profiles.ts";
export type { DisplayMode, GraphicsQuality } from "../scene/display-profiles.ts";

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
  modeOptions?: ModeOptions;
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
  technical?: TechnicalOptions;
  decorate?: (ctx: CanvasRenderingContext2D, width: number, height: number, camera: import("three").Camera, slot: number) => void;
}

export interface CameraAccess {
  pose: (slot: number) => CameraPose | null;
  apply: (pose: CameraPose) => void;
  applySlot: (slot: number, pose: CameraPose) => void;
  preset: (preset: ViewPreset) => void;
  direction: (direction: Vec3, projection?: Projection) => void;
  projection: (projection: Projection) => void;
  rotate90?: (dir: 1 | -1) => void;
  home?: () => void;
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
  showNavCube: boolean;
  display: DisplaySettings;
  access: CameraAccess | null;
  poses: (CameraPose | null)[];
  setLayout: (layout: ViewLayout) => void;
  setActive: (slot: number) => void;
  toggleMaximize: () => void;
  setShowNavCube: (show: boolean) => void;
  patchDisplay: (patch: Partial<DisplaySettings>) => void;
  resetViews: () => void;
}

export const usePresentation = create<PresentationState>((set, get) => ({
  layout: "single", active: 0, maximized: null,
  projections: ["perspective", "orthographic", "orthographic", "orthographic"],
  syncTarget: false, syncZoom: false, shareSelection: true, shareVisibility: true, showNavCube: true, display: defaultDisplay, access: null,
  poses: [null, null, null, null],
  setLayout: (layout) => set({ layout, active: 0, maximized: null }),
  setActive: (slot) => { if (get().active !== slot) set({ active: slot }); },
  toggleMaximize: () => set(({ active, maximized }) => ({ maximized: maximized === null ? active : null })),
  setShowNavCube: (showNavCube) => set({ showNavCube }),
  patchDisplay: (patch) => set(({ display }) => ({ display: { ...display, ...patch } })),
  resetViews: () => set({
    layout: "single", active: 0, maximized: null, access: null, poses: [null, null, null, null], shareSelection: true, shareVisibility: true,
    projections: ["perspective", "orthographic", "orthographic", "orthographic"],
  }),
}));
