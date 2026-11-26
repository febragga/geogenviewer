import Ajv2020Import from "ajv/dist/2020.js";
import schema from "../../../../schemas/documentation-v1.schema.json" with { type: "json" };
import type { Revision } from "../revisions/revision.ts";
import type { DiffStatus } from "../revisions/diff.ts";
import { defaultLayout, type KnollingSettings } from "./knolling.ts";
import { defaultTypes, type CatalogGroup, type CatalogScope, type TypeSettings } from "./catalog.ts";
import type { Callout } from "./callouts.ts";

export const documentationMaxBytes = 24 * 1024 * 1024;
export type Density = "compact" | "comfortable" | "detailed";
export type ThumbnailStyle = "axonometric" | "orthographic" | "technical" | "mono" | "materials";
export type SheetFrame = "axonometric" | "front" | "top" | "left" | "right" | "back" | "bottom" | "current";
export type SheetField = "identity" | "dimensions" | "fabrication" | "measurements" | "assembly" | "parts" | "callouts";
export type SheetTemplate = "component" | "type" | "assembly" | "knolling" | "inspection" | "comparison";
export type CatalogColumn = "part" | "type" | "category" | "layer" | "material" | "dimensions" | "volume" | "mass" | "status";

export interface CatalogSettings {
  view: "cards" | "table" | "list" | "types" | "categories"; density: Density; query: string; scope: CatalogScope;
  scopeValue: string; filterStatus: "all" | DiffStatus; group: CatalogGroup; columns: CatalogColumn[];
  property: string; propertyValue: string; prototype: string; thumbnail: ThumbnailStyle;
}
export interface SheetSettings {
  template: SheetTemplate; title: string; subtitle: string; page: "A4" | "A3"; orientation: "portrait" | "landscape";
  marginMm: number; background: string; brand: string; notes: string; frames: SheetFrame[]; fields: SheetField[]; measurementIds: string[];
  labels: boolean; leaders: boolean; legend: boolean; titleInCapture: boolean; grid: boolean; axes: boolean; measurements: boolean;
  identifiers: boolean; scale: boolean; transparent: boolean; density: Density; stage: "before" | "during" | "after"; progress: number;
}
export interface DocumentationSettings {
  layout: KnollingSettings; scope: CatalogScope; scopeValue: string; labels: boolean; quantities: boolean; groups: boolean;
  types: TypeSettings; catalog: CatalogSettings; callouts: Callout[]; sheet: SheetSettings;
}
export interface DocumentationDocument {
  schemaVersion: "1.0.0"; kind: "documentation" | "catalog" | "knolling";
  identity: { projectId: string | null; revisionId: string | null; sha256: string };
  settings: DocumentationSettings; generatedAt: string; report?: Record<string, unknown>;
}

export function defaultDocumentation(revision: Revision): DocumentationSettings {
  return {
    layout: defaultLayout(Math.max(...revision.scene.sceneGraph.sceneBoundsMeters)), scope: "all", scopeValue: "",
    labels: false, quantities: true, groups: true, types: defaultTypes, callouts: [],
    catalog: { view: "cards", density: "compact", query: "", scope: "all", scopeValue: "", filterStatus: "all",
      group: "category", columns: ["part", "type", "material", "volume"], property: "", propertyValue: "", prototype: "", thumbnail: "axonometric" },
    sheet: { template: "component", title: "", subtitle: "", page: "A4", orientation: "landscape", marginMm: 12,
      background: "#ffffff", brand: "", notes: "", frames: ["axonometric", "front", "top", "left"],
      fields: ["identity", "dimensions", "fabrication", "measurements", "assembly", "parts", "callouts"], measurementIds: [],
      labels: true, leaders: true, legend: false, titleInCapture: false, grid: false, axes: false, measurements: true,
      identifiers: false, scale: true, transparent: false, density: "comfortable", stage: "after", progress: 0.5 },
  };
}
const Ajv = typeof Ajv2020Import === "function" ? Ajv2020Import :
  (Ajv2020Import as unknown as { default: typeof Ajv2020Import }).default;
const validate = new Ajv({ strict: true }).compile<DocumentationDocument>(schema);

function identity(revision: Revision): DocumentationDocument["identity"] {
  const { projectId, revisionId, sha256 } = revision.identity;
  if (!sha256) throw new Error("O hash do GLB está indisponível para esta documentação.");
  return { projectId, revisionId, sha256 };
}

export function createDocumentation(revision: Revision, settings: DocumentationSettings, kind: DocumentationDocument["kind"],
  report?: Record<string, unknown>, generatedAt = new Date().toISOString()): DocumentationDocument {
  return { schemaVersion: "1.0.0", kind, identity: identity(revision), settings, generatedAt, report };
}

export function parseDocumentation(text: string, revision: Revision) {
  if (new TextEncoder().encode(text).byteLength > documentationMaxBytes) throw new Error("Documento excede 24 MB.");
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error("Documento JSON inválido."); }
  if (!validate(input) || !Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error("Documento da V0.8 inválido em " + (validate.errors?.[0]?.instancePath || "raiz") + ".");
  }
  const current = identity(revision);
  if (input.identity.sha256 !== current.sha256 || input.identity.projectId !== current.projectId || input.identity.revisionId !== current.revisionId) {
    throw new Error("O documento pertence a outro GLB ou revisão.");
  }
  const { callouts, layout, types } = input.settings;
  if (new Set(callouts.map((callout) => callout.id)).size !== callouts.length ||
    [...Object.keys(layout.overrides), ...Object.keys(types.overrides), ...callouts.map((label) => label.elementId)]
      .some((id) => !revision.occurrences.has(id)) ||
    callouts.some((label) => !revision.occurrences.get(label.elementId)?.parts.length)) {
    throw new Error("Documento contém identificadores repetidos ou referências indisponíveis.");
  }
  return input;
}
