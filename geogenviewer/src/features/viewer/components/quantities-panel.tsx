"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ListTree } from "lucide-react";
import { parseFabrication, documentMaxBytes, type FabricationDocument } from "../../../lib/geogen/revisions/documents";
import { analyzeFabrication, defaultFabrication, summarizeFabrication, type FabricationRow, type FabricationSettings } from "../../../lib/geogen/revisions/fabrication";
import { collectQuantities, groupQuantities, summarizeQuantities, type coverage, type QuantityRow } from "../../../lib/geogen/revisions/quantities";
import { numericDelta, quantitiesCsv } from "../../../lib/geogen/revisions/reports";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { coverageReasons, groupLabels, massLabels, provenanceLabels, scopeLabels, timeLabels, v07 } from "../v07-copy";
import type { RevisionComparison, Side } from "../state/revision-workspace";
import { actionClass, Choice, FileButton, formatNumber, VirtualRows } from "./analytics-fields";
import { downloadFile } from "./download-file";
import { FabricationControls } from "./fabrication-settings";

export type QuantitiesLayout = "table" | "analytics" | "tableFocus" | "modelFocus";
export const quantitiesLayouts: Record<QuantitiesLayout, string> = {
  table: v07.modelTable, analytics: v07.modelAnalytics, tableFocus: v07.focusTable, modelFocus: v07.focusModel,
};

const revisionLabels = { base: v07.base, comparison: v07.comparison };
const columns = { category: v07.category, layer: v07.layer, material: v07.material, area: v07.area + " (m²)",
  volume: v07.volume + " (m³)", dimensions: v07.dimensions + " (m)", solid: massLabels.solid + " (kg)",
  slicer: massLabels.slicer + " (kg)", measured: massLabels.measured + " (kg)", estimate: massLabels.estimate + " (kg)",
  cost: v07.costSubtotal } as const;
type Column = keyof typeof columns;
const defaultColumns: Column[] = ["category", "material", "volume"];
const orderLabels = { component: v07.component, category: v07.category, material: v07.material, volume: v07.volume, area: v07.area };
const chartLabels = { counts: "Ocorrências por categoria", categoryVolume: "Volume por categoria", materialVolume: "Volume por material",
  mass: "Massa por material", cost: "Custo por material", revision: v07.compareQuantities };

export type AnalysisConfig = Pick<FabricationDocument, "settings" | "scope" | "grouping" | "scopeValue" | "property">;
const methodLabels: Record<string, string> = {
  "area-cad": "CAD", "area-authored": "Autorada", "area-mesh": "Malha informada", "area-triangles": "Triângulos",
  "volume-cad": "CAD", "volume-authored": "Autorado", "volume-mesh": "Malha informada", "volume-closed-mesh": "Malha fechada",
};
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format;
const defaultConfig: AnalysisConfig = { settings: defaultFabrication, scope: "all", grouping: "category", scopeValue: "", property: "" };
type Coverage = ReturnType<typeof coverage>;
type QuantitySummary = ReturnType<typeof summarizeQuantities>;
type FabricationSummary = ReturnType<typeof summarizeFabrication>;

function formatCoverage(report: Coverage) {
  return report.percent === null ? v07.noData :
    `${report.included} ${v07.covered}, ${report.excluded} ${v07.excluded} · ${percent(report.percent)}%`;
}

function CoverageReport({ report }: { report: Coverage }) {
  return <span className="gg-v07-muted">{formatCoverage(report)}
    {report.excluded > 0 && Object.entries(report.reasons).map(([key, value]) =>
      <span key={key}> · {value} {coverageReasons[key] ?? key}</span>)}
  </span>;
}

