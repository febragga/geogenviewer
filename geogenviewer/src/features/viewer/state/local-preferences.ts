import type { ManifestV1 } from "../../../lib/geogen/domain/model.ts";
import type { Filters } from "../../../lib/geogen/domain/visibility.ts";
import type { InspectionPreset } from "./inspection-store";
import type { CameraPose, ViewLayout } from "../scene/camera-state.ts";
import type { DisplaySettings } from "./presentation-store.ts";

export interface VisibilitySnapshot {
  filters: Filters;
  hiddenIds: string[];
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
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Filters;
}

export function preferenceKey(kind: "views" | "filters", manifest: ManifestV1 | undefined, file: string, size: number) {
  const identity = manifest ? [manifest.project.id, manifest.project.revisionId] : [file, size];
  return "geogen:v05:" + kind + ":" + JSON.stringify(identity);
}

export function readLocalList<T>(key: string, storage?: Pick<Storage, "getItem">): T[] {
  try {
    const entries: unknown = JSON.parse((storage ?? localStorage).getItem(key) ?? "[]");
    return Array.isArray(entries) ? entries.filter((item) => item && typeof item.id === "string" && typeof item.name === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocalList<T>(key: string, entries: T[], storage?: Pick<Storage, "setItem">) {
  try {
    (storage ?? localStorage).setItem(key, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}
