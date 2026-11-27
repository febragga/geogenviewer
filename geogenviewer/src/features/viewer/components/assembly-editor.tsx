"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { componentLabel } from "../../../lib/geogen/domain/component-identity";
import type { ManifestAssemblyStep } from "../../../lib/geogen/domain/model";
import type { Vec3 } from "../scene/camera-state";
import { useAssembly } from "../state/assembly-store";
import { useViewerStore } from "../state/viewer-store";
import { v05 } from "../v05-copy";
import { downloadFile } from "./download-file";

export function AssemblyEditor({ onClose }: { onClose: () => void }) {
  const source = useAssembly((state) => state.source)!;
  const graph = useViewerStore((state) => state.sceneGraph);
  const selected = useViewerStore((state) => state.selectedIds);
  const [steps, setSteps] = useState(() => {
    const state = useAssembly.getState();
    return state.sourceIssue ? source.assembly?.steps ?? [] : state.timeline.schedule.map(({ step }) => step);
  });
  const [current, setCurrent] = useState(0);
  const [candidate, setCandidate] = useState("");
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);
  const step = steps[current];
  const names = new Map(source.elements.map((item) => [item.id, componentLabel(graph?.components[item.id], item.name)]));
  const previous = steps.slice(0, current);
  const assigned = new Set(steps.flatMap((item) => item.elementIds));
  const available = step ? source.elements.filter((item) => !assigned.has(item.id)) : [];

  function change(next: ManifestAssemblyStep[]) {
    setSteps(next);
    setStatus(null);
  }

  function patch(values: Partial<ManifestAssemblyStep>) {
    change(steps.map((item, index) => index === current ? { ...item, ...values } : item));
  }

  function move(offset: -1 | 1) {
    const next = [...steps];
    const destination = current + offset;
    [next[destination], next[current]] = [next[current], next[destination]];
    change(next);
    setCurrent(destination);
  }

  function add() {
    const next: ManifestAssemblyStep = {
      id: "step-" + crypto.randomUUID(), title: "Etapa " + (steps.length + 1),
      elementIds: selected.filter((id) => !assigned.has(id) && names.has(id)),
      dependsOn: [], durationSeconds: 1, insertionOffsetM: [0, 0, 0],
    };
    change([...steps, next]);
    setCurrent(steps.length);
    setCandidate("");
  }

  function apply(action: "save" | "preview" | "download") {
    try {
      const result = useAssembly.getState().replace(steps);
      setStatus({ message: v05.savedSequence, error: false });
      if (action === "preview") {
        useAssembly.getState().setSolo(current);
        onClose();
      } else if (action === "download") {
        downloadFile(new Blob([JSON.stringify(result, null, 2) + "\n"], { type: "application/json" }), "manifest.json");
      }
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Sequência inválida.", error: true });
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="gg-dialog-backdrop" />
        <Dialog.Popup className="gg-v05-editor">
          <header>
            <Dialog.Title className="gg-v05-title">{v05.editTitle}</Dialog.Title>
            <Dialog.Close className="gg-btn gg-btn--ghost" aria-label="Fechar editor">Fechar</Dialog.Close>
          </header>
          <div className="gg-v05-editor__body gg-v05-fields">
            <div className="gg-v05-actions">
              <button type="button" className="gg-btn gg-btn--secondary" onClick={add}>{v05.addStep}</button>
              <button type="button" className="gg-btn gg-btn--ghost" onClick={() => {
                change(source.assembly?.steps ?? []);
                setCurrent(0);
              }}>{v05.importSequence}</button>
            </div>
            {step && <>
              <label>Etapa
                <select value={current} onChange={(event) => { setCurrent(Number(event.currentTarget.value)); setCandidate(""); }}>
                  {steps.map((item, index) => <option key={item.id} value={index}>{index + 1} · {item.title || "Sem título"}</option>)}
                </select>
              </label>
              <div className="gg-v05-actions">
                <button type="button" className="gg-btn gg-btn--ghost" disabled={current <= 0} onClick={() => move(-1)}>{v05.moveUp}</button>
                <button type="button" className="gg-btn gg-btn--ghost" disabled={current >= steps.length - 1} onClick={() => move(1)}>{v05.moveDown}</button>
                <button type="button" className="gg-btn gg-btn--ghost" onClick={() => {
                  change(steps.filter((item) => item.id !== step.id).map((item) => ({
                    ...item, dependsOn: item.dependsOn.filter((id) => id !== step.id),
                  })));
                  setCurrent(Math.max(0, current - 1));
                }}>{v05.remove}</button>
              </div>
              <label>{v05.title}
                <input value={step.title} maxLength={256} onChange={(event) => patch({ title: event.currentTarget.value })} />
              </label>
              <label>{v05.duration}
                <input type="number" min="0.001" step="any" value={Number.isFinite(step.durationSeconds ?? 1) ? step.durationSeconds ?? 1 : ""}
                  onChange={(event) => patch({ durationSeconds: event.currentTarget.valueAsNumber })} />
              </label>
              <fieldset>
                <legend>{v05.insert}</legend>
                <div className="gg-v05-editor__axes">
                  {["X", "Y", "Z"].map((axis, index) => (
                    <label key={axis}>{axis}
                      <input type="number" step="any" value={Number.isFinite(step.insertionOffsetM?.[index] ?? 0) ? step.insertionOffsetM?.[index] ?? 0 : ""}
                        onChange={(event) => {
                          const offset: Vec3 = [...(step.insertionOffsetM ?? [0, 0, 0])];
                          offset[index] = event.currentTarget.valueAsNumber;
                          patch({ insertionOffsetM: offset });
                        }} />
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{v05.depends}</legend>
                {previous.length ? <div className="gg-v05-checks gg-v05-filter-values">
                  {previous.map((item) => <label key={item.id}>
                    <input type="checkbox" checked={step.dependsOn.includes(item.id)} onChange={(event) => patch({
                      dependsOn: event.currentTarget.checked ? [...step.dependsOn, item.id] : step.dependsOn.filter((id) => id !== item.id),
                    })} />{item.title}
                  </label>)}
                </div> : <p className="gg-v05-hint">{v05.noDependencies}</p>}
                {step.dependsOn.some((id) => !previous.some((item) => item.id === id)) &&
                  <button type="button" className="gg-btn gg-btn--secondary" onClick={() => patch({
                    dependsOn: step.dependsOn.filter((id) => previous.some((item) => item.id === id)),
                  })}>Remover dependências fora de ordem</button>}
              </fieldset>
              <fieldset>
                <legend>{v05.pieces} · {step.elementIds.length}</legend>
                <div className="gg-v05-actions">
                  <button type="button" className="gg-btn gg-btn--secondary" disabled={!selected.some((id) => !assigned.has(id) && names.has(id))}
                    onClick={() => patch({ elementIds: [...step.elementIds, ...selected.filter((id) => !assigned.has(id) && names.has(id))] })}>{v05.addSelection}</button>
                </div>
                <label>Componente disponível
                  <select value={candidate} onChange={(event) => setCandidate(event.currentTarget.value)}>
                    <option value="">Escolher componente</option>
                    {available.map((item) => <option key={item.id} value={item.id}>{names.get(item.id)} · {item.id}</option>)}
                  </select>
                </label>
                <button type="button" className="gg-btn gg-btn--secondary" disabled={!candidate || assigned.has(candidate)} onClick={() => {
                  patch({ elementIds: [...step.elementIds, candidate] });
                  setCandidate("");
                }}>Adicionar componente</button>
                <ul className="gg-v05-editor__pieces">
                  {step.elementIds.map((id) => <li key={id}><span>{names.get(id) ?? id}</span>
                    <button type="button" className="gg-btn gg-btn--ghost" aria-label={"Remover " + (names.get(id) ?? id)} onClick={() => patch({
                      elementIds: step.elementIds.filter((item) => item !== id),
                    })}>Remover</button></li>)}
                </ul>
              </fieldset>
            </>}
            <p className="gg-v05-hint">{v05.offsetHint}</p>
            {status && <p role={status.error ? "alert" : "status"} className={status.error ? "gg-v05-error" : "gg-v05-hint"}>{status.message}</p>}
          </div>
          <footer className="gg-v05-actions">
            <button type="button" className="gg-btn gg-btn--primary" onClick={() => apply("save")}>{v05.apply}</button>
            <button type="button" className="gg-btn gg-btn--secondary" disabled={!step} onClick={() => apply("preview")}>{v05.preview}</button>
            <button type="button" className="gg-btn gg-btn--secondary" onClick={() => apply("download")}>{v05.downloadManifest}</button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
