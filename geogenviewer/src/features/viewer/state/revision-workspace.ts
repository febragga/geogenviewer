import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxGlbBytes } from "../../../lib/geogen/importers/glb";
import { importGlbBasicPackage, importGlbWithManifestPackage } from "../../../lib/geogen/importers/package";
import { maxManifestBytes } from "../../../lib/geogen/validation/manifest";
import { prepareDiff, type Diff, type DiffStatus } from "../../../lib/geogen/revisions/diff";
import type { InspectionEntry } from "../../../lib/geogen/revisions/inspection";
import { matchRevisions, type ManualMatch } from "../../../lib/geogen/revisions/matching";
import { alignmentFor, captureRevision, defaultAlignment, needsProjectAssociation, reverseAlignment, type Alignment, type Revision } from "../../../lib/geogen/revisions/revision";

export type CompareMode = "side" | "overlay" | "differences" | "toggle";
export type Side = "base" | "comparison";
export type CompareSelection = { side: Side; id: string };
export const diffColors: Record<DiffStatus, string> = {
  unchanged: "#8896a4", added: "#267e53", removed: "#c4484e", modified: "#b96b14", unresolved: "#8a56be",
};

export interface CompareDisplay {
  mode: CompareMode;
  side: Side;
  visible: Record<Side, boolean>;
  opacity: Record<Side, number>;
  colors: Record<DiffStatus, string>;
  semantic: boolean;
  context: boolean;
  sync: boolean;
  isolate: boolean;
}

const initialDisplay: CompareDisplay = { mode: "side", side: "base", visible: { base: true, comparison: true },
  opacity: { base: 1, comparison: 0.58 }, colors: diffColors, semantic: true, context: false, sync: true, isolate: false };

export function useSecondaryRevision() {
  const current = useRef<Revision | null>(null);
  const token = useRef(0);
  const retired = useRef<Revision[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    token.current++;
    current.current?.scene.dispose();
    for (const revision of retired.current.splice(0)) revision.scene.dispose();
    current.current = null;
  }, []);

  useEffect(() => {
    for (const entry of retired.current.splice(0)) entry.scene.dispose();
  }, [revision]);

  function release(dispose = true) {
    token.current++;
    const previous = current.current;
    current.current = null;
    setRevision(null);
    setBusy(false);
    setError("");
    if (dispose && previous) retired.current.push(previous);
    return previous;
  }

  async function load(read: () => Promise<{ glb: ArrayBuffer; manifest: ArrayBuffer | null; name: string }>) {
    const request = ++token.current;
    setBusy(true);
    setError("");
    try {
      const { glb, manifest, name } = await read();
      if (request !== token.current) return;
      const scene = manifest ? await importGlbWithManifestPackage(glb, manifest, name) : await importGlbBasicPackage(glb, name);
      if (request !== token.current) { scene.dispose(); return; }
      let next: Revision;
      try { next = captureRevision(scene); } catch (cause) { scene.dispose(); throw cause; }
      const previous = current.current;
      current.current = next;
      setRevision(next);
      if (previous) retired.current.push(previous);
    } catch (cause) {
      if (token.current === request) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (token.current === request) setBusy(false);
    }
  }

  async function files(files: File[]) {
    return load(async () => {
      const glbs = files.filter((file) => /\.glb$/i.test(file.name));
      const manifests = files.filter((file) => /\.json$/i.test(file.name) && file.name !== "export_report.json");
      if (glbs.length !== 1 || manifests.length > 1) throw new Error("Selecione um GLB e, opcionalmente, um manifesto.");
      const [file] = glbs, [json] = manifests;
      if (file.size > maxGlbBytes || (json && json.size > maxManifestBytes)) throw new Error("Arquivo excede o limite de importação.");
      const [glb, manifest] = await Promise.all([file.arrayBuffer(), json?.arrayBuffer() ?? null]);
      return { glb, manifest, name: file.name };
    });
  }

  async function demo(kind: "revision" | "catalog" = "revision") {
    return load(async () => {
      const directory = kind === "catalog" ? "/demos/catalog-lab/rev-02/" : "/demos/revision-lab/proto-02/";
      const [glb, manifest] = await Promise.all(["model.glb", "manifest.json"].map(async (file) => {
        const response = await fetch(directory + file);
        if (!response.ok) throw new Error("O protótipo sintético está indisponível.");
        return response.arrayBuffer();
      }));
      return { glb, manifest, name: "model.glb" };
    });
  }

  return { revision, busy, error, release, files, demo };
}

