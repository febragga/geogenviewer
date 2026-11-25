"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Command } from "cmdk";
import { useState } from "react";
import { copy } from "../copy";
import {
  CloseIcon,
  CubeIcon,
  FitViewIcon,
  FolderOpenIcon,
  HandIcon,
  HelpIcon,
  MaximizeIcon,
  OrbitIcon,
  ResetCameraIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  SunIcon,
} from "./icons";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasModel: boolean;
  isLost: boolean;
  isBusy: boolean;
  onOpenFile: () => void;
  onLoadDemo: () => void;
  onFit: () => void;
  onReset: () => void;
  onSetOrbit: () => void;
  onSetPan: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
  onOpenHelp: () => void;
  onToggleTheme: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  hasModel,
  isLost,
  isBusy,
  onOpenFile,
  onLoadDemo,
  onFit,
  onReset,
  onSetOrbit,
  onSetPan,
  onToggleLeft,
  onToggleRight,
  onToggleFocus,
  onOpenHelp,
  onToggleTheme,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const cameraDisabled = !hasModel || isLost;

  function run(action: () => void) {
    onOpenChange(false);
    setSearch("");
    action();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="gg-cmd-overlay" />
        <Dialog.Popup className="gg-cmd-popup" aria-label={copy.commandTitle}>
          <Dialog.Title className="visually-hidden">
            {copy.commandTitle}
          </Dialog.Title>
          <Command label={copy.commandTitle} className="gg-cmd" loop>
            <div className="gg-cmd__head">
              <span className="gg-section-index gg-technical-label">
                {copy.commandTitle}
              </span>
              <Dialog.Close
                className="gg-cmd__close"
                aria-label={copy.controlsClose}
              >
                <CloseIcon width={14} height={14} />
                <span>Esc</span>
              </Dialog.Close>
            </div>

            <div className="gg-cmd__input-wrap">
              <span className="gg-cmd__prompt" aria-hidden="true">
                &gt;
              </span>
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={copy.commandPlaceholder}
                className="gg-cmd__input"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="gg-cmd__clear"
                  onClick={() => setSearch("")}
                >
                  {copy.commandClear}
                </button>
              )}
            </div>

            <Command.List className="gg-cmd__list">
              <Command.Empty className="gg-cmd__empty">
                {copy.commandEmpty}
              </Command.Empty>

              <Command.Group heading={copy.commandGroupFile} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  disabled={isBusy}
                  onSelect={() => run(onOpenFile)}
                >
                  <FolderOpenIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.open}</span>
                  <span className="gg-cmd__meta">Local · GLB 2.0</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={isBusy}
                  onSelect={() => run(onLoadDemo)}
                >
                  <CubeIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.demo}</span>
                  <span className="gg-cmd__meta">estrutura.glb</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={copy.commandGroupCamera} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onFit)}
                >
                  <FitViewIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.fit}</span>
                  <kbd className="gg-cmd__kbd">F</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onReset)}
                >
                  <ResetCameraIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.resetCamera}</span>
                  <kbd className="gg-cmd__kbd">R</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onSetOrbit)}
                >
                  <OrbitIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.orbit}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onSetPan)}
                >
                  <HandIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.pan}</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={copy.commandGroupInterface} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onToggleLeft)}
                >
                  <SidebarLeftIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.panelToggleLeft}</span>
                  <kbd className="gg-cmd__kbd">[</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onToggleRight)}
                >
                  <SidebarRightIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.panelToggleRight}</span>
                  <kbd className="gg-cmd__kbd">]</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onToggleFocus)}
                >
                  <MaximizeIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.focusModeEnter}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onToggleTheme)}
                >
                  <SunIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.themeSectionLabel}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onOpenHelp)}
                >
                  <HelpIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.controlsTitle}</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
