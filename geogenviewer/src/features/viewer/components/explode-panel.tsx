"use client";

import { useEffect, useId, useRef } from "react";
import type {
  ExplodeAxisCad,
  ExplodeGranularity,
  ExplodeMode,
  ExplodeScope,
} from "../../../lib/geogen/explode/controller";
import { copy } from "../copy";
import { useViewerStore } from "../state/viewer-store";
import {
  AxisIcon,
  CloseIcon,
  DirectionalIcon,
  ExplodeIcon,
  HierarchyExplodeIcon,
  PauseIcon,
  PlayIcon,
  RadialIcon,
  ResetCameraIcon,
  TrailLinesIcon,
} from "./icons";

export function ExplodePanel({
  subscribeLiveFactor,
  onClose,
}: {
  subscribeLiveFactor: (listener: (factor: number) => void) => () => void;
  onClose: () => void;
}) {
  const sliderId = useId();
  const numberId = useId();
  const modeId = useId();
  const scopeId = useId();
  const granId = useId();
  const layerSelectId = useId();
  const groupSelectId = useId();
  const dirXId = useId();
  const dirYId = useId();
  const dirZId = useId();

  const rangeRef = useRef<HTMLInputElement>(null);
  const readRef = useRef<HTMLInputElement>(null);

  const sceneGraph = useViewerStore((s) => s.sceneGraph);
  const selectedIds = useViewerStore((s) => s.selectedIds);
  const explode = useViewerStore((s) => s.explode);
  const explodeTransition = useViewerStore((s) => s.explodeTransition);

  const setExplodeFactor = useViewerStore((s) => s.setExplodeFactor);
  const patchExplode = useViewerStore((s) => s.patchExplode);
  const startExplodeAnimation = useViewerStore((s) => s.startExplodeAnimation);
  const stopExplodeAnimation = useViewerStore((s) => s.stopExplodeAnimation);
  const resetExplode = useViewerStore((s) => s.resetExplode);

  // Sync live factor into slider & number field during 60fps animation without re-rendering React tree
  useEffect(() => {
    return subscribeLiveFactor((liveFactor) => {
      if (rangeRef.current) {
        rangeRef.current.value = String(liveFactor);
      }
      if (readRef.current) {
        readRef.current.value = liveFactor.toFixed(2);
      }
    });
  }, [subscribeLiveFactor]);

  if (!sceneGraph) return null;

  const layers = Object.values(sceneGraph.layers);
  const groups = Object.values(sceneGraph.groups);
  const isAnimating = explodeTransition !== null;

  const presets: Array<{ label: string; factor: number }> = [
    { label: copy.explodePresetRest, factor: 0 },
    { label: copy.explodePresetLight, factor: 0.35 },
    { label: copy.explodePresetMedium, factor: 0.65 },
    { label: copy.explodePresetFull, factor: 1.0 },
  ];

  const modes: Array<{ key: ExplodeMode; label: string; Icon: typeof RadialIcon }> = [
    { key: "radial", label: copy.explodeModeRadial, Icon: RadialIcon },
    { key: "axial", label: copy.explodeModeAxial, Icon: AxisIcon },
    { key: "directional", label: copy.explodeModeDirectional, Icon: DirectionalIcon },
    { key: "hierarchical", label: copy.explodeModeHierarchical, Icon: HierarchyExplodeIcon },
  ];

  function handlePauseOrPlay() {
    if (isAnimating) {
      const cur = rangeRef.current
        ? Number.parseFloat(rangeRef.current.value)
        : explode.factor;
      stopExplodeAnimation(Number.isFinite(cur) ? cur : explode.factor);
      return;
    }
    const target = explode.factor >= 0.85 ? 0 : 1.0;
    startExplodeAnimation(target);
  }

  return (
    <section
      className="gg-explode-popover"
      aria-label={copy.explodeTitle}
      role="region"
    >
      <div className="gg-explode-popover__head">
        <div className="gg-panel__title-group">
          <ExplodeIcon size={14} strokeWidth={1.75} />
          <span>{copy.explodeTitle}</span>
        </div>
        <button
          type="button"
          className="gg-btn gg-btn--ghost gg-btn--icon-sm"
          aria-label={copy.panelClose}
          onClick={onClose}
        >
          <CloseIcon size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="gg-explode-popover__body">
        {/* Slider + Numeric Factor */}
        <div className="gg-explode-field">
          <div className="gg-explode-field__head">
            <label htmlFor={sliderId} className="gg-explode-label">
              {copy.explodeFactorLabel}
            </label>
            <div className="gg-explode-num-wrap">
              <label htmlFor={numberId} className="visually-hidden">
                {copy.explodeFactorLabel}
              </label>
              <input
                ref={readRef}
                id={numberId}
                type="number"
                min={0}
                max={1.5}
                step={0.05}
                className="gg-input-num gg-mono gg-tabular"
                value={Number(explode.factor.toFixed(2))}
                onChange={(e) => {
                  const val = Number.parseFloat(e.currentTarget.value);
                  setExplodeFactor(Number.isFinite(val) ? val : 0);
                }}
              />
            </div>
          </div>

          <input
            ref={rangeRef}
            id={sliderId}
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            className="gg-range"
            value={explode.factor}
            onChange={(e) => setExplodeFactor(Number.parseFloat(e.currentTarget.value))}
          />

          <div className="gg-explode-presets" role="group" aria-label={copy.explodePresetsLabel}>
            {presets.map((p) => {
              const active = Math.abs(explode.factor - p.factor) < 0.015;
              return (
                <button
                  key={p.label}
                  type="button"
                  className="gg-preset-btn"
                  aria-pressed={active}
                  onClick={() => startExplodeAnimation(p.factor)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Animation & Restore Actions */}
        <div className="gg-explode-playback">
          <button
            type="button"
            className="gg-btn gg-btn--primary gg-btn--xs gg-explode-playback__play"
            onClick={handlePauseOrPlay}
          >
            {isAnimating ? (
              <PauseIcon size={13} strokeWidth={1.75} />
            ) : (
              <PlayIcon size={13} strokeWidth={1.75} />
            )}
            <span>
              {isAnimating
                ? copy.explodePause
                : explode.factor >= 0.85
                  ? copy.explodePlayToRest
                  : copy.explodePlayToExploded}
            </span>
          </button>

          <button
            type="button"
            className="gg-btn gg-btn--secondary gg-btn--xs"
            disabled={explode.factor <= 1e-6 && !isAnimating}
            onClick={resetExplode}
          >
            <ResetCameraIcon size={13} strokeWidth={1.75} />
            <span>{copy.explodeReset}</span>
          </button>
        </div>

        {/* Mode Selection */}
        <div className="gg-explode-field">
          <span id={modeId} className="gg-explode-label">
            {copy.explodeModeLabel}
          </span>
          <div className="gg-segmented-4" role="group" aria-labelledby={modeId}>
            {modes.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className="gg-seg-btn"
                aria-pressed={explode.mode === key}
                onClick={() => patchExplode({ mode: key, enabled: true })}
              >
                <Icon size={12} strokeWidth={1.75} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Axis CAD Selector (when Axial) */}
        {explode.mode === "axial" && (
          <div className="gg-explode-field">
            <div className="gg-explode-field__head">
              <span className="gg-explode-label">{copy.explodeAxisLabel}</span>
              <span className="gg-explode-hint">{copy.explodeAxisHintCad}</span>
            </div>
            <div className="gg-segmented-3" role="group" aria-label={copy.explodeAxisLabel}>
              {(["X", "Y", "Z"] as ExplodeAxisCad[]).map((ax) => (
                <button
                  key={ax}
                  type="button"
                  className="gg-seg-btn gg-mono"
                  aria-pressed={explode.axis === ax}
                  onClick={() => patchExplode({ axis: ax, enabled: true })}
                >
                  {ax === "X" ? "X" : ax === "Y" ? "Y" : "Z (Vert.)"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Directional Vector CAD Inputs */}
        {explode.mode === "directional" && (
          <div className="gg-explode-field">
            <span className="gg-explode-label">{copy.explodeDirectionLabel}</span>
            <div className="gg-vec3-inputs">
              {(
                [
                  [dirXId, "X", 0],
                  [dirYId, "Y", 1],
                  [dirZId, "Z", 2],
                ] as const
              ).map(([id, axisChar, idx]) => (
                <div key={axisChar} className="gg-vec3-cell">
                  <label htmlFor={id} className="gg-vec3-axis gg-mono">
                    {axisChar}
                  </label>
                  <input
                    id={id}
                    type="number"
                    step={0.5}
                    className="gg-input-num gg-mono gg-tabular"
                    value={explode.customDirectionCad[idx]}
                    onChange={(e) => {
                      const val = Number.parseFloat(e.currentTarget.value);
                      const next: [number, number, number] = [
                        ...explode.customDirectionCad,
                      ];
                      next[idx] = Number.isFinite(val) ? val : 0;
                      patchExplode({ customDirectionCad: next, enabled: true });
                    }}
                  />
                </div>
              ))}
            </div>
            {sceneGraph.mode === "manifest-full" && (
              <label className="gg-check-row">
                <input
                  type="checkbox"
                  checked={explode.useManifestHints}
                  onChange={(e) =>
                    patchExplode({ useManifestHints: e.currentTarget.checked })
                  }
                />
                <span>{copy.explodeUseManifestHints}</span>
              </label>
            )}
          </div>
        )}

        {/* Scope vs Granularity (explicitly differentiated) */}
        <div className="gg-explode-grid-2">
          <div className="gg-explode-field">
            <label htmlFor={scopeId} className="gg-explode-label">
              {copy.explodeScopeLabel}
            </label>
            <select
              id={scopeId}
              className="gg-select"
              value={explode.scope}
              onChange={(e) =>
                patchExplode({
                  scope: e.currentTarget.value as ExplodeScope,
                  enabled: true,
                })
              }
            >
              <option value="all">{copy.explodeScopeAll}</option>
              <option value="selection">
                {copy.explodeScopeSelection} ({selectedIds.length})
              </option>
              {layers.length > 0 && (
                <option value="layer">{copy.explodeScopeLayer}</option>
              )}
              {groups.length > 0 && (
                <option value="group">{copy.explodeScopeGroup}</option>
              )}
            </select>
          </div>

          <div className="gg-explode-field">
            <label htmlFor={granId} className="gg-explode-label">
              {copy.explodeGranularityLabel}
            </label>
            <select
              id={granId}
              className="gg-select"
              value={explode.granularity}
              onChange={(e) =>
                patchExplode({
                  granularity: e.currentTarget.value as ExplodeGranularity,
                  enabled: true,
                })
              }
            >
              <option value="component">{copy.explodeGranularityComponent}</option>
              {layers.length > 0 && (
                <option value="layer">{copy.explodeGranularityLayer}</option>
              )}
              {groups.length > 0 && (
                <option value="group">{copy.explodeGranularityGroup}</option>
              )}
            </select>
          </div>
        </div>

        {explode.scope === "selection" && selectedIds.length === 0 && (
          <p className="gg-helper-note">{copy.explodeScopeSelectionEmptyHint}</p>
        )}

        {explode.scope === "layer" && layers.length > 0 && (
          <div className="gg-explode-field">
            <label htmlFor={layerSelectId} className="gg-explode-label">
              {copy.explodeTargetLayerLabel}
            </label>
            <select
              id={layerSelectId}
              className="gg-select"
              value={explode.scopeLayerId ?? layers[0]?.id ?? ""}
              onChange={(e) =>
                patchExplode({ scopeLayerId: e.currentTarget.value || null })
              }
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullPath}
                </option>
              ))}
            </select>
          </div>
        )}

        {explode.scope === "group" && groups.length > 0 && (
          <div className="gg-explode-field">
            <label htmlFor={groupSelectId} className="gg-explode-label">
              {copy.explodeTargetGroupLabel}
            </label>
            <select
              id={groupSelectId}
              className="gg-select"
              value={explode.scopeGroupId ?? groups[0]?.id ?? ""}
              onChange={(e) =>
                patchExplode({ scopeGroupId: e.currentTarget.value || null })
              }
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reference Lines Toggle */}
        <button
          type="button"
          className="gg-ref-lines-toggle"
          aria-pressed={explode.showReferenceLines}
          onClick={() =>
            patchExplode({ showReferenceLines: !explode.showReferenceLines })
          }
        >
          <TrailLinesIcon size={14} strokeWidth={1.75} />
          <span>{copy.explodeRefLines}</span>
          <span className="gg-badge gg-badge--neutral gg-mono">
            {explode.showReferenceLines ? copy.boolYes : copy.boolNo}
          </span>
        </button>
      </div>
    </section>
  );
}
