"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  blueprintDefaults,
  clayDefaults,
  displayExposure,
  ditherDefaults,
  monoDefaults,
  resolveDisplayProfile,
  type BlueprintModeOptions,
  type ClayStudioModeOptions,
  type DitherModeOptions,
  type MonoModeOptions,
} from "../scene/display-profiles";
import { usePresentation, type DisplayMode, type DisplaySettings, type GraphicsQuality } from "../state/presentation-store";
import { useAppSettings } from "../state/settings-store";
import { displayModes, qualities, v05 } from "../v05-copy";
import { downloadFile } from "./download-file";

const switches = ["grid", "axes", "ground", "shadows", "edges"] as const;
const featuredModes: { id: DisplayMode; hint: string }[] = [
  { id: "mono", hint: "Alto contraste" },
  { id: "blueprint", hint: "Cianotipia" },
  { id: "dither", hint: "Reticulado" },
  { id: "clayStudio", hint: "Estúdio + AO" },
];
const secondaryModes: DisplayMode[] = [
  "shaded", "material", "technical", "wireframe", "xray", "layer", "category", "semanticMaterial",
];

export function DisplayOptions({ count, loadTime, onReset, comparison = false }: {
  count: number; loadTime: number; onReset: () => void; comparison?: boolean;
}) {
  const settings = usePresentation((state) => state.display);
  const patch = usePresentation((state) => state.patchDisplay);
  const preferences = useAppSettings((state) => state.patchPreferences);
  const access = usePresentation((state) => state.access);
  const [transparent, setTransparent] = useState(false);
  const [resolution, setResolution] = useState(1920);
  const [diagnostics, setDiagnostics] = useState(false);
  const [stats, setStats] = useState(() => access?.stats());
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  const profile = resolveDisplayProfile(settings);
  const monoOpts = settings.modeOptions?.mono ?? {};
  const blueprintOpts = settings.modeOptions?.blueprint ?? {};
  const ditherOpts = { ...ditherDefaults, ...settings.modeOptions?.dither };
  const clayOpts = settings.modeOptions?.clayStudio ?? {};

  useEffect(() => {
    if (!diagnostics || !access) return;
    const timer = window.setInterval(() => setStats(access.stats()), 400);
    return () => window.clearInterval(timer);
  }, [access, diagnostics]);

  function patchMono(next: Partial<MonoModeOptions>) {
    preferences({ modeOptions: { ...settings.modeOptions, mono: { ...monoOpts, ...next } } });
  }

  function patchBlueprint(next: Partial<BlueprintModeOptions>) {
    preferences({ modeOptions: { ...settings.modeOptions, blueprint: { ...blueprintOpts, ...next } } });
  }

  function patchDither(next: Partial<DitherModeOptions>) {
    preferences({ modeOptions: { ...settings.modeOptions, dither: { ...settings.modeOptions?.dither, ...next } } });
  }

  function patchClay(next: Partial<ClayStudioModeOptions>) {
    preferences({ modeOptions: { ...settings.modeOptions, clayStudio: { ...clayOpts, ...next } } });
  }

  function resetActiveMode(mode: "mono" | "blueprint" | "dither" | "clayStudio") {
    const next = { ...settings.modeOptions };
    delete next[mode];
    preferences({ modeOptions: next });
  }

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
      {!comparison && (
        <div className="gg-display-presets" role="group" aria-label={v05.featuredModes}>
          {featuredModes.map(({ id, hint }) => (
            <button
              key={id}
              type="button"
              className="gg-display-preset"
              data-preset={id}
              aria-pressed={settings.mode === id}
              onClick={() => preferences({ displayMode: id })}
            >
              <span className={`gg-display-swatch gg-display-swatch--${id}`} aria-hidden="true" />
              <span className="gg-display-preset__text">
                <strong>{displayModes[id]}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <label>{v05.display}
        <select value={settings.mode} onChange={(event) => preferences({ displayMode: event.currentTarget.value as DisplayMode })}>
          <optgroup label={v05.featuredModes}>
            {featuredModes.map(({ id }) => <option key={id} value={id}>{displayModes[id]}</option>)}
          </optgroup>
          <optgroup label={v05.otherModes}>
            {secondaryModes.map((id) => <option key={id} value={id}>{displayModes[id]}</option>)}
          </optgroup>
        </select>
      </label>

      {!comparison && settings.mode === "mono" && (
        <section className="gg-display-mode-card" aria-label="Ajustes de Mono">
          <div className="gg-display-mode-card__head">
            <strong>Mono 2.0</strong>
            <button type="button" className="gg-mini-link-btn" onClick={() => resetActiveMode("mono")} title={v05.resetMode}>
              <RotateCcw size={12} aria-hidden="true" />
              <span>Padrão</span>
            </button>
          </div>
          <label className="gg-display-check">
            <input
              type="checkbox"
              checked={monoOpts.invert ?? monoDefaults.invert}
              onChange={(event) => {
                const invert = event.currentTarget.checked;
                patchMono({
                  invert,
                  surfaceColor: undefined,
                  edgeColor: undefined,
                  backgroundColor: undefined,
                });
              }}
            />
            <span>{v05.invertPalette}</span>
          </label>
          <label className="gg-display-range">
            <span>{v05.edgeWidth} · {(profile.edges?.width ?? monoDefaults.edgeWidth).toFixed(2)} px</span>
            <input
              type="range"
              min="0.75"
              max="3"
              step="0.25"
              value={profile.edges?.width ?? monoDefaults.edgeWidth}
              onChange={(event) => patchMono({ edgeWidth: event.currentTarget.valueAsNumber })}
            />
          </label>
          <div className="gg-display-colors">
            <label>
              <span>{v05.surfaceColor}</span>
              <input
                type="color"
                value={profile.material?.color ?? monoDefaults.surfaceColor}
                onChange={(event) => patchMono({ surfaceColor: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{v05.edgeColor}</span>
              <input
                type="color"
                value={profile.edges?.color ?? monoDefaults.edgeColor}
                onChange={(event) => patchMono({ edgeColor: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{v05.backgroundColor}</span>
              <input
                type="color"
                value={profile.backgroundColor ?? monoDefaults.backgroundColor}
                onChange={(event) => patchMono({ backgroundColor: event.currentTarget.value })}
              />
            </label>
          </div>
        </section>
      )}

      {!comparison && settings.mode === "blueprint" && (
        <section className="gg-display-mode-card" aria-label="Ajustes de Blueprint">
          <div className="gg-display-mode-card__head">
            <strong>Blueprint</strong>
            <button type="button" className="gg-mini-link-btn" onClick={() => resetActiveMode("blueprint")} title={v05.resetMode}>
              <RotateCcw size={12} aria-hidden="true" />
              <span>Padrão</span>
            </button>
          </div>
          <label className="gg-display-check">
            <input
              type="checkbox"
              checked={blueprintOpts.grid ?? blueprintDefaults.grid}
              onChange={(event) => patchBlueprint({ grid: event.currentTarget.checked })}
            />
            <span>{v05.blueprintGrid}</span>
          </label>
          <label className="gg-display-check">
            <input
              type="checkbox"
              checked={blueprintOpts.syncUiTheme ?? blueprintDefaults.syncUiTheme}
              onChange={(event) => patchBlueprint({ syncUiTheme: event.currentTarget.checked })}
            />
            <span>{v05.blueprintUiTheme}</span>
          </label>
          <div className="gg-display-colors">
            <label>
              <span>{v05.surfaceColor}</span>
              <input
                type="color"
                value={profile.material?.color ?? blueprintDefaults.surfaceColor}
                onChange={(event) => patchBlueprint({ surfaceColor: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{v05.edgeColor}</span>
              <input
                type="color"
                value={profile.edges?.color ?? blueprintDefaults.edgeColor}
                onChange={(event) => patchBlueprint({ edgeColor: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{v05.backgroundColor}</span>
              <input
                type="color"
                value={profile.backgroundColor ?? blueprintDefaults.backgroundColor}
                onChange={(event) => patchBlueprint({ backgroundColor: event.currentTarget.value })}
              />
            </label>
          </div>
        </section>
      )}

      {!comparison && settings.mode === "dither" && (
        <section className="gg-display-mode-card" aria-label="Ajustes de Dither">
          <div className="gg-display-mode-card__head">
            <strong>Dither</strong>
            <button type="button" className="gg-mini-link-btn" onClick={() => resetActiveMode("dither")} title={v05.resetMode}>
              <RotateCcw size={12} aria-hidden="true" />
              <span>Padrão</span>
            </button>
          </div>
          <div className="gg-display-segmented" role="group" aria-label={v05.ditherMatrix}>
            {([4, 8] as const).map((size) => (
              <button
                key={size}
                type="button"
                className="gg-seg-btn"
                aria-pressed={ditherOpts.matrixSize === size}
                onClick={() => patchDither({ matrixSize: size })}
              >
                Bayer {size}×{size}
              </button>
            ))}
          </div>
          <label className="gg-display-range">
            <span>{v05.ditherIntensity} · {Math.round(ditherOpts.intensity * 100)}%</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={ditherOpts.intensity}
              onChange={(event) => patchDither({ intensity: event.currentTarget.valueAsNumber })}
            />
          </label>
          <label className="gg-display-range">
            <span>{v05.ditherContrast} · {Math.round(ditherOpts.contrast * 100)}%</span>
            <input
              type="range"
              min="0.6"
              max="2"
              step="0.05"
              value={ditherOpts.contrast}
              onChange={(event) => patchDither({ contrast: event.currentTarget.valueAsNumber })}
            />
          </label>
          <label className="gg-display-range">
            <span>{v05.ditherScale} · {ditherOpts.pixelScale}×</span>
            <input
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={ditherOpts.pixelScale}
              onChange={(event) => patchDither({ pixelScale: event.currentTarget.valueAsNumber })}
            />
          </label>
          <div className="gg-v05-checks gg-v05-checks--columns">
            <label>
              <input
                type="checkbox"
                checked={ditherOpts.edges}
                onChange={(event) => patchDither({ edges: event.currentTarget.checked })}
              />
              {v05.ditherEdges}
            </label>
            <label>
              <input
                type="checkbox"
                checked={ditherOpts.invert}
                onChange={(event) => patchDither({ invert: event.currentTarget.checked })}
              />
              {v05.invertPalette}
            </label>
          </div>
          <div className="gg-display-colors gg-display-colors--2">
            <label>
              <span>{v05.darkTone}</span>
              <input
                type="color"
                value={ditherOpts.darkColor}
                onChange={(event) => patchDither({ darkColor: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>{v05.lightTone}</span>
              <input
                type="color"
                value={ditherOpts.lightColor}
                onChange={(event) => patchDither({ lightColor: event.currentTarget.value })}
              />
            </label>
          </div>
        </section>
      )}

      {!comparison && settings.mode === "clayStudio" && (
        <section className="gg-display-mode-card" aria-label="Ajustes de Clay">
          <div className="gg-display-mode-card__head">
            <strong>Clay</strong>
            <button type="button" className="gg-mini-link-btn" onClick={() => resetActiveMode("clayStudio")} title={v05.resetMode}>
              <RotateCcw size={12} aria-hidden="true" />
              <span>Padrão</span>
            </button>
          </div>
          <label className="gg-display-range">
            <span>{v05.exposure} · {Math.round(displayExposure(settings) * 100)}%</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={displayExposure(settings)}
              onChange={(event) => patchClay({ exposure: event.currentTarget.valueAsNumber })}
            />
          </label>
          <label className="gg-display-range">
            <span>{v05.aoIntensity} · {Math.round((clayOpts.aoIntensity ?? clayDefaults.aoIntensity) * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={clayOpts.aoIntensity ?? clayDefaults.aoIntensity}
              onChange={(event) => patchClay({ aoIntensity: event.currentTarget.valueAsNumber })}
            />
          </label>
          <div className="gg-display-colors gg-display-colors--2">
            <label>
              <span>{v05.surfaceColor}</span>
              <input
                type="color"
                value={profile.material?.color ?? clayDefaults.surfaceColor}
                onChange={(event) => patchClay({ surfaceColor: event.currentTarget.value })}
              />
            </label>
          </div>
        </section>
      )}

      <label>{v05.background}
        <select value={settings.background} onChange={(event) => patch({ background: event.currentTarget.value as DisplaySettings["background"] })}>
          <option value="theme">Tema</option><option value="white">Branco</option><option value="dark">Grafite</option>
        </select>
      </label>
      <div className="gg-v05-checks gg-v05-checks--columns">
        {switches.filter((name) => !comparison || name === "edges").map((name) => (
          <label key={name}>
            <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.currentTarget.checked })} />
            {v05[name]}
          </label>
        ))}
      </div>
      <label>{v05.light} · {Math.round(settings.light * 100)}%
        <input type="range" min="0.2" max="2" step="0.05" value={settings.light} onChange={(event) => patch({ light: Number(event.currentTarget.value) })} />
      </label>
      <label>{v05.opacity} · {Math.round(settings.opacity * 100)}%
        <input type="range" min="0.1" max="1" step="0.05" value={settings.opacity} onChange={(event) => patch({ opacity: Number(event.currentTarget.value) })} />
      </label>
      <label>{v05.quality}
        <select value={settings.quality} onChange={(event) => preferences({ graphicsQuality: event.currentTarget.value as GraphicsQuality })}>
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
