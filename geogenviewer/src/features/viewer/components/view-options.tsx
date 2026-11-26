"use client";

import { useState } from "react";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { type Projection, type ViewLayout, type ViewPreset } from "../scene/camera-state";
import { preferenceKey, readLocalList, writeLocalList, type NamedView } from "../state/local-preferences";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { layouts, presets, v05 } from "../v05-copy";

export function ViewOptions({ loaded }: { loaded: LoadedScenePackage }) {
  const active = usePresentation((state) => state.active);
  const layout = usePresentation((state) => state.layout);
  const maximized = usePresentation((state) => state.maximized);
  const projection = usePresentation((state) => state.projections[state.active]);
  const syncTarget = usePresentation((state) => state.syncTarget);
  const syncZoom = usePresentation((state) => state.syncZoom);
  const shareSelection = usePresentation((state) => state.shareSelection);
  const shareVisibility = usePresentation((state) => state.shareVisibility);
  const access = usePresentation((state) => state.access);
  const key = preferenceKey("views", loaded.manifest, loaded.sceneGraph.fileName, loaded.sceneGraph.fileSizeBytes);
  const [views, setViews] = useState(() => readLocalList<NamedView>(key));
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const view = views.find((item) => item.id === chosen);

  function save(entries: NamedView[]) {
    setViews(entries);
    setStatus(writeLocalList(key, entries) ? "" : v05.localFailure);
  }

  function capture(id: string, title: string) {
    const pose = access?.pose(active);
    if (!pose) return;
    const { display } = usePresentation.getState();
    const { filters, hiddenIds, isolatedIds } = useViewerStore.getState();
    return { id, name: title, pose, display, visibility: { filters, hiddenIds, isolatedIds } } satisfies NamedView;
  }

  function create() {
    if (!name.trim()) return;
    const next = capture(crypto.randomUUID(), name.trim());
    if (next) {
      save([...views, next]);
      setChosen(next.id);
    }
  }

  return (
    <>
      <label>{v05.layout}
        <select value={layout} onChange={(event) => usePresentation.getState().setLayout(event.currentTarget.value as ViewLayout)}>
          {Object.entries(layouts).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <label>{v05.orientation}
        <select key={active} value="" onChange={(event) => {
          if (event.currentTarget.value) access?.preset(event.currentTarget.value as ViewPreset);
        }}>
          <option value="">Escolher orientação</option>
          {Object.entries(presets).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <label>{v05.projection}
        <select value={projection} onChange={(event) => access?.projection(event.currentTarget.value as Projection)}>
          <option value="perspective">{v05.perspective}</option><option value="orthographic">{v05.orthographic}</option>
        </select>
      </label>
      {layout !== "single" && (
        <div className="gg-v05-checks">
          <label><input type="checkbox" checked={syncTarget} onChange={(event) => usePresentation.setState({ syncTarget: event.currentTarget.checked })} />{v05.syncTarget}</label>
          <label><input type="checkbox" checked={syncZoom} onChange={(event) => usePresentation.setState({ syncZoom: event.currentTarget.checked })} />{v05.syncZoom}</label>
          <label><input type="checkbox" checked={shareSelection} onChange={(event) => usePresentation.setState({ shareSelection: event.currentTarget.checked })} />{v05.selectionShared}</label>
          <label><input type="checkbox" checked={shareVisibility} onChange={(event) => usePresentation.setState({ shareVisibility: event.currentTarget.checked })} />{v05.visibilityShared}</label>
          <button type="button" className="gg-btn gg-btn--secondary" onClick={usePresentation.getState().toggleMaximize}>
            {maximized === null ? v05.maximize : v05.restoreLayout}
          </button>
        </div>
      )}
      <h3 className="gg-v05-subtitle">{v05.named}</h3>
      <label>{v05.named}
        <select value={chosen} onChange={(event) => {
          const id = event.currentTarget.value;
          setChosen(id);
          setName(views.find((item) => item.id === id)?.name ?? "");
        }}>
          <option value="">Escolher vista</option>
          {views.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>{v05.name}<input maxLength={80} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--primary" disabled={!name.trim() || !access} onClick={create}>{v05.save}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!view || !access} onClick={() => {
          if (!view?.pose || !view.visibility || !view.display) return;
          access?.apply(view.pose);
          usePresentation.setState({ display: view.display });
          useViewerStore.setState({ ...view.visibility, beforeIsolation: null });
        }}>{v05.apply}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!view || !access} onClick={() => {
          if (!view) return;
          const next = capture(view.id, view.name);
          if (next) save(views.map((item) => item.id === view.id ? next : item));
        }}>{v05.update}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!view || !name.trim()} onClick={() => {
          if (view) save(views.map((item) => item.id === view.id ? { ...item, name: name.trim() } : item));
        }}>{v05.rename}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!view} onClick={() => {
          if (!view) return;
          const next = { ...view, id: crypto.randomUUID(), name: view.name + " · cópia" };
          save([...views, next]);
          setChosen(next.id);
          setName(next.name);
        }}>{v05.duplicate}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!view} onClick={() => {
          save(views.filter((item) => item.id !== chosen));
          setChosen("");
          setName("");
        }}>{v05.remove}</button>
      </div>
      {status && <p role="status">{status}</p>}
    </>
  );
}
