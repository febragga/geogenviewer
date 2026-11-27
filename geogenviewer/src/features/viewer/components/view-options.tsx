"use client";

import { useState } from "react";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { Filters } from "../../../lib/geogen/domain/visibility";
import { type Projection, type ViewLayout, type ViewPreset } from "../scene/camera-state";
import { preferenceKey, readLocalList, restoreDisplay, validNamedView, writeLocalList, type NamedView } from "../state/local-preferences";
import { useInspection } from "../state/inspection-store";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore } from "../state/viewer-store";
import { useOrganizationStore } from "../state/organization-store";
import { layouts, presets, v05 } from "../v05-copy";
import { createDocumentation, parseDocumentation, type DocumentationSettings } from "../../../lib/geogen/documentation/document";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { v08 } from "../v08-copy";
import { useKnollingMotion } from "../state/documentation-store";

export type ViewDocumentation = { revision: Revision; settings: DocumentationSettings; apply: (update: (prior: DocumentationSettings) => DocumentationSettings) => void };

export function ViewOptions({ loaded, comparison = false, documentation }: {
  loaded: LoadedScenePackage; comparison?: boolean; documentation?: ViewDocumentation;
}) {
  const active = usePresentation((state) => state.active);
  const layout = usePresentation((state) => state.layout);
  const maximized = usePresentation((state) => state.maximized);
  const projection = usePresentation((state) => state.projections[state.active]);
  const syncTarget = usePresentation((state) => state.syncTarget);
  const syncZoom = usePresentation((state) => state.syncZoom);
  const shareSelection = usePresentation((state) => state.shareSelection);
  const shareVisibility = usePresentation((state) => state.shareVisibility);
  const access = usePresentation((state) => state.access);
  const key = preferenceKey("views", loaded.manifest, loaded.sceneGraph.fileName, loaded.sceneGraph.fileSizeBytes, loaded.binarySha256 ?? null);
  const [views, setViews] = useState(() => readLocalList<NamedView>(key, undefined, validNamedView));
  const [legacy] = useState(() => !loaded.manifest && readLocalList(
    preferenceKey("views", undefined, loaded.sceneGraph.fileName, loaded.sceneGraph.fileSizeBytes)
  ).length > 0);
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
    const { display, layout, maximized } = usePresentation.getState();
    const { filters, hiddenIds, hiddenGroupKeys, isolatedIds } = useViewerStore.getState();
    const poses = Array.from({ length: 4 }, (_, slot) => access?.pose(slot) ?? null);
    const inspection = useInspection.getState().preset();
    let publication;
    if (documentation && useViewerStore.getState().workspace === "knolling") {
      try { publication = createDocumentation(documentation.revision, documentation.settings, "knolling"); }
      catch (error) { setStatus(error instanceof Error ? error.message : String(error)); return; }
    }
    return { id, name: title, pose, display, visibility: { filters, hiddenIds, hiddenGroupKeys, isolatedIds },
      regions: { layout, active, maximized, poses }, inspection, documentation: publication } satisfies NamedView;
  }

  function create() {
    if (!name.trim()) return;
    const next = capture(crypto.randomUUID(), name.trim());
    if (next) {
      save([...views, next]);
      setChosen(next.id);
      useInspection.setState({ viewName: next.name });
    }
  }

  return (
    <>
      {!comparison && <label>{v05.layout}
        <select value={layout} onChange={(event) => usePresentation.getState().setLayout(event.currentTarget.value as ViewLayout)}>
          {Object.entries(layouts).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>}
      <label>{v05.orientation}
        <select key={active} value="" onChange={(event) => {
          if (event.currentTarget.value) access?.preset(event.currentTarget.value as ViewPreset);
        }}>
          <option value="">Escolher orientação</option>
          {Object.entries(presets).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <label>{v05.projection}
        <select value={comparison ? "" : projection} onChange={(event) => {
          if (event.currentTarget.value) access?.projection(event.currentTarget.value as Projection);
        }}>
          {comparison && <option value="">Escolher projeção</option>}
          <option value="perspective">{v05.perspective}</option><option value="orthographic">{v05.orthographic}</option>
        </select>
      </label>
      {!comparison && layout !== "single" && (
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
          {views.map((item) => <option key={item.id} value={item.id}>{item.name}{item.documentation ? " · " + v08.namedKnoll : ""}</option>)}
        </select>
      </label>
      <label>{v05.name}<input maxLength={80} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--primary" disabled={comparison || !name.trim() || !access} onClick={create}>{v05.save}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!view || !access} onClick={() => {
          if (!view?.pose || !view.visibility || !view.display) return;
          if (comparison) { access?.apply(view.pose); return; }
          const knolling = useViewerStore.getState().workspace === "knolling";
          if (knolling !== Boolean(view.documentation)) {
            setStatus(knolling ? v08.originalNamed : "Abra Knolling para aplicar esta vista.");
            return;
          }
          if (view.documentation) {
            if (!documentation) { setStatus(v08.missingDocumentModel); return; }
            try {
              const imported = parseDocumentation(JSON.stringify(view.documentation), documentation.revision);
              documentation.apply(() => imported.settings);
              useKnollingMotion.getState().set(1);
            } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); return; }
          }
          if (view.regions && access) {
            const { layout, active, maximized, poses } = view.regions;
            usePresentation.setState({ layout, active, maximized, display: restoreDisplay(view.display) });
            const apply = () => poses.forEach((pose, slot) => { if (pose && usePresentation.getState().access === access) access.applySlot(slot, pose); });
            if (knolling) requestAnimationFrame(() => requestAnimationFrame(apply));
            else apply();
          } else {
            access?.apply(view.pose);
            usePresentation.setState({ display: restoreDisplay(view.display) });
          }
          useInspection.getState().restorePreset(view.inspection, view.name);
          const org = useOrganizationStore.getState().doc;
          const layerIds = new Set(org.userLayers.map(({ id }) => id));
          const groupIds = new Set(org.userGroups.map(({ id }) => id));
          const ids = new Set(loaded.sceneGraph.componentOrder);
          const { userLayer, userGroup, ...baseFilters } = view.visibility.filters;
          const filters: Filters = baseFilters;
          const validLayers = userLayer?.filter((id) => layerIds.has(id));
          const validGroups = userGroup?.filter((id) => groupIds.has(id));
          if (validLayers?.length) filters.userLayer = validLayers;
          if (validGroups?.length) filters.userGroup = validGroups;
          useViewerStore.setState({
            filters,
            beforeIsolation: null,
            hiddenIds: view.visibility.hiddenIds.filter((id) => ids.has(id)),
            isolatedIds: view.visibility.isolatedIds?.filter((id) => ids.has(id)) ?? null,
            hiddenGroupKeys: (view.visibility.hiddenGroupKeys ?? []).filter((key) =>
              key.startsWith("user:") ? groupIds.has(key.slice(5)) :
                key.startsWith("cad:") && Object.hasOwn(loaded.sceneGraph.groups, key.slice(4))),
          });
        }}>{v05.apply}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={comparison || !view || !access} onClick={() => {
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
      {legacy && <p className="gg-v05-hint">Vistas antigas deste GLB seguem armazenadas sem vínculo ao conteúdo do arquivo.</p>}
      {status && <p role="status">{status}</p>}
    </>
  );
}
