"use client";

import { useMemo, useState } from "react";
import { catalogFor, normalizeSearch, type FilterField, type FilterOption } from "../../../lib/geogen/domain/visibility";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { copy } from "../copy";
import { preferenceKey, readLocalList, writeLocalList, type FilterPreset } from "../state/local-preferences";
import { useEffectiveVisibility } from "../state/visibility-state";
import { useViewerStore } from "../state/viewer-store";
import { assemblyStates, filterFields, v05 } from "../v05-copy";

export function FilterOptions({ loaded, onFit }: { loaded: LoadedScenePackage; onFit: (selected?: string[]) => void }) {
  const filters = useViewerStore((state) => state.filters);
  const beforeIsolation = useViewerStore((state) => state.beforeIsolation);
  const selected = useViewerStore((state) => state.selectedIds);
  const setFilters = useViewerStore((state) => state.setFilters);
  const { visible } = useEffectiveVisibility();
  const [field, setField] = useState<FilterField>("layer");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(80);
  const key = preferenceKey("filters", loaded.manifest, loaded.sceneGraph.fileName, loaded.sceneGraph.fileSizeBytes);
  const [saved, setSaved] = useState(() => readLocalList<FilterPreset>(key));
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const options = useMemo<FilterOption[]>(() => {
    if (field === "selection") return [{ value: "selected", label: "Selecionados" }, { value: "unselected", label: "Sem seleção" }];
    if (field === "assembly") return Object.entries(assemblyStates).map(([value, label]) => ({ value, label }));
    return catalogFor(loaded.sceneGraph, new Map(loaded.manifest?.blocks?.map((block) => [block.id, block.name])), field);
  }, [field, loaded]);
  const query = normalizeSearch(search.trim());
  const matching = query ? options.filter((item) => normalizeSearch(item.label + " " + item.value).includes(query)) : options;
  const current = filters[field] ?? [];
  const preset = saved.find((item) => item.id === chosen);

  function save(entries: FilterPreset[]) {
    setSaved(entries);
    setStatus(writeLocalList(key, entries) ? "" : v05.localFailure);
  }

  return (
    <>
      <p className="gg-v05-hint">{v05.filterHelp}</p>
      <label>{v05.filters}
        <select value={field} onChange={(event) => {
          setField(event.currentTarget.value as FilterField);
          setSearch("");
          setLimit(80);
        }}>
          {Object.entries(filterFields).map(([id, label]) => <option key={id} value={id}>{label}{filters[id as FilterField]?.length ? ` (${filters[id as FilterField]?.length})` : ""}</option>)}
        </select>
      </label>
      {options.length > 12 && <label>{v05.searchFilters}
        <input type="search" value={search} onChange={(event) => { setSearch(event.currentTarget.value); setLimit(80); }} />
      </label>}
      <div className="gg-v05-checks gg-v05-filter-values">
        {matching.length === 0 && <p className="gg-v05-hint">{v05.emptyFilter}</p>}
        {matching.slice(0, limit).map(({ value, label }) => (
          <label key={value}>
            <input type="checkbox" checked={current.includes(value)} onChange={(event) => {
              setFilters({ ...filters, [field]: event.currentTarget.checked ? [...current, value] : current.filter((item) => item !== value) });
            }} />{label}
          </label>
        ))}
        {matching.length > limit && <button type="button" className="gg-btn gg-btn--ghost" onClick={() => setLimit((count) => count + 80)}>{v05.moreOptions}</button>}
      </div>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!selected.length} onClick={() => useViewerStore.getState().hideIds(selected)}>{copy.hideSelected}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!selected.length} onClick={() => useViewerStore.getState().isolateIds(selected)}>{copy.isolateSelected}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!selected.length} onClick={useViewerStore.getState().clearSelection}>{copy.clearSelection}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!selected.length} onClick={useViewerStore.getState().hideUnselected}>{v05.hideUnselected}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!beforeIsolation} onClick={useViewerStore.getState().restoreIsolation}>{v05.undoIsolate}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={() => {
          useViewerStore.setState({ hiddenIds: visible, isolatedIds: null, filters: {}, beforeIsolation: null });
        }}>{v05.invert}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!visible.length} onClick={() => useViewerStore.getState().selectMany(visible)}>{v05.selectVisible}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!selected.length} onClick={() => onFit(selected)}>{v05.fitSelection}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={() => onFit()}>{v05.fitExtents}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={useViewerStore.getState().showAll}>{copy.showAll}</button>
      </div>
      <h3 className="gg-v05-subtitle">{v05.preset}</h3>
      <label>{v05.preset}
        <select value={chosen} onChange={(event) => setChosen(event.currentTarget.value)}>
          <option value="">Escolher combinação</option>
          {saved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>{v05.name}<input value={name} maxLength={80} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--primary" disabled={!name.trim()} onClick={() => {
          const next = { id: crypto.randomUUID(), name: name.trim(), filters };
          save([...saved, next]);
          setChosen(next.id);
          setName("");
        }}>{v05.savePreset}</button>
        <button type="button" className="gg-btn gg-btn--secondary" disabled={!preset} onClick={() => { if (preset) setFilters(preset.filters); }}>{v05.apply}</button>
        <button type="button" className="gg-btn gg-btn--ghost" disabled={!preset} onClick={() => {
          save(saved.filter((item) => item.id !== chosen));
          setChosen("");
        }}>{v05.remove}</button>
      </div>
      {status && <p role="status">{status}</p>}
    </>
  );
}
