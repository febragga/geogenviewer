"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, FileText } from "lucide-react";
import { unitsPerMeter } from "../../../lib/geogen/inspection/measurements";
import { makeCallout, calloutText, type Callout } from "../../../lib/geogen/documentation/callouts";
import { catalogGroup, compareCatalog, type CatalogEntry, type CatalogItem, type CatalogScope } from "../../../lib/geogen/documentation/catalog";
import { createDocumentation, documentationMaxBytes, parseDocumentation, type CatalogColumn, type CatalogSettings,
  type DocumentationSettings, type ThumbnailStyle } from "../../../lib/geogen/documentation/document";
import { defaultLayout, type KnollingSettings } from "../../../lib/geogen/documentation/knolling";
import { catalogCsv, partsList } from "../../../lib/geogen/documentation/sheets";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import type { RenderDocumentationImage } from "../scene/documentation-renderer";
import { useKnollingMotion } from "../state/documentation-store";
import type { DocumentationWorkspace } from "../state/documentation-workspace";
import { usePresentation } from "../state/presentation-store";
import { diffLabels, massLabels, v07 } from "../v07-copy";
import { v08, calloutKinds, catalogColumns, catalogGroups, catalogScopes, catalogSort, densityLabels,
  layoutModes, leaderLabels, orientations, thumbnailStyles } from "../v08-copy";
import { actionClass, Choice, FileButton, formatNumber, NumericField, VirtualRows } from "./analytics-fields";
import { downloadFile } from "./download-file";
import { publicationCapture, SheetEditor, sheetReport, type Counterpart, type GenerateSheet } from "./sheet-editor";

const filterStatus = { all: v07.all, ...diffLabels };
const projections = { top: v08.top, axonometric: v08.axonometric, perspective: "Perspectiva", front: v08.front, back: v08.back,
  left: v08.left, right: v08.right, bottom: v08.bottom } as const;
const views = { cards: "Cartões", table: "Tabela", list: "Lista compacta", types: "Por tipo", categories: "Por categoria" } as const;

function ScopeControls({ scope, value, rows, change }: {
  scope: CatalogScope; value: string; rows: CatalogEntry[]; change: (scope: CatalogScope, value: string) => void;
}) {
  const values = useMemo(() => {
    if (scope === "group") return [...new Set(rows.flatMap((entry) => entry.groups))].sort();
    if (scope === "layer" || scope === "category" || scope === "material" || scope === "type" || scope === "assembly") {
      return [...new Set(rows.flatMap((entry) => catalogGroup(entry, scope) ?? []))].sort();
    }
    return [];
  }, [scope, rows]);
  const options = Object.fromEntries([["", v08.unavailable], ...values.map((item) => [item, item])]);
  return <>
    <Choice label={v08.scope} value={scope} options={catalogScopes} onChange={(next) => {
      const first = next === "group" ? rows.find((entry) => entry.groups.length)?.groups[0] :
        next === "layer" || next === "category" || next === "material" || next === "type" || next === "assembly"
          ? rows.map((entry) => catalogGroup(entry, next)).find(Boolean) : null;
      change(next, first ?? "");
    }} />
    {values.length > 0 && <Choice label={v08.value} value={value} options={options} onChange={(value) => change(scope, value)} />}
  </>;
}

function KnollingMotion() {
  const amount = useKnollingMotion((state) => state.amount);
  const playing = useKnollingMotion((state) => state.playing);
  return <div className="gg-v07-stack">
    <label className="gg-v07-field">{v08.progress}<input type="range" min={0} max={1} step={0.01} value={amount}
      onChange={(event) => useKnollingMotion.getState().set(event.currentTarget.valueAsNumber)} /></label>
    <div className="gg-v07-actions">
      <button type="button" className={actionClass} onClick={playing ? useKnollingMotion.getState().pause : useKnollingMotion.getState().play}>{playing ? v08.pause : v08.play}</button>
      <button type="button" className={actionClass} onClick={() => useKnollingMotion.getState().set(0)}>{v08.resetPose}</button>
    </div>
  </div>;
}

