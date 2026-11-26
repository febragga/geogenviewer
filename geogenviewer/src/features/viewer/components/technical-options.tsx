"use client";

import { useRef, useState } from "react";
import { matchesIdentity, maxInspectionBytes, type InspectionDocument, type TechnicalOptions, type TechnicalSnapshot } from "../../../lib/geogen/inspection/document";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { useInspection } from "../state/inspection-store";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { v06 } from "../v06-copy";
import { downloadFile } from "./download-file";

const toggles = ["measurements", "identifiers", "grid", "axes", "gizmos", "selection", "scale"] as const;
const labels = { measurements: v06.measurements, identifiers: v06.identifiers, gizmos: v06.gizmos, grid: v06.grid, axes: v06.axes, selection: v06.selected, scale: v06.scale };

export function TechnicalOptionsPanel({ loaded }: { loaded: LoadedScenePackage }) {
  const options = useInspection((state) => state.doc?.capture);
  const status = useInspection((state) => state.status);
  const lastCapture = useInspection((state) => state.lastCapture);
  const access = usePresentation((state) => state.access);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  if (!options) return null;
  const patch = useInspection.getState().patchCapture;

  function snapshot(): TechnicalSnapshot | undefined {
    const region = usePresentation.getState();
    const camera = region.access?.pose(region.active);
    if (!camera) return;
    const state = useInspection.getState();
    const selected = useViewerStore.getState().selectedIds;
    const measured = state.doc?.measurements.filter((item) => item.visible).flatMap((item) => item.anchors.map((anchor) => anchor.elementId)) ?? [];
    return {
      camera, generatedAt: new Date().toISOString(), layout: region.layout, activeSlot: region.active,
      title: loaded.sceneGraph.projectTitle, viewName: state.viewName, projection: camera.projection, unit: state.unit,
      elementIds: [...new Set([...selected, ...measured])].slice(0, 300),
    };
  }

  function saveJson(document: InspectionDocument, name: string) {
    downloadFile(new Blob([JSON.stringify(document, null, 2) + "\n"], { type: "application/json" }), name);
  }

  async function exportPng() {
    if (!options || !access) return;
    setBusy(true);
    setError("");
    try {
      const metadata = useInspection.getState().exportDocument(snapshot());
      const png = await access.capture({
        width: options.width, transparent: options.background === "transparent",
        background: options.background === "white" ? "#ffffff" : options.color, technical: options,
      });
      downloadFile(png, "geogen-inspecao.png");
      const current = useInspection.getState().doc;
      if (metadata && current && matchesIdentity(metadata.model, current.model)) {
        useInspection.setState({ lastCapture: metadata });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : v06.captureError);
    } finally { setBusy(false); }
  }

  async function importFile(file: File) {
    setError("");
    try {
      if (file.size > maxInspectionBytes) throw new Error("Arquivo de inspeção excede 2 MB.");
      useInspection.getState().importText(await file.text());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : v06.importError);
    }
  }

  return (
    <>
      <p className="gg-v05-hint">{v06.briefing}</p>
      <label>{v06.resolution}
        <select value={options.width} onChange={(event) => patch({ width: Number(event.currentTarget.value) as TechnicalOptions["width"] })}>
          {[1280, 1920, 3840].map((width) => <option key={width} value={width}>{width} px</option>)}
        </select>
      </label>
      <label>{v06.background}
        <select value={options.background} onChange={(event) => patch({ background: event.currentTarget.value as TechnicalOptions["background"] })}>
          <option value="white">Branco</option><option value="transparent">Transparente</option><option value="custom">Personalizado</option>
        </select>
      </label>
      {options.background === "custom" && <label>{v06.color}<input type="color" value={options.color} onChange={(event) => patch({ color: event.currentTarget.value })} /></label>}
      <div className="gg-v05-checks gg-v05-checks--columns">
        {toggles.map((key) => <label key={key}>
          <input type="checkbox" checked={options[key]} onChange={(event) => patch({ [key]: event.currentTarget.checked })} />{labels[key]}
        </label>)}
      </div>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--primary" disabled={!access || busy} onClick={() => void exportPng()}>{v06.png}</button>
        <button type="button" className="gg-btn gg-btn--secondary" onClick={() => {
          const doc = useInspection.getState().exportDocument(snapshot());
          if (doc) saveJson(doc, "inspection.json");
        }}>{v06.exportJson}</button>
        <button type="button" className="gg-btn gg-btn--secondary" onClick={() => picker.current?.click()}>{v06.importJson}</button>
        {lastCapture && <button type="button" className="gg-btn gg-btn--ghost" onClick={() => saveJson(lastCapture, "geogen-inspecao.snapshot.json")}>
          {v06.lastCapture}
        </button>}
        <input type="file" ref={picker} hidden accept=".json,application/json" aria-label={v06.importJson} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importFile(file);
        }} />
      </div>
      {error ? <p role="alert" className="gg-v05-error">{error}</p> : status && <p role="status" className="gg-v05-hint">{status}</p>}
    </>
  );
}
