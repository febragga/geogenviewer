import { create } from "zustand";
import type { DisplayUnit } from "../../../lib/geogen/domain/model";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import {
  defaultTechnicalOptions, inspectionIdentity, matchesIdentity, parseInspection, type InspectionDocument,
  type InspectionIdentity, type TechnicalOptions, type TechnicalSnapshot,
} from "../../../lib/geogen/inspection/document";
import { measurementValue, sourceCoordinates, type MeasureKind, type Measurement, type MeasurementPose, type MeshAnchor, type MeshReferences } from "../../../lib/geogen/inspection/measurements";
import {
  makeSections, sectionAt, setSectionAt, shareSections, type CadAxis, type Point3,
  type SectionConfiguration, type SectionPlane, type SectionSettings,
} from "../../../lib/geogen/inspection/sections";
import type { SnapSettings } from "../../../lib/geogen/inspection/snapping";
import type { Workspace } from "./viewer-store";

export type InspectionTool = "selection" | "sections" | "measure" | "capture";
export interface InspectionPreset {
  model: InspectionIdentity;
  sections: SectionConfiguration;
  visibleMeasurementIds: string[];
}

interface InspectionState {
  doc: InspectionDocument | null;
  unit: DisplayUnit;
  bounds: { min: Point3; max: Point3 };
  tool: InspectionTool;
  kind: MeasureKind;
  pose: MeasurementPose;
  draft: MeshAnchor | null;
  positionDragging: boolean;
  warnings: string[];
  status: string;
  viewName: string;
  lastCapture: InspectionDocument | null;
  invalidIds: string[];
  load: (loaded: LoadedScenePackage | null) => void;
  setTool: (tool: InspectionTool) => void;
  cancel: () => void;
  patchPlane: (slot: number, axis: CadAxis, patch: Partial<SectionPlane>) => void;
  patchSection: (slot: number, patch: Partial<SectionSettings>) => void;
  setShared: (slot: number, shared: boolean) => void;
  reset: () => void;
  patchSnap: (patch: Partial<SnapSettings>) => void;
  patchCapture: (patch: Partial<TechnicalOptions>) => void;
  confirm: (anchor: MeshAnchor, workspace: Workspace) => void;
  patchRecord: (id: string, changes: Pick<Partial<Measurement>, "name" | "visible" | "pose">) => void;
  remove: (id: string) => void;
  bind: (references: MeshReferences | null) => void;
  importText: (text: string) => void;
  preset: () => InspectionPreset | undefined;
  restorePreset: (preset?: InspectionPreset, name?: string) => void;
  exportDocument: (snapshot?: TechnicalSnapshot) => InspectionDocument | null;
  sourcePoint: (record: Measurement) => Point3 | null;
}

const storageKey = (model: InspectionIdentity) => "geogen:inspection:v1:" + JSON.stringify([
  model.projectId, model.revisionId, model.sha256 ?? model.fileName, model.bytes,
]);

let timeout: ReturnType<typeof setTimeout> | undefined;
let pending: InspectionDocument | null = null;
let loadedModel: LoadedScenePackage | null = null;
let references: MeshReferences | null = null;
let elementIds = new Set<string>();
let initialSections = makeSections();

function persistNow() {
  clearTimeout(timeout);
  if (!pending) return;
  const doc = pending;
  pending = null;
  try {
    localStorage.setItem(storageKey(doc.model), JSON.stringify(doc));
  } catch {
    useInspection.setState({ status: "O armazenamento local está indisponível. Exporte o JSON para guardar a inspeção." });
  }
}

function commit(doc: InspectionDocument) {
  useInspection.setState({ doc });
  pending = doc;
  clearTimeout(timeout);
  timeout = setTimeout(persistNow, 160);
}

function update(patch: Partial<InspectionDocument>) {
  const doc = useInspection.getState().doc;
  if (doc) commit({ ...doc, ...patch });
}

function markInvalid(doc: InspectionDocument | null) {
  if (!doc || !references) return [];
  return doc.measurements.filter((record) => record.anchors.some((anchor) => !references?.valid(anchor))).map((record) => record.id);
}