function KnollingControls({ docs, settings, selected, onFit }: {
  docs: DocumentationWorkspace; settings: DocumentationSettings; selected: CatalogEntry | undefined; onFit: () => void;
}) {
  const layout = settings.layout;
  const units = docs.revision?.scene.sceneGraph.displayUnit ?? "mm";
  const scale = unitsPerMeter[units];
  const id = selected?.occurrence.id;
  const placement = id ? docs.byPlacement.get(id) : undefined;
  const override = id && Object.hasOwn(layout.overrides, id) ? layout.overrides[id] : undefined;
  const patch = (patch: Partial<KnollingSettings>) => docs.change((old) => ({ ...old, layout: { ...old.layout, ...patch } }));
  const [view, setView] = useState<keyof typeof projections>("top");
  const position = override?.fixed ?? (placement ? [placement.x, placement.y] as [number, number] : undefined);
  function edit(override: import("../../../lib/geogen/documentation/knolling").PlacementOverride) {
    if (id) docs.change((old) => ({ ...old, layout: { ...old.layout, overrides: { ...old.layout.overrides, [id]: override } } }));
  }
  const fields = [["spacingM", v08.spacing], ["groupSpacingM", v08.groupSpacing], ["widthM", v08.width], ["marginM", v08.margin]] as const;
  return <>
    <div className="gg-v07-grid">
        <Choice label={v08.mode} value={layout.mode} options={layoutModes} onChange={(mode) => patch({ mode })} />
        <Choice label={v08.plane} value={layout.plane} options={{ XY: "XY", XZ: "XZ", YZ: "YZ" }} onChange={(plane) => patch({ plane })} />
        <ScopeControls scope={settings.scope} value={settings.scopeValue} rows={docs.entries}
          change={(scope, scopeValue) => docs.change((old) => ({ ...old, scope, scopeValue }))} />
    </div>
    <details>
      <summary>{v08.layout}</summary>
      <div className="gg-v07-grid">
        <Choice label={v08.group} value={layout.group} options={catalogGroups} onChange={(group) => patch({ group })} />
        <Choice label={v08.sort} value={layout.sort} options={catalogSort} onChange={(sort) => patch({ sort })} />
        <Choice label={v08.orientation} value={layout.orientation} options={orientations} onChange={(orientation) => patch({ orientation })} />
        <Choice label={v08.alignment} value={layout.alignment} options={{ start: "Início", center: "Centro", end: "Fim" }} onChange={(alignment) => patch({ alignment })} />
        <Choice label={v08.direction} value={layout.direction} options={{ forward: "Crescente", reverse: "Decrescente" }} onChange={(direction) => patch({ direction })} />
        <NumericField label={v08.columns} value={layout.columns} min={1} onChange={(columns) => patch({ columns: Math.min(100, Math.round(columns)) })} />
        {fields.map(([key, label]) => <NumericField key={key} label={label + " (" + units + ")"} value={layout[key] * scale}
          min={key === "widthM" ? 0.001 : 0} onChange={(value) => patch({ [key]: value / scale })} />)}
      </div>
      <button type="button" className={actionClass} onClick={() => patch({ ...defaultLayout(Math.max(...(docs.revision?.scene.sceneGraph.sceneBoundsMeters ?? [1]))), overrides: layout.overrides })}>{v08.reset}</button>
    </details>
    <div className="gg-v07-actions"><button type="button" className={actionClass}
      onClick={() => { useKnollingMotion.getState().set(1); onFit(); }}>{v08.generate}</button></div>
    <div className="gg-v07-grid">
      <Choice label="Câmera do knolling" value={view} options={projections} onChange={(next) => { setView(next); usePresentation.getState().access?.preset(next); }} />
      <div className="gg-v07-actions"><button type="button" className={actionClass} onClick={onFit}>{v08.fit}</button></div>
      {([["labels", v08.showLabels], ["groups", v08.showGroups], ["quantities", v08.showQuantities]] as const).map(([key, label]) =>
        <label className="gg-v07-check" key={key}><input type="checkbox" checked={settings[key]}
          onChange={(event) => { const checked = event.currentTarget.checked; docs.change((old) => ({ ...old, [key]: checked })); }} />{label}</label>)}
    </div>
    <KnollingMotion />
    {docs.layout.error && <p role="alert" className="gg-v07-alert">{docs.layout.error}</p>}
    {docs.layout.value?.warnings.map((message) => <p key={message} className="gg-v07-note">{message}</p>)}
    {id && (position || override) && <details><summary>{v08.manualPose}</summary>
      <div className="gg-v07-grid">
        <NumericField label={v08.rotation} value={override?.rotation ?? 0} onChange={(rotation) => edit({ rotation, fixed: override?.fixed ?? null })} />
        {position && <button type="button" className={actionClass} onClick={() => edit({
          rotation: override?.rotation ?? 0, fixed: override?.fixed ? null : position,
        })}>{override?.fixed ? v08.unpin : v08.pin}</button>}
        {override?.fixed && position && ([v08.pinX, v08.pinY] as const).map((label, index) => <NumericField key={label}
          label={label + " (" + units + ")"} value={position[index] * scale}
          onChange={(value) => {
            const next = [...position] as [number, number];
            next[index] = value / scale;
            edit({ rotation: override.rotation, fixed: next });
          }} />)}
      </div>
      <button type="button" className={actionClass} onClick={() => edit({ rotation: 0, fixed: override?.fixed ?? null })}>{v08.resetOrientation}</button>
    </details>}
  </>;
}

