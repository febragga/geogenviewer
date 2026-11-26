"use client";

import { formatMeasurement, type MeasureKind, type MeasurementPose, type SnapMode } from "../../../lib/geogen/inspection/measurements";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { useInspection } from "../state/inspection-store";
import { snapLabels, v06 } from "../v06-copy";

const kinds = ["distance", "delta", "point"] as const;

export function MeasurementOptions({ loaded, onFit }: { loaded: LoadedScenePackage; onFit: (ids: string[]) => void }) {
  const doc = useInspection((state) => state.doc);
  const { scaleDenominator, displayUnit } = loaded.sceneGraph;
  const kind = useInspection((state) => state.kind);
  const pose = useInspection((state) => state.pose);
  const draft = useInspection((state) => state.draft);
  const invalidIds = useInspection((state) => state.invalidIds);
  const state = useInspection.getState();
  if (!doc) return null;
  return (
    <>
      <p className="gg-v05-hint">{kind === "point" ? v06.pointPrompt : draft ? v06.second : v06.first}</p>
      <label>{v06.measurement}
        <select value={kind} onChange={(event) => useInspection.setState({ kind: event.currentTarget.value as MeasureKind, draft: null })}>
          {kinds.map((key) => <option key={key} value={key}>{v06[key]}</option>)}
        </select>
      </label>
      <label>{v06.pose}
        <select value={pose} onChange={(event) => useInspection.setState({ pose: event.currentTarget.value as MeasurementPose })}>
          <option value="rest">{v06.rest}</option><option value="presentation">{v06.current}</option>
        </select>
      </label>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!draft} onClick={state.cancel}>{v06.cancel}</button>
      </div>
      <h3 className="gg-v05-subtitle">{v06.snap}</h3>
      <div className="gg-v05-checks gg-v05-checks--columns">
        {(Object.keys(snapLabels) as SnapMode[]).map((mode) => (
          <label key={mode}><input type="checkbox" checked={doc.snap.modes.includes(mode)} onChange={(event) => {
            state.patchSnap({ modes: event.currentTarget.checked ? [...doc.snap.modes, mode] : doc.snap.modes.filter((item) => item !== mode) });
          }} />{snapLabels[mode]}</label>
        ))}
      </div>
      <label>{v06.sensitivity} · {doc.snap.pixels} px
        <input type="range" min="4" max="36" step="1" value={doc.snap.pixels}
          onChange={(event) => state.patchSnap({ pixels: event.currentTarget.valueAsNumber })} />
      </label>
      <p className="gg-v05-hint">{v06.snapHelp}</p>
      <h3 className="gg-v05-subtitle">{v06.records}</h3>
      <p className="gg-v05-hint">{v06.precision}</p>
      {doc.measurements.length === 0 && <p className="gg-v05-hint">{v06.inactive}</p>}
      {doc.measurements.map((record) => {
        const invalid = invalidIds.includes(record.id);
        const ids = [...new Set(record.anchors.map((anchor) => anchor.elementId))];
        const origin = state.sourcePoint(record);
        return (
          <details key={record.id} className="gg-inspection-record">
            <summary><span>{record.name}</span><strong>{invalid ? v06.availability : formatMeasurement(record.valueM, displayUnit)}</strong></summary>
            <div className="gg-v05-fields">
              <label>{v06.recordName}<input maxLength={80} defaultValue={record.name} onBlur={(event) => {
                if (event.currentTarget.value.trim()) state.patchRecord(record.id, { name: event.currentTarget.value.trim() });
                else event.currentTarget.value = record.name;
              }} /></label>
              <p className="gg-v05-hint">{v06.provenance} · {v06.mesh} · {v06[record.kind]} · {record.pose === "rest" ? v06.rest : v06.current}</p>
              <p className="gg-v05-hint">{v06.method} · {record.anchors.map((anchor) => snapLabels[anchor.snap]).join(" → ")}</p>
              <p className="gg-v05-hint">{v06.element} · {ids.join(" · ")}</p>
              {record.pose === "presentation" && <p className="gg-v05-hint">{v06.currentRecord}</p>}
              {origin && <p className="gg-v05-hint">{v06.basis} · {origin.map((value) => value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })).join(" / ")} {loaded.manifest?.source.sourceUnit}</p>}
              {record.pose === "rest" && record.kind === "distance" && scaleDenominator && loaded.sceneGraph.geometryKind === "physicalModel" && (
                <p className="gg-v05-hint">{v06.derived} · Escala 1:{scaleDenominator} · {formatMeasurement(Number(record.valueM) * scaleDenominator, displayUnit)}</p>
              )}
              <div className="gg-v05-checks"><label><input type="checkbox" checked={record.visible} onChange={(event) => state.patchRecord(record.id, { visible: event.currentTarget.checked })} />{v06.visible}</label></div>
              <label>{v06.pose}
                <select value={record.pose} disabled={invalid} onChange={(event) => state.patchRecord(record.id, { pose: event.currentTarget.value as MeasurementPose })}>
                  <option value="rest">{v06.rest}</option><option value="presentation">{v06.current}</option>
                </select>
              </label>
              <div className="gg-v05-actions">
                <button type="button" className="gg-btn gg-btn--secondary" disabled={invalid} onClick={() => onFit(ids)}>{v06.fitRecord}</button>
                <button type="button" className="gg-btn gg-btn--ghost" onClick={() => state.remove(record.id)}>{v06.delete}</button>
              </div>
            </div>
          </details>
        );
      })}
    </>
  );
}
