import type { AssemblyTimeline } from "../assembly/timeline.ts";
import type { Measurement } from "../inspection/measurements.ts";
import { formatMeasurement } from "../inspection/measurements.ts";
import { numericDelta, csv } from "../revisions/reports.ts";
import type { Revision, Triple } from "../revisions/revision.ts";
import type { CatalogEntry, CatalogItem } from "./catalog.ts";
import { calloutText, type Callout } from "./callouts.ts";
import type { SheetSettings } from "./document.ts";

const number = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 7 }).format;
export interface SheetLine { label: string; value: string; provenance?: string }
export interface SheetPage {
  title: string; subtitle: string; project: string; prototype: string | null; revision: string | null;
  date: string; groups: { title: string; lines: SheetLine[] }[]; partIds: string[];
}

export function assemblyMoment(timeline: AssemblyTimeline, index: number, stage: SheetSettings["stage"], fraction: number) {
  const entry = timeline.schedule[index];
  if (!entry) return null;
  const time = stage === "before" ? entry.start : stage === "after" ? entry.end :
    entry.start + (entry.end - entry.start) * Math.max(0, Math.min(fraction, 1));
  const sample = timeline.sample(time);
  const previously = timeline.schedule.slice(0, index).flatMap(({ step }) => step.elementIds);
  const installed = stage === "before" ? [] : entry.step.elementIds;
  const offsets = new Map<string, Triple>();
  if (stage === "during" && sample.index === index && entry.step.insertionOffsetM) {
    const move = entry.step.insertionOffsetM.map((value) => value * (1 - sample.progress)) as Triple;
    for (const id of installed) offsets.set(id, move);
  }
  return { index, entry, time, installed, previously, offsets, stage,
    future: timeline.schedule.slice(index + 1).flatMap(({ step }) => step.elementIds) };
}
export type AssemblyMoment = NonNullable<ReturnType<typeof assemblyMoment>>;

function values(row: CatalogEntry) {
  const { record } = row.occurrence;
  const dimensions = record.cad?.dimensions;
  const data: SheetLine[] = [];
  for (const [label, amount] of [["Comprimento", dimensions?.lengthM], ["Largura", dimensions?.widthM], ["Espessura", dimensions?.thicknessM]] as const) {
    if (amount != null) data.push({ label, value: number(amount * 1000) + " mm", provenance: dimensions?.source });
  }
  if (row.area) data.push({ label: "Área", value: number(row.area.value) + " m²", provenance: row.area.method });
  if (row.volume) data.push({ label: "Volume", value: number(row.volume.value) + " m³", provenance: row.volume.method });
  const box = record.meshBoundsMeters;
  if (row.occurrence.parts.length) data.push({ label: "Extensões da caixa em repouso", value: box.map((value) => number(value * 1000)).join(" × ") + " mm", provenance: "bounding box malha · X/Y/Z da cena" });
  return data;
}

const massLabels = { solid: "Massa maciça teórica", slicer: "Massa do slicer", measured: "Massa medida", estimate: "Massa estimada" };
const timeLabels = { machine: "Tempo de máquina", production: "Tempo de produção estimado", recorded: "Tempo registrado" };
function fabricationLines(row: CatalogEntry) {
  const cad = row.occurrence.record.cad?.fabrication;
  const fabrication = row.fabrication;
  const lines: SheetLine[] = [];
  if (fabrication.material) lines.push({ label: "Material de fabricação", value: fabrication.material, provenance: "fabrication.material / cenário" });
  if (cad?.scaleDenominator != null) lines.push({ label: "Escala física", value: "1:" + cad.scaleDenominator, provenance: "autorada" });
  if (cad?.toleranceMm != null) lines.push({ label: "Tolerância de fabricação", value: number(cad.toleranceMm) + " mm", provenance: "autorada" });
  if (cad?.connectorNote) lines.push({ label: "Conexão", value: cad.connectorNote, provenance: "CAD" });
  for (const [method, entry] of Object.entries(fabrication.mass)) if (entry) lines.push({
    label: massLabels[method as keyof typeof massLabels], value: number(entry.value) + " kg", provenance: entry.source + " · " + entry.detail,
  });
  for (const cost of fabrication.costs) lines.push({ label: "Custo de material · " + massLabels[cost.method],
    value: number(cost.value) + " " + cost.currency, provenance: cost.source + " · " + cost.detail });
  for (const [method, entry] of Object.entries(fabrication.time)) if (entry) lines.push({
    label: timeLabels[method as keyof typeof timeLabels], value: number(entry.value) + " s", provenance: entry.source + " · " + entry.detail,
  });
  return lines;
}

