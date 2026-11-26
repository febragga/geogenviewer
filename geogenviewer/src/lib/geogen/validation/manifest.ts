import Ajv2020Import from "ajv/dist/2020.js";
import manifestSchema from "../../../../schemas/manifest-v1.schema.json" with { type: "json" };
import type { ManifestV1 } from "../domain/model.ts";

export const maxManifestBytes = 10 * 1024 * 1024;
export const supportedMajorVersion = 1;
export const supportedMaxMinorVersion = 0;

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

const validateSchema = ajv.compile<ManifestV1>(manifestSchema);

export class ManifestValidationError extends Error {
  readonly code: string;
  readonly details: string[];

  constructor(code: string, message: string, details: string[] = []) {
    super(message);
    this.name = "ManifestValidationError";
    this.code = code;
    this.details = details;
  }
}

const unsafeContentPattern = /<\s*\/?\s*(script|iframe|object|embed|svg|style)\b|javascript\s*:/i;

function assertSafeAndFinite(value: unknown, path: string, depth = 0): void {
  if (depth > 64) {
    throw new ManifestValidationError("JSON_DEPTH", "O JSON do manifesto é profundo demais.");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ManifestValidationError(
        "NON_FINITE_NUMBER",
        `Valor numérico inválido (NaN/Infinito) em "${path}".`
      );
    }
    return;
  }
  if (typeof value === "string") {
    if (unsafeContentPattern.test(value)) {
      throw new ManifestValidationError(
        "UNSAFE_STRING",
        `Conteúdo textual potencialmente executável rejeitado em "${path}".`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertSafeAndFinite(value[i], `${path}[${i}]`, depth + 1);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        throw new ManifestValidationError(
          "UNSAFE_KEY",
          `Chave de objeto proibida "${k}" em "${path}".`
        );
      }
      assertSafeAndFinite(v, `${path}.${k}`, depth + 1);
    }
  }
}

function collectUniqueIds<T extends { id: string }>(
  items: readonly T[],
  collectionName: string
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new ManifestValidationError(
        "DUPLICATE_ID",
        `ID duplicado "${item.id}" na coleção "${collectionName}".`
      );
    }
    map.set(item.id, item);
  }
  return map;
}

function assertNoParentCycles<T extends { id: string; parentId?: string | null }>(
  map: ReadonlyMap<string, T>,
  collectionName: string
): void {
  const state = new Map<string, 1 | 2>();
  for (const id of map.keys()) {
    let cursor: string | null | undefined = id;
    const chain = new Set<string>();
    while (cursor) {
      if (state.get(cursor) === 2) break;
      if (chain.has(cursor) || state.get(cursor) === 1) {
        throw new ManifestValidationError(
          "HIERARCHY_CYCLE",
          `Ciclo hierárquico detectado em "${collectionName}" envolvendo "${cursor}".`
        );
      }
      chain.add(cursor);
      state.set(cursor, 1);
      const item = map.get(cursor);
      if (!item) {
        throw new ManifestValidationError(
          "MISSING_PARENT",
          `Referência de pai inexistente "${cursor}" em "${collectionName}".`
        );
      }
      if (item.parentId && !map.has(item.parentId)) {
        throw new ManifestValidationError(
          "MISSING_PARENT",
          `Item "${item.id}" em "${collectionName}" referencia parentId inexistente "${item.parentId}".`
        );
      }
      cursor = item.parentId ?? null;
    }
    for (const visited of chain) state.set(visited, 2);
  }
}

