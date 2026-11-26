"use client";

import { useState, type FormEvent } from "react";
import { fabricationFields, type FabricationSettings, type Field } from "../../../lib/geogen/revisions/fabrication";
import { numeric } from "../../../lib/geogen/revisions/quantities";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import { massLabels, timeLabels, v07 } from "../v07-copy";
import { actionClass, Choice, formatNumber } from "./analytics-fields";

const labels = { ...massLabels, ...timeLabels };
const fields = Object.keys(fabricationFields) as Field[];
const fieldLabels = Object.fromEntries(fields.map((field) => [field, labels[field]])) as Record<Field, string>;

export function FabricationControls({ revision, settings, update }: {
  revision: Revision; settings: FabricationSettings; update: (settings: FabricationSettings) => void;
}) {
  const [issue, setIssue] = useState("");
  const [editing, setEditing] = useState("");
  const current = settings.materials.find((entry) => entry.code === editing);
  const [field, setField] = useState<Field>("slicer");

  function handle(event: FormEvent<HTMLFormElement>, run: (values: FormData) => void) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try { run(data); setIssue(""); }
    catch (cause) { setIssue(cause instanceof Error ? cause.message : String(cause)); }
  }

  const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
  function saveMaterial(event: FormEvent<HTMLFormElement>) {
    handle(event, (data) => {
      const code = text(data, "code"), name = text(data, "name"), source = text(data, "source"), notes = text(data, "notes");
      const densityKgM3 = numeric(data.get("density")), costPerKg = numeric(data.get("cost"));
      const currency = text(data, "currency").toUpperCase() || null;
      if (!code || !name || !source || (text(data, "density") && !densityKgM3) ||
        (text(data, "cost") && (costPerKg === null || !currency)) || (currency && !/^[A-Z]{3}$/.test(currency))) {
        throw new Error("Informe código, nome e fonte. A densidade deve ser positiva e o custo requer uma moeda de três letras.");
      }
      const material = { code, name, source, notes, densityKgM3, costPerKg, currency };
      update({ ...settings, materials: [...settings.materials.filter((entry) => entry.code !== code), material] });
      setEditing(code);
    });
  }

  function saveScenario(event: FormEvent<HTMLFormElement>) {
    handle(event, (data) => {
      const name = text(data, "name"), materialCode = text(data, "material"), replaces = text(data, "replaces") || null;
      if (!name || !settings.materials.some((material) => material.code === materialCode)) throw new Error("Informe o nome e um material da biblioteca.");
      update({ ...settings, scenarios: [...settings.scenarios.filter((entry) => entry.name !== name), { name, materialCode, replaces }], activeScenario: name });
    });
  }

  function saveMapping(event: FormEvent<HTMLFormElement>) {
    handle(event, (data) => {
      const mapping = Object.fromEntries(fields.flatMap((key) => {
        const value = text(data, key);
        return value ? [[key, value]] : [];
      }));
      update({ ...settings, mapping });
    });
  }

  function saveValue(event: FormEvent<HTMLFormElement>) {
    handle(event, (data) => {
      const id = text(data, "id"), value = numeric(data.get("value")), source = text(data, "source");
      if (!revision.occurrences.has(id) || value === null || !source) throw new Error("Informe um componente desta revisão, valor válido e a fonte.");
      const prior = Object.hasOwn(settings.authored, id) ? settings.authored[id] : undefined;
      update({ ...settings, authored: { ...settings.authored, [id]: { ...prior, [field]: { value, source } } } });
    });
  }

  return <details>
    <summary>{v07.configuration}</summary>
    {issue && <p role="alert" className="gg-v07-alert">{issue}</p>}
    <details>
      <summary>{v07.library}</summary>
      <label className="gg-v07-field">{v07.material}
        <select value={editing} onChange={(event) => setEditing(event.currentTarget.value)}>
          <option value="">Adicionar material</option>
          {settings.materials.map((entry) => <option key={entry.code} value={entry.code}>{entry.name} · {entry.code}</option>)}
        </select>
      </label>
      {current && <p className="gg-v07-muted">{current.source}{current.densityKgM3 ? " · " + formatNumber(current.densityKgM3) + " kg/m³" : ""}</p>}
      <form key={current?.code ?? ""} className="gg-v07-stack" onSubmit={saveMaterial}>
        <div className="gg-v07-grid">
          <label className="gg-v07-field">{v07.code}<input name="code" required defaultValue={current?.code} /></label>
          <label className="gg-v07-field">{v07.name}<input name="name" required defaultValue={current?.name} /></label>
          <label className="gg-v07-field">{v07.density}<input name="density" type="number" min={0} step="any" defaultValue={current?.densityKgM3 ?? ""} /></label>
          <label className="gg-v07-field">{v07.cost}<input name="cost" type="number" min={0} step="any" defaultValue={current?.costPerKg ?? ""} /></label>
          <label className="gg-v07-field">{v07.currency}<input name="currency" maxLength={3} defaultValue={current?.currency ?? ""} /></label>
          <label className="gg-v07-field">{v07.provenance}<input name="source" required defaultValue={current?.source} /></label>
        </div>
        <label className="gg-v07-field">{v07.notes}<input name="notes" defaultValue={current?.notes} /></label>
        <button type="submit" className={actionClass}>{v07.save} · {v07.material}</button>
      </form>
    </details>
    <details>
      <summary>{v07.scenarios}</summary>
      <label className="gg-v07-field">{v07.scenario}<select value={settings.activeScenario ?? ""}
        onChange={(event) => update({ ...settings, activeScenario: event.currentTarget.value || null })}>
        <option value="">{v07.automatic}</option>
        {settings.scenarios.map((entry) => <option key={entry.name}>{entry.name}</option>)}
      </select></label>
      <form className="gg-v07-stack" onSubmit={saveScenario}>
        <label className="gg-v07-field">{v07.name}<input name="name" required /></label>
        <label className="gg-v07-field">{v07.material}
          <select name="material" required defaultValue=""><option value="" disabled>{v07.unknown}</option>
            {settings.materials.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
          </select>
        </label>
        <label className="gg-v07-field">{v07.scenarioSubstitution}<input name="replaces" placeholder={v07.all} /></label>
        <button type="submit" className={actionClass} disabled={!settings.materials.length}>{v07.save} · {v07.scenario}</button>
      </form>
    </details>
    <details>
      <summary>{v07.mapping}</summary>
      <form key={JSON.stringify(settings.mapping)} className="gg-v07-stack" onSubmit={saveMapping}>
        {fields.map((key) => <label className="gg-v07-field" key={key}>{labels[key]}
          <input name={key} defaultValue={settings.mapping[key]} placeholder={fabricationFields[key]} /></label>)}
        <button type="submit" className={actionClass}>{v07.save} · {v07.mapping}</button>
      </form>
    </details>
    <details>
      <summary>{v07.authored}</summary>
      <form className="gg-v07-stack" onSubmit={saveValue}>
        <label className="gg-v07-field">ID · {v07.component}<input name="id" required /></label>
        <Choice label={v07.property} value={field} onChange={setField} options={fieldLabels} />
        <label className="gg-v07-field">Valor {field === "slicer" || field === "measured" || field === "estimate" ? "(kg)" : "(s)"}
          <input name="value" type="number" min={0} step="any" required /></label>
        <label className="gg-v07-field">{v07.provenance}<input name="source" required /></label>
        <button type="submit" className={actionClass}>{v07.save} · {v07.authored}</button>
      </form>
    </details>
  </details>;
}
