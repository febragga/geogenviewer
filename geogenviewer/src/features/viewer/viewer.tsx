"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Vector3 } from "three";
import {
  importGlb,
  maxGlbBytes,
  type ImportedModel,
} from "../../lib/geogen/importers/glb";
import { CommandPalette } from "./components/command-palette";
import { ControlsDialog } from "./components/controls-dialog";
import {
  AlertIcon,
  CloseIcon,
  CubeIcon,
  FolderOpenIcon,
} from "./components/icons";
import { toggleColorScheme } from "./components/theme-toggle";
import {
  LeftHierarchyPanel,
  MobileBottomSheet,
  RightPropertiesPanel,
  type SceneNodeSummary,
  type SceneSummary,
} from "./components/viewer-panels";
import { ViewerToolbar } from "./components/viewer-toolbar";
import { ViewerTopbar } from "./components/viewer-topbar";
import { copy } from "./copy";
import type { CameraCommand, NavigationMode } from "./scene/viewport";

const Viewport = dynamic(() => import("./scene/viewport"), { ssr: false });

function createMediaStore(query: string) {
  return {
    subscribe(callback: () => void) {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    getSnapshot() {
      return window.matchMedia(query).matches;
    },
    getServerSnapshot() {
      return false;
    },
  };
}

const wideDesktopStore = createMediaStore("(min-width: 1180px)");
const desktopLayoutStore = createMediaStore("(min-width: 1024px)");

function summarizeScene(
  model: ImportedModel,
  fileSizeBytes: number
): SceneSummary {
  let nodeCount = 0;
  let meshCount = 0;
  model.scene.traverse((obj) => {
    if (obj !== model.scene) nodeCount += 1;
    if ((obj as { isMesh?: boolean }).isMesh) meshCount += 1;
  });
  const size = model.bounds.getSize(new Vector3());
  const rootNodes: SceneNodeSummary[] = model.scene.children.map(
    (child, index) => ({
      key: `${child.uuid}-${index}`,
      name: child.name?.trim() || `Nó ${index + 1}`,
      elementId:
        typeof child.userData?.geogenElementId === "string"
          ? child.userData.geogenElementId
          : null,
      hasMesh: Boolean((child as { isMesh?: boolean }).isMesh),
    })
  );
  return {
    fileSizeBytes,
    nodeCount,
    meshCount,
    boundsMeters: [size.x, size.y, size.z],
    rootNodes,
  };
}

export function Viewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const dragDepthRef = useRef(0);

  const [loaded, setLoaded] = useState<{
    model: ImportedModel;
    name: string;
    id: number;
    summary: SceneSummary;
  }>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lost, setLost] = useState(false);
  const [mode, setMode] = useState<NavigationMode>("orbit");
  const [command, setCommand] = useState<CameraCommand>({ kind: "reset" });
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const isWideDesktop = useSyncExternalStore(
    wideDesktopStore.subscribe,
    wideDesktopStore.getSnapshot,
    wideDesktopStore.getServerSnapshot
  );
  const isDesktopLayout = useSyncExternalStore(
    desktopLayoutStore.subscribe,
    desktopLayoutStore.getSnapshot,
    desktopLayoutStore.getServerSnapshot
  );

  const [leftOverride, setLeftOverride] = useState<boolean | null>(null);
  const [rightOverride, setRightOverride] = useState<boolean | null>(null);
  const leftOpen = leftOverride ?? isWideDesktop;
  const rightOpen = rightOverride ?? isWideDesktop;

  const [mobileTab, setMobileTab] = useState<"structure" | "properties" | null>(
    null
  );
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const requestCounter = requestRef;
    return () => {
      requestCounter.current++;
    };
  }, []);

  useEffect(() => () => loaded?.model.dispose(), [loaded]);

  const open = useCallback(async (file?: File) => {
    const id = ++requestRef.current;
    setStatus(copy.reading);
    setError("");
    try {
      if (file && file.size > maxGlbBytes) throw new Error(copy.tooLarge);
      const bytes = file
        ? await file.arrayBuffer()
        : await fetch("/demos/estrutura.glb").then((response) => {
            if (!response.ok) throw new Error(copy.invalid);
            return response.arrayBuffer();
          });
      if (id !== requestRef.current) return;
      setStatus(copy.decoding);
      const model = await importGlb(bytes);
      if (id !== requestRef.current) {
        model.dispose();
        return;
      }
      const name = file?.name ?? copy.demoName;
      const summary = summarizeScene(model, bytes.byteLength);
      setLoaded({ model, name, id, summary });
      setCommand({ kind: "reset" });
      setLost(false);
      setAnnouncement(`${copy.loadedSuccessAnnouncement} ${name}`);
    } catch (cause) {
      if (id === requestRef.current) {
        const message = cause instanceof Error ? cause.message : "";
        setError(
          /^(O arquivo|Selecione|O GLB|A versão|Exporte|A cena)/.test(message)
            ? message
            : copy.invalid
        );
      }
    } finally {
      if (id === requestRef.current) setStatus("");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("demo") === "1") {
        void open();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const onContextLost = useCallback(() => setLost(true), []);

  const toggleLeftPanel = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileTab((prev) => (prev === "structure" ? null : "structure"));
      return;
    }
    const next = !(leftOverride ?? isWideDesktop);
    setLeftOverride(next);
    if (next && !isDesktopLayout) {
      setRightOverride(false);
    }
  }, [isDesktopLayout, isWideDesktop, leftOverride]);

  const toggleRightPanel = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileTab((prev) => (prev === "properties" ? null : "properties"));
      return;
    }
    const next = !(rightOverride ?? isWideDesktop);
    setRightOverride(next);
    if (next && !isDesktopLayout) {
      setLeftOverride(false);
    }
  }, [isDesktopLayout, isWideDesktop, rightOverride]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHelpOpen(false);
        setCommandOpen((prev) => !prev);
        return;
      }

      if (helpOpen || commandOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "f" && loaded && !lost) {
        event.preventDefault();
        setCommand({ kind: "fit" });
      } else if (key === "r" && loaded && !lost) {
        event.preventDefault();
        setCommand({ kind: "reset" });
      } else if (event.key === "[") {
        event.preventDefault();
        toggleLeftPanel();
      } else if (event.key === "]") {
        event.preventDefault();
        toggleRightPanel();
      } else if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        setFocusMode(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commandOpen,
    focusMode,
    helpOpen,
    loaded,
    lost,
    toggleLeftPanel,
    toggleRightPanel,
  ]);

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void open(file);
  }

  const fallback = (
    <div role="alert" className="gg-state-card">
      <AlertIcon
        size={26}
        strokeWidth={1.75}
        className="gg-state-card__icon gg-state-card__icon--danger"
      />
      <p className="gg-state-card__title">{copy.noWebgl}</p>
    </div>
  );

  const viewportSurface = (
    <div
      className={`gg-viewport ${
        isDraggingFile ? "gg-viewport--dragging" : ""
      }`}
      aria-busy={Boolean(status)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {focusMode && (
        <button
          type="button"
          className="gg-btn gg-btn--elevated gg-focus-exit"
          onClick={() => setFocusMode(false)}
        >
          <CloseIcon size={15} strokeWidth={1.75} />
          <span>{copy.focusModeExit}</span>
        </button>
      )}

      {loaded && !lost ? (
        <Viewport
          key={loaded.id}
          model={loaded.model}
          command={command}
          mode={mode}
          onContextLost={onContextLost}
          fallback={fallback}
        />
      ) : lost ? (
        <div className="gg-viewport-center">
          <div className="gg-state-card">
            <AlertIcon
              size={26}
              strokeWidth={1.75}
              className="gg-state-card__icon gg-state-card__icon--danger"
            />
            <p className="gg-state-card__title">{copy.noWebgl}</p>
            <button
              type="button"
              className="gg-btn gg-btn--primary"
              onClick={() => {
                setCommand({ kind: "reset" });
                setLost(false);
              }}
            >
              {copy.retry}
            </button>
          </div>
        </div>
      ) : (
        <div className="gg-viewport-center">
          <section className="gg-dropzone" aria-labelledby="gg-empty-title">
            <div className="gg-dropzone__icon">
              <CubeIcon size={22} strokeWidth={1.65} />
            </div>
            <h2 id="gg-empty-title" className="gg-dropzone__title">
              {copy.empty}
            </h2>
            <p className="gg-dropzone__desc">{copy.emptySubtitle}</p>
            <div className="gg-dropzone__actions">
              <button
                type="button"
                className="gg-btn gg-btn--primary"
                disabled={Boolean(status)}
                onClick={() => inputRef.current?.click()}
              >
                <FolderOpenIcon size={15} strokeWidth={1.75} />
                <span>{copy.open}</span>
              </button>
              <button
                type="button"
                className="gg-btn gg-btn--secondary"
                disabled={Boolean(status)}
                onClick={() => void open()}
              >
                <CubeIcon size={15} strokeWidth={1.75} />
                <span>{copy.demo}</span>
              </button>
            </div>
            <p className="gg-dropzone__privacy">{copy.local}</p>
          </section>
        </div>
      )}

      {isDraggingFile && (
        <div className="gg-drop-overlay" aria-hidden="true">
          <div className="gg-drop-overlay__box">
            <FolderOpenIcon size={24} strokeWidth={1.65} />
            <p>{copy.dropHint}</p>
          </div>
        </div>
      )}

      {status && (
        <div className="gg-status-pill" role="status" aria-live="polite">
          <span className="gg-progress-track" aria-hidden="true">
            <span className="gg-progress-bar" />
          </span>
          <span>{status}</span>
        </div>
      )}

      {error && (
        <div className="gg-error-banner" role="alert">
          <AlertIcon size={16} strokeWidth={1.75} className="gg-error-banner__icon" />
          <span className="gg-error-banner__text">{error}</span>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon-sm"
            aria-label={copy.dismissError}
            onClick={() => setError("")}
          >
            <CloseIcon size={15} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {loaded && !lost && (
        <div
          className={`gg-axes ${focusMode ? "gg-axes--focus" : ""}`}
          aria-label={copy.axes}
        >
          <span className="gg-axis gg-axis--x">X</span>
          <span className="gg-axis gg-axis--y">Y</span>
          <span className="gg-axis gg-axis--z">Z</span>
        </div>
      )}

      {loaded && (
        <ViewerToolbar
          mode={mode}
          disabled={lost}
          onModeChange={setMode}
          onCommand={setCommand}
        />
      )}
    </div>
  );

  const tabletOverlayOpen = !focusMode && !isDesktopLayout && (leftOpen || rightOpen);

  return (
    <Tooltip.Provider delay={300}>
      <div className={`gg-app ${focusMode ? "gg-app--focus" : ""}`}>
        {!focusMode && (
          <ViewerTopbar
            modelName={loaded?.name}
            isBusy={Boolean(status)}
            leftOpen={leftOpen || mobileTab === "structure"}
            rightOpen={rightOpen || mobileTab === "properties"}
            onToggleLeft={toggleLeftPanel}
            onToggleRight={toggleRightPanel}
            onOpenFile={() => inputRef.current?.click()}
            onLoadDemo={() => void open()}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
            onEnterFocusMode={() => setFocusMode(true)}
            onToggleTheme={toggleColorScheme}
          />
        )}

        <input
          type="file"
          accept=".glb,model/gltf-binary"
          aria-label={copy.open}
          ref={inputRef}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void open(file);
          }}
        />

        <main className="gg-workspace">
          {isDesktopLayout && !focusMode ? (
            <Group
              orientation="horizontal"
              className="gg-panel-group"
            >
              {leftOpen && (
                <>
                  <Panel
                    id="structure-panel"
                    defaultSize={264}
                    minSize={220}
                    maxSize={380}
                    groupResizeBehavior="preserve-pixel-size"
                    className="gg-resizable-panel"
                  >
                    <LeftHierarchyPanel
                      modelName={loaded?.name}
                      summary={loaded?.summary ?? null}
                      onClose={() => setLeftOverride(false)}
                    />
                  </Panel>
                  <Separator
                    className="gg-resize-handle"
                    aria-label={copy.panelResize}
                  />
                </>
              )}

              <Panel
                id="viewport-panel"
                minSize={400}
                groupResizeBehavior="preserve-relative-size"
                className="gg-resizable-panel gg-resizable-panel--viewport"
              >
                {viewportSurface}
              </Panel>

              {rightOpen && (
                <>
                  <Separator
                    className="gg-resize-handle"
                    aria-label={copy.panelResize}
                  />
                  <Panel
                    id="properties-panel"
                    defaultSize={272}
                    minSize={240}
                    maxSize={400}
                    groupResizeBehavior="preserve-pixel-size"
                    className="gg-resizable-panel"
                  >
                    <RightPropertiesPanel
                      modelName={loaded?.name}
                      summary={loaded?.summary ?? null}
                      onClose={() => setRightOverride(false)}
                    />
                  </Panel>
                </>
              )}
            </Group>
          ) : (
            <>
              {tabletOverlayOpen && (
                <div
                  className="gg-tablet-scrim"
                  aria-hidden="true"
                  onClick={() => {
                    setLeftOverride(false);
                    setRightOverride(false);
                  }}
                />
              )}
              {!focusMode && leftOpen && (
                <LeftHierarchyPanel
                  modelName={loaded?.name}
                  summary={loaded?.summary ?? null}
                  onClose={() => setLeftOverride(false)}
                />
              )}
              {viewportSurface}
              {!focusMode && rightOpen && (
                <RightPropertiesPanel
                  modelName={loaded?.name}
                  summary={loaded?.summary ?? null}
                  onClose={() => setRightOverride(false)}
                />
              )}
            </>
          )}
        </main>

        {!focusMode && (
          <MobileBottomSheet
            activeTab={mobileTab}
            modelName={loaded?.name}
            summary={loaded?.summary ?? null}
            onTabChange={setMobileTab}
            onClose={() => setMobileTab(null)}
          />
        )}

        <div className="visually-hidden" aria-live="polite">
          {announcement}
        </div>

        <ControlsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          hasModel={Boolean(loaded)}
          isLost={lost}
          isBusy={Boolean(status)}
          onOpenFile={() => inputRef.current?.click()}
          onLoadDemo={() => void open()}
          onFit={() => setCommand({ kind: "fit" })}
          onReset={() => setCommand({ kind: "reset" })}
          onSetOrbit={() => setMode("orbit")}
          onSetPan={() => setMode("pan")}
          onToggleLeft={toggleLeftPanel}
          onToggleRight={toggleRightPanel}
          onToggleFocus={() => setFocusMode((prev) => !prev)}
          onOpenHelp={() => setHelpOpen(true)}
          onToggleTheme={toggleColorScheme}
        />
      </div>
    </Tooltip.Provider>
  );
}
