"use client";

import { useState } from "react";
import { Box3, Vector3 } from "three";
import { cadAxes, rangeOnAxis, sectionAt, type CadAxis, type SectionMode } from "../../../lib/geogen/inspection/sections";
import { unitsPerMeter } from "../../../lib/geogen/inspection/measurements";
import { useInspection } from "../state/inspection-store";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { sectionModes, v06 } from "../v06-copy";

export function SectionOptions({ onFit }: { onFit: () => void }) {
  const document = useInspection((state) => state.doc);
  const unit = useInspection((state) => state.unit);
  const bounds = useInspection((state) => state.bounds);
  const warnings = useInspection((state) => state.warnings);
  const slot = usePresentation((state) => state.active);
  const layout = usePresentation((state) => state.layout);
  const selected = useViewerStore((state) => state.selectedIds);
  const graph = useViewerStore((state) => state.sceneGraph);
  const [axis, setAxis] = useState<CadAxis>("Z");
  if (!document) return null;
  const { sections } = document;
  const appearance = sectionAt(sections, slot);
  const plane = appearance.planes.find((item) => item.axis === axis)!;
  const scale = unitsPerMeter[unit];
  const full = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
  const [min, max] = rangeOnAxis(full, axis);
  const selection = new Box3();
  for (const id of selected) {
    const box = graph?.components[id]?.meshMinMaxMeters;
    if (!box) continue;
    selection.expandByPoint(new Vector3(...box.min));
    selection.expandByPoint(new Vector3(...box.max));
  }
  const [first, last] = rangeOnAxis(selection, axis);
  const state = useInspection.getState();
  const positionM = (value: number) => {
    if (Number.isFinite(value)) state.patchPlane(slot, axis, { positionM: Math.max(min, Math.min(max, value)) });
  };

  return (
    <>
      <p className="gg-v05-hint">{v06.axesNote}</p>
      {(layout !== "single" || !sections.shared) && <div className="gg-v05-checks">
        <label><input type="checkbox" checked={sections.shared} onChange={(event) => state.setShared(slot, event.currentTarget.checked)} />{v06.share}</label>
      </div>}
      <div className="gg-v05-actions" role="group" aria-label="Eixos dos planos de corte">
        {cadAxes.map((name) => (
          <button type="button" key={name} className="gg-btn gg-btn--secondary" aria-label={v06.plane + " " + name}
            aria-pressed={axis === name} onClick={() => setAxis(name)}>
            {name}{appearance.planes.find((item) => item.axis === name)?.enabled && <span aria-hidden="true"> ·</span>}
          </button>
        ))}
      </div>
      <div className="gg-v05-checks">
        <label><input type="checkbox" checked={plane.enabled} onChange={(event) => state.patchPlane(slot, axis, { enabled: event.currentTarget.checked })} />{v06.cut} {axis}</label>
        <label><input type="checkbox" checked={plane.flipped} onChange={(event) => state.patchPlane(slot, axis, { flipped: event.currentTarget.checked })} />{v06.flip}</label>
        <label><input type="checkbox" checked={plane.gizmo} onChange={(event) => state.patchPlane(slot, axis, { gizmo: event.currentTarget.checked })} />{v06.gizmo}</label>
      </div>
      <label>{v06.position} ({unit})
        <input aria-label={v06.position + " " + axis} type="range" min={min * scale} max={max * scale} step="any"
          value={plane.positionM * scale} disabled={max <= min} onChange={(event) => positionM(event.currentTarget.valueAsNumber / scale)}
          onPointerDown={() => useInspection.setState({ positionDragging: true })}
          onPointerUp={() => useInspection.setState({ positionDragging: false })}
          onPointerCancel={() => useInspection.setState({ positionDragging: false })}
          onBlur={() => useInspection.setState({ positionDragging: false })} />
      </label>
      <label>{v06.position} ({unit})
        <input key={axis + ":" + plane.positionM} aria-label={v06.position + " numérica " + axis} type="number" inputMode="decimal" step="any"
          defaultValue={Number((plane.positionM * scale).toFixed(unit === "mm" ? 3 : unit === "cm" ? 4 : 6))}
          onBlur={(event) => positionM(event.currentTarget.valueAsNumber / scale)}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      </label>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--secondary" onClick={() => positionM((min + max) / 2)}>{v06.center}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={selection.isEmpty()} onClick={() => positionM((first + last) / 2)}>{v06.centerSelection}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={selection.isEmpty()} onClick={() => positionM(first)}>{v06.selectionMin}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={selection.isEmpty()} onClick={() => positionM(last)}>{v06.selectionMax}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={() => state.patchPlane(slot, axis, {
          name: v06.plane + " " + axis, positionM: (min + max) / 2, enabled: false, flipped: false, gizmo: true, gizmoOpacity: 0.65,
        })}>{v06.resetPlane}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={state.reset}>{v06.resetAll}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={onFit}>{v06.fit}</button>
      </div>
      <label>{v06.mode}
        <select value={appearance.mode} onChange={(event) => state.patchSection(slot, { mode: event.currentTarget.value as SectionMode })}>
          {Object.entries(sectionModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      {appearance.mode !== "open" && <>
        <div className="gg-v05-checks"><label>
          <input type="checkbox" checked={appearance.fill} onChange={(event) => state.patchSection(slot, { fill: event.currentTarget.checked })}
            disabled={appearance.mode === "outline"} />{v06.fill}
        </label></div>
        <div className="gg-inspection-colors">
          <label>{v06.fillColor}<input type="color" value={appearance.fillColor} onChange={(event) => state.patchSection(slot, { fillColor: event.currentTarget.value })} /></label>
          <label>{v06.outlineColor}<input type="color" value={appearance.outlineColor} onChange={(event) => state.patchSection(slot, { outlineColor: event.currentTarget.value })} /></label>
        </div>
        <label>{v06.lineWidth}<input type="range" min="1" max="5" step="0.5" value={appearance.lineWidth}
          onChange={(event) => state.patchSection(slot, { lineWidth: event.currentTarget.valueAsNumber })} /></label>
        <label>{v06.opacity}<input type="range" min="0.1" max="1" step="0.05" value={appearance.opacity}
          onChange={(event) => state.patchSection(slot, { opacity: event.currentTarget.valueAsNumber })} /></label>
      </>}
      <details className="gg-inspection-record">
        <summary>Ajustes do plano</summary>
        <div className="gg-v05-fields">
          <label>{v06.plane}<input type="text" defaultValue={plane.name} key={axis + plane.name} maxLength={80}
            onBlur={(event) => state.patchPlane(slot, axis, { name: event.currentTarget.value.trim() || v06.plane + " " + axis })} /></label>
          <label>{v06.gizmoOpacity}<input type="range" min="0.1" max="1" step="0.05" value={plane.gizmoOpacity}
            onChange={(event) => state.patchPlane(slot, axis, { gizmoOpacity: event.currentTarget.valueAsNumber })} /></label>
        </div>
      </details>
      {warnings.map((warning) => <p className="gg-v05-hint" key={warning} role="status">{warning}</p>)}
    </>
  );
}
