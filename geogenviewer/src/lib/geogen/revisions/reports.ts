import { componentLabel } from "../domain/component-identity.ts";
import type { Diff } from "./diff.ts";
import type { FabricationRow } from "./fabrication.ts";
import type { QuantityRow } from "./quantities.ts";
import type { Revision } from "./revision.ts";

export function csv(rows: readonly (readonly unknown[])[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    // Text from CAD may otherwise execute as a spreadsheet formula.
    if (typeof value !== "number" && /^[\s\uFEFF]*[=+\-@\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

const identityColumns = ["projectId", "revisionId", "prototypeId", "sha256", "displayUnit"] as const;
export function identityRow(revision: Revision) {
  const { projectId, revisionId, prototypeId, sha256 } = revision.identity;
  return [projectId, revisionId, prototypeId, sha256, revision.scene.sceneGraph.displayUnit];
}

export function quantitiesCsv(revision: Revision, rows: QuantityRow[], analysis: FabricationRow[], scope: string, generatedAt: string) {
  const areaKnown = rows.filter((row) => row.area !== null).length;
  const volumeKnown = rows.filter((row) => row.volume !== null).length;
  return csv([
    [...identityColumns, "generatedAt", "scope", "scopeComponentCount", "areaKnown", "volumeKnown", "volumeCoveragePct", "elementId", "name", "occurrences", "category", "layer", "material",
      "block", "partId", "type", "areaM2", "areaMethod", "volumeM3", "volumeMethod", "volumeExclusion",
      "lengthM", "widthM", "thicknessM", "dimensionsSource", "solidKg", "slicerKg", "measuredKg", "estimateKg", "costs", "originalName", "sourceObjectId"],
    ...rows.map((row, index) => {
      const dimensions = row.occurrence.record.cad?.dimensions;
      const { mass, costs } = analysis[index];
      return [...identityRow(revision), generatedAt, scope, rows.length, areaKnown, volumeKnown, 100 * volumeKnown / rows.length, row.occurrence.id, componentLabel(row.occurrence.record), row.occurrence.count,
        row.category, row.layer, row.material, row.block, row.part, row.type,
        row.area?.value, row.area?.method, row.volume?.value, row.volume?.method, row.volumeExclusion,
        dimensions?.lengthM, dimensions?.widthM, dimensions?.thicknessM, dimensions?.source,
        mass.solid?.value, mass.slicer?.value, mass.measured?.value, mass.estimate?.value, JSON.stringify(costs), row.occurrence.record.name, row.occurrence.record.sourceObjectId];
    }),
  ]);
}

export function differencesCsv(base: Revision, comparison: Revision, rows: readonly Diff[], toleranceM: number, generatedAt: string) {
  return csv([
    [...identityColumns.map((key) => "base." + key), ...identityColumns.map((key) => "comparison." + key),
      "generatedAt", "toleranceM", "baseId", "comparisonId", "status", "method", "changes", "meshResult", "candidateCount", "candidates", "baseName", "comparisonName"],
    ...rows.map((row) => [...identityRow(base), ...identityRow(comparison), generatedAt, toleranceM, row.baseId, row.comparisonId,
      row.status, row.method, row.changes.join(" / "), row.shape, row.candidateCount, row.candidates.join(" / "),
      componentLabel(row.baseId ? base.occurrences.get(row.baseId)?.record : undefined),
      componentLabel(row.comparisonId ? comparison.occurrences.get(row.comparisonId)?.record : undefined)]),
  ]);
}

export function numericDelta(base: number | null, next: number | null) {
  if (base === null || next === null) return null;
  const absolute = next - base;
  return { absolute, percent: base === 0 ? null : 100 * absolute / Math.abs(base) };
}
