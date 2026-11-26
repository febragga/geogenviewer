"use client";

import { useEffect, useState } from "react";
import { usePresentation, type DisplayMode, type DisplaySettings, type GraphicsQuality } from "../state/presentation-store";
import { displayModes, qualities, v05 } from "../v05-copy";
import { downloadFile } from "./download-file";

const switches = ["grid", "axes", "ground", "shadows", "edges"] as const;

export function DisplayOptions({ count, loadTime, onReset }: { count: number; loadTime: number; onReset: () => void }) {
  const settings = usePresentation((state) => state.display);
  const patch = usePresentation((state) => state.patchDisplay);
  const access = usePresentation((state) => state.access);
  const [transparent, setTransparent] = useState(false);
  const [resolution, setResolution] = useState(1920);
  const [diagnostics, setDiagnostics] = useState(false);
  const [stats, setStats] = useState(() => access?.stats());
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!diagnostics || !access) return;
    const timer = window.setInterval(() => setStats(access.stats()), 400);
    return () => window.clearInterval(timer);
  }, [access, diagnostics]);

  async function exportImage() {
    if (!access) return;
    setExporting(true);
    setStatus("");
    try {
      const viewport = document.querySelector(".gg-viewport");
      const background = viewport ? getComputedStyle(viewport).backgroundColor : "#edf0f3";
      const blob = await access.capture({ width: resolution, transparent, background });
      downloadFile(blob, "geogenviewer.png");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao exportar PNG.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <label>{v05.display}
        <select value={settings.mode} onChange={(event) => patch({ mode: event.currentTarget.value as DisplayMode })}>
          {Object.entries(displayModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label>{v05.background}
        <select value={settings.background} onChange={(event) => patch({ background: event.currentTarget.value as DisplaySettings["background"] })}>
          <option value="theme">Tema</option><option value="white">Branco</option><option value="dark">Grafite</option>
        </select>
      </label>
      <div className="gg-v05-checks gg-v05-checks--columns">
        {switches.map((name) => <label key={name}><input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.currentTarget.checked })} />{v05[name]}</label>)}
      </div>
      <label>{v05.light} · {Math.round(settings.light * 100)}%
        <input type="range" min="0.2" max="2" step="0.05" value={settings.light} onChange={(event) => patch({ light: Number(event.currentTarget.value) })} />
      </label>
      <label>{v05.opacity} · {Math.round(settings.opacity * 100)}%
        <input type="range" min="0.1" max="1" step="0.05" value={settings.opacity} onChange={(event) => patch({ opacity: Number(event.currentTarget.value) })} />
      </label>
      <label>{v05.quality}
        <select value={settings.quality} onChange={(event) => patch({ quality: event.currentTarget.value as GraphicsQuality })}>
          {Object.entries(qualities).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </label>
      <div className="gg-v05-checks">
        <label><input type="checkbox" checked={diagnostics} onChange={(event) => setDiagnostics(event.currentTarget.checked)} />{v05.diagnostics}</label>
        {diagnostics && <dl className="gg-v05-stats">
          <dt>FPS em atividade</dt><dd>{stats?.fps ? Math.round(stats.fps) : "—"}</dd>
          <dt>Draw calls</dt><dd>{stats?.draws ?? "—"}</dd>
          <dt>Triângulos</dt><dd>{stats?.triangles ?? "—"}</dd>
          <dt>Geometrias</dt><dd>{stats?.geometries ?? "—"}</dd>
          <dt>Materiais</dt><dd>{stats?.materials ?? "—"}</dd>
          <dt>Componentes</dt><dd>{count}</dd>
          <dt>Carga do modelo</dt><dd>{Math.round(loadTime)} ms</dd>
        </dl>}
      </div>
      <h3 className="gg-v05-subtitle">{v05.exportPng}</h3>
      <label>{v05.resolution}
        <select value={resolution} onChange={(event) => setResolution(Number(event.currentTarget.value))}>
          <option value={1280}>1280 px</option><option value={1920}>1920 px</option><option value={3840}>3840 px</option>
        </select>
      </label>
      <div className="gg-v05-checks"><label><input type="checkbox" checked={transparent} onChange={(event) => setTransparent(event.currentTarget.checked)} />{v05.transparent}</label></div>
      <div className="gg-v05-actions">
        <button type="button" className="gg-btn gg-btn--primary" disabled={!access || exporting} onClick={() => void exportImage()}>{v05.exportPng}</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={onReset}>Restaurar vista</button>
        <button type="button" className="gg-btn gg-btn--ghost" onClick={() => {
          const toggle = document.fullscreenElement ? document.exitFullscreen() : document.querySelector(".gg-app")?.requestFullscreen?.();
          if (toggle) void toggle.catch(() => setStatus("Tela cheia indisponível neste navegador."));
          else setStatus("Tela cheia indisponível neste navegador.");
        }}>{v05.fullscreen}</button>
      </div>
      {status && <p role="status">{status}</p>}
    </>
  );
}