function QuantitiesSummary({ summary, fabrication }: { summary: QuantitySummary; fabrication: FabricationSummary }) {
  const row = (name: string, value: number, description?: string) => <div key={name}>
    <dt>{name}</dt><dd>{formatNumber(value)}{description ? " " + description : ""}</dd>
  </div>;
  const metric = (name: string, report: Coverage, unit = "") => <div key={name + " · " + unit}>
    <dt>{name}</dt><dd>{report.subtotal === null ? "—" : formatNumber(report.subtotal) + " " + unit}<br />
      <CoverageReport report={report} /></dd>
  </div>;
  return <>
    <dl className="gg-v07-summary">
      {row(v07.components, summary.components)}
      {row(v07.occurrences, summary.occurrences)}
      {summary.types > 0 && row(v07.types, summary.types)}
      {summary.blocks > 0 && row(v07.blocks, summary.blocks)}
      {summary.uniqueGeometries > 0 && row(v07.geometries, summary.uniqueGeometries)}
      {summary.volumeCoverage.percent !== null && <div><dt>{v07.volumeCoverage}</dt><dd>{percent(summary.volumeCoverage.percent)}%</dd></div>}
    </dl>
    <details><summary>{v07.subtotal}</summary><dl className="gg-v07-summary">
      {Object.entries(summary.area).map(([key, report]) => metric(v07.area + " · " + (methodLabels[key] ?? key), report, "m²"))}
      {Object.entries(summary.volume).map(([key, report]) => metric(v07.volume + " · " + (methodLabels[key] ?? key), report, "m³"))}
      {Object.entries(fabrication.mass).map(([key, report]) => report.included > 0 && metric(massLabels[key as keyof typeof massLabels], report, "kg"))}
      {Object.entries(fabrication.costs).map(([key, report]) => {
        const [currency, method] = key.split(" ");
        return metric(v07.costSubtotal + " · " + massLabels[method as keyof typeof massLabels], report, currency);
      })}
      {Object.entries(fabrication.time).map(([key, report]) => report.included > 0 && metric(timeLabels[key as keyof typeof timeLabels], report))}
    </dl></details>
    <details><summary>{v07.coverage}</summary>
      <dl className="gg-v07-metrics">
        {[[v07.area, summary.areaCoverage], [v07.volume, summary.volumeCoverage], [v07.material, fabrication.material], [v07.density, fabrication.density],
          ...Object.entries(fabrication.mass).map(([key, report]) => [massLabels[key as keyof typeof massLabels], report])]
          .map(([name, report]) => <div key={String(name)}><dt>{String(name)}</dt><dd><CoverageReport report={report as Coverage} /></dd></div>)}
      </dl>
    </details>
  </>;
}

function ComparisonMetrics({ base, comparison }: {
  base: { quantities: QuantitySummary; fabrication: FabricationSummary };
  comparison: { quantities: QuantitySummary; fabrication: FabricationSummary };
}) {
  const [metric, setMetric] = useState(v07.components);
  const metrics = [
    { label: v07.components, a: base.quantities.components, b: comparison.quantities.components, warning: false },
    { label: v07.occurrences, a: base.quantities.occurrences, b: comparison.quantities.occurrences, warning: false },
  ];
  const add = (label: string, first: Record<string, Coverage>, last: Record<string, Coverage>, unit: (key: string) => string) => {
    for (const key of new Set([...Object.keys(first), ...Object.keys(last)])) {
      const a = first[key], b = last[key];
      if (a?.subtotal == null && b?.subtotal == null) continue;
      metrics.push({ label: label + " · " + unit(key), a: a?.subtotal ?? NaN, b: b?.subtotal ?? NaN,
        warning: a?.percent !== 100 || b?.percent !== 100 });
    }
  };
  add(v07.volume, base.quantities.volume, comparison.quantities.volume, (key) => (methodLabels[key] ?? key) + " (m³)");
  add(v07.area, base.quantities.area, comparison.quantities.area, (key) => (methodLabels[key] ?? key) + " (m²)");
  add("Massa", base.fabrication.mass, comparison.fabrication.mass, (key) => massLabels[key as keyof typeof massLabels] + " (kg)");
  add(v07.costSubtotal, base.fabrication.costs, comparison.fabrication.costs, (key) => key);
  const comparable = metrics.filter(({ a, b }) => Number.isFinite(a) && Number.isFinite(b));
  const active = comparable.find((entry) => entry.label === metric) ?? comparable[0];
  const max = Math.max(active.a, active.b) || 1;
  return <>
    <Choice label={v07.property} value={active.label} onChange={setMetric}
      options={Object.fromEntries(comparable.map(({ label }) => [label, label]))} />
    <ul className="gg-v07-chart" aria-label={v07.compareQuantities}>
      {[[v07.base, active.a], [v07.comparison, active.b]].map(([label, value]) => <li key={label}>
        <span>{label}</span><span>{formatNumber(Number(value))}</span>
        <span className="gg-v07-chart__track" aria-hidden="true"><span style={{ width: 100 * Number(value) / max + "%" }} /></span>
      </li>)}
    </ul>
    <div className="gg-v07-table-scroll" tabIndex={0} role="region" aria-label={v07.compareQuantities}>
    {metrics.some((row) => row.warning) && <p className="gg-v07-note">{v07.compareCoverage}</p>}
    <table className="gg-v07-table"><thead><tr><th scope="col">{v07.property}</th><th scope="col">{v07.base}</th>
      <th scope="col">{v07.comparison}</th><th scope="col">{v07.delta}</th></tr></thead>
      <tbody>{metrics.map((row) => {
        const a = Number.isFinite(row.a) ? row.a : null, b = Number.isFinite(row.b) ? row.b : null;
        const delta = numericDelta(a, b);
        return <tr key={row.label}><th scope="row">{row.label}</th><td>{a === null ? "—" : formatNumber(a)}</td>
          <td>{b === null ? "—" : formatNumber(b)}</td>
          <td>{delta ? formatNumber(delta.absolute) + (delta.percent === null ? "" : " (" + formatNumber(delta.percent) + "%)") : "—"}</td>
        </tr>;
      })}</tbody>
    </table>
    </div>
  </>;
}