export function partsList(items: readonly CatalogItem[], callouts: readonly Callout[]) {
  const numbers = new Map(callouts.map((label, index) => [label.elementId, { label, index }]));
  return items.map((item) => {
    const row = item.representative, record = row.occurrence.record;
    const callout = numbers.get(row.occurrence.id);
    return { id: row.occurrence.id, name: record.name, part: row.part, type: item.label ?? row.type, quantity: item.quantity,
      category: row.category, layer: row.layer, material: row.material, visual: record.materialNames,
      dimensions: record.cad?.dimensions ?? null, area: row.area, volume: row.volume, status: row.status,
      fabrication: row.fabrication, prototype: row.prototype, note: record.cad?.fabrication?.connectorNote ?? null,
      label: callout ? calloutText(row, callout.label, callout.index, item.quantity) : null,
      members: item.members.map((member) => member.occurrence.id),
    };
  });
}

export function catalogCsv(revision: Revision, items: readonly CatalogItem[], callouts: readonly Callout[]) {
  return csv([
    ["Projeto", "Revisão", "Protótipo", "SHA-256", "Callout", "Elemento", "Peça", "Tipo", "Nome", "Categoria", "Camada",
      "Quantidade", "Material de fabricação", "Materiais GLB", "Dimensões autoradas", "Área", "Volume", "Fabricação", "Estado", "Observações", "Ocorrências"],
    ...partsList(items, callouts).map((row) => [revision.identity.projectId, revision.identity.revisionId, row.prototype, revision.identity.sha256,
      row.label, row.id, row.part, row.type, row.name, row.category, row.layer, row.quantity, row.material, row.visual.join(" / "),
      JSON.stringify(row.dimensions), JSON.stringify(row.area), JSON.stringify(row.volume), JSON.stringify(row.fabrication), row.status, row.note, row.members.join(" / ")]),
  ]);
}

