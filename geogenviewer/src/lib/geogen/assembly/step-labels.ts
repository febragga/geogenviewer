import { identityText } from "../domain/component-identity.ts";
import type { ComponentRecord, ElementCategory } from "../domain/model.ts";
import type { AssemblyTimeline } from "./timeline.ts";

export const categoryLabels: Record<ElementCategory, string> = {
  column: "Pilares", beam: "Vigas", slab: "Lajes", stair: "Escadas",
  foundation: "Fundações", connector: "Conectores", wall: "Paredes", roof: "Coberturas", other: "Componentes complementares",
};

export function describeAssembly(timeline: AssemblyTimeline, records: readonly Pick<ComponentRecord, "id" | "category">[],
  titles: Readonly<Record<string, string>> = {}, categoryFallback = false) {
  const categories = new Map(records.map((record) => [record.id, record.category]));
  const steps = timeline.schedule.map(({ step }, index) => {
    const key = "step:" + step.id;
    const title = identityText(step.title);
    const groupCategories = [...new Set(step.elementIds.flatMap((id) => categories.get(id) ?? []))];
    const suggested = groupCategories.map((category) => categoryLabels[category]).join(" / ");
    const defaultTitle = title && !/^etapa\s*\d*$/iu.test(title) ? title : suggested;
    const custom = Object.hasOwn(titles, key) ? identityText(titles[key]) : null;
    const prefix = "Etapa " + String(index + 1).padStart(2, "0");
    const detail = custom || defaultTitle;
    return { key, title: detail, label: detail ? prefix + " — " + detail : prefix, legacy: (index + 1) + " · " + step.title };
  });
  return (record: Pick<ComponentRecord, "id" | "category">) => {
    const index = timeline.byElement.get(record.id);
    if (index !== undefined && steps[index]) return { ...steps[index], index };
    if (!categoryFallback || !record.category) return { key: null, title: "", label: null, legacy: null, index: null };
    const key = "category:" + record.category;
    const title = (Object.hasOwn(titles, key) ? identityText(titles[key]) : null) ?? categoryLabels[record.category];
    return { key, title, label: steps.length ? "Sem etapa · " + title : title, legacy: null, index: null };
  };
}
