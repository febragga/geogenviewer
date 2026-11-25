"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { importGlb, maxGlbBytes, type ImportedModel } from "../../lib/geogen/importers/glb";
import { copy } from "./copy";
import type { CameraCommand, NavigationMode } from "./scene/viewport";

const Viewport = dynamic(() => import("./scene/viewport"), { ssr: false });

export function Viewer() {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [loaded, setLoaded] = useState<{ model: ImportedModel; name: string; id: number }>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lost, setLost] = useState(false);
  const [mode, setMode] = useState<NavigationMode>("orbit");
  const [command, setCommand] = useState<CameraCommand>({ kind: "reset" });

  useEffect(() => () => { request.current++; }, []);
  useEffect(() => () => loaded?.model.dispose(), [loaded]);

  const onContextLost = useCallback(() => setLost(true), []);

  async function open(file?: File) {
    const id = ++request.current;
    setStatus(copy.reading);
    setError("");
    try {
      if (file && file.size > maxGlbBytes) throw new Error(copy.tooLarge);
      const bytes = file ? await file.arrayBuffer() : await fetch("/demos/estrutura.glb").then((response) => {
        if (!response.ok) throw new Error(copy.invalid);
        return response.arrayBuffer();
      });
      if (id !== request.current) return;
      setStatus(copy.decoding);
      const model = await importGlb(bytes);
      if (id !== request.current) {
        model.dispose();
        return;
      }
      setLoaded({ model, name: file?.name ?? copy.demoName, id });
      setCommand({ kind: "reset" });
      setLost(false);
    } catch (cause) {
      if (id === request.current) {
        const message = cause instanceof Error ? cause.message : "";
        setError(/^(O arquivo|Selecione|O GLB|A versão|Exporte|A cena)/.test(message) ? message : copy.invalid);
      }
    } finally {
      if (id === request.current) setStatus("");
    }
  }

  const fallback = <p role="alert" className="viewport-message">{copy.noWebgl}</p>;
  return (
    <main className="viewer">
      <header className="topbar">
        <div><h1>{copy.title}</h1><p>{loaded?.name ?? copy.local}</p></div>
        <div className="actions">
          <button onClick={() => input.current?.click()}>{copy.open}</button>
          <button onClick={() => void open()}>{copy.demo}</button>
          <input type="file" accept=".glb,model/gltf-binary" aria-label={copy.open} ref={input} hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void open(file);
          }} />
        </div>
      </header>
      <div className="viewport" aria-busy={Boolean(status)}>
        {loaded && !lost
          ? <Viewport key={loaded.id} model={loaded.model} command={command} mode={mode} onContextLost={onContextLost} fallback={fallback} />
          : lost
            ? <div className="viewport-message">{fallback}<button onClick={() => { setCommand({ kind: "reset" }); setLost(false); }}>{copy.retry}</button></div>
            : <p className="viewport-message">{copy.empty}</p>}
        {loaded && !lost && <div className="axes" aria-label={copy.axes}><span>X</span><span>Y</span><span>Z</span></div>}
      </div>
      {status && <p className="notice" role="status">{status}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {loaded && <footer className="toolbar">
        <div className="actions">
          <button disabled={lost} aria-pressed={mode === "orbit"} onClick={() => setMode("orbit")}>{copy.orbit}</button>
          <button disabled={lost} aria-pressed={mode === "pan"} onClick={() => setMode("pan")}>{copy.pan}</button>
          {(["closer", "farther", "fit", "reset"] as const).map((kind) =>
            <button disabled={lost} key={kind} onClick={() => setCommand({ kind })}>{copy[kind]}</button>)}
        </div>
        <p>{copy.help}</p>
      </footer>}
    </main>
  );
}
