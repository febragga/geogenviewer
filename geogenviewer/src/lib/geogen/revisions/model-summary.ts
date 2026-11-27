import { describeAssembly } from "../assembly/step-labels.ts";
import type { AssemblyTimeline } from "../assembly/timeline.ts";
import { analyzeFabrication, summarizeFabrication, type FabricationSettings, type FabricationRow } from "./fabrication.ts";
import { collectQuantities, coverage, numeric, summarizeQuantities, type QuantityRow } from "./quantities.ts";
import type { Revision } from "./revision.ts";

export type SummaryGrouping = "category" | "layer" | "material" | "type" | "assembly";

export function summarizeModel(rows: readonly QuantityRow[], fabrication: readonly FabricationRow[]) {
  const result = summarizeQuantities(rows, "geometricVolume");
  const manufacturing = summarizeFabrication(fabrication);
  return {
    components: result.components,
    occurrences: result.occurrences,
    types: result.types,
    typeCoverage: coverage(rows, (row) => row.type ? 1 : null, () => "missing-type"),
    length: coverage(rows, ({ occurrence }) => {
      const dimensions = occurrence.record.cad?.dimensions;
      return dimensions && dimensions.source !== "mesh" ? numeric(dimensions.lengthM) : null;
    }, () => "missing-authored-length"),
    area: result.area,
    volume: result.volume,
    fabricationVolume: coverage(rows, (row) => row.fabricationVolume, () => "missing-fabrication-volume"),
    mass: manufacturing.mass,
    costs: manufacturing.costs,
  };
}

export function groupModelSummary(revision: Revision, rows: readonly QuantityRow[], fabrication: readonly FabricationRow[],
  timeline: AssemblyTimeline, grouping: SummaryGrouping, stepTitles?: Readonly<Record<string, string>>) {
  const graph = revision.scene.sceneGraph;
  const describe = describeAssembly(timeline, Object.values(graph.components), stepTitles);
  const groups = new Map<string | null, { label: string | null; index: number | null; rows: QuantityRow[]; fabrication: FabricationRow[] }>();
  for (const [i, row] of rows.entries()) {
    const { record } = row.occurrence;
    let key: string | null, label: string | null, index: number | null = null;
    if (grouping === "assembly") {
      const step = describe(record);
      index = step.index;
      key = index === null ? null : step.key;
      label = index === null ? null : step.label;
    } else if (grouping === "layer") {
      key = record.layerId;
      label = row.layer;
    } else if (grouping === "material") {
      const cad = record.materialId ? graph.materials[record.materialId] : null;
      label = cad?.name ?? row.material ?? (record.materialNames.slice().sort().join(" / ") || null);
      key = cad ? "cad:" + cad.id : label;
    } else {
      key = label = grouping === "category" && graph.mode === "glb-basic" ? null : row[grouping];
    }
    let group = groups.get(key);
    if (!group) groups.set(key, group = { label, index, rows: [], fabrication: [] });
    group.rows.push(row);
    group.fabrication.push(fabrication[i]);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group })).sort((a, b) => {
    if (grouping === "assembly") return (a.index ?? Infinity) - (b.index ?? Infinity);
    if (a.label === null || b.label === null) return Number(a.label === null) - Number(b.label === null);
    return a.label.localeCompare(b.label, "pt-BR", { numeric: true });
  });
}

export function collectModelSummary(revision: Revision, ids: ReadonlySet<string> | undefined, settings: FabricationSettings) {
  const rows = collectQuantities(revision, ids).map((row) => row.typeId && row.typeId !== row.type ? { ...row, type: row.typeId } : row);
  return { rows, fabrication: analyzeFabrication(revision, rows, settings) };
}
