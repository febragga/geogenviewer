import type { ManifestAssemblyStep, ManifestV1 } from "../domain/model.ts";
import { validateManifestObject } from "../validation/manifest.ts";
import { compileAssembly } from "./timeline.ts";

export function withAssembly(source: ManifestV1, steps: ManifestAssemblyStep[]) {
  const edited = validateManifestObject({ ...source, assembly: { steps } });
  for (const step of edited.assembly?.steps ?? []) {
    if (new Set(step.dependsOn).size !== step.dependsOn.length) {
      throw new Error("Dependência duplicada na etapa " + step.title + ".");
    }
  }
  compileAssembly(edited.assembly?.steps ?? []);
  return edited;
}