function Thumbnail({ renderer, revision, id, style }: {
  renderer: RenderDocumentationImage | null; revision: Revision; id: string; style: ThumbnailStyle;
}) {
  const [image, setImage] = useState<{ id: string; style: ThumbnailStyle; revision: string; url: string } | null>(null);
  useEffect(() => {
    if (!renderer) return;
    const controller = new AbortController();
    let url = "";
    void renderer({ revision, ids: [id], orientation: style === "orthographic" || style === "technical" ? "front" : "axonometric",
      style, width: 160, transparent: true }, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setImage({ id, style, revision: revision.key, url });
    }).catch(() => {});
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [renderer, revision, id, style]);
  return <span className="gg-v08-thumb">{image?.id === id && image.style === style && image.revision === revision.key
    ? <Image src={image.url} unoptimized width={160} height={160} alt="" /> : <Boxes size={22} aria-hidden="true" />}</span>;
}

function cell(row: CatalogEntry, column: CatalogColumn) {
  if (column === "status") return row.status ? diffLabels[row.status] : "—";
  if (column === "volume") return row.volume ? formatNumber(row.volume.value) + " m³ · " + row.volume.source : "—";
  if (column === "dimensions") {
    const dims = row.occurrence.record.cad?.dimensions;
    return dims ? [dims.lengthM, dims.widthM, dims.thicknessM].map((value) => value == null ? "—" : formatNumber(value * 1000))
      .join(" × ") + " mm · " + dims.source : "—";
  }
  if (column === "mass") {
    const mass = row.fabrication.mass;
    return Object.entries(mass).filter(([, item]) => item).map(([key, item]) =>
      massLabels[key as keyof typeof massLabels] + " " + formatNumber(item!.value) + " kg · " + item!.source).join(" / ") || "—";
  }
  return row[column] ?? "—";
}