export const useInspection = create<InspectionState>((set, get) => ({
  doc: null, unit: "mm", bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  tool: "selection", kind: "distance", pose: "rest", draft: null, positionDragging: false,
  status: "", viewName: "Vista atual", lastCapture: null, invalidIds: [], warnings: [],
  load(loaded) {
    persistNow();
    loadedModel = loaded;
    references = null;
    elementIds = new Set(loaded?.sceneGraph.componentOrder);
    let doc: InspectionDocument | null = null;
    let status = "";
    let bounds: InspectionState["bounds"] = { min: [0, 0, 0], max: [0, 0, 0] };
    if (loaded) {
      const model = inspectionIdentity(loaded);
      const box = loaded.model.bounds;
      const center = box.min.clone();
      if (!box.isEmpty()) {
        center.add(box.max).multiplyScalar(0.5);
        bounds = { min: box.min.toArray(), max: box.max.toArray() };
      } else center.set(0, 0, 0);
      initialSections = makeSections(center);
      const defaults: InspectionDocument = {
        schemaVersion: "1.0.0", model, sections: initialSections, measurements: [],
        snap: { modes: ["surface", "vertex", "edge", "midpoint"], pixels: 12 },
        capture: defaultTechnicalOptions,
      };
      doc = defaults;
      try {
        const raw = localStorage.getItem(storageKey(model));
        if (raw) doc = parseInspection(raw, model, elementIds);
      } catch {
        status = "A inspeção local não pôde ser recuperada. Os padrões estão disponíveis nesta sessão.";
      }
    }
    set({ doc, unit: loaded?.sceneGraph.displayUnit ?? "mm", bounds, status, draft: null, tool: "selection", positionDragging: false,
      kind: "distance", pose: "rest", warnings: [], invalidIds: [], viewName: "Vista atual", lastCapture: null });
  },
  setTool(tool) { set({ tool, draft: null, positionDragging: false }); },
  cancel() { set({ draft: null }); },
  patchPlane(slot, axis, patch) {
    const sections = get().doc?.sections;
    if (!sections) return;
    const current = sectionAt(sections, slot);
    const planes = current.planes.map((plane) => plane.axis === axis ? { ...plane, ...patch } : plane) as SectionSettings["planes"];
    update({ sections: setSectionAt(sections, slot, { ...current, planes }) });
  },
  patchSection(slot, patch) {
    const sections = get().doc?.sections;
    if (sections) update({ sections: setSectionAt(sections, slot, { ...sectionAt(sections, slot), ...patch }) });
  },
  setShared(slot, shared) {
    const section = get().doc?.sections;
    if (section) update({ sections: shareSections(section, slot, shared) });
  },
  reset() { update({ sections: initialSections }); },
  patchSnap(patch) {
    const snap = get().doc?.snap;
    if (snap) update({ snap: { ...snap, ...patch } });
  },
  patchCapture(patch) {
    const capture = get().doc?.capture;
    if (capture) update({ capture: { ...capture, ...patch } });
  },
  confirm(anchor, workspace) {
    const { doc, draft, kind, pose } = get();
    if (!doc || !references) return;
    if (kind !== "point" && !draft) {
      set({ draft: anchor, status: "" });
      return;
    }
    if (doc.measurements.length >= 300) {
      set({ status: "Limite de 300 medições atingido." });
      return;
    }
    const anchors = kind === "point" ? [anchor] : [draft!, anchor];
    const points = anchors.map((point) => references?.point(point, pose));
    if (!points.every((point) => point != null)) return;
    const names = { distance: "Distância", delta: "Delta XYZ", point: "Coordenadas" };
    const record: Measurement = {
      id: crypto.randomUUID(), name: names[kind] + " " + (doc.measurements.length + 1), anchors, kind, pose,
      valueM: measurementValue(kind, points), provenance: "mesh", visible: true, capturedIn: workspace,
    };
    commit({ ...doc, measurements: [...doc.measurements, record] });
    set({ draft: null, status: "" });
  },
  patchRecord(id, changes) {
    const doc = get().doc;
    if (!doc) return;
    const measurements = doc.measurements.map((record) => {
      if (record.id !== id) return record;
      const result = { ...record, ...changes };
      if (changes.pose && changes.pose !== record.pose) {
        const points = record.anchors.map((anchor) => references?.point(anchor, result.pose));
        if (!points.every((point) => point != null)) return record;
        result.valueM = measurementValue(record.kind, points);
      }
      return result;
    });
    commit({ ...doc, measurements });
  },
  remove(id) {
    const doc = get().doc;
    if (doc) commit({ ...doc, measurements: doc.measurements.filter((record) => record.id !== id) });
  },
  bind(next) {
    references = next;
    if (next) set({ invalidIds: markInvalid(get().doc) });
  },
  importText(text) {
    const current = get().doc;
    if (!current || !references) throw new Error("Aguarde o carregamento da cena antes de importar a inspeção.");
    const next = parseInspection(text, current.model, elementIds, (anchor) => !!references?.valid(anchor));
    const { snapshot, ...doc } = next;
    commit(doc);
    set({ status: "Inspeção importada.", viewName: snapshot?.viewName ?? "Vista atual", invalidIds: [], draft: null });
  },
  preset() {
    const doc = get().doc;
    return doc && { model: doc.model, sections: doc.sections, visibleMeasurementIds: doc.measurements.filter((record) => record.visible).map((record) => record.id) } || undefined;
  },
  restorePreset(preset, name) {
    const doc = get().doc;
    if (doc && preset && matchesIdentity(preset.model, doc.model)) {
      const visible = new Set(preset.visibleMeasurementIds);
      commit({ ...doc, sections: preset.sections, measurements: doc.measurements.map((record) => ({ ...record, visible: visible.has(record.id) })) });
    }
    if (name) set({ viewName: name });
  },
  exportDocument(snapshot) {
    const doc = get().doc;
    if (!doc) return null;
    const measurements = doc.measurements.map((record) => {
      if (!snapshot || record.pose === "rest") return record;
      const points = record.anchors.map((anchor) => references?.point(anchor, record.pose));
      return points.every((point) => point != null) ? { ...record, valueM: measurementValue(record.kind, points) } : record;
    });
    return { ...doc, measurements, ...(snapshot ? { snapshot } : {}) };
  },
  sourcePoint(record) {
    if (record.kind !== "point") return null;
    const point = references?.point(record.anchors[0], record.pose);
    return point ? sourceCoordinates(point.toArray(), loadedModel?.manifest?.source) : null;
  },
}));

export function flushInspection() {
  persistNow();
}
