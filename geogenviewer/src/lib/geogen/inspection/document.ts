import Ajv2020Import from "ajv/dist/2020.js";
import schema from "../../../../schemas/inspection-v1.schema.json" with { type: "json" };
import type { LoadedScenePackage } from "../importers/package.ts";
import type { DisplayUnit } from "../domain/model.ts";
import type { Point3 } from "./sections.ts";
import type { Measurement, MeshAnchor } from "./measurements.ts";
import type { SectionConfiguration } from "./sections.ts";
import type { SnapSettings } from "./snapping.ts";

export interface InspectionIdentity {
  projectId: string;
  revisionId: string | null;
  sha256: string | null;
  bytes: number;
  fileName: string;
}

export interface TechnicalOptions {
  width: 1280 | 1920 | 3840;
  background: "transparent" | "white" | "custom";
  color: string;
  measurements: boolean;
  identifiers: boolean;
  gizmos: boolean;
  grid: boolean;
  axes: boolean;
  selection: boolean;
  scale: boolean;
}

export const defaultTechnicalOptions: TechnicalOptions = {
  width: 1920, background: "white", color: "#f1f5f9", measurements: true, identifiers: false,
  gizmos: false, grid: false, axes: false, selection: false, scale: true,
};

export interface TechnicalSnapshot {
  generatedAt: string;
  title: string;
  viewName: string;
  projection: "perspective" | "orthographic";
  layout: "single" | "horizontal" | "vertical" | "quad";
  activeSlot: number;
  unit: DisplayUnit;
  elementIds: string[];
  camera: { position: Point3; target: Point3; up: Point3; height: number; projection: TechnicalSnapshot["projection"] };
}

export interface InspectionDocument {
  schemaVersion: "1.0.0";
  model: InspectionIdentity;
  sections: SectionConfiguration;
  measurements: Measurement[];
  snap: SnapSettings;
  capture: TechnicalOptions;
  snapshot?: TechnicalSnapshot;
}

export const maxInspectionBytes = 2 * 1024 * 1024;
const Ajv = typeof Ajv2020Import === "function" ? Ajv2020Import :
  (Ajv2020Import as unknown as { default: typeof Ajv2020Import }).default;
const validate = new Ajv({ strict: false }).compile<InspectionDocument>(schema);

export function inspectionIdentity(loaded: LoadedScenePackage): InspectionIdentity {
  const graph = loaded.sceneGraph;
  return {
    projectId: loaded.manifest?.project.id ?? graph.fileName,
    revisionId: graph.revisionId,
    fileName: graph.fileName,
    bytes: graph.fileSizeBytes,
    sha256: loaded.binarySha256 ?? null,
  };
}

export function matchesIdentity(a: InspectionIdentity, b: InspectionIdentity) {
  return a.projectId === b.projectId && a.revisionId === b.revisionId && a.bytes === b.bytes &&
    (a.sha256 || b.sha256 ? a.sha256 === b.sha256 : a.fileName === b.fileName);
}

export function validateInspection(input: unknown, identity: InspectionIdentity, ids: ReadonlySet<string>, anchorExists?: (anchor: MeshAnchor) => boolean, keepMissing = false) {
  if (!validate(input)) throw new Error("Arquivo de inspeção inválido em " + (validate.errors?.[0]?.instancePath || "raiz") + ".");
  if (!matchesIdentity(input.model, identity)) throw new Error("O arquivo de inspeção pertence a outro modelo ou revisão.");
  const used = new Set<string>();
  for (const record of input.measurements) {
    if (used.has(record.id)) throw new Error("Identificador de medição repetido.");
    used.add(record.id);
    if (record.anchors.length !== (record.kind === "point" ? 1 : 2) ||
      (record.kind === "distance") !== (typeof record.valueM === "number")) {
      throw new Error("Quantidade de pontos ou formato de valor inválido.");
    }
    if (!keepMissing && record.anchors.some((anchor) => !ids.has(anchor.elementId) || (anchorExists && !anchorExists(anchor)))) {
      throw new Error("Uma medição referencia uma peça ou nó indisponível.");
    }
  }
  if (input.snapshot) {
    const snapshot = input.snapshot;
    if (!Number.isFinite(Date.parse(snapshot.generatedAt)) || snapshot.projection !== snapshot.camera.projection ||
      (!keepMissing && snapshot.elementIds.some((id) => !ids.has(id)))) throw new Error("Metadados da captura técnica inválidos.");
  }
  return input;
}

export function parseInspection(text: string, identity: InspectionIdentity, ids: ReadonlySet<string>, anchorExists?: (anchor: MeshAnchor) => boolean, keepMissing = false) {
  if (new TextEncoder().encode(text).byteLength > maxInspectionBytes) throw new Error("Arquivo de inspeção excede 2 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Arquivo de inspeção deve conter JSON válido."); }
  return validateInspection(parsed, identity, ids, anchorExists, keepMissing);
}
