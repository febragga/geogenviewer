"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import type { ViewerSceneGraph } from "../../../lib/geogen/domain/model";
import { copy } from "../copy";
import { v06 } from "../v06-copy";
import { useViewerStore, type Workspace } from "../state/viewer-store";
import { v05, workspaces } from "../v05-copy";
import {
  BrandMarkIcon,
  CommandIcon,
  CubeIcon,
  FolderOpenIcon,
  HelpIcon,
  ManifestIcon,
  MaximizeIcon,
  MoreIcon,
  PavilionIcon,
  SidebarLeftIcon,
  SidebarRightIcon,
} from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { ActionTooltip } from "./ui-tooltip";

interface ViewerTopbarProps {
  modelName?: string;
  revision?: string | null;
  sceneMode?: ViewerSceneGraph["mode"];
  isBusy: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onOpenFile: () => void;
  onLoadDemo: () => void;
  onLoadContractDemo: () => void;
  onLoadExplodeDemo: () => void;
  onLoadInspectionDemo: () => void;
  onOpenHelp: () => void;
  onOpenCommand: () => void;
  onEnterFocusMode: () => void;
  onToggleTheme: () => void;
}

export function ViewerTopbar({
  modelName,
  revision,
  sceneMode,
  isBusy,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onOpenFile,
  onLoadDemo,
  onLoadContractDemo,
  onLoadExplodeDemo,
  onLoadInspectionDemo,
  onOpenHelp,
  onOpenCommand,
  onEnterFocusMode,
  onToggleTheme,
}: ViewerTopbarProps) {
  const workspace = useViewerStore((state) => state.workspace);
  const setWorkspace = useViewerStore((state) => state.setWorkspace);
  return (
    <header className="gg-topbar" data-model={Boolean(modelName)}>
      <div className="gg-topbar__identity">
        <Link
          href="/"
          className="gg-brand"
          aria-label={`${copy.title} — ${copy.backHome}`}
        >
          <BrandMarkIcon className="gg-brand__mark" />
          <span className="gg-brand__name">{copy.title}</span>
        </Link>
        <span className="gg-topbar__divider" aria-hidden="true" />
        <div className="gg-topbar__model">
          <h1 className="gg-topbar__title">{modelName ?? copy.noModel}</h1>
          {revision && <span className="gg-topbar__revision gg-mono" title={"Revisão " + revision}>{revision}</span>}
          {modelName && (
            <span
              className={`gg-badge ${
                sceneMode === "manifest-full"
                  ? "gg-badge--accent"
                  : "gg-badge--neutral"
              }`}
            >
              {sceneMode === "manifest-full" ? copy.modeManifest : copy.modeBasic}
            </span>
          )}
        </div>
      </div>

      {modelName && <label className="gg-workspace-picker">
        <span className="visually-hidden">{v05.workspace}</span>
        <select value={workspace} onChange={(event) => setWorkspace(event.currentTarget.value as Workspace)}>
          {Object.entries(workspaces).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
        </select>
      </label>}

      <div className="gg-topbar__actions">
        <div
          className="gg-topbar__panel-toggles"
          role="group"
          aria-label="Painéis"
        >
          <ActionTooltip label={copy.panelStructure} shortcut="[">
            <button
              type="button"
              className="gg-btn gg-btn--ghost gg-btn--icon"
              aria-pressed={leftOpen}
              aria-label={copy.panelToggleLeft}
              aria-keyshortcuts="["
              onClick={onToggleLeft}
            >
              <SidebarLeftIcon size={16} strokeWidth={1.75} />
            </button>
          </ActionTooltip>
          <ActionTooltip label={copy.panelProperties} shortcut="]">
            <button
              type="button"
              className="gg-btn gg-btn--ghost gg-btn--icon"
              aria-pressed={rightOpen}
              aria-label={copy.panelToggleRight}
              aria-keyshortcuts="]"
              onClick={onToggleRight}
            >
              <SidebarRightIcon size={16} strokeWidth={1.75} />
            </button>
          </ActionTooltip>
        </div>

        <ActionTooltip label={copy.commandTitle} shortcut="Ctrl+K">
          <button
            type="button"
            className="gg-btn gg-btn--secondary gg-cmd-trigger gg-hide-sm"
            aria-keyshortcuts="Control+k Meta+k"
            onClick={onOpenCommand}
          >
            <CommandIcon size={14} strokeWidth={1.75} />
            <span className="visually-hidden">{copy.commandTitle}</span>
            <span className="gg-cmd-trigger__kbd gg-mono" aria-hidden="true">
              ⌘K
            </span>
          </button>
        </ActionTooltip>

        <button
          type="button"
          className="gg-btn gg-btn--primary"
          disabled={isBusy}
          onClick={onOpenFile}
        >
          <FolderOpenIcon size={15} strokeWidth={1.75} />
          <span className="gg-open-label-full">
            {modelName ? copy.replaceGlb : copy.open}
          </span>
          <span className="gg-open-label-short">{copy.openShort}</span>
        </button>

        <ActionTooltip label={copy.focusModeEnter}>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon gg-hide-sm"
            aria-label={copy.focusModeEnter}
            onClick={onEnterFocusMode}
          >
            <MaximizeIcon size={16} strokeWidth={1.75} />
          </button>
        </ActionTooltip>

        <ActionTooltip label={copy.controlsTitle}>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon gg-hide-sm"
            aria-label={copy.controlsTitle}
            onClick={onOpenHelp}
          >
            <HelpIcon size={16} strokeWidth={1.75} />
          </button>
        </ActionTooltip>

        <ThemeToggle className="gg-hide-sm" />

        <div className="gg-topbar__menu">
          <Menu.Root>
            <Menu.Trigger
              className="gg-btn gg-btn--ghost gg-btn--icon"
              aria-label={copy.moreActions}
            >
              <MoreIcon size={16} strokeWidth={1.75} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={6} align="end" className="gg-menu-pos">
                <Menu.Popup className="gg-popover-menu">
                  <Menu.Item
                    className="gg-menu-item"
                    disabled={isBusy}
                    onClick={onLoadExplodeDemo}
                  >
                    <PavilionIcon size={15} strokeWidth={1.75} />
                    <span>{copy.demoExplode}</span>
                  </Menu.Item>
                  <Menu.Item
                    className="gg-menu-item"
                    disabled={isBusy}
                    onClick={onLoadContractDemo}
                  >
                    <ManifestIcon size={15} strokeWidth={1.75} />
                    <span>{copy.demoContract}</span>
                  </Menu.Item>
                  <Menu.Item
                    className="gg-menu-item"
                    disabled={isBusy}
                    onClick={onLoadDemo}
                  >
                    <CubeIcon size={15} strokeWidth={1.75} />
                    <span>{copy.demo}</span>
                  </Menu.Item>
                  <Menu.Item className="gg-menu-item" disabled={isBusy} onClick={onLoadInspectionDemo}>
                    <CubeIcon size={15} strokeWidth={1.75} /><span>{v06.lab}</span>
                  </Menu.Item>
                  <Menu.Item className="gg-menu-item" onClick={onOpenCommand}>
                    <CommandIcon size={15} strokeWidth={1.75} />
                    <span>{copy.commandTitle}</span>
                  </Menu.Item>
                  <Menu.Item className="gg-menu-item" onClick={onEnterFocusMode}>
                    <MaximizeIcon size={15} strokeWidth={1.75} />
                    <span>{copy.focusModeEnter}</span>
                  </Menu.Item>
                  <Menu.Item className="gg-menu-item" onClick={onOpenHelp}>
                    <HelpIcon size={15} strokeWidth={1.75} />
                    <span>{copy.controlsTitle}</span>
                  </Menu.Item>
                  <Menu.Separator className="gg-menu-sep" />
                  <Menu.Item className="gg-menu-item" onClick={onToggleTheme}>
                    <span className="gg-menu-item__grow">
                      {copy.themeSectionLabel}
                    </span>
                    <span className="gg-badge gg-badge--neutral">
                      Claro / Escuro
                    </span>
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
    </header>
  );
}
