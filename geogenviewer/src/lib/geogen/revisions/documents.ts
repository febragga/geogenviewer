import Ajv2020Import from "ajv/dist/2020.js";
import comparisonSchema from "../../../../schemas/comparison-v1.schema.json" with { type: "json" };
import fabricationSchema from "../../../../schemas/fabrication-analysis-v1.schema.json" with { type: "json" };
import { statuses, type Diff, type DiffStatus } from "./diff.ts";
import type { FabricationSettings } from "./fabrication.ts";
import { validateManual, type ManualMatch } from "./matching.ts";
import type { Grouping, QuantityScope } from "./quantities.ts";
import { needsProjectAssociation, type Alignment, type Revision, type RevisionIdentity } from "./revision.ts";

export interface ComparisonDocument {
  schemaVersion: "1.0.0";
  generatedAt: string;
  base: RevisionIdentity;
  comparison: RevisionIdentity;
  associated: boolean;
  toleranceM: number;
  alignment: Alignment;
  manual: ManualMatch[];
  filter: DiffStatus | null;
  differences?: Diff[];
}

export interface FabricationDocument {
  schemaVersion: "1.0.0";
  generatedAt: string;
  revision: RevisionIdentity;
  settings: FabricationSettings;
  scope: QuantityScope;
  grouping: Grouping;
  property: string;
  scopeValue: string;
  report?: Record<string, unknown>;
}

const Ajv = typeof Ajv2020Import === "function" ? Ajv2020Import :
  (Ajv2020Import as unknown as { default: typeof Ajv2020Import }).default;
const ajv = new Ajv({ strict: true });
const validateComparison = ajv.compile<ComparisonDocument>(comparisonSchema);
const validateAnalysis = ajv.compile<FabricationDocument>(fabricationSchema);

export const comparisonFilters = statuses;
export const documentMaxBytes = 32 * 1024 * 1024;

function decode(text: string) {
  if (new TextEncoder().encode(text).length > documentMaxBytes) throw new Error("Documento excede 32 MB.");
  try { return JSON.parse(text) as unknown; } catch { throw new Error("Documento JSON inválido."); }
}

function same(a: RevisionIdentity, b: RevisionIdentity) {
  return a.sha256 !== null && a.sha256 === b.sha256 && a.projectId === b.projectId &&
    a.revisionId === b.revisionId && a.prototypeId === b.prototypeId && a.geometryKind === b.geometryKind &&
    a.scaleDenominator === b.scaleDenominator && a.sourceUnit === b.sourceUnit && a.sourceUpAxis === b.sourceUpAxis &&
    a.metersPerSourceUnit === b.metersPerSourceUnit && JSON.stringify(a.sourceOrigin) === JSON.stringify(b.sourceOrigin);
}

export function parseComparison(text: string, base: Revision, next: Revision) {
  const data = decode(text);
  if (!validateComparison(data)) throw new Error("Documento de comparação inválido em " +
    (validateComparison.errors?.[0]?.instancePath || "raiz") + ".");
  if (!same(data.base, base.identity) || !same(data.comparison, next.identity)) {
    throw new Error("Projetos, revisões ou hashes não correspondem aos arquivos abertos.");
  }
  if (needsProjectAssociation(base, next) && !data.associated) throw new Error("O vínculo entre os projetos está ausente.");
  validateManual(base, next, data.manual);
  return data;
}

export function parseFabrication(text: string, revision: Revision) {
  const data = decode(text);
  if (!validateAnalysis(data)) throw new Error("Documento de fabricação inválido em " +
    (validateAnalysis.errors?.[0]?.instancePath || "raiz") + ".");
  if (!same(data.revision, revision.identity)) throw new Error("A análise pertence a outra revisão, protótipo ou GLB.");
  const { materials, scenarios, activeScenario, authored } = data.settings;
  const codes = new Set(materials.map((entry) => entry.code));
  const names = new Set(scenarios.map((entry) => entry.name));
  if (codes.size !== materials.length || names.size !== scenarios.length ||
      scenarios.some((entry) => !codes.has(entry.materialCode)) || (activeScenario !== null && !names.has(activeScenario)) ||
      Object.keys(authored).some((id) => !revision.occurrences.has(id))) {
    throw new Error("A análise contém materiais, cenários ou componentes inválidos.");
  }
  return data;
}
