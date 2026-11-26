import type { ManifestV1 } from "../../../lib/geogen/domain/model.ts";
import type { Filters } from "../../../lib/geogen/domain/visibility.ts";
import type { InspectionPreset } from "./inspection-store";
import type { CameraPose, ViewLayout } from "../scene/camera-state.ts";
import type { DisplaySettings } from "./presentation-store.ts";

export interface VisibilitySnapshot {
  filters: Filters;
  hiddenIds: string[];
  hiddenGroupKeys?: string[];
  isolatedIds: string[] | null;
}

export interface NamedView {
  id: string;
  name: string;
  pose: CameraPose;
  display: DisplaySettings;
  visibility: VisibilitySnapshot;
  regions?: { layout: ViewLayout; active: number; maximized: number | null; poses: (CameraPose | null)[] };
  inspection?: InspectionPreset;
  documentation?: import("../../../lib/geogen/documentation/document").DocumentationDocument;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Filters;
}

export function preferenceKey(kind: "views" | "filters", manifest: ManifestV1 | undefined, file: string, size: number,
  binarySha256?: string | null) {
  if (!manifest && binarySha256 !== undefined) {
    return binarySha256 ? "geogen:v091:" + kind + ":glb:" + binarySha256.toLowerCase() : null;
  }
  const identity = manifest ? [manifest.project.id, manifest.project.revisionId] : [file, size];
  return "geogen:v05:" + kind + ":" + JSON.stringify(identity);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const filterFields = new Set(["layer", "group", "userLayer", "userGroup", "category", "material", "geometry", "block", "instance", "selection", "assembly"]);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function validFilters(value: unknown): value is Filters {
  const candidate = record(value);
  return Boolean(candidate && Object.entries(candidate).every(([field, values]) =>
    filterFields.has(field) && strings(values)));
}

function validPose(value: unknown): value is CameraPose {
  const candidate = record(value);
  if (!candidate || (candidate.projection !== "perspective" && candidate.projection !== "orthographic") ||
      typeof candidate.height !== "number" || !Number.isFinite(candidate.height) || candidate.height <= 0) return false;
  return [candidate.position, candidate.target, candidate.up].every((vector) =>
    Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite));
}

export function validNamedView(view: NamedView): boolean {
  if (!validPose(view.pose)) return false;
  const display = record(view.display);
  const visibility = record(view.visibility);
  if (!display || !visibility || !validFilters(visibility.filters) || !strings(visibility.hiddenIds) ||
      (visibility.hiddenGroupKeys !== undefined && !strings(visibility.hiddenGroupKeys)) ||
      (visibility.isolatedIds !== null && !strings(visibility.isolatedIds))) return false;
  if (!["shaded", "material", "clay", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial"].includes(String(display.mode)) ||
      !["performance", "balanced", "high"].includes(String(display.quality)) ||
      !Number.isFinite(display.light) || !Number.isFinite(display.opacity)) return false;
  const regions = record(view.regions);
  if (view.regions === undefined) return true;
  const slot = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) < 4;
  return Boolean(regions && ["single", "horizontal", "vertical", "quad"].includes(String(regions.layout)) &&
    slot(regions.active) && (regions.maximized === null || slot(regions.maximized)) &&
    Array.isArray(regions.poses) && regions.poses.length <= 4 &&
    regions.poses.every((pose) => pose === null || validPose(pose)));
}

export function readLocalList<T>(key: string | null, storage?: Pick<Storage, "getItem">, validate?: (item: T) => boolean): T[] {
  if (!key) return [];
  try {
    const entries: unknown = JSON.parse((storage ?? localStorage).getItem(key) ?? "[]");
    return Array.isArray(entries) ? entries.filter((item) =>
      item && typeof item.id === "string" && typeof item.name === "string" && (!validate || validate(item))) : [];
  } catch {
    return [];
  }
}

export function writeLocalList<T>(key: string | null, entries: T[], storage?: Pick<Storage, "setItem">) {
  if (!key) return false;
  try {
    (storage ?? localStorage).setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}
