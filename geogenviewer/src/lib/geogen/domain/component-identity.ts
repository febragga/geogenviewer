import type { ComponentRecord } from "./model.ts";

export function identityText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && !/[\p{Cc}\p{Cf}]/u.test(text) ? text : null;
}

const partIdKeys = ["geogen.v02.partId", "GeoGen:PartId", "partId", "partID", "PartID"] as const;
const cadNameKeys = ["geogen.v02.objectName", "GeoGen:ObjectName", "cadName", "objectName"] as const;

type Metadata = Record<string, unknown>;
function aliases(sources: readonly (Metadata | undefined)[], keys: readonly string[]) {
  const values: string[] = [];
  for (const key of keys) for (const source of sources) {
    if (source && Object.hasOwn(source, key)) {
      const text = identityText(source[key]);
      if (text) values.push(text);
    }
  }
  return values;
}

export interface ComponentIdentity {
  partIds: string[];
  manifestName: string | null;
  cadNames: string[];
  glbNames: string[];
}

export function importedComponentIdentity(input: {
  manifestName?: string;
  glbNames: unknown[];
  extras?: Metadata;
  properties?: Metadata;
  userText?: Metadata;
}): ComponentIdentity {
  const sources = [input.properties, input.userText, input.extras];
  return {
    partIds: [...new Set(aliases(sources, partIdKeys))],
    manifestName: identityText(input.manifestName),
    cadNames: [...new Set(aliases(sources, cadNameKeys))],
    glbNames: [...new Set(input.glbNames.flatMap((value) => identityText(value) ?? []))],
  };
}

export function componentIdentity(record: ComponentRecord): ComponentIdentity {
  return record.identity ?? importedComponentIdentity({
    manifestName: record.name, glbNames: [], properties: record.cad?.properties, userText: record.cad?.userText,
  });
}

export function componentLabel(record: ComponentRecord | null | undefined, fallback = ""): string {
  if (!record) return fallback;
  const { partIds, manifestName, cadNames, glbNames } = componentIdentity(record);
  return partIds[0] ?? manifestName ?? cadNames[0] ?? glbNames[0] ?? record.id;
}

export function componentIdentifiers(record: ComponentRecord | null | undefined): string[] {
  if (!record) return [];
  const { partIds, manifestName, cadNames, glbNames } = componentIdentity(record);
  return [...new Set([record.id, record.sourceObjectId, record.name, manifestName, ...partIds, ...cadNames, ...glbNames]
    .filter((value): value is string => Boolean(value)))];
}