function Charts({ rows, fabrication, peers }: {
  rows: QuantityRow[]; fabrication: FabricationRow[];
  peers: { base: { quantities: QuantitySummary; fabrication: FabricationSummary };
    comparison: { quantities: QuantitySummary; fabrication: FabricationSummary } } | null;
}) {
  const [chart, setChart] = useState<keyof typeof chartLabels>("counts");
  const [method, setMethod] = useState<keyof typeof massLabels>("solid");
  const volumeMethods = useMemo(() => [...new Set(rows.flatMap((row) => row.volume?.method ?? []))], [rows]);
  const [volumeType, setVolumeType] = useState("");
  const volume = volumeMethods.includes(volumeType) ? volumeType : volumeMethods[0] ?? "";
  const currencies = [...new Set(fabrication.flatMap((entry) => entry.costs.map((cost) => cost.currency)))];
  const [currencyType, setCurrencyType] = useState("");
  const currency = currencies.includes(currencyType) ? currencyType : currencies[0] ?? "";
  const data = (() => {
    const groups = new Map<string, number>();
    function append(key: string | null, value: number | null | undefined) {
      if (value != null) groups.set(key ?? v07.unknown, (groups.get(key ?? v07.unknown) ?? 0) + value);
    }
    if (chart === "counts") for (const row of rows) append(row.category, row.occurrence.count);
    if (chart === "categoryVolume" || chart === "materialVolume") for (const row of rows) {
      if (row.volume?.method === volume) append(chart === "categoryVolume" ? row.category : row.material, row.volume.value);
    }
    if (chart === "mass" || chart === "cost") for (const row of fabrication) {
      append(row.material, chart === "mass" ? row.mass[method]?.value : row.costs.find((cost) => cost.currency === currency && cost.method === method)?.value);
    }
    return [...groups].sort((a, b) => b[1] - a[1]);
  })();
  const max = data[0]?.[1] || 1;
  const units = chart === "mass" ? " kg" : chart === "cost" ? " " + currency :
    chart === "categoryVolume" || chart === "materialVolume" ? " m³" : "";
  return <section className="gg-v07-stack" aria-label={v07.modelAnalytics}>
    <Choice label={v07.chart} value={chart} options={chartLabels} onChange={setChart} />
    {(chart === "mass" || chart === "cost") && <Choice label="Método de massa" value={method} options={massLabels} onChange={setMethod} />}
    {chart === "cost" && currencies.length > 0 && <Choice label={v07.currency} value={currency}
      options={Object.fromEntries(currencies.map((entry) => [entry, entry]))} onChange={setCurrencyType} />}
    {(chart === "categoryVolume" || chart === "materialVolume") && volumeMethods.length > 0 && <Choice label={v07.subtotal} value={volume}
      options={Object.fromEntries(volumeMethods.map((entry) => [entry, methodLabels[entry] ?? entry]))} onChange={setVolumeType} />}
    {chart === "revision" ? peers ? <ComparisonMetrics {...peers} /> : <p>{v07.noComparison}</p> :
      !data.length ? <p>{v07.noData}</p> :
      <ul className="gg-v07-chart" aria-label={chartLabels[chart]}>{data.map(([label, value]) => <li key={label}>
        <span>{label}</span><span>{formatNumber(value)}{units}</span>
        <span className="gg-v07-chart__track" aria-hidden="true"><span style={{ width: `${100 * value / max}%` }} /></span>
      </li>)}</ul>}
  </section>;
}

