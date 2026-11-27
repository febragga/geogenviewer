"use client";

import { componentIdentifiers, componentLabel } from "../../../lib/geogen/domain/component-identity.ts";
import { useMemo, useState, type FormEvent, type RefObject } from "react";
import { ArrowLeftRight, Download, Layers2 } from "lucide-react";
import { statuses, stableValue, type Diff, type DiffStatus } from "../../../lib/geogen/revisions/diff";
import { documentMaxBytes, parseComparison, type ComparisonDocument } from "../../../lib/geogen/revisions/documents";
import { pairInspections, readInspection, type InspectionEntry } from "../../../lib/geogen/revisions/inspection";
import { maxInspectionBytes } from "../../../lib/geogen/inspection/document";
import { formatMeasurement, unitsPerMeter } from "../../../lib/geogen/inspection/measurements";
import { validateManual, type ManualMatch } from "../../../lib/geogen/revisions/matching";
import { differencesCsv, numericDelta } from "../../../lib/geogen/revisions/reports";
import { defaultAlignment, type Revision, type Triple } from "../../../lib/geogen/revisions/revision";
import { changeLabels, compareModeLabels, diffLabels, diffSymbols, matchLabels, provenanceLabels, shapeLabels, v07 } from "../v07-copy";
import type { RevisionComparison, Side } from "../state/revision-workspace";
import { actionClass, Choice, FileButton, formatNumber, NumericField, VirtualRows } from "./analytics-fields";
import { downloadFile } from "./download-file";

const sides: Side[] = ["base", "comparison"];
const sideLabels = { base: v07.base, comparison: v07.comparison };
const filterChoices = { all: v07.all, ...diffLabels };

