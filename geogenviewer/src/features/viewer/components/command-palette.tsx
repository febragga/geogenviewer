"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Command } from "cmdk";
import { useState } from "react";
import { normalizeSearch } from "../../../lib/geogen/domain/visibility";
import { copy } from "../copy";
import { presets, workspaces } from "../v05-copy";
import { useOrganizationStore } from "../state/organization-store";
import { usePresentation } from "../state/presentation-store";
import { useViewerStore, type Workspace } from "../state/viewer-store";
import {
  AxisIcon,
  ClearSelectionIcon,
  CloseIcon,
  CubeIcon,
  ExplodeIcon,
  EyeIcon,
  EyeOffIcon,
  FitViewIcon,
  FolderOpenIcon,
  GroupIcon,
  HandIcon,
  HelpIcon,
  HomeIcon,
  IsolateIcon,
  LayersIcon,
  ManifestIcon,
  MaximizeIcon,
  MultiSelectIcon,
  OrbitIcon,
  PavilionIcon,
  RadialIcon,
  ResetCameraIcon,
  SettingsIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
  SunIcon,
  TrailLinesIcon,
} from "./icons";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasModel: boolean;
  isLost: boolean;
  isBusy: boolean;
  hasSelection: boolean;
  hasVisibilityOverrides: boolean;
  onOpenFile: () => void;
  onLoadDemo: () => void;
  onLoadContractDemo: () => void;
  onLoadExplodeDemo: () => void;
  onFit: () => void;
  onReset: () => void;
  onSetOrbit: () => void;
  onSetPan: () => void;
  onHideSelected: () => void;
  onIsolateSelected: () => void;
  onShowAll: () => void;
  onClearSelection: () => void;
  onToggleMultiSelect: () => void;
  onToggleExplodePanel: () => void;
  onExplodeReset: () => void;
  onExplodeRadial: () => void;
  onExplodeAxial: (axis: "X" | "Y" | "Z") => void;
  onToggleRefLines: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
  onOpenHelp: () => void;
  onOpenSettings?: () => void;
  onToggleTheme: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  hasModel,
  isLost,
  isBusy,
  hasSelection,
  hasVisibilityOverrides,
  onOpenFile,
  onLoadDemo,
  onLoadContractDemo,
  onLoadExplodeDemo,
  onFit,
  onReset,
  onSetOrbit,
  onSetPan,
  onHideSelected,
  onIsolateSelected,
  onShowAll,
  onClearSelection,
  onToggleMultiSelect,
  onToggleExplodePanel,
  onExplodeReset,
  onExplodeRadial,
  onExplodeAxial,
  onToggleRefLines,
  onToggleLeft,
  onToggleRight,
  onToggleFocus,
  onOpenHelp,
  onOpenSettings,
  onToggleTheme,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const cameraDisabled = !hasModel || isLost;
  const userLayers = useOrganizationStore((s) => s.doc.userLayers);
  const userGroups = useOrganizationStore((s) => s.doc.userGroups);
  const componentAssignments = useOrganizationStore((s) => s.doc.componentLayerAssignments);
  const setWorkspace = useViewerStore((s) => s.setWorkspace);
  const selectMany = useViewerStore((s) => s.selectMany);
  const showNavCube = usePresentation((s) => s.showNavCube);
  const setShowNavCube = usePresentation((s) => s.setShowNavCube);

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
          <Command
            label={copy.commandTitle}
            className="gg-cmd"
            loop
            filter={(value, query) => (normalizeSearch(value).includes(normalizeSearch(query.trim())) ? 1 : 0)}
          >
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
                  <span className="gg-cmd__meta">GLB / JSON</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={isBusy}
                  onSelect={() => run(onLoadExplodeDemo)}
                >
                  <PavilionIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.demoExplode}</span>
                  <span className="gg-cmd__meta">18 peças · Demonstração</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={isBusy}
                  onSelect={() => run(onLoadContractDemo)}
                >
                  <ManifestIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.demoContract}</span>
                  <span className="gg-cmd__meta">GLB + JSON v1.0</span>
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

              <Command.Group heading={copy.commandGroupExplode} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onToggleExplodePanel)}
                >
                  <ExplodeIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeToggle}</span>
                  <kbd className="gg-cmd__kbd">E</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onExplodeReset)}
                >
                  <ResetCameraIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeReset}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onExplodeRadial)}
                >
                  <RadialIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeRadial}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(() => onExplodeAxial("X"))}
                >
                  <AxisIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeAxialX}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(() => onExplodeAxial("Y"))}
                >
                  <AxisIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeAxialY}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(() => onExplodeAxial("Z"))}
                >
                  <AxisIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeAxialZ}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onToggleRefLines)}
                >
                  <TrailLinesIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.commandExplodeRefLines}</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={copy.commandGroupSelection} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onToggleMultiSelect)}
                >
                  <MultiSelectIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.multiSelect}</span>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled || !hasSelection}
                  onSelect={() => run(onHideSelected)}
                >
                  <EyeOffIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.hideSelected}</span>
                  <kbd className="gg-cmd__kbd">H</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled || !hasSelection}
                  onSelect={() => run(onIsolateSelected)}
                >
                  <IsolateIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.isolateSelected}</span>
                  <kbd className="gg-cmd__kbd">I</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled || !hasVisibilityOverrides}
                  onSelect={() => run(onShowAll)}
                >
                  <EyeIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.showAll}</span>
                  <kbd className="gg-cmd__kbd">A</kbd>
                </Command.Item>
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled || !hasSelection}
                  onSelect={() => run(onClearSelection)}
                >
                  <ClearSelectionIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.clearSelection}</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={copy.commandGroupCamera} className="gg-cmd__group">
                <Command.Item
                  className="gg-cmd__item"
                  disabled={cameraDisabled}
                  onSelect={() => run(onFit)}
                >
                  <FitViewIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.fitExploded}</span>
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
                  onSelect={() => run(() => setShowNavCube(!showNavCube))}
                >
                  <HomeIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">
                    {showNavCube ? "Ocultar Cubo de Navegação 3D" : "Exibir Cubo de Navegação 3D"}
                  </span>
                </Command.Item>
                {onOpenSettings && (
                  <Command.Item
                    className="gg-cmd__item"
                    onSelect={() => run(onOpenSettings)}
                  >
                    <SettingsIcon className="gg-cmd__icon" />
                    <span className="gg-cmd__label">Abrir configurações</span>
                  </Command.Item>
                )}
                <Command.Item
                  className="gg-cmd__item"
                  onSelect={() => run(onOpenHelp)}
                >
                  <HelpIcon className="gg-cmd__icon" />
                  <span className="gg-cmd__label">{copy.controlsTitle}</span>
                </Command.Item>
              </Command.Group>

              {hasModel && (
                <Command.Group heading="Workspaces" className="gg-cmd__group">
                  {(Object.keys(workspaces) as Workspace[]).map((id) => (
                    <Command.Item
                      key={`ws:${id}`}
                      value={`workspace ${workspaces[id]} ${id}`}
                      className="gg-cmd__item"
                      onSelect={() => run(() => setWorkspace(id))}
                    >
                      <CubeIcon className="gg-cmd__icon" />
                      <span className="gg-cmd__label">Workspace: {workspaces[id]}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {hasModel && !isLost && (
                <Command.Group heading="Vistas padrão" className="gg-cmd__group">
                  {(["perspective", "top", "front", "right", "left", "back", "bottom"] as const).map((preset) => (
                    <Command.Item
                      key={`view:${preset}`}
                      value={`vista ${presets[preset]} ${preset}`}
                      className="gg-cmd__item"
                      onSelect={() => run(() => usePresentation.getState().access?.preset(preset))}
                    >
                      <FitViewIcon className="gg-cmd__icon" />
                      <span className="gg-cmd__label">Vista {presets[preset]}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {hasModel && userLayers.length > 0 && (
                <Command.Group heading="Camadas do usuário" className="gg-cmd__group">
                  {userLayers.slice(0, 12).map((ul) => {
                    const members = Object.entries(componentAssignments)
                      .filter(([, lid]) => lid === ul.id)
                      .map(([cid]) => cid);
                    return (
                      <Command.Item
                        key={`cmd-ul:${ul.id}`}
                        value={`camada usuario ${ul.name}`}
                        className="gg-cmd__item"
                        onSelect={() => run(() => selectMany(members))}
                      >
                        <LayersIcon className="gg-cmd__icon" />
                        <span className="gg-cmd__label">Selecionar camada: {ul.name}</span>
                        <span className="gg-cmd__meta">{members.length}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {hasModel && userGroups.length > 0 && (
                <Command.Group heading="Grupos do usuário" className="gg-cmd__group">
                  {userGroups.slice(0, 12).map((ug) => (
                    <Command.Item
                      key={`cmd-ug:${ug.id}`}
                      value={`grupo usuario ${ug.name}`}
                      className="gg-cmd__item"
                      onSelect={() => run(() => selectMany(ug.memberIds))}
                    >
                      <GroupIcon className="gg-cmd__icon" />
                      <span className="gg-cmd__label">Selecionar grupo: {ug.name}</span>
                      <span className="gg-cmd__meta">{ug.memberIds.length}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