function valueFor(row: QuantityRow, fabrication: FabricationRow, column: Column) {
  if (column === "category" || column === "layer" || column === "material") return row[column] ?? "—";
  if (column === "volume" || column === "area") {
    const data = row[column];
    return data ? formatNumber(data.value) + " · " + provenanceLabels[data.source] : "—";
  }
  if (column === "dimensions") {
    const dims = row.occurrence.record.cad?.dimensions;
    if (!dims) return "—";
    const values = [dims.lengthM, dims.widthM, dims.thicknessM].map((value) => value == null ? "—" : formatNumber(value));
    return values.join(" × ") + " · " + provenanceLabels[dims.source];
  }
  if (column === "cost") return fabrication.costs.map((cost) =>
    cost.currency + " " + formatNumber(cost.value) + " · " + massLabels[cost.method]).join(" / ") || "—";
  const data = fabrication.mass[column];
  return data ? formatNumber(data.value) + " · " + provenanceLabels[data.source] : "—";
}

function QuantityTable({ grouped, analysis, selected, onSelect }: {
  grouped: ReturnType<typeof groupQuantities>; analysis: FabricationRow[];
  selected: readonly string[]; onSelect: (ids: string[], multi: boolean) => void;
}) {
  const [shown, setShown] = useState(defaultColumns);
  const byId = useMemo(() => new Map(analysis.map((entry) => [entry.id, entry])), [analysis]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const entries = useMemo(() => {
    type Item = { key: string; label: string; ids: string[]; subtotal: string } | { key: string; row: QuantityRow };
    const result: Item[] = [];
    for (const [label, rows] of grouped.groups) {
      const summary = summarizeQuantities(rows);
      const volumes = Object.entries(summary.volume).map(([method, value]) => value.subtotal === null ? "" :
        formatNumber(value.subtotal) + " m³ · " + (methodLabels[method] ?? method)).filter(Boolean);
      result.push({ key: JSON.stringify(["group", label]), label: label ?? v07.unknown, ids: rows.map((row) => row.occurrence.id),
        subtotal: [summary.occurrences + " " + v07.occurrences.toLowerCase(), ...volumes].join(" · ") });
      for (const row of rows) result.push({ key: JSON.stringify([label, row.occurrence.key]), row });
    }
    return result;
  }, [grouped]);
  const active = selected.length ? entries.findIndex((entry) => "row" in entry && entry.row.occurrence.id === selected.at(-1)) : -1;
  const grid = { gridTemplateColumns: "minmax(152px, 1.2fr) " + shown.map(() => "minmax(96px, 1fr)").join(" "),
    minWidth: 152 + shown.length * 96 };
  return <>
    <details><summary>{v07.column}</summary>
      <div className="gg-v07-grid">{(Object.keys(columns) as Column[]).map((column) => <label className="gg-v07-check" key={column}>
        <input type="checkbox" checked={shown.includes(column)} onChange={(event) =>
          setShown(event.currentTarget.checked ? [...shown, column] : shown.filter((value) => value !== column))} />{columns[column]}
      </label>)}</div>
    </details>
    {grouped.overlapping && <p className="gg-v07-note">{v07.overlap}</p>}
    <div className="gg-v07-table-scroll" tabIndex={0} role="region" aria-label={v07.quantityTable}>
      <div role="table" aria-label={v07.quantityTable} aria-rowcount={entries.length + 1} style={{ minWidth: grid.minWidth }}>
        <div role="row" className="gg-v07-table-row gg-v07-table-head" style={grid}>
          <span role="columnheader">{v07.component}</span>{shown.map((column) => <span key={column} role="columnheader">{columns[column]}</span>)}
        </div>
        <VirtualRows rows={entries} label={v07.quantityTable} table rowHeight={42} activeIndex={active} render={(entry, index) => {
          if (!("row" in entry)) return <div key={entry.key} className="gg-v07-table-row gg-v07-table-group" role="row" aria-rowindex={index + 2}>
            <div role="cell" aria-colspan={shown.length + 1}><button type="button" className="gg-v07-table-select" onClick={(event) => onSelect(entry.ids, event.ctrlKey || event.metaKey || event.shiftKey)}>
              {entry.label}</button><span className="gg-v07-muted">{entry.subtotal}</span></div>
          </div>;
          const { row } = entry;
          const data = byId.get(row.occurrence.id)!;
          return <div role="row" aria-rowindex={index + 2} key={entry.key} className="gg-v07-table-row" style={grid}
            data-selected={selectedSet.has(row.occurrence.id)}>
            <div role="cell"><button type="button" className="gg-v07-table-select" title={row.occurrence.record.name + " · " + row.occurrence.id}
              aria-pressed={selectedSet.has(row.occurrence.id)} onClick={(event) => onSelect([row.occurrence.id], event.ctrlKey || event.metaKey || event.shiftKey)}>
              {row.occurrence.record.name}</button>
              <input type="checkbox" checked={selectedSet.has(row.occurrence.id)} aria-label={v07.component + " " + row.occurrence.record.name}
                onChange={() => onSelect([row.occurrence.id], true)} />
            </div>
            {shown.map((column) => { const value = valueFor(row, data, column); return <span title={value} role="cell" key={column}>{value}</span>; })}
          </div>;
        }} />
      </div>
    </div>
  </>;
}

export function QuantitiesPanel({ configs, onConfig, base, comparison, analysis, side, onSide, layout, onLayout, scopes, selected, onSelect }: {
  configs: Record<string, AnalysisConfig>; onConfig: (key: string, settings: AnalysisConfig) => void;
  base: Revision; comparison: Revision | null; analysis: RevisionComparison; side: Side; onSide: (side: Side) => void;
  layout: QuantitiesLayout; onLayout: (layout: QuantitiesLayout) => void; scopes: { visible: string[]; filtered: string[] };
  selected: readonly string[]; onSelect: (ids: string[], multi: boolean) => void;
}) {
  const revision = side === "comparison" && comparison ? comparison : base;
  const config = configs[revision.key] ?? defaultConfig;
  function patch(value: Partial<AnalysisConfig>) {
    onConfig(revision.key, { ...config, ...value });
  }
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query).trim().toLocaleLowerCase("pt-BR");
  const [order, setOrder] = useState<keyof typeof orderLabels>("component");
  const [descending, setDescending] = useState(false);
  const [error, setError] = useState("");
  const all = useMemo(() => collectQuantities(revision, undefined, config.property), [revision, config.property]);
  const scopeValues = useMemo(() => config.scope === "category" || config.scope === "material" ?
    [...new Set(all.flatMap((row) => row[config.scope as "category" | "material"] ?? []))].sort() : [], [all, config.scope]);
  const scopeValue = scopeValues.includes(config.scopeValue) ? config.scopeValue : scopeValues[0] ?? "";
  const { visible, filtered } = scopes;
  const rows = useMemo(() => {
    const allowed = new Set(config.scope === "visible" ? visible : config.scope === "filtered" ? filtered : config.scope === "selected" ? selected :
      config.scope === "modified" ? analysis.diffs.flatMap((row) => row.status === "modified" ? row[side === "base" ? "baseId" : "comparisonId"] ?? [] : []) : []);
    const scope = config.scope;
    const scoped = all.filter((row) => {
      if (scope === "all") return true;
      if (scope === "category" || scope === "material") return row[scope] === scopeValue;
      return allowed.has(row.occurrence.id);
    });
    const result = search ? scoped.filter((row) => [row.occurrence.record.name, row.occurrence.id, row.material, row.category, row.layer, row.part, row.block]
      .join(" ").toLocaleLowerCase("pt-BR").includes(search)) : scoped;
    const value = (row: QuantityRow) => order === "area" || order === "volume" ? row[order]?.value ?? null :
      order === "component" ? row.occurrence.record.name : row[order];
    return [...result].sort((a, b) => {
      const first = value(a), second = value(b);
      if (first === null || second === null) return Number(first === null) - Number(second === null);
      const difference = typeof first === "number" && typeof second === "number" ?
        first - second : String(first).localeCompare(String(second), "pt-BR", { numeric: true });
      return descending ? -difference : difference;
    });
  }, [all, config.scope, visible, filtered, selected, analysis.diffs, side, scopeValue, search, order, descending]);
  const grouped = useMemo(() => groupQuantities(rows, config.grouping), [rows, config.grouping]);
  const analyzed = useMemo(() => analyzeFabrication(revision, rows, config.settings), [revision, rows, config.settings]);
  const summary = useMemo(() => summarizeQuantities(rows), [rows]);
  const fabrication = useMemo(() => summarizeFabrication(analyzed), [analyzed]);
  const peers = useMemo(() => {
    if (layout !== "analytics" || !comparison || !analysis.ready) return null;
    const summarize = (entry: Revision) => {
      const entries = collectQuantities(entry);
      return { quantities: summarizeQuantities(entries),
        fabrication: summarizeFabrication(analyzeFabrication(entry, entries, configs[entry.key]?.settings ?? defaultFabrication)) };
    };
    return { base: summarize(base), comparison: summarize(comparison) };
  }, [analysis.ready, base, comparison, configs, layout]);

  function exportCsv() {
    const text = quantitiesCsv(revision, rows, analyzed, scopeLabels[config.scope] + (scopeValue ? " · " + scopeValue : ""), new Date().toISOString());
    downloadFile(new Blob([text], { type: "text/csv;charset=utf-8" }), "quantitativos.csv");
  }

  function exportJson() {
    const scopedIds = new Set(rows.map((row) => row.occurrence.id));
    const data: FabricationDocument = {
      schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), revision: revision.identity, ...config, scopeValue,
      report: { scope: config.scope, query: search, components: analyzed, includedIds: rows.map((row) => row.occurrence.id),
        excludedIds: all.filter((row) => !scopedIds.has(row.occurrence.id)).map((row) => row.occurrence.id),
        summary, fabrication, units: { mass: "kg", time: "s", volume: "m³", area: "m²" } },
    };
    downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "fabrication-analysis.json");
  }


  async function importDoc(file: File) {
    try {
      if (file.size > documentMaxBytes) throw new Error("Documento excede 32 MB.");
      const imported = parseFabrication(await file.text(), revision);
      patch({ settings: imported.settings, scope: imported.scope, grouping: imported.grouping, scopeValue: imported.scopeValue, property: imported.property });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  return <aside className="gg-v07-panel gg-v07-panel--quantities" aria-label={v07.quantities}>
    <header className="gg-v07-panel-title"><ListTree size={17} aria-hidden="true" /><h2>{v07.quantities}</h2></header>
    <div className="gg-v07-grid">
      {comparison && <Choice label={v07.revision} value={side} options={revisionLabels} onChange={onSide} />}
      <Choice label={v07.visual} value={layout} options={quantitiesLayouts} onChange={onLayout} />
    </div>
    {layout !== "modelFocus" && <>
      <details open>
        <summary>{v07.scope} · {scopeLabels[config.scope]}</summary>
        <div className="gg-v07-grid">
          <Choice label={v07.scope} value={config.scope} options={scopeLabels} onChange={(scope) => patch({ scope, scopeValue: "" })} />
          {scopeValues.length > 0 && <Choice label={v07.scopeValue} value={scopeValue} onChange={(scopeValue) => patch({ scopeValue })}
            options={Object.fromEntries(scopeValues.map((value) => [value, value]))} />}
          <Choice label={v07.group} value={config.grouping} options={groupLabels} onChange={(grouping) => patch({ grouping })} />
          {config.grouping === "property" && <label className="gg-v07-field">{v07.property}<input value={config.property}
            onChange={(event) => patch({ property: event.currentTarget.value })} /></label>}
          <label className="gg-v07-field">{v07.search}<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
          <Choice label={v07.sort} value={order} options={orderLabels} onChange={setOrder} />
          <label className="gg-v07-check"><input type="checkbox" checked={descending} onChange={(event) => setDescending(event.currentTarget.checked)} />
            Ordem decrescente</label>
        </div>
      </details>
      <QuantitiesSummary summary={summary} fabrication={fabrication} />
      {layout === "analytics" ? <Charts rows={rows} fabrication={analyzed} peers={peers} /> : rows.length > 0 ?
        <QuantityTable grouped={grouped} analysis={analyzed} selected={selected} onSelect={onSelect} /> : <p>{v07.noResults}</p>}
      <FabricationControls key={revision.key} revision={revision} settings={config.settings} update={(settings: FabricationSettings) => patch({ settings })} />
      <details>
        <summary>{v07.export}</summary>
        <div className="gg-v07-actions">
          <button type="button" className={actionClass} onClick={exportCsv}>{v07.quantitiesCsv}</button>
          <button type="button" className={actionClass} onClick={exportJson}>{v07.analysisJson}</button>
          <FileButton label={v07.importAnalysis} onFiles={([file]) => void importDoc(file)} />
        </div>
      </details>
      {error && <p role="alert" className="gg-v07-alert">{error}</p>}
    </>}
  </aside>;
}