interface CompareInputs {
  associated: boolean;
  manual: ManualMatch[];
  toleranceM: number;
  alignment: Alignment;
  filter: DiffStatus | null;
}
const initial: CompareInputs = { associated: false, manual: [], toleranceM: 0.0001, alignment: defaultAlignment, filter: null };
const noDiffs: Diff[] = [];
const noRecords: InspectionEntry[] = [];
const noAccepted: ReadonlySet<string> = new Set();
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function useRevisionComparison(base: Revision | null, comparison: Revision | null, enabled: boolean) {
  const key = JSON.stringify([base?.key, comparison?.key]);
  const [state, setState] = useState<{ key: string; data: CompareInputs } | null>(null);
  const reverseKey = JSON.stringify([comparison?.key, base?.key]);
  const inputs = useMemo((): CompareInputs => {
    if (state?.key === key) return state.data;
    if (state?.key !== reverseKey || !base || !comparison) return initial;
    const data = state.data;
    return { ...data, alignment: reverseAlignment(base, comparison, data.alignment),
      manual: data.manual.map((entry) => ({ ...entry, baseId: entry.comparisonId, comparisonId: entry.baseId })),
      filter: data.filter === "added" ? "removed" : data.filter === "removed" ? "added" : data.filter };
  }, [state, key, reverseKey, base, comparison]);
  const update = useCallback((patch: Partial<CompareInputs>) =>
    setState((old) => ({ key, data: { ...(old?.key === key ? old.data : inputs), ...patch } })), [key, inputs]);
  const [display, setDisplay] = useState(initialDisplay);
  const [inspection, setInspection] = useState<{ records: Record<string, InspectionEntry[]>; accepted: { key: string; ids: ReadonlySet<string> } | null }>(
    { records: {}, accepted: null });
  const baseInspection = base ? inspection.records[base.key] ?? noRecords : noRecords;
  const comparisonInspection = comparison ? inspection.records[comparison.key] ?? noRecords : noRecords;
  const acceptedInspection = inspection.accepted?.key === key ? inspection.accepted.ids : noAccepted;
  const storeInspection = (revision: Revision, records: InspectionEntry[]) =>
    setInspection((current) => ({ records: { ...current.records, [revision.key]: records }, accepted: null }));
  const acceptInspection = (id: string) => setInspection((current) => ({
    records: current.records, accepted: { key, ids: new Set([...(current.accepted?.key === key ? current.accepted.ids : noAccepted), id]) },
  }));
  const [picked, setPicked] = useState<{ key: string; value: CompareSelection | null } | null>(null);
  const selection = picked?.key === key ? picked.value : null;
  const select = useCallback((value: CompareSelection | null) => setPicked({ key, value }), [key]);
  const needsAssociation = Boolean(base && comparison && needsProjectAssociation(base, comparison));
  const { alignment, associated, manual, toleranceM } = inputs;
  const space = useMemo(() => base && comparison ? alignmentFor(base, comparison, alignment) : null, [base, comparison, alignment]);
  const request = useMemo(() => enabled && base && comparison && space && (!needsAssociation || associated)
    ? { id: Symbol(), base, comparison, manual, associated, matrix: space.matrix, toleranceM } : null,
  [base, comparison, manual, associated, needsAssociation, enabled, space, toleranceM]);
  const [analysis, setAnalysis] = useState<{ id: symbol; diffs: Diff[]; error: string } | null>(null);
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    async function run() {
      if (!request) return;
      await yieldTask();
      if (cancelled) return;
      try {
        const matches = matchRevisions(request.base, request.comparison, request.manual, request.associated);
        const diff = prepareDiff(request.base, request.comparison, request.matrix, request.toleranceM);
        const diffs: Diff[] = [];
        let deadline = performance.now() + 14;
        for (const match of matches) {
          diffs.push(diff(match));
          if (performance.now() > deadline) {
            await yieldTask();
            if (cancelled) return;
            deadline = performance.now() + 14;
          }
        }
        if (!cancelled) setAnalysis({ id: request.id, diffs, error: "" });
      } catch (cause) {
        if (!cancelled) setAnalysis({ id: request.id, diffs: noDiffs, error: cause instanceof Error ? cause.message : String(cause) });
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [request]);
  const result = request && analysis?.id === request.id ? analysis : null;
  return { key, inputs, update, display, setDisplay, selection, select, needsAssociation, space,
    baseInspection, comparisonInspection, acceptedInspection, storeInspection, acceptInspection,
    diffs: result?.diffs ?? noDiffs, ready: Boolean(result && !result.error), computing: Boolean(request && !result), error: result?.error ?? "" };
}

export type RevisionComparison = ReturnType<typeof useRevisionComparison>;