export function validateManifestObject(raw: unknown): ManifestV1 {
  assertSafeAndFinite(raw, "$");

  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    typeof (raw as { schemaVersion?: unknown }).schemaVersion === "string"
  ) {
    const version = (raw as { schemaVersion: string }).schemaVersion;
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
      throw new ManifestValidationError(
        "INVALID_VERSION",
        `schemaVersion inválido "${version}". Esperado formato SemVer (ex.: "1.0.0").`
      );
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major !== supportedMajorVersion) {
      throw new ManifestValidationError(
        "UNSUPPORTED_MAJOR_VERSION",
        `Versão principal de schema ${major}.x não suportada (esperado ${supportedMajorVersion}.x).`
      );
    }
    if (minor > supportedMaxMinorVersion) {
      throw new ManifestValidationError(
        "UNSUPPORTED_MINOR_VERSION",
        `Versão minor ${major}.${minor} não suportada por este visualizador (máximo ${supportedMajorVersion}.${supportedMaxMinorVersion}).`
      );
    }
  }

  const valid = validateSchema(raw);
  if (!valid) {
    const details = (validateSchema.errors ?? []).slice(0, 8).map((err) => {
      const loc = err.instancePath || "$";
      return `${loc}: ${err.message ?? "valor inválido"}`;
    });
    throw new ManifestValidationError(
      "SCHEMA_VALIDATION_FAILED",
      `Manifesto inválido segundo manifest-v1.schema.json: ${details[0] ?? "erro de estrutura"}.`,
      details
    );
  }

  const manifest = raw as ManifestV1;

  // Validate source units & origin consistency
  if (
    manifest.source.sourceUnit !== null &&
    manifest.source.metersPerSourceUnit === null
  ) {
    throw new ManifestValidationError(
      "INVALID_UNITS",
      "source.metersPerSourceUnit é obrigatório quando source.sourceUnit está definido."
    );
  }

  // Unique IDs & acyclic parent hierarchies
  const layerMap = collectUniqueIds(manifest.layers, "layers");
  assertNoParentCycles(layerMap, "layers");

  const groupMap = collectUniqueIds(manifest.groups, "groups");
  assertNoParentCycles(groupMap, "groups");

  const materialMap = collectUniqueIds(manifest.materials, "materials");
  const blockMap = collectUniqueIds(manifest.blocks ?? [], "blocks");
  const elementMap = collectUniqueIds(manifest.elements, "elements");
  assertNoParentCycles(elementMap, "elements");

  // Validate element references & geometric consistency
  for (const el of manifest.elements) {
    if (el.layerId !== null && !layerMap.has(el.layerId)) {
      throw new ManifestValidationError(
        "MISSING_LAYER_REF",
        `Elemento "${el.id}" referencia layerId inexistente "${el.layerId}".`
      );
    }
    for (const gid of el.groupIds) {
      if (!groupMap.has(gid)) {
        throw new ManifestValidationError(
          "MISSING_GROUP_REF",
          `Elemento "${el.id}" referencia groupId inexistente "${gid}".`
        );
      }
    }
    if (el.materialId !== null && !materialMap.has(el.materialId)) {
      throw new ManifestValidationError(
        "MISSING_MATERIAL_REF",
        `Elemento "${el.id}" referencia materialId inexistente "${el.materialId}".`
      );
    }
    if (el.blockDefinitionId && !blockMap.has(el.blockDefinitionId)) {
      throw new ManifestValidationError(
        "MISSING_BLOCK_REF",
        `Elemento "${el.id}" referencia blockDefinitionId inexistente "${el.blockDefinitionId}".`
      );
    }
    for (const cid of el.connectorIds ?? []) {
      if (!elementMap.has(cid)) {
        throw new ManifestValidationError(
          "MISSING_CONNECTOR_REF",
          `Elemento "${el.id}" referencia connectorId inexistente "${cid}".`
        );
      }
    }
    if (el.isClosed === false && el.volumeM3 !== undefined && el.volumeM3 !== null) {
      throw new ManifestValidationError(
        "OPEN_SURFACE_VOLUME",
        `Elemento "${el.id}" possui isClosed=false e não pode declarar volumeM3.`
      );
    }
    if (el.boundingBoxM) {
      const { min, max } = el.boundingBoxM;
      if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) {
        throw new ManifestValidationError(
          "INVALID_BBOX",
          `Elemento "${el.id}" possui boundingBoxM invertida (min > max).`
        );
      }
    }
  }

  // Validate assembly steps if present
  if (manifest.assembly) {
    const stepIndexById = new Map<string, number>();
    const seenElements = new Set<string>();
    manifest.assembly.steps.forEach((step, idx) => {
      if (stepIndexById.has(step.id)) {
        throw new ManifestValidationError(
          "DUPLICATE_STEP_ID",
          `Passo de montagem duplicado "${step.id}".`
        );
      }
      stepIndexById.set(step.id, idx);
    });

    manifest.assembly.steps.forEach((step, idx) => {
      for (const elId of step.elementIds) {
        if (!elementMap.has(elId)) {
          throw new ManifestValidationError(
            "MISSING_STEP_ELEMENT",
            `Passo "${step.id}" referencia elemento inexistente "${elId}".`
          );
        }
        if (seenElements.has(elId)) {
          throw new ManifestValidationError(
            "DUPLICATE_STEP_ELEMENT",
            `Elemento "${elId}" aparece em múltiplos passos de montagem.`
          );
        }
        seenElements.add(elId);
      }
      for (const dep of step.dependsOn) {
        const depIndex = stepIndexById.get(dep);
        if (depIndex === undefined) {
          throw new ManifestValidationError(
            "MISSING_STEP_DEP",
            `Passo "${step.id}" depende de passo inexistente "${dep}".`
          );
        }
        if (depIndex >= idx) {
          throw new ManifestValidationError(
            "FUTURE_STEP_DEP",
            `Passo "${step.id}" depende do passo posterior ou igual "${dep}".`
          );
        }
      }
    });
  }

  return manifest;
}

export function parseAndValidateManifest(bytes: ArrayBuffer): ManifestV1 {
  if (bytes.byteLength > maxManifestBytes) {
    throw new ManifestValidationError(
      "MANIFEST_TOO_LARGE",
      "O manifesto excede o limite de 10 MiB."
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ManifestValidationError(
      "INVALID_UTF8",
      "O arquivo manifesto não possui codificação UTF-8 válida."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ManifestValidationError(
      "INVALID_JSON",
      "Não foi possível interpretar o manifesto JSON. Verifique a sintaxe."
    );
  }
  return validateManifestObject(parsed);
}