function CatalogControls({ docs, settings, peer }: { docs: DocumentationWorkspace; settings: CatalogSettings; peer: Revision | null }) {
  const patch = (value: Partial<CatalogSettings>) => docs.change((old) => ({ ...old, catalog: { ...old.catalog, ...value } }));
  return <>
    {peer && <Choice label={v08.actual} value={docs.revisionSide} options={{ primary: "Modelo aberto", peer: "Outra revisão carregada" }} onChange={docs.setRevisionSide} />}
    <div className="gg-v07-grid">
      <Choice label={v08.catalogView} value={settings.view} options={views} onChange={(view) => patch({ view })} />
      <Choice label={v08.density} value={settings.density} options={densityLabels} onChange={(density) => patch({ density })} />
      <label className="gg-v07-field gg-v08-wide">{v08.search}<input type="search" value={settings.query} onChange={(event) => patch({ query: event.currentTarget.value })} /></label>
      {settings.view === "cards" && <Choice label={v08.viewImage} value={settings.thumbnail} options={thumbnailStyles} onChange={(thumbnail) => patch({ thumbnail })} />}
    </div>
    <details><summary>Filtros do catálogo</summary><div className="gg-v07-grid">
      <ScopeControls scope={settings.scope} value={settings.scopeValue} rows={docs.entries} change={(scope, scopeValue) => patch({ scope, scopeValue })} />
      <Choice label={v08.compare} value={settings.filterStatus} options={filterStatus} onChange={(filterStatus) => patch({ filterStatus })} />
      <Choice label={v08.group} value={settings.group} options={catalogGroups} onChange={(group) => patch({ group })} />
      <label className="gg-v07-field">{v08.prototypeFilter}<input value={settings.prototype} onChange={(event) => patch({ prototype: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.property}<input value={settings.property} onChange={(event) => patch({ property: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.value}<input value={settings.propertyValue} onChange={(event) => patch({ propertyValue: event.currentTarget.value })} /></label>
    </div></details>
    <details><summary>{v08.columnsConfig}</summary><div className="gg-v07-grid">
      {(Object.keys(catalogColumns) as CatalogColumn[]).map((key) => <label key={key} className="gg-v07-check">
        <input type="checkbox" checked={settings.columns.includes(key)} onChange={(event) => patch({
          columns: event.currentTarget.checked ? [...settings.columns, key] : settings.columns.filter((column) => column !== key),
        })} />{catalogColumns[key]}</label>)}
    </div></details>
  </>;
}

function ItemList({ docs, revision, knolling, renderer, onSelect }: {
  docs: DocumentationWorkspace; revision: Revision; knolling: boolean; renderer: RenderDocumentationImage | null;
  onSelect: (ids: string[]) => void;
}) {
  const settings = docs.settings!.catalog;
  const placed = docs.layout.value?.placements;
  const view = knolling ? "list" : settings.view;
  const items = useMemo(() => placed ? placed.map((row) => row.item) : [...docs.items]
    .sort((a, b) => {
      if (view === "categories") {
        const first = catalogGroup(a.representative, settings.group) ?? "";
        const second = catalogGroup(b.representative, settings.group) ?? "";
        const order = first.localeCompare(second, "pt-BR");
        if (order) return order;
      }
      return compareCatalog(a.representative, b.representative, "name");
    }), [docs.items, placed, settings.group, view]);
  const selected = new Set(docs.selected);
  const showImages = view === "cards";
  const height = showImages ? (settings.density === "detailed" ? 100 : settings.density === "comfortable" ? 88 : 72) : 44;
  const activeIndex = docs.selected.length ? items.findIndex((item) => item.members.some((row) => row.occurrence.id === docs.selected[0])) : -1;
  const columns = settings.columns;
  const gridStyle = { gridTemplateColumns: "minmax(145px, 1.1fr) " + columns.map(() => "minmax(100px, 1fr)").join(" "),
    minWidth: 145 + columns.length * 100 };
  const render = (item: CatalogItem, index: number) => {
    const row = item.representative, name = row.occurrence.record.name;
    const active = item.members.some((member) => selected.has(member.occurrence.id));
    const click = () => onSelect(item.members.map((member) => member.occurrence.id));
    const position = docs.byPlacement.get(row.occurrence.id);
    if (view === "table") return <div key={item.key} role="row" aria-rowindex={index + 2}
      className="gg-v07-table-row gg-v08-table-row" data-selected={active} style={gridStyle}>
      <span role="cell"><button className="gg-v07-table-select" type="button" aria-pressed={active} title={name} onClick={click}>{name}</button></span>
      {columns.map((column) => <span role="cell" title={cell(row, column)} key={column}>{cell(row, column)}</span>)}
    </div>;
    const metadata = [item.label ?? row.part, view === "categories" ? catalogGroup(row, settings.group) : row.category,
      position?.group, position?.fixed ? "Posição fixada" : null, item.inconsistent ? v08.inconsistent : null,
      row.status ? diffLabels[row.status] : null].filter(Boolean).join(" · ");
    return <button key={item.key} type="button" className="gg-v08-item" data-card={showImages || undefined} aria-pressed={active}
      onClick={click} style={{ height }}>
      {showImages && <Thumbnail renderer={renderer} revision={revision} id={row.occurrence.id} style={settings.thumbnail} />}
      <span className="gg-v08-item__text"><strong title={name}>{name}</strong>
        <small>{metadata}</small></span>
      <span>× {item.quantity}</span>
    </button>;
  };
  return <section aria-label={v08.parts}>
    <h3>{knolling ? v08.components : v08.parts} <small className="gg-v07-muted">· {items.length}</small></h3>
    {!items.length ? <p>{v08.noParts}</p> : view === "table" ? <div className="gg-v07-table-scroll" role="region" tabIndex={0} aria-label="Tabela do catálogo">
      <div role="table" aria-label={v08.catalog} aria-rowcount={items.length + 1} style={{ minWidth: gridStyle.minWidth }}>
        <div role="row" className="gg-v07-table-row gg-v07-table-head" style={gridStyle}>
          <span role="columnheader">{v08.components}</span>{columns.map((column) => <span role="columnheader" key={column}>{catalogColumns[column]}</span>)}
        </div>
        <VirtualRows rows={items} table label={v08.catalog} rowHeight={height} activeIndex={activeIndex} render={render} />
      </div>
    </div> : <VirtualRows rows={items} label={v08.parts} rowHeight={height} activeIndex={activeIndex} render={render} />}
  </section>;
}

function CalloutControls({ docs, selected, settings }: { docs: DocumentationWorkspace; selected: CatalogEntry | undefined; settings: DocumentationSettings }) {
  const [chosenId, setChosenId] = useState("");
  const labels = settings.callouts;
  const label = labels.find((entry) => entry.id === chosenId) ?? labels.find((entry) => entry.elementId === selected?.occurrence.id);
  const row = label ? docs.rows.get(label.elementId) : undefined;
  const update = (patch: Partial<Callout>) => docs.change((old) => ({ ...old, callouts: old.callouts.map((item) =>
    item.id === label?.id ? { ...item, ...patch } : item) }));
  function move(delta: number) {
    if (!label) return;
    docs.change((old) => {
      const callouts = [...old.callouts];
      const index = callouts.findIndex((row) => row.id === label.id);
      if (index + delta >= 0 && index + delta < callouts.length) [callouts[index + delta], callouts[index]] = [callouts[index], callouts[index + delta]];
      return { ...old, callouts };
    });
  }
  return <details>
    <summary>{v08.callouts}</summary>
    <div className="gg-v07-actions">
      <button type="button" className={actionClass} disabled={!selected?.occurrence.parts.length} onClick={() => {
        if (!selected) return;
        const entry = makeCallout(selected, crypto.randomUUID());
        docs.change((old) => ({ ...old, labels: true, callouts: [...old.callouts, entry] }));
        setChosenId(entry.id);
      }}>{v08.addCallout}</button>
      <label className="gg-v07-check"><input type="checkbox" checked={settings.labels}
        onChange={(event) => { const labels = event.currentTarget.checked; docs.change((old) => ({ ...old, labels })); }} />{v08.showLabels}</label>
    </div>
    {labels.length > 0 && <Choice label="Callout selecionado" value={label?.id ?? ""} options={Object.fromEntries([["", v08.noSelection],
      ...labels.map((item, index) => [item.id, (index + 1) + " · " + (docs.rows.get(item.elementId)?.occurrence.record.name ?? v08.invalid)])])}
      onChange={setChosenId} />}
    {label && <div className="gg-v07-stack">
      <p>{row ? calloutText(row, label, labels.indexOf(label)) : v08.invalid}</p>
      <div className="gg-v07-grid">
        <Choice label="Tipo do callout" value={label.kind} options={calloutKinds} onChange={(kind) => update({ kind })} />
        <Choice label={v08.leader} value={label.leader} options={leaderLabels} onChange={(leader) => update({ leader })} />
        {label.kind === "custom" && <label className="gg-v07-field gg-v08-wide">{v08.calloutText}<input maxLength={4096} value={label.text}
          onChange={(event) => update({ text: event.currentTarget.value })} /></label>}
        <NumericField label={v08.offsetX} value={label.offset[0]} onChange={(x) => update({ offset: [x, label.offset[1]] })} />
        <NumericField label={v08.offsetY} value={label.offset[1]} onChange={(y) => update({ offset: [label.offset[0], y] })} />
      </div>
      <label className="gg-v07-check"><input type="checkbox" checked={label.visible}
        onChange={(event) => update({ visible: event.currentTarget.checked })} />{v08.showCallout}</label>
      <div className="gg-v07-actions">
        <button type="button" className={actionClass} onClick={() => move(-1)}>{v08.earlier}</button>
        <button type="button" className={actionClass} onClick={() => move(1)}>{v08.later}</button>
        <button type="button" className={actionClass} onClick={() => docs.change((old) =>
          ({ ...old, callouts: old.callouts.filter((entry) => entry.id !== label.id) }))}>{v08.removeCallout}</button>
      </div>
    </div>}
  </details>;
}

export function DocumentationPanel({ docs, peer, knolling, renderer, counterpart, onSelect, onIsolate, onLocate, onFit }: {
  docs: DocumentationWorkspace; peer: Revision | null; knolling: boolean; renderer: RenderDocumentationImage | null;
  counterpart: Counterpart; onSelect: (ids: string[]) => void; onIsolate: (ids: string[]) => void;
  onLocate: (ids: string[], step?: number | null) => void; onFit: (ids?: string[]) => void;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<GenerateSheet | null>(null);
  const [manual, setManual] = useState(false);
  const [step, setStep] = useState(0);
  const [sort, setSort] = useState(false);
  const root = useRef<HTMLElement>(null);
  const settings = docs.settings, revision = docs.revision;
  if (!settings || !revision) return null;
  const selected = docs.rows.get(docs.selected[0]);
  const found = selected ? docs.items.find((entry) => entry.members.includes(selected)) : undefined;
  const item = found ?? (selected ? { key: selected.occurrence.key, label: selected.type, representative: selected,
    members: [selected], inconsistent: false, quantity: selected.occurrence.count } : null);
  const details = selected ? [...new Set([...(item ? item.members.map((entry) => entry.occurrence.id) : []), selected.occurrence.id])] : [];
  const title = knolling ? v08.knolling : v08.catalog;
  const exportItems = sort ? [...docs.items].sort((a, b) => compareCatalog(a.representative, b.representative, "part")) : docs.items;
  const fail = (error: unknown) => setError(error ? error instanceof Error ? error.message : String(error) : "");

  async function image(kind: "knolling" | "part" | "callouts") {
    if (!revision || !settings) return;
    setBusy(true);
    try {
      if (kind === "part" && (!selected || !renderer)) throw new Error(v08.noSelection);
      const blob = kind === "part" ? await renderer!({ revision, ids: [selected!.occurrence.id], orientation: "axonometric",
        style: "materials", width: 1440, background: settings.sheet.background, transparent: settings.sheet.transparent })
        : await publicationCapture(docs, settings.sheet, kind === "callouts");
      downloadFile(blob, kind === "knolling" ? "knolling.png" : kind === "part" ? "peca.png" : "callouts.png");
      fail(null);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }

  function exportJson(kind: "catalog" | "documentation" | "knolling") {
    if (!revision || !settings) return;
    try {
      const report = kind === "catalog" ? { parts: partsList(exportItems, settings.callouts) } :
        kind === "knolling" ? { placements: docs.layout.value?.placements.map(({ item, x, y, w, h, fixed }) =>
          ({ id: item.representative.occurrence.id, x, y, w, h, fixed, quantity: item.quantity })), units: "m" } :
          sheetReport(generated, exportItems, docs);
      const value = createDocumentation(revision, settings, kind, report);
      downloadFile(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), kind + ".json");
      fail(null);
    } catch (error) { fail(error); }
  }

  async function restore(file: File) {
    if (!revision) return;
    try {
      if (file.size > documentationMaxBytes) throw new Error("Documento excede 24 MB.");
      const value = parseDocumentation(await file.text(), revision);
      docs.change(() => value.settings); setNotice(v08.exactDoc); fail(null);
    } catch (error) { setNotice(""); fail(error); }
  }

  return <aside ref={root} className="gg-v07-panel gg-v08-panel" aria-label={title}>
    <header className="gg-v07-panel-title"><Boxes size={17} aria-hidden="true" /><h2>{title}</h2></header>
    {knolling ? <KnollingControls docs={docs} settings={settings} selected={selected} onFit={() => onFit()} /> :
      <CatalogControls docs={docs} settings={settings.catalog} peer={peer} />}
    <ItemList docs={docs} revision={revision} knolling={knolling} renderer={renderer} onSelect={onSelect} />
    <details>
      <summary>Identificação de tipos</summary>
      <label className="gg-v07-check"><input type="checkbox" checked={settings.types.blocks}
        onChange={(event) => { const blocks = event.currentTarget.checked; docs.change((old) => ({ ...old, types: { ...old.types, blocks } })); }} />{v08.blockType}</label>
      {selected && <label className="gg-v07-field">{v08.manualType}<input key={selected.occurrence.key}
        defaultValue={Object.hasOwn(settings.types.overrides, selected.occurrence.id) ? settings.types.overrides[selected.occurrence.id] : ""}
        onBlur={(event) => {
          const value = event.currentTarget.value.trim();
          docs.change((old) => {
            const overrides = { ...old.types.overrides };
            if (value) overrides[selected.occurrence.id] = value;
            else delete overrides[selected.occurrence.id];
            return { ...old, types: { ...old.types, overrides } };
          });
        }} /></label>}
      {item?.inconsistent && item.label && <button type="button" className={actionClass} onClick={() => docs.change((old) => {
        const label = item.label!;
        const confirmed = old.types.confirmed.includes(label) ? old.types.confirmed.filter((value) => value !== label) : [...old.types.confirmed, label];
        return { ...old, types: { ...old.types, confirmed } };
      })}>{settings.types.confirmed.includes(item.label) ? v08.splitType : v08.confirmType}</button>}
    </details>
    <details open={selected ? true : undefined}>
      <summary>{v08.detail}</summary>
      {selected ? <>
        <h3>{selected.occurrence.record.name}</h3>
        <p>{[selected.part ?? selected.occurrence.id, selected.type, revision.identity.revisionId].filter(Boolean).join(" · ")}</p>
        <dl className="gg-v07-metrics">
          {(["category", "layer", "material", "dimensions", "volume", "mass", "status"] as CatalogColumn[]).filter((column) => cell(selected, column) !== "—")
            .map((column) => <div key={column}><dt>{catalogColumns[column]}</dt><dd>{cell(selected, column)}</dd></div>)}
          {selected.occurrence.record.materialNames.length > 0 && <div><dt>Materiais GLB</dt><dd>{selected.occurrence.record.materialNames.join(" / ")}</dd></div>}
          {selected.stepLabel && <div><dt>{v08.step}</dt><dd>{selected.stepLabel}</dd></div>}
          {selected.occurrence.record.cad?.fabrication?.toleranceMm != null && <div><dt>Tolerância autorada</dt>
            <dd>{formatNumber(selected.occurrence.record.cad.fabrication.toleranceMm)} mm</dd></div>}
          {counterpart && <div><dt>{v08.otherRevision}</dt><dd>{counterpart.entry.occurrence.record.name} · {counterpart.revision.identity.revisionId}</dd></div>}
        </dl>
        <div className="gg-v07-actions">
          <button type="button" className={actionClass} onClick={() => onIsolate([selected.occurrence.id])}>{v08.isolate}</button>
          <button type="button" className={actionClass} onClick={() => onLocate(details)}>{v08.locate}</button>
          {selected.step !== null && <button type="button" className={actionClass} onClick={() => onLocate(details, selected.step)}>Abrir etapa</button>}
          <button type="button" className={actionClass} onClick={() => { const pane = root.current?.querySelector<HTMLDetailsElement>("[data-sheet-editor]");
            if (pane) { pane.open = true; pane.querySelector("summary")?.focus(); } }}>
            <FileText size={14} aria-hidden="true" />{v08.makeSheet}</button>
        </div>
      </> : <p>{v08.noSelection}</p>}
    </details>
    <CalloutControls docs={docs} selected={selected} settings={settings} />
    <SheetEditor docs={docs} item={item} counterpart={counterpart} renderer={renderer} knolling={knolling} manual={manual} setManual={setManual}
      selectedStep={step} setSelectedStep={setStep} generated={generated} onGenerated={setGenerated} fail={fail} />
    <details>
      <summary>{v08.export}</summary>
      <div className="gg-v07-grid">
        {([["labels", v08.showLabels], ["leaders", v08.leaderLines], ["legend", v08.includeLegend], ["grid", v08.grid],
          ["axes", v08.axes], ["measurements", v08.measurements], ["identifiers", v08.identifiers],
          ["scale", v08.graphicScale], ["transparent", v08.transparent], ["titleInCapture", v08.titleInCapture]] as const).map(([key, label]) => (
          <label className="gg-v07-check" key={key}><input type="checkbox" checked={settings.sheet[key]} onChange={(event) => {
            const checked = event.currentTarget.checked;
            docs.change((old) => ({ ...old, sheet: { ...old.sheet, [key]: checked } }));
          }} />{label}</label>
        ))}
        <label className="gg-v07-check"><input type="checkbox" checked={sort} onChange={(event) => setSort(event.currentTarget.checked)} />Ordenar CSV por Part ID</label>
      </div>
      <div className="gg-v07-actions">
        {knolling && <button type="button" className={actionClass} disabled={busy || Boolean(docs.layout.error)} onClick={() => void image("knolling")}>{v08.exportKnoll}</button>}
        <button type="button" className={actionClass} disabled={!selected || busy || !renderer} onClick={() => void image("part")}>{v08.exportPart}</button>
        <button type="button" className={actionClass} disabled={!docs.isPrimary || busy} onClick={() => void image("callouts")}>{v08.exportCallouts}</button>
        <button type="button" className={actionClass} onClick={() => downloadFile(new Blob([catalogCsv(revision, exportItems, settings.callouts)],
          { type: "text/csv;charset=utf-8" }), "catalogo.csv")}>{v08.exportCsv}</button>
        <button type="button" className={actionClass} onClick={() => exportJson("catalog")}>{v08.exportCatalog}</button>
        {knolling && <button type="button" className={actionClass} onClick={() => exportJson("knolling")}>{v08.exportKnolling}</button>}
        <button type="button" className={actionClass} onClick={() => exportJson("documentation")}>{v08.exportDocumentation}</button>
        <FileButton label={v08.importDoc} onFiles={([file]) => void restore(file)} />
      </div>
    </details>
    {error && <p role="alert" className="gg-v07-alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </aside>;
}