function RevisionCard({ revision, label, busy, onLoad, onFiles, onRemove }: {
  revision: Revision | null; label: string; busy?: boolean;
  onLoad?: () => void; onFiles?: (files: File[]) => void; onRemove: () => void;
}) {
  const identity = revision?.identity;
  const validation = !revision?.scene.manifest ? v07.glbOnly :
    revision.scene.sceneGraph.diagnostics.sha256Verified ? v07.verified : v07.manifest;
  return <article className="gg-v07-revision">
    <h3>{label}</h3>
    {revision && identity ? <>
      <strong>{revision.scene.sceneGraph.projectTitle}</strong>
      <p className="gg-v07-muted">{validation}</p>
      <dl>
        <dt>{v07.project}</dt><dd>{identity.projectId ?? v07.unknown}</dd>
        <dt>{v07.revision}</dt><dd>{identity.revisionId ?? v07.unknown}</dd>
        <dt>{v07.prototype}</dt><dd>{identity.prototypeId ?? v07.unknown}</dd>
        <dt>{v07.scale}</dt><dd>{identity.scaleDenominator ? "1:" + identity.scaleDenominator : v07.unknown}</dd>
        <dt>{v07.source}</dt><dd>{identity.sourceOrigin ? identity.sourceOrigin.join(" / ") + " " + (identity.sourceUnit ?? "") : v07.unknown}</dd>
        <dt>{v07.hash}</dt><dd className="gg-mono">{identity.sha256 ?? v07.noHash}</dd>
      </dl>
      {revision.scene.sceneGraph.diagnostics.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
    </> : <p>{v07.chooseBase}</p>}
    <div className="gg-v07-actions">
      {onLoad && <button disabled={busy} type="button" className={actionClass} onClick={onLoad}>{revision ? v07.replace : v07.load}</button>}
      {onFiles && <FileButton label={(revision ? v07.replace : v07.load) + " · " + label} accept=".glb,.json" multiple disabled={busy} onFiles={onFiles} />}
      {revision && <button type="button" className={actionClass} onClick={onRemove}>{v07.remove} · {label}</button>}
    </div>
  </article>;
}

function AlignmentFields({ state, unit }: { state: RevisionComparison; unit: keyof typeof unitsPerMeter }) {
  const { alignment, toleranceM } = state.inputs;
  const unitScale = unitsPerMeter[unit];
  const triple = (name: "translationM" | "rotationDeg", index: number, value: number) => {
    const result = [...alignment[name]] as Triple;
    result[index] = value;
    state.update({ alignment: { ...alignment, [name]: result } });
  };
  return <details>
    <summary>{v07.alignment}</summary>
    <p>{state.space?.sourceAvailable ? v07.originAvailable : v07.originMissing}</p>
    <p className="gg-v07-muted">{v07.bakedTransforms}</p>
    <label className="gg-v07-check"><input type="checkbox" disabled={!state.space?.sourceAvailable}
      checked={alignment.source && Boolean(state.space?.sourceAvailable)}
      onChange={(event) => state.update({ alignment: { ...alignment, source: event.currentTarget.checked } })} />{v07.sourceAlignment}</label>
    {(["translationM", "rotationDeg"] as const).map((kind) => {
      const translation = kind === "translationM";
      const scale = translation ? unitScale : 1;
      return <fieldset key={kind}><legend>{translation ? v07.translation + " (" + unit + ", Y↑)" : v07.rotation + " (Y↑)"}</legend>
        <div className="gg-v07-grid gg-v07-grid--three">
          {["X", "Y", "Z"].map((axis, index) => <NumericField key={axis} label={axis} value={alignment[kind][index] * scale}
            onChange={(value) => triple(kind, index, value / scale)} />)}
        </div>
      </fieldset>;
    })}
    <div className="gg-v07-actions">
      <NumericField label={v07.tolerance + " (" + unit + ")"} value={toleranceM * unitScale} min={0}
        onChange={(value) => state.update({ toleranceM: value / unitScale })} />
      <button type="button" className={actionClass} onClick={() => state.update({ alignment: defaultAlignment })}>{v07.resetAlignment}</button>
    </div>
  </details>;
}

function Appearance({ state, compact, onFit }: { state: RevisionComparison; compact: boolean; onFit: () => void }) {
  const { display, setDisplay } = state;
  const patch = (value: Partial<typeof display>) => setDisplay((prior) => ({ ...prior, ...value }));
  return <>
    <div className="gg-v07-actions">
      <Choice label={v07.viewing} value={display.mode} options={compareModeLabels} onChange={(mode) => patch({ mode })} />
      {(display.mode === "toggle" || (compact && display.mode === "side")) &&
        <Choice label={v07.modeSwitch} value={display.side} options={sideLabels} onChange={(side) => patch({ side })} />}
      <button type="button" className={actionClass} onClick={onFit}>{v07.fit}</button>
      <button type="button" className={actionClass} aria-pressed={display.isolate && Boolean(state.selection)}
        disabled={!state.selection} onClick={() => patch({ isolate: !display.isolate })}>{v07.isolatePair}</button>
    </div>
    <details>
      <summary>{v07.diffColors}</summary>
      <label className="gg-v07-check"><input type="checkbox" checked={!display.semantic}
        onChange={(event) => patch({ semantic: !event.currentTarget.checked })} />{v07.original}</label>
      {display.mode === "side" && !compact && <label className="gg-v07-check"><input type="checkbox" checked={display.sync}
        onChange={(event) => patch({ sync: event.currentTarget.checked })} />{v07.sync}</label>}
      {display.mode === "differences" && <label className="gg-v07-check"><input type="checkbox" checked={display.context}
        onChange={(event) => patch({ context: event.currentTarget.checked })} />{v07.context}</label>}
      {(display.mode === "overlay" || display.mode === "differences") && sides.map((side) => <div key={side} className="gg-v07-actions">
        <label className="gg-v07-check"><input type="checkbox" checked={display.visible[side]}
          onChange={(event) => patch({ visible: { ...display.visible, [side]: event.currentTarget.checked } })} />{sideLabels[side]}</label>
        <label className="gg-v07-field"><span>{v07.opacity} · {sideLabels[side]}</span>
          <input type="range" min={0.05} max={1} step={0.05} value={display.opacity[side]}
            onChange={(event) => patch({ opacity: { ...display.opacity, [side]: event.currentTarget.valueAsNumber } })} />
        </label>
      </div>)}
      <div className="gg-v07-grid">
        {statuses.map((status) => <label key={status} className="gg-v07-check">
          <input type="color" value={display.colors[status]} onChange={(event) => patch({ colors: { ...display.colors, [status]: event.currentTarget.value } })} />
          {diffSymbols[status]} {diffLabels[status]}
        </label>)}
      </div>
    </details>
  </>;
}

function DiffInspector({ base, comparison, diff }: { base: Revision; comparison: Revision; diff: Diff }) {
  const a = diff.baseId ? base.occurrences.get(diff.baseId)?.record : null;
  const b = diff.comparisonId ? comparison.occurrences.get(diff.comparisonId)?.record : null;
  const output = base.scene.sceneGraph.displayUnit;
  const fields: { name: string; a: unknown; b: unknown; factor?: number; suffix?: string; sourceA?: string; sourceB?: string }[] = [
    { name: v07.name, a: a?.name, b: b?.name },
    { name: v07.category, a: a?.category, b: b?.category },
    { name: v07.layer, a: a?.layerId, b: b?.layerId },
    { name: v07.material, a: a?.cad?.fabrication?.material, b: b?.cad?.fabrication?.material },
    { name: "Material visual", a: a?.materialNames.join(", "), b: b?.materialNames.join(", ") },
    { name: "Tolerância de fabricação (mm)", a: a?.cad?.fabrication?.toleranceMm, b: b?.cad?.fabrication?.toleranceMm, factor: 1 },
    ...(["lengthM", "widthM", "thicknessM"] as const).map((key) => ({
      name: ({ lengthM: "Comprimento", widthM: "Largura", thicknessM: "Espessura" })[key] + " (" + output + ")",
      a: a?.cad?.dimensions?.[key], b: b?.cad?.dimensions?.[key], factor: unitsPerMeter[output],
      sourceA: a?.cad?.dimensions?.source, sourceB: b?.cad?.dimensions?.source,
    })),
    { name: "Área (m²)", a: a?.cad?.areaM2?.value, b: b?.cad?.areaM2?.value, factor: 1, sourceA: a?.cad?.areaM2?.source, sourceB: b?.cad?.areaM2?.source },
    { name: "Volume (m³)", a: a?.cad?.volumeM3?.value, b: b?.cad?.volumeM3?.value, factor: 1, sourceA: a?.cad?.volumeM3?.source, sourceB: b?.cad?.volumeM3?.source },
    ...[...new Set([...Object.keys(a?.cad?.properties ?? {}), ...Object.keys(b?.cad?.properties ?? {})])].sort().map((name) =>
      ({ name, a: a?.cad?.properties[name], b: b?.cad?.properties[name], sourceA: "cad", sourceB: "cad" })),
    ...[...new Set([...Object.keys(a?.cad?.userText ?? {}), ...Object.keys(b?.cad?.userText ?? {})])].sort().map((name) =>
      ({ name: "User Text · " + name, a: a?.cad?.userText[name], b: b?.cad?.userText[name], sourceA: "cad", sourceB: "cad" })),
  ];
  return <section aria-label={v07.properties}>
    <h3>{v07.properties}</h3>
    <p>{matchLabels[diff.method]}{diff.shape ? " · " + shapeLabels[diff.shape] : ""}{diff.transformInconclusive ? " · Transformação com cisalhamento ou singularidade" : ""}</p>
    {diff.changes.length > 0 && <p className="gg-v07-muted">{diff.changes.map((key) => changeLabels[key]).join(" · ")}</p>}
    <div className="gg-v07-table-scroll" tabIndex={0} role="region" aria-label={v07.properties}>
      <table className="gg-v07-table">
        <thead><tr><th scope="col">{v07.property}</th><th scope="col">{v07.base}</th><th scope="col">{v07.comparison}</th><th scope="col">{v07.delta}</th></tr></thead>
        <tbody>{fields.filter((field) => field.a != null || field.b != null).map((field, index) => {
          const scale = field.factor ?? 1;
          const value = (item: unknown, source?: string) => item == null ? "—" :
            (typeof item === "number" ? formatNumber(item * scale) : String(item)) + (source ? " · " + provenanceLabels[source] : "");
          const comparable = field.sourceA === field.sourceB;
          const delta = comparable && field.factor !== undefined && typeof field.a === "number" && typeof field.b === "number"
            ? numericDelta(field.a * scale, field.b * scale) : null;
          return <tr key={index}><th scope="row">{field.name}</th>
            <td>{value(field.a, field.sourceA)}</td><td>{value(field.b, field.sourceB)}</td>
            <td>{field.a == null || field.b == null ? "—" : !comparable ? "Proveniências diferentes" : delta && delta.absolute !== 0 ?
              formatNumber(delta.absolute) + (delta.percent === null ? "" : " (" + formatNumber(delta.percent) + "%)") :
              stableValue(field.a) !== stableValue(field.b) ? "Alterado" : "—"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}

function ManualEditor({ base, comparison, state, diff, fail }: {
  base: Revision; comparison: Revision; state: RevisionComparison; diff: Diff | undefined; fail: (message: string) => void;
}) {
  function submit(next: ManualMatch) {
    const manual = state.inputs.manual.filter((entry) => !(next.baseId && entry.baseId === next.baseId) &&
      !(next.comparisonId && entry.comparisonId === next.comparisonId));
    manual.push(next);
    try { validateManual(base, comparison, manual); state.update({ manual }); fail(""); }
    catch (cause) { fail(String(cause instanceof Error ? cause.message : cause)); }
  }

  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const baseId = String(data.get("base") ?? "").trim() || null;
    const comparisonId = String(data.get("comparison") ?? "").trim() || null;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    if (action === "unmatch") {
      if (baseId && comparisonId) { fail("Para marcar sem correspondência, informe o ID em apenas uma revisão."); return; }
      submit({ baseId, comparisonId });
      return;
    }
    if (!baseId || !comparisonId) { fail("Informe os IDs dos dois componentes."); return; }
    submit({ baseId, comparisonId, replacement: data.has("replacement") });
  }

  return <details>
    <summary>{v07.manual}</summary>
    {diff?.baseId && diff.candidates.length > 0 && <div className="gg-v07-stack">
      <p>{diff.candidateCount} · {matchLabels[diff.method]}{diff.candidateCount > diff.candidates.length ? " · informe outro ID abaixo, se necessário" : ""}</p>
      <ul className="gg-v07-candidates">{diff.candidates.map((id) => <li key={id}>
        <span>{componentLabel(comparison.occurrences.get(id)?.record, id)} · <code>{id}</code></span>
        <button type="button" className={actionClass} onClick={() => submit({ baseId: diff.baseId, comparisonId: id })}>{v07.useSuggestion}</button>
      </li>)}</ul>
    </div>}
    <form key={JSON.stringify([diff?.baseId, diff?.comparisonId])} className="gg-v07-stack" onSubmit={enter}>
      <label className="gg-v07-field">{v07.baseId}<input name="base" defaultValue={diff?.baseId ?? ""} /></label>
      <label className="gg-v07-field">{v07.nextId}<input name="comparison" defaultValue={diff?.comparisonId ?? ""} /></label>
      <label className="gg-v07-check"><input type="checkbox" name="replacement" defaultChecked={diff?.replacement} />{v07.replacement}</label>
      <div className="gg-v07-actions">
        <button type="submit" className={actionClass}>{v07.manualApply}</button>
        <button type="submit" value="unmatch" className={actionClass}>{v07.unmatch}</button>
        {diff?.method === "manual" && <button type="button" className={actionClass} onClick={() =>
          state.update({ manual: state.inputs.manual.filter((entry) => entry.baseId !== diff.baseId || entry.comparisonId !== diff.comparisonId) })}>
          {v07.undo}</button>}
      </div>
    </form>
  </details>;
}

function ComparisonInspection({ base, comparison, state, fail }: {
  base: Revision; comparison: Revision; state: RevisionComparison; fail: (message: string) => void;
}) {
  const { baseInspection, comparisonInspection, diffs, acceptedInspection } = state;
  const table = useMemo(() => pairInspections(baseInspection, comparisonInspection, diffs, acceptedInspection),
    [baseInspection, comparisonInspection, diffs, acceptedInspection]);
  const unit = base.scene.sceneGraph.displayUnit;
  async function load(file: File, side: Side) {
    try {
      if (file.size > maxInspectionBytes) throw new Error("Arquivo de inspeção excede 2 MB.");
      const revision = side === "base" ? base : comparison;
      state.storeInspection(revision, readInspection(await file.text(), revision));
      fail("");
    } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)); }
  }
  return <details>
    <summary>{v07.inspections}</summary>
    <div className="gg-v07-actions">
      {sides.map((side) => <FileButton key={side} label={v07.loadInspection + " · " + sideLabels[side]} onFiles={([file]) => void load(file, side)} />)}
    </div>
    {!table.length ? <p>{v07.inspectionRecordsEmpty}</p> : <div className="gg-v07-table-scroll" tabIndex={0} role="region" aria-label={v07.inspections}>
      <table className="gg-v07-table"><thead><tr><th scope="col">{v07.name}</th><th scope="col">{v07.base}</th><th scope="col">{v07.comparison}</th>
        <th scope="col">{v07.delta}</th></tr></thead>
        <tbody>{table.map((row) => {
          const value = (entry: InspectionEntry | null) => entry ? formatMeasurement(entry.record.valueM, unit) +
            (entry.invalid ? " · " + v07.invalid : " · Malha") : "—";
          return <tr key={row.key}><th scope="row">{row.base?.record.name ?? row.comparison?.record.name}</th>
            <td>{value(row.base)}</td><td>{value(row.comparison)}</td>
            <td>{row.delta ? formatMeasurement(row.delta.absolute, unit) : row.confirmed ? v07.confirmedMeasurement : row.removed ? v07.missingReference :
              row.valid ? <button type="button" className={actionClass} onClick={() => state.acceptInspection(row.key)}>
                {v07.acceptMeasurement}</button> : row.base && row.comparison ? v07.invalid : v07.pendingMeasurement}</td></tr>;
        })}</tbody></table>
    </div>}
  </details>;
}

export function RevisionViewLabels({ state, compact }: { state: RevisionComparison; compact: boolean }) {
  const { mode, side } = state.display;
  if (mode === "side" && !compact) return <div className="gg-v07-view-labels gg-v07-view-labels--split">
    <span>{v07.base}</span><span>{v07.comparison}</span>
  </div>;
  return <div className="gg-v07-view-labels"><span>{mode === "toggle" || mode === "side" ? sideLabels[side] : compareModeLabels[mode]}</span></div>;
}

export function ComparisonPanel({ base, comparison, state, compact, busy, baseOnLeft, error, onBase, onSecondary, onRemove,
  onReverse, onLab, onFit, capture }: {
  base: Revision | null; comparison: Revision | null; state: RevisionComparison; compact: boolean; busy: boolean;
  baseOnLeft: boolean; error: string; onBase: () => void; onSecondary: (files: File[]) => void; onRemove: (side: Side) => void;
  onReverse: () => void; onLab: () => void; onFit: () => void; capture: RefObject<(() => Promise<Blob>) | null>;
}) {
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("");
  const [capturing, setCapturing] = useState(false);
  const { diffs, inputs, selection } = state;
  const counts = useMemo(() => {
    const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<DiffStatus, number>;
    for (const diff of diffs) counts[diff.status]++;
    return counts;
  }, [diffs]);
  const rows = useMemo(() => diffs.filter((diff) => {
    if (inputs.filter && diff.status !== inputs.filter) return false;
    const name = [diff.baseId, diff.comparisonId, ...componentIdentifiers(diff.baseId ? base?.occurrences.get(diff.baseId)?.record : undefined),
      ...componentIdentifiers(diff.comparisonId ? comparison?.occurrences.get(diff.comparisonId)?.record : undefined)].join(" ").toLocaleLowerCase("pt-BR");
    return !query || name.includes(query.trim().toLocaleLowerCase("pt-BR"));
  }), [base, comparison, diffs, inputs.filter, query]);
  const selected = selection && diffs.find((row) => selection.side === "base" ? row.baseId === selection.id : row.comparisonId === selection.id);
  const activeIndex = selected ? rows.indexOf(selected) : -1;
  const choose = (diff: Diff) => state.select(diff.baseId ? { side: "base", id: diff.baseId } :
    diff.comparisonId ? { side: "comparison", id: diff.comparisonId } : null);
  const go = (offset: number) => {
    const next = rows[activeIndex < 0 ? (offset > 0 ? 0 : rows.length - 1) : (activeIndex + offset + rows.length) % rows.length];
    if (next) choose(next);
  };

  const unit = base?.scene.sceneGraph.displayUnit ?? "mm";
  const fail = (cause: unknown) => setIssue(cause instanceof Error ? cause.message : String(cause));
  async function importDoc(file: File) {
    if (!base || !comparison) return;
    try {
      if (file.size > documentMaxBytes) throw new Error("Documento excede 32 MB.");
      const data = parseComparison(await file.text(), base, comparison);
      state.update({ alignment: data.alignment, toleranceM: data.toleranceM, manual: data.manual, filter: data.filter, associated: data.associated });
      setIssue("");
    } catch (cause) { fail(cause); }
  }

  function exportDoc() {
    if (!base || !comparison) return;
    const data: ComparisonDocument = { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(),
      base: base.identity, comparison: comparison.identity, ...inputs, differences: diffs };
    downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "comparison.json");
  }

  async function exportPng() {
    const render = capture.current;
    if (!render) { fail("A viewport ainda está carregando."); return; }
    setCapturing(true);
    try { downloadFile(await render(), "comparacao.png"); setIssue(""); }
    catch (cause) { fail(cause); }
    finally { setCapturing(false); }
  }

  return <aside className="gg-v07-panel" aria-label={v07.compare}>
    <header className="gg-v07-panel-title"><Layers2 size={17} aria-hidden="true" /><h2>{v07.compare}</h2></header>
    <details open={!comparison || undefined}>
      <summary>{v07.revisions}</summary>
      <div className="gg-v07-stack">
        {sides.map((side) => {
          const primary = (side === "base") === baseOnLeft;
          return <RevisionCard key={side} label={sideLabels[side]} revision={side === "base" ? base : comparison} busy={busy}
            onLoad={primary ? onBase : undefined} onFiles={primary ? undefined : onSecondary} onRemove={() => onRemove(side)} />;
        })}
        <div className="gg-v07-actions">
          <button type="button" className={actionClass} onClick={onLab} disabled={busy}>{v07.revisionLab}</button>
          <button type="button" className={actionClass} onClick={onReverse} disabled={!base || !comparison || busy}>
            <ArrowLeftRight size={14} aria-hidden="true" />{v07.reverse}
          </button>
        </div>
      </div>
    </details>
    {(busy || state.computing) && <p role="status">{busy ? v07.loading : v07.loadingAnalysis}</p>}
    {(error || state.error) && <p role="alert" className="gg-v07-alert">{error || state.error}</p>}
    {issue && <p role="alert" className="gg-v07-alert">{issue}</p>}
    {base && comparison && <>
      {state.needsAssociation && !inputs.associated &&
        <div className="gg-v07-note"><p>{v07.associationRequired}</p><button type="button" className={actionClass}
          onClick={() => state.update({ associated: true })}>{v07.associate}</button></div>}
      {state.space?.differentScale && <p className="gg-v07-note">{v07.scaleWarning}</p>}
      {state.space?.differentKind && <p className="gg-v07-note">{v07.kindWarning}</p>}
      <Appearance state={state} compact={compact} onFit={onFit} />
      <AlignmentFields state={state} unit={unit} />
      <details>
        <summary>{v07.export}</summary>
        <div className="gg-v07-actions">
          <button type="button" className={actionClass} disabled={!state.ready} onClick={exportDoc}>{v07.comparisonJson}</button>
          <button type="button" className={actionClass} disabled={!state.ready} onClick={() =>
            downloadFile(new Blob([differencesCsv(base, comparison, diffs, inputs.toleranceM, new Date().toISOString())],
              { type: "text/csv;charset=utf-8" }), "diferencas.csv")}>{v07.comparisonCsv}</button>
          <button type="button" className={actionClass} disabled={capturing} onClick={() => void exportPng()}>
            <Download size={14} aria-hidden="true" />{v07.comparisonPng}
          </button>
          <FileButton label={v07.importComparison} onFiles={([file]) => void importDoc(file)} />
        </div>
      </details>
      {(state.ready || state.computing) && <div hidden={!state.ready}>
        <section aria-label={v07.differences}>
          <h3>{v07.differences}</h3>
          <div className="gg-v07-legend" aria-label={v07.status}>
            {statuses.map((status) => <span key={status}><i aria-hidden="true" style={{ background: state.display.colors[status] }} />
              {diffSymbols[status]} {diffLabels[status]} {counts[status]}</span>)}
          </div>
          <div className="gg-v07-grid">
            <Choice label={v07.status} value={inputs.filter ?? "all"} options={filterChoices} onChange={(value) => state.update({ filter: value === "all" ? null : value })} />
            <label className="gg-v07-field">{v07.search}<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
          </div>
          <div className="gg-v07-actions">
            <button type="button" className={actionClass} disabled={!rows.length} onClick={() => go(-1)}>{v07.prev}</button>
            <button type="button" className={actionClass} disabled={!rows.length} onClick={() => go(1)}>{v07.next}</button>
            <span className="gg-v07-muted">{rows.length} {v07.components.toLowerCase()}</span>
          </div>
          {rows.length ? <VirtualRows rows={rows} label={v07.differences} activeIndex={activeIndex}
            render={(diff) => {
              const record = diff.baseId ? base.occurrences.get(diff.baseId) : diff.comparisonId ? comparison.occurrences.get(diff.comparisonId) : null;
              return <button key={JSON.stringify([diff.baseId, diff.comparisonId])} type="button" className="gg-v07-diff-row"
                aria-pressed={selected === diff} onClick={() => choose(diff)}>
                <span className="gg-v07-diff-symbol" aria-hidden="true">{diffSymbols[diff.status]}</span>
                <span title={componentLabel(record?.record)}>{componentLabel(record?.record, diff.baseId ?? diff.comparisonId ?? undefined)}</span>
                <small>{diffLabels[diff.status]}</small>
              </button>;
            }} /> : <p>{v07.noResults}</p>}
        </section>
        {selected ? <DiffInspector base={base} comparison={comparison} diff={selected} /> : <p>{v07.noProperties}</p>}
        <ManualEditor base={base} comparison={comparison} state={state} diff={selected || undefined} fail={setIssue} />
        <ComparisonInspection key={state.key} base={base} comparison={comparison} state={state} fail={setIssue} />
      </div>}
    </>}
  </aside>;
}