export function sheetPage(revision: Revision, settings: SheetSettings, items: readonly CatalogItem[], measurements: readonly Measurement[],
  callouts: readonly Callout[], moment: AssemblyMoment | null, comparison: CatalogEntry | null = null,
  date = new Date().toISOString()): SheetPage {
  const page: SheetPage = {
    title: settings.title || (settings.template === "assembly" ? moment?.entry.step.title ?? "Montagem" :
      settings.template === "knolling" ? "Disposição de componentes" :
        (settings.template === "type" ? items[0]?.label : null) ?? items[0]?.representative.occurrence.record.name ?? "Ficha técnica"),
    subtitle: settings.subtitle, project: revision.scene.sceneGraph.projectTitle, revision: revision.identity.revisionId,
    prototype: revision.identity.prototypeId, date, groups: [], partIds: [...new Set(items.flatMap((row) => row.members.map(({ occurrence }) => occurrence.id)))],
  };
  const row = items[0]?.representative;
  const selected = new Set(settings.fields);
  const partIds = new Set(page.partIds);
  const selectedMeasurements = new Set(settings.measurementIds);
  const add = (title: string, lines: SheetLine[]) => { if (lines.length) page.groups.push({ title, lines }); };
  if (selected.has("identity") && row && settings.template !== "knolling" && settings.template !== "assembly") {
    add("Identificação", [
      { label: "Ocorrência", value: row.occurrence.id },
      ...(row.part ? [{ label: "Part ID", value: row.part }] : []),
      ...(row.type ? [{ label: "Tipo autorado", value: row.type }] : []),
      { label: "Categoria", value: row.category }, { label: "Quantidade", value: String(items[0].quantity) },
    ]);
  }
  if (selected.has("dimensions") && row && settings.template !== "knolling" && settings.template !== "assembly") add("Dimensões e grandezas", values(row));
  if (selected.has("fabrication") && row && settings.template !== "knolling" && settings.template !== "assembly") add("Fabricação", fabricationLines(row));
  if (selected.has("measurements") && settings.measurements) add("Medições registradas", measurements
    .filter((entry) => (!selectedMeasurements.size || selectedMeasurements.has(entry.id)) && entry.anchors.every((anchor) => partIds.has(anchor.elementId)))
    .map((entry) => ({ label: entry.name, value: formatMeasurement(entry.valueM, revision.scene.sceneGraph.displayUnit), provenance: entry.provenance + " · " + entry.pose })));
  if (selected.has("assembly") && moment) add("Sequência autorada", [
    { label: "Etapa", value: String(moment.index + 1) + " · " + moment.entry.step.title },
    { label: "Dependências", value: moment.entry.step.dependsOn.join(", ") || "Sem dependência" },
    { label: "Instalados antes", value: String(moment.previously.length) },
    { label: "Componentes desta etapa na captura", value: String(moment.installed.length) },
    { label: "Etapas subsequentes · componentes", value: String(moment.future.length) },
    { label: "Instante", value: number(moment.time) + " s" },
  ]);
  if (selected.has("parts") && (items.length > 1 || settings.template === "type" || settings.template === "assembly"))
    add("Lista de peças", partsList(items, callouts).map((entry) => ({
      label: [entry.label, entry.part ?? entry.id].filter(Boolean).join(" · "), value: entry.name + " × " + entry.quantity,
    })));
  if (selected.has("callouts") && settings.labels) add("Legendas", callouts.flatMap((entry, index) => {
    if (!entry.visible || !partIds.has(entry.elementId)) return [];
    const row = items.find((item) => item.representative.occurrence.id === entry.elementId)?.representative;
    return row ? [{ label: calloutText(row, entry, index), value: row.occurrence.record.name }] : [];
  }));
  if (settings.template === "comparison" && row && comparison) {
    const source = row.occurrence.record.cad, other = comparison.occurrence.record.cad;
    const length = source?.dimensions?.source === other?.dimensions?.source ?
      numericDelta(source?.dimensions?.lengthM ?? null, other?.dimensions?.lengthM ?? null) : null;
    const volume = row.volume && comparison.volume && row.volume.method === comparison.volume.method ?
      numericDelta(row.volume.value, comparison.volume.value) : null;
    const tolerance = numericDelta(source?.fabrication?.toleranceMm ?? null, other?.fabrication?.toleranceMm ?? null);
    add("Comparação entre revisões", [
      { label: "Ocorrência correspondente", value: comparison.occurrence.id },
      { label: "Categoria", value: row.category + " → " + comparison.category },
      { label: "Material de fabricação", value: (row.material ?? "indisponível") + " → " + (comparison.material ?? "indisponível") },
      ...(length ? [{ label: "Δ comprimento", value: number(length.absolute * 1000) + " mm", provenance: source?.dimensions?.source }] : []),
      ...(volume ? [{ label: "Δ volume", value: number(volume.absolute) + " m³", provenance: row.volume?.method }] : []),
      ...(tolerance ? [{ label: "Δ tolerância", value: number(tolerance.absolute) + " mm", provenance: "autorada" }] : []),
    ]);
  }
  if (settings.notes) add("Observações", [{ label: "", value: settings.notes, provenance: "autorada" }]);
  return page;
}
