import Ajv2020Import from "ajv/dist/2020.js";
import schema from "../../../../schemas/organization-v1.schema.json" with { type: "json" };
import type { ViewerSceneGraph } from "../domain/model.ts";
import {
  MAX_ORGANIZATION_DEPTH,
  normalizeHexColor,
  type OrganizationBinding,
  type UserOrganizationDocument,
} from "./model.ts";
import { wouldCreateCycle } from "./operations.ts";

export const organizationMaxBytes = 12 * 1024 * 1024;

const Ajv2020Ctor = (
  typeof Ajv2020Import === "function"
    ? Ajv2020Import
    : (Ajv2020Import as unknown as { default: typeof Ajv2020Import }).default
);

const ajv = new Ajv2020Ctor({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

const validateSchema = ajv.compile<UserOrganizationDocument>(schema);
const unsafeContentPattern = /<\s*\/?\s*(script|iframe|object|embed|svg|style)\b|javascript\s*:/i;

export class OrganizationValidationError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "OrganizationValidationError";
    this.code = code;
    this.details = details;
  }
}

function assertSafeTreeJson(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new OrganizationValidationError(
        "NON_FINITE_NUMBER",
        `Número inválido em "${path}".`
      );
    }
    return;
  }
  if (typeof value === "string") {
    if (unsafeContentPattern.test(value)) {
      throw new OrganizationValidationError(
        "UNSAFE_STRING",
        `Conteúdo textual não permitido em "${path}".`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      assertSafeTreeJson(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new OrganizationValidationError(
          "PROTOTYPE_POLLUTION_KEY",
          `Chave proibida "${key}" em "${path}".`
        );
      }
      assertSafeTreeJson((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

function checkHierarchyIntegrity<T extends { id: string; parentId: string | null }>(
  items: readonly T[],
  kindLabel: string
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new OrganizationValidationError(
        "DUPLICATE_ID",
        `Identificador duplicado "${item.id}" em ${kindLabel}.`
      );
    }
    seen.add(item.id);
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    if (item.parentId !== null && !byId.has(item.parentId)) {
      throw new OrganizationValidationError(
        "MISSING_PARENT",
        `Pai "${item.parentId}" inexistente em ${kindLabel}.`
      );
    }
    if (wouldCreateCycle(items, item.id, item.parentId)) {
      throw new OrganizationValidationError(
        "CYCLE_OR_DEPTH",
        `Ciclo ou profundidade acima de ${MAX_ORGANIZATION_DEPTH} níveis em ${kindLabel}.`
      );
    }
  }
}

export function parseAndValidateOrganization(rawJson: string): UserOrganizationDocument {
  if (rawJson.length > organizationMaxBytes) {
    throw new OrganizationValidationError(
      "FILE_TOO_LARGE",
      "O arquivo organization.json ultrapassa o limite seguro de tamanho."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new OrganizationValidationError(
      "INVALID_JSON",
      "Não foi possível interpretar o arquivo JSON de organização."
    );
  }

  assertSafeTreeJson(parsed);

  if (!validateSchema(parsed)) {
    const details = (validateSchema.errors ?? []).slice(0, 6).map(
      (err) => `${err.instancePath || "$"}: ${err.message ?? "inválido"}`
    );
    throw new OrganizationValidationError(
      "SCHEMA_ERROR",
      "O arquivo organization.json não segue o contrato 1.0.0.",
      details
    );
  }

  checkHierarchyIntegrity(parsed.userLayers, "camadas do usuário");
  checkHierarchyIntegrity(parsed.userGroups, "grupos do usuário");

  const layerIds = new Set(parsed.userLayers.map((l) => l.id));
  for (const [compId, layerId] of Object.entries(parsed.componentLayerAssignments)) {
    if (!layerIds.has(layerId)) {
      throw new OrganizationValidationError(
        "ORPHAN_LAYER_ASSIGNMENT",
        `Componente "${compId}" aponta para camada inexistente "${layerId}".`
      );
    }
  }

  return {
    ...parsed,
    userLayers: parsed.userLayers.map((l) => ({ ...l, color: normalizeHexColor(l.color) })),
    userGroups: parsed.userGroups.map((g) => ({
      ...g,
      color: normalizeHexColor(g.color),
      memberIds: [...new Set(g.memberIds)],
    })),
    hiddenLayerIds: parsed.hiddenLayerIds.filter((id) => layerIds.has(id)),
  };
}

export function serializeOrganization(doc: UserOrganizationDocument): string {
  return JSON.stringify(doc, null, 2);
}

export interface OrganizationCompatibilityResult {
  status: "match" | "partial" | "mismatch";
  matchedOccurrences: number;
  missingOccurrences: number;
  warnings: string[];
  sanitized: UserOrganizationDocument;
}

export function checkOrganizationCompatibility(
  doc: UserOrganizationDocument,
  sceneGraph: ViewerSceneGraph,
  binding: OrganizationBinding
): OrganizationCompatibilityResult {
  const warnings: string[] = [];
  let mismatch = false;

  if (
    doc.modelSha256 &&
    binding.modelSha256 &&
    doc.modelSha256.toLowerCase() !== binding.modelSha256.toLowerCase()
  ) {
    mismatch = true;
    warnings.push(
      `O SHA-256 do arquivo de organização (${doc.modelSha256.slice(0, 12)}) difere do modelo carregado (${binding.modelSha256.slice(0, 12)}).`
    );
  }
  if (doc.projectId && binding.projectId && doc.projectId !== binding.projectId) {
    mismatch = true;
    warnings.push(`O projeto de origem (${doc.projectId}) difere do projeto atual (${binding.projectId}).`);
  }

  const validSet = new Set(sceneGraph.componentOrder);
  let matched = 0;
  let missing = 0;
  const cleanAssignments: Record<string, string> = {};
  for (const [compId, layerId] of Object.entries(doc.componentLayerAssignments)) {
    if (validSet.has(compId)) {
      cleanAssignments[compId] = layerId;
      matched += 1;
    } else {
      missing += 1;
    }
  }

  const cleanGroups = doc.userGroups.map((group) => {
    const validMembers: string[] = [];
    for (const memberId of group.memberIds) {
      if (validSet.has(memberId)) {
        validMembers.push(memberId);
        matched += 1;
      } else {
        missing += 1;
      }
    }
    return { ...group, memberIds: validMembers };
  });

  if (missing > 0) {
    warnings.push(
      `${missing} vínculo(s) não correspondem às ocorrências da cena atual e foram ignorados com segurança.`
    );
  }

  const sanitized: UserOrganizationDocument = {
    ...doc,
    projectId: binding.projectId ?? doc.projectId,
    revisionId: binding.revisionId ?? doc.revisionId,
    modelSha256: binding.modelSha256 ?? doc.modelSha256,
    userGroups: cleanGroups,
    componentLayerAssignments: cleanAssignments,
  };

  return {
    status: mismatch ? "mismatch" : missing > 0 ? "partial" : "match",
    matchedOccurrences: matched,
    missingOccurrences: missing,
    warnings,
    sanitized,
  };
}
