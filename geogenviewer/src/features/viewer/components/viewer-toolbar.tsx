"use client";

import { copy } from "../copy";
import type { CameraCommand, NavigationMode } from "../scene/viewport";
import {
  ClearSelectionIcon,
  ExplodeIcon,
  EyeIcon,
  EyeOffIcon,
  FitViewIcon,
  HandIcon,
  IsolateIcon,
  MultiSelectIcon,
  OrbitIcon,
  ResetCameraIcon,
  RulerIcon,
  SectionIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";
import { ActionTooltip } from "./ui-tooltip";

interface ViewerToolbarProps {
  mode: NavigationMode;
  disabled: boolean;
  multiSelectMode: boolean;
  selectedCount: number;
  hasVisibilityOverrides: boolean;
  onModeChange: (mode: NavigationMode) => void;
  onToggleMultiSelect: () => void;
  onHideSelected: () => void;
  onIsolateSelected: () => void;
  onShowAll: () => void;
  onClearSelection: () => void;
  onCommand: (command: CameraCommand) => void;
}

export function ViewerToolbar({
  mode,
  disabled,
  multiSelectMode,
  selectedCount,
  hasVisibilityOverrides,
  onModeChange,
  onToggleMultiSelect,
  onHideSelected,
  onIsolateSelected,
  onShowAll,
  onClearSelection,
  onCommand,
}: ViewerToolbarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="gg-toolbar-wrap">
      <div className="gg-toolbar" role="toolbar" aria-label="Navegação e inspeção 3D">
        <div className="gg-toolbar__group">
          <ActionTooltip label={copy.orbit} side="top">
            <button
              type="button"
              className="gg-tool-btn"
              disabled={disabled}
              aria-pressed={mode === "orbit"}
              onClick={() => onModeChange("orbit")}
            >
              <OrbitIcon size={15} strokeWidth={1.75} />
              <span className="gg-tool-btn__label">{copy.orbit}</span>
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.pan} side="top">
            <button
              type="button"
              className="gg-tool-btn"
              disabled={disabled}
              aria-pressed={mode === "pan"}
              onClick={() => onModeChange("pan")}
            >
              <HandIcon size={15} strokeWidth={1.75} />
              <span className="gg-tool-btn__label">{copy.pan}</span>
            </button>
          </ActionTooltip>
        </div>

        <span className="gg-toolbar__sep" aria-hidden="true" />

        <div className="gg-toolbar__group">
          <ActionTooltip label={copy.closer} side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled}
              aria-label={copy.closer}
              onClick={() => onCommand({ kind: "closer" })}
            >
              <ZoomInIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.farther} side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled}
              aria-label={copy.farther}
              onClick={() => onCommand({ kind: "farther" })}
            >
              <ZoomOutIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.fit} shortcut="F" side="top">
            <button
              type="button"
              className="gg-tool-btn"
              disabled={disabled}
              aria-keyshortcuts="f"
              onClick={() => onCommand({ kind: "fit" })}
            >
              <FitViewIcon size={15} strokeWidth={1.75} />
              <span className="gg-tool-btn__label">{copy.fit}</span>
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.resetCamera} shortcut="R" side="top">
            <button
              type="button"
              className="gg-tool-btn"
              disabled={disabled}
              aria-keyshortcuts="r"
              onClick={() => onCommand({ kind: "reset" })}
            >
              <ResetCameraIcon size={15} strokeWidth={1.75} />
              <span className="gg-tool-btn__label gg-hide-sm">
                {copy.reset}
              </span>
            </button>
          </ActionTooltip>
        </div>

        <span className="gg-toolbar__sep" aria-hidden="true" />

        <div className="gg-toolbar__group">
          <ActionTooltip label={copy.multiSelect} side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled}
              aria-label={copy.multiSelect}
              aria-pressed={multiSelectMode}
              onClick={onToggleMultiSelect}
            >
              <MultiSelectIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.hideSelected} shortcut="H" side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled || !hasSelection}
              aria-label={copy.hideSelected}
              aria-keyshortcuts="h"
              onClick={onHideSelected}
            >
              <EyeOffIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.isolateSelected} shortcut="I" side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled || !hasSelection}
              aria-label={copy.isolateSelected}
              aria-keyshortcuts="i"
              onClick={onIsolateSelected}
            >
              <IsolateIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          <ActionTooltip label={copy.showAll} shortcut="A" side="top">
            <button
              type="button"
              className="gg-tool-btn gg-tool-btn--compact"
              disabled={disabled || !hasVisibilityOverrides}
              aria-label={copy.showAll}
              aria-keyshortcuts="a"
              onClick={onShowAll}
            >
              <EyeIcon size={15} strokeWidth={1.75} />
            </button>
          </ActionTooltip>

          {hasSelection && (
            <ActionTooltip label={copy.clearSelection} shortcut="Esc" side="top">
              <button
                type="button"
                className="gg-tool-btn gg-tool-btn--compact"
                disabled={disabled}
                aria-label={copy.clearSelection}
                onClick={onClearSelection}
              >
                <ClearSelectionIcon size={15} strokeWidth={1.75} />
              </button>
            </ActionTooltip>
          )}
        </div>

        <span className="gg-toolbar__sep gg-hide-md" aria-hidden="true" />

        <div
          className="gg-toolbar__group gg-toolbar__group--future gg-hide-md"
          aria-label={copy.futureDisabledHint}
        >
          <button
            type="button"
            className="gg-tool-btn gg-tool-btn--future"
            disabled
            title={`${copy.futureExplode} — ${copy.futureDisabledHint} (${copy.futureBadgeV04})`}
          >
            <ExplodeIcon size={15} strokeWidth={1.75} />
            <span className="gg-tool-btn__label">{copy.futureExplode}</span>
            <span className="gg-mini-tag">{copy.futureBadgeV04}</span>
          </button>

          <button
            type="button"
            className="gg-tool-btn gg-tool-btn--future gg-hide-lg"
            disabled
            title={`${copy.futureSection} — ${copy.futureDisabledHint} (${copy.futureBadgeV06})`}
          >
            <SectionIcon size={15} strokeWidth={1.75} />
            <span className="gg-tool-btn__label">{copy.futureSection}</span>
            <span className="gg-mini-tag">{copy.futureBadgeV06}</span>
          </button>

          <button
            type="button"
            className="gg-tool-btn gg-tool-btn--future gg-hide-lg"
            disabled
            title={`${copy.futureMeasure} — ${copy.futureDisabledHint} (${copy.futureBadgeV06})`}
          >
            <RulerIcon size={15} strokeWidth={1.75} />
            <span className="gg-tool-btn__label">{copy.futureMeasure}</span>
            <span className="gg-mini-tag">{copy.futureBadgeV06}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
