"use client";

import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { useInspection, type InspectionTool } from "../state/inspection-store";
import { v06 } from "../v06-copy";
import { MeasurementOptions } from "./measurement-options";
import { SectionOptions } from "./section-options";
import { TechnicalOptionsPanel } from "./technical-options";

const tools = [["selection", v06.selection], ["sections", v06.sections], ["measure", v06.measure], ["capture", v06.capture]] as const;

export function InspectionTools({ loaded, onFit }: { loaded: LoadedScenePackage; onFit: (ids?: string[]) => void }) {
  const tool = useInspection((state) => state.tool);
  const setTool = useInspection((state) => state.setTool);
  return (
    <>
      <div className="gg-v05-actions gg-inspection-tabs" role="group" aria-label="Ferramenta de inspeção">
        {tools.map(([id, name]) => <button type="button" key={id} className="gg-btn gg-btn--secondary"
          aria-pressed={tool === id} onClick={() => setTool(id as InspectionTool)}>{name}</button>)}
      </div>
      {tool === "sections" && <SectionOptions onFit={() => onFit()} />}
      {tool === "measure" && <MeasurementOptions loaded={loaded} onFit={onFit} />}
      {tool === "capture" && <TechnicalOptionsPanel loaded={loaded} />}
    </>
  );
}

export function InspectionHint() {
  const tool = useInspection((state) => state.tool);
  const draft = useInspection((state) => state.draft);
  const kind = useInspection((state) => state.kind);
  if (tool !== "measure") return null;
  return (
    <div className="gg-inspection-hint">
      <span role="status">{kind === "point" ? v06.pointPrompt : draft ? v06.second : v06.first}</span>
      <button type="button" className="gg-btn gg-btn--ghost" onClick={() => useInspection.getState().setTool("selection")}>{v06.cancel}</button>
    </div>
  );
}
