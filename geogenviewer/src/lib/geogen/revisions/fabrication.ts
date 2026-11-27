import { authored, type Revision } from "./revision.ts";
import { coverage, numeric, type QuantityRow } from "./quantities.ts";

export const fabricationFields = {
  slicer: "GeoGen:Fabrication:SlicerMassKg",
  measured: "GeoGen:Fabrication:MeasuredMassKg",
  estimate: "GeoGen:Fabrication:EstimatedMassKg",
  machine: "GeoGen:Fabrication:MachineTimeSeconds",
  production: "GeoGen:Fabrication:EstimatedProductionSeconds",
  recorded: "GeoGen:Fabrication:RecordedTimeSeconds",
} as const;

export type Field = keyof typeof fabricationFields;
export type MassMethod = "solid" | "slicer" | "measured" | "estimate";
export type Material = { code: string; name: string; densityKgM3: number | null; costPerKg: number | null;
  currency: string | null; source: string; notes: string };
export type Scenario = { name: string; materialCode: string; replaces: string | null };
export type AuthoredValue = { value: number; source: string };
export type FabricationSettings = {
  materials: Material[];
  scenarios: Scenario[];
  activeScenario: string | null;
  mapping: Partial<Record<Field, string>>;
  authored: Record<string, Partial<Record<Field, AuthoredValue>>>;
};
export const defaultFabrication: FabricationSettings = { materials: [], scenarios: [], activeScenario: null, mapping: {}, authored: {} };
type DataSource = "cad" | "mesh" | "authored" | "scenario";
export type SourcedNumber = { value: number; source: DataSource; detail: string };
export type MaterialCost = SourcedNumber & { currency: string; method: MassMethod };

function monetary(value: number | null, currency: string | null) {
  return value !== null && currency && /^[A-Z]{3}$/.test(currency) ? { value, currency } : null;
}

export function analyzeFabrication(revision: Revision, rows: readonly QuantityRow[], settings: FabricationSettings) {
  const library = new Map(settings.materials.map((material) => [material.code, material]));
  const cadMaterials = new Map<string, NonNullable<Revision["scene"]["manifest"]>["materials"]>();
  for (const material of revision.scene.manifest?.materials ?? []) {
    for (const key of new Set([material.id, material.name])) {
      const entries = cadMaterials.get(key) ?? [];
      entries.push(material);
      cadMaterials.set(key, entries);
    }
  }
  const cadById = new Map((revision.scene.manifest?.materials ?? []).map((material) => [material.id, material]));
  const scenario = settings.scenarios.find((entry) => entry.name === settings.activeScenario);
  const replacementMaterial = scenario && library.get(scenario.materialCode);
  return rows.map((row) => {
    const variant = Boolean(replacementMaterial && (scenario?.replaces === null || scenario?.replaces === row.material));
    const author = variant ? replacementMaterial : row.material ? library.get(row.material) : null;
    const candidates = row.material ? cadMaterials.get(row.material) : undefined;
    const materialId = row.occurrence.record.materialId;
    const cad = variant ? null : candidates?.length === 1 ? candidates[0] :
      !row.material && materialId ? cadById.get(materialId) : null;
    const librarySource = variant ? "scenario" : "authored";
    const fromLibrary = (value: number | null | undefined): SourcedNumber | null => value != null
      ? { value, source: librarySource, detail: author!.source } : null;
    const cadDensity = numeric(cad?.densityKgM3);
    const libraryDensity = numeric(author?.densityKgM3);
    const density = cadDensity !== null && cadDensity > 0 ? { value: cadDensity, source: "cad" as const, detail: cad!.id } :
      libraryDensity && libraryDensity > 0 ? fromLibrary(libraryDensity) : null;
    const cadCost = monetary(numeric(cad?.costPerKg?.amount), cad?.costPerKg?.currency ?? null);
    const libraryCost = monetary(numeric(author?.costPerKg), author?.currency ?? null);
    const rate = cadCost ? { ...cadCost, source: "cad" as const, detail: cad!.id } :
      libraryCost ? { ...fromLibrary(libraryCost.value)!, currency: libraryCost.currency } : null;
    const field = (name: Field): SourcedNumber | null => {
      const manual = Object.hasOwn(settings.authored, row.occurrence.id) ? settings.authored[row.occurrence.id]?.[name] : undefined;
      const manualValue = numeric(manual?.value);
      if (manual && manualValue !== null) return { value: manualValue, source: "authored", detail: manual.source };
      const key = settings.mapping[name] || fabricationFields[name];
      const value = numeric(authored(row.occurrence.record, key));
      return value === null ? null : { value, source: "cad", detail: key };
    };
    const solid = row.volume && density && Number.isFinite(row.volume.value * density.value)
      ? { value: row.volume.value * density.value, source: density.source,
        detail: row.volume.method + " × " + density.detail } : null;
    const mass = { solid, slicer: field("slicer"), measured: field("measured"), estimate: field("estimate") };
    const costs: MaterialCost[] = [];
    for (const method of Object.keys(mass) as MassMethod[]) {
      const entry = mass[method];
      if (!rate || !entry || (variant && method !== "solid")) continue;
      const value = rate.value * entry.value;
      if (Number.isFinite(value)) costs.push({ value, source: rate.source, currency: rate.currency, method,
        detail: entry.detail + " × " + rate.detail });
    }
    const originalMaterial = row.material ?? cadById.get(materialId ?? "")?.name ?? null;
    return { id: row.occurrence.id, material: variant ? author!.code : originalMaterial,
      originalMaterial, density, rate, volume: row.volume, mass, costs,
      time: { machine: field("machine"), production: field("production"), recorded: field("recorded") } };
  });
}

export type FabricationRow = ReturnType<typeof analyzeFabrication>[number];

export function summarizeFabrication(rows: readonly FabricationRow[]) {
  const mass = Object.fromEntries((["solid", "slicer", "measured", "estimate"] as const).map((method) => [method,
    coverage(rows, (row) => row.mass[method]?.value ?? null,
      (row) => method === "solid" ? !row.volume ? "missing-volume" : !row.density ? "missing-density" : "invalid-result" : "missing-record")]));
  const time = Object.fromEntries((["machine", "production", "recorded"] as const).map((method) => [method,
    coverage(rows, (row) => row.time[method]?.value ?? null, () => "missing-record")]));
  const currencies = new Map<string, MaterialCost>();
  for (const row of rows) for (const cost of row.costs) currencies.set(cost.currency + " " + cost.method, cost);
  const costs = Object.fromEntries([...currencies].map(([key, { currency, method }]) => [key,
    coverage(rows, (row) => row.costs.find((cost) => cost.currency === currency && cost.method === method)?.value ?? null,
      (row) => !row.rate ? "missing-cost" : row.rate.currency !== currency ? "different-currency" : "missing-compatible-mass")]));
  return { mass, time, costs,
    material: coverage(rows, (row) => row.material ? 1 : null, () => "missing-fabrication-material"),
    density: coverage(rows, (row) => row.density ? 1 : null, () => "missing-density") };
}
