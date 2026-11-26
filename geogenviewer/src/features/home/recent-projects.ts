export type RecentDemoKind =
  | "basic"
  | "contract"
  | "pavilion"
  | "inspection"
  | "revision"
  | "catalog"
  | null;

export interface RecentProjectRecord {
  key: string;
  title: string;
  fileName: string;
  revisionId: string | null;
  mode: "glb-basic" | "manifest-full";
  componentCount: number;
  sha256Prefix: string | null;
  demoKind: RecentDemoKind;
  lastWorkspace: string;
  lastOpenedAt: string;
}

const RECENT_PROJECTS_KEY = "geogen:v09:recent-projects";
const MAX_RECENT_PROJECTS = 6;

function sanitizeText(value: unknown, maxLen = 120): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f<>]/gu, "").trim().slice(0, maxLen);
}

export function readRecentProjects(storage?: Pick<Storage, "getItem">): RecentProjectRecord[] {
  if (typeof window === "undefined" && !storage) return [];
  try {
    const raw = (storage ?? window.localStorage).getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: RecentProjectRecord[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const key = sanitizeText(obj.key, 160);
      const title = sanitizeText(obj.title, 120);
      const fileName = sanitizeText(obj.fileName, 120);
      const lastOpenedAt = sanitizeText(obj.lastOpenedAt, 40);
      if (!key || !title || !fileName || !Number.isFinite(Date.parse(lastOpenedAt))) continue;
      items.push({
        key,
        title,
        fileName,
        revisionId: typeof obj.revisionId === "string" ? sanitizeText(obj.revisionId, 64) : null,
        mode: obj.mode === "manifest-full" ? "manifest-full" : "glb-basic",
        componentCount:
          typeof obj.componentCount === "number" && Number.isFinite(obj.componentCount)
            ? Math.max(0, Math.round(obj.componentCount))
            : 0,
        sha256Prefix: typeof obj.sha256Prefix === "string" ? sanitizeText(obj.sha256Prefix, 16) : null,
        demoKind:
          obj.demoKind === "basic" ||
          obj.demoKind === "contract" ||
          obj.demoKind === "pavilion" ||
          obj.demoKind === "inspection" ||
          obj.demoKind === "revision" ||
          obj.demoKind === "catalog"
            ? obj.demoKind
            : null,
        lastWorkspace: sanitizeText(obj.lastWorkspace, 32) || "explore",
        lastOpenedAt,
      });
      if (items.length >= MAX_RECENT_PROJECTS) break;
    }
    return items;
  } catch {
    return [];
  }
}

export function recordRecentProject(
  input: Omit<RecentProjectRecord, "lastOpenedAt">,
  storage?: Pick<Storage, "getItem" | "setItem">
): RecentProjectRecord[] {
  if (typeof window === "undefined" && !storage) return [];
  const current = readRecentProjects(storage);
  const nextItem: RecentProjectRecord = {
    ...input,
    key: sanitizeText(input.key, 160),
    title: sanitizeText(input.title, 120) || sanitizeText(input.fileName, 120),
    fileName: sanitizeText(input.fileName, 120),
    revisionId: input.revisionId ? sanitizeText(input.revisionId, 64) : null,
    sha256Prefix: input.sha256Prefix ? sanitizeText(input.sha256Prefix, 16) : null,
    lastWorkspace: sanitizeText(input.lastWorkspace, 32) || "explore",
    lastOpenedAt: new Date().toISOString(),
  };
  const updated = [nextItem, ...current.filter((item) => item.key !== nextItem.key)].slice(
    0,
    MAX_RECENT_PROJECTS
  );
  try {
    (storage ?? window.localStorage).setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota / privacy mode failures
  }
  return updated;
}

export function clearRecentProjects(storage?: Pick<Storage, "removeItem">): void {
  if (typeof window === "undefined" && !storage) return;
  try {
    (storage ?? window.localStorage).removeItem(RECENT_PROJECTS_KEY);
  } catch {
    // Ignore
  }
}

export function demoHrefFor(kind: RecentDemoKind): string {
  switch (kind) {
    case "basic":
      return "/viewer?demo=1";
    case "contract":
      return "/viewer?demo=contrato";
    case "pavilion":
      return "/viewer?demo=pavilhao";
    case "inspection":
      return "/viewer?demo=inspecao";
    case "revision":
      return "/viewer?demo=revisao";
    case "catalog":
      return "/viewer?demo=catalog";
    default:
      return "/viewer?open=1";
  }
}
