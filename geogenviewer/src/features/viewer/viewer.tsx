"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { maxGlbBytes } from "../../lib/geogen/importers/glb";
import { defaultHiddenIds, hiddenByFilters, visibleIds } from "../../lib/geogen/domain/visibility";
import { captureRevision, type Revision } from "../../lib/geogen/revisions/revision";
import { catalogEntries } from "../../lib/geogen/documentation/catalog";
import {
  importGlbBasicPackage,
  importGlbWithManifestPackage,
  type LoadedScenePackage,
} from "../../lib/geogen/importers/package";
import {
  ManifestValidationError,
  maxManifestBytes,
} from "../../lib/geogen/validation/manifest";
import { AssemblyPanel } from "./components/assembly-panel";
import { ComparisonPanel, RevisionViewLabels } from "./components/comparison-panel";
import { DocumentationPanel } from "./components/documentation-panel";
import { DocumentationOverlay } from "./components/documentation-overlay";
import type { RenderDocumentationImage } from "./scene/documentation-renderer";
import { QuantitiesPanel, type AnalysisConfig, type QuantitiesLayout } from "./components/quantities-panel";
import { CommandPalette } from "./components/command-palette";
import { ControlsDialog } from "./components/controls-dialog";
import { ViewerContextMenu, type ContextMenuState } from "./components/context-menu";
import { ExplodePanel } from "./components/explode-panel";
import { SettingsDialog } from "./components/settings-dialog";
import {
  AlertIcon,
  CloseIcon,
  CubeIcon,
  FolderOpenIcon,
  ManifestIcon,
  PavilionIcon,
} from "./components/icons";
import { toggleColorScheme } from "./components/theme-toggle";
import {
  LeftHierarchyPanel,
  MobileBottomSheet,
  RightPropertiesPanel,
} from "./components/viewer-panels";
import { ViewerToolbar } from "./components/viewer-toolbar";
import { ViewerTopbar } from "./components/viewer-topbar";
import { copy } from "./copy";
import type { CameraCommand, NavigationMode } from "./scene/viewport";
import { ViewportTools } from "./components/viewport-tools";
import { useAssembly } from "./state/assembly-store";
import { flushInspection, useInspection } from "./state/inspection-store";
import { useOrganizationStore } from "./state/organization-store";
import { resolveOrganizationView } from "../../lib/geogen/organization/operations";
import { useAppSettings } from "./state/settings-store";
import { v06 } from "./v06-copy";
import { usePresentation } from "./state/presentation-store";
import { useEffectiveVisibility } from "./state/visibility-state";
import { connectViewportScopes } from "./state/viewport-scopes";
import { useViewerStore } from "./state/viewer-store";
import { useRevisionComparison, useSecondaryRevision, type Side } from "./state/revision-workspace";
import { v07, changeLabels } from "./v07-copy";
import { v08 } from "./v08-copy";
import { catalogTimeline, useDocumentationWorkspace } from "./state/documentation-workspace";
import { useKnollingMotion } from "./state/documentation-store";
import { recordRecentProject, type RecentDemoKind } from "../home/recent-projects";

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
const compareCompactStore = createMediaStore("(max-width: 767px)");
const emptyIds: string[] = [];

function isKnownUserError(message: string): boolean {
  return /^(O arquivo|Selecione|O GLB|A versão|Exporte|A cena|Manifesto|Incompatibilidade|Conflito|Referência)/.test(
    message
  );
}

interface PendingFallback {
  fileName: string;
  glbBytes: ArrayBuffer;
  reason: string;
}

export function Viewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadStartedAt = useRef(0);
  const dragDepthRef = useRef(0);

  const [loaded, setLoaded] = useState<{
    scenePackage: LoadedScenePackage;
    revision: Revision;
    name: string;
    id: number;
    loadTime: number;
  }>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingFallback, setPendingFallback] = useState<PendingFallback | null>(
    null
  );
  const [lost, setLost] = useState(false);
  const [mode, setMode] = useState<NavigationMode>("orbit");
  const [command, setCommand] = useState<CameraCommand>({ kind: "reset", seq: 0 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const selectedIds = useViewerStore((s) => s.selectedIds);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const filters = useViewerStore((s) => s.filters);
  const workspace = useViewerStore((s) => s.workspace);
  const comparing = workspace === "compare";
  const quantities = workspace === "quantities";
  const publication = workspace === "knolling" || workspace === "catalog" ? workspace : null;
  const analytics = comparing || quantities || Boolean(publication);
  const secondary = useSecondaryRevision();
  const [reversed, setReversed] = useState(false);
  const base = reversed && secondary.revision ? secondary.revision : loaded?.revision ?? null;
  const compared = reversed && secondary.revision ? loaded?.revision ?? null : secondary.revision;
  const comp = useRevisionComparison(base, compared, Boolean(base && compared));
  const compact = useSyncExternalStore(compareCompactStore.subscribe, compareCompactStore.getSnapshot, compareCompactStore.getServerSnapshot);
  const capture = useRef<(() => Promise<Blob>) | null>(null);
  const onCaptureChange = useCallback((value: (() => Promise<Blob>) | null) => { capture.current = value; }, []);
  const [analysisConfigs, setAnalysisConfigs] = useState<Record<string, AnalysisConfig>>({});
  const onAnalysisConfig = useCallback((key: string, config: AnalysisConfig) => {
    setAnalysisConfigs((current) => ({ ...current, [key]: config }));
  }, []);
  const [quantitiesLayout, setQuantitiesLayout] = useState<QuantitiesLayout>("table");
  const [quantitySide, setQuantitySide] = useState<Side>("base");
  const actualSide = compared ? quantitySide : "base";
  const quantityRevision = actualSide === "comparison" ? compared : base;
  const ownQuantity = Boolean(loaded && quantityRevision && loaded.revision === quantityRevision);
  const [quantitySecondarySelection, setQuantitySecondarySelection] = useState<{ key: string; ids: string[] } | null>(null);
  const secondaryIds = quantitySecondarySelection?.key === quantityRevision?.key ? quantitySecondarySelection?.ids ?? emptyIds : emptyIds;
  const quantitySelected = ownQuantity ? selectedIds : secondaryIds;
  const background = usePresentation((s) => s.display.background);
  const effective = useEffectiveVisibility();
  const organization = useOrganizationStore((state) => state.doc);
  const docs = useDocumentationWorkspace(loaded?.revision ?? null, secondary.revision, base, comp, publication,
    selectedIds, effective.visible, filters, analysisConfigs, quantitySecondarySelection, setQuantitySecondarySelection);
  const [documentationRenderer, setDocumentationRenderer] = useState<RenderDocumentationImage | null>(null);
  const attachDocumentationRenderer = useCallback((service: RenderDocumentationImage | null) => setDocumentationRenderer(() => service), []);
  const docUsingPeer = publication === "catalog" && !docs.isPrimary && Boolean(secondary.revision);
  const docSide = reversed ? "base" : "comparison";
  const docSelectedId = docs.selected[0];
  const counterpart = useMemo(() => {
    if (!publication || !docs.revision || !base || !compared || !docSelectedId) return null;
    const left = docs.revision === base;
    const row = comp.diffs.find((candidate) => candidate.confirmed && (left ? candidate.baseId : candidate.comparisonId) === docSelectedId);
    const id = left ? row?.comparisonId : row?.baseId;
    if (!id) return null;
    const revision = left ? compared : base;
    const entry = catalogEntries(revision, catalogTimeline(revision), new Map(), analysisConfigs[revision.key]?.settings, new Set([id]))[0];
    return entry ? { revision, entry, changes: row?.changes.map((change) => changeLabels[change]) } : null;
  }, [publication, docs.revision, base, compared, docSelectedId, comp.diffs, analysisConfigs]);
  const isolatedIds = useViewerStore((s) => s.isolatedIds);
  const multiSelectMode = useViewerStore((s) => s.multiSelectMode);
  const explodeOpen = useViewerStore((s) => s.explodeOpen);
  const explode = useViewerStore((s) => s.explode);
  const explodeTransition = useViewerStore((s) => s.explodeTransition);

  const setSceneGraph = useViewerStore((s) => s.setSceneGraph);
  const select = useViewerStore((s) => s.select);
  const clearSelection = useViewerStore((s) => s.clearSelection);
  const setHoveredId = useViewerStore((s) => s.setHoveredId);
  const hideIds = useViewerStore((s) => s.hideIds);
  const isolateIds = useViewerStore((s) => s.isolateIds);
  const showAll = useViewerStore((s) => s.showAll);
  const setMultiSelectMode = useViewerStore((s) => s.setMultiSelectMode);
  const setExplodeOpen = useViewerStore((s) => s.setExplodeOpen);
  const patchExplode = useViewerStore((s) => s.patchExplode);
  const startExplodeAnimation = useViewerStore((s) => s.startExplodeAnimation);
  const stopExplodeAnimation = useViewerStore((s) => s.stopExplodeAnimation);
  const resetExplode = useViewerStore((s) => s.resetExplode);
  const setExplodedBoundsMeters = useViewerStore((s) => s.setExplodedBoundsMeters);

  const liveFactorListenersRef = useRef<Set<(factor: number) => void>>(new Set());
  const subscribeLiveFactor = useCallback(
    (listener: (factor: number) => void) => {
      liveFactorListenersRef.current.add(listener);
      return () => {
        liveFactorListenersRef.current.delete(listener);
      };
    },
    []
  );
  const emitLiveFactor = useCallback((factor: number) => {
    for (const listener of liveFactorListenersRef.current) {
      listener(factor);
    }
  }, []);

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
  const leftOpen = !analytics && (leftOverride ?? isWideDesktop);
  const rightOpen = !analytics && (rightOverride ?? isWideDesktop);

  const [mobileTab, setMobileTab] = useState<"structure" | "properties" | null>(
    null
  );
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    useAppSettings.getState().hydrate();
    const requestCounter = requestRef;
    const activeAbort = abortRef;
    return () => {
      requestCounter.current++;
      activeAbort.current?.abort();
      useViewerStore.getState().setSceneGraph(null);
      useInspection.getState().load(null);
    };
  }, []);

  useEffect(connectViewportScopes, []);

  useEffect(() => {
    window.addEventListener("pagehide", flushInspection);
    return () => window.removeEventListener("pagehide", flushInspection);
  }, []);

  useEffect(() => () => loaded?.scenePackage.dispose(), [loaded]);

  useEffect(() => () => {
    requestRef.current += 1;
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!comparing || !loaded) return;
    const stored = useViewerStore.getState();
    const { sceneGraph, selectedIds, hiddenIds, hiddenGroupKeys, isolatedIds, filters, hoveredId, beforeIsolation } = stored;
    const { display } = usePresentation.getState();
    return () => {
      if (useViewerStore.getState().sceneGraph !== sceneGraph) return;
      useViewerStore.setState({ selectedIds, hiddenIds, hiddenGroupKeys, isolatedIds, filters, hoveredId, beforeIsolation });
      usePresentation.setState({ display });
    };
  }, [comparing, loaded]);

  useEffect(() => {
    if (workspace !== "assembly") useAssembly.getState().setSolo(null);
    useInspection.getState().setTool(workspace === "inspect" ? "sections" : "selection");
  }, [workspace]);

  const issueCommand = useCallback((next: Omit<CameraCommand, "seq">) => {
    setCommand((prev) => ({ ...next, seq: (prev.seq ?? 0) + 1 }));
  }, []);

  const activatePackage = useCallback(
    (
      scenePackage: LoadedScenePackage,
      displayName: string,
      id: number,
      captured?: Revision,
      demoKind: RecentDemoKind = null
    ) => {
      const revision = captured ?? captureRevision(scenePackage);
      const priorWorkspace = useViewerStore.getState().workspace;
      useAssembly.getState().initialize(scenePackage.manifest ?? null);
      useOrganizationStore.getState().initializeForRevision(scenePackage.sceneGraph, {
        key: revision.key,
        projectId: revision.identity.projectId,
        revisionId: revision.identity.revisionId,
        modelSha256: revision.identity.sha256,
      });
      usePresentation.getState().resetViews();
      useAppSettings.getState().evaluateLargeModel(
        scenePackage.sceneGraph.totalTriangles,
        scenePackage.sceneGraph.componentOrder.length
      );
      useInspection.getState().load(scenePackage);
      setLoaded({ scenePackage, revision, name: displayName, id, loadTime: performance.now() - loadStartedAt.current });
      setSceneGraph(scenePackage.sceneGraph);
      if (priorWorkspace === "compare" || priorWorkspace === "quantities" || priorWorkspace === "knolling" || priorWorkspace === "catalog") useViewerStore.getState().setWorkspace(priorWorkspace);
      const effectiveWorkspace = useViewerStore.getState().workspace;
      recordRecentProject({
        key: revision.key,
        title: displayName,
        fileName: displayName,
        revisionId: revision.identity.revisionId,
        mode: scenePackage.sceneGraph.mode,
        componentCount: scenePackage.sceneGraph.componentOrder.length,
        sha256Prefix: revision.identity.sha256 ? revision.identity.sha256.slice(0, 12) : null,
        demoKind,
        lastWorkspace: effectiveWorkspace,
      });
      setPendingFallback(null);
      setLost(false);
      issueCommand({ kind: "reset" });
      setAnnouncement(`${copy.loadedSuccessAnnouncement} ${displayName}`);
    },
    [issueCommand, setSceneGraph]
  );

  const openFiles = useCallback(
    async (files: File[]) => {
      abortRef.current?.abort();
      abortRef.current = null;
      const id = ++requestRef.current;
      setStatus("");
      loadStartedAt.current = performance.now();
      setError("");
      setPendingFallback(null);

      const glbFiles = files.filter((f) => f.name.toLowerCase().endsWith(".glb"));
      const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith(".json") && f.name.toLowerCase() !== "export_report.json");

      if (glbFiles.length === 0 && jsonFiles.length > 0) {
        setError(copy.jsonNeedsGlb);
        return;
      }
      if (glbFiles.length !== 1 || jsonFiles.length > 1) {
        setError(copy.onlyOneGlbWarning);
        return;
      }

      const glbFile = glbFiles[0];
      const jsonFile = jsonFiles[0] ?? null;

      setStatus(copy.reading);
      try {
        if (glbFile.size > maxGlbBytes) throw new Error(copy.tooLarge);
        if (jsonFile && jsonFile.size > maxManifestBytes) {
          throw new Error(copy.tooLarge);
        }

        const glbBytes = await glbFile.arrayBuffer();
        const jsonBytes = jsonFile ? await jsonFile.arrayBuffer() : null;
        if (id !== requestRef.current) return;

        setStatus(copy.decoding);
        if (jsonBytes) {
          try {
            const pkg = await importGlbWithManifestPackage(
              glbBytes,
              jsonBytes,
              glbFile.name
            );
            if (id !== requestRef.current) {
              pkg.dispose();
              return;
            }
            const label = pkg.sceneGraph.projectTitle || glbFile.name;
            activatePackage(pkg, label, id);
          } catch (cause) {
            if (id !== requestRef.current) return;
            const reason =
              cause instanceof ManifestValidationError
                ? `${cause.message}${
                    cause.details.length > 0 ? ` (${cause.details[0]})` : ""
                  }`
                : cause instanceof Error && cause.message
                  ? cause.message
                  : copy.manifestFailedChoiceTitle;
            setPendingFallback({
              fileName: glbFile.name,
              glbBytes,
              reason,
            });
          }
          return;
        }

        const pkg = await importGlbBasicPackage(glbBytes, glbFile.name);
        if (id !== requestRef.current) {
          pkg.dispose();
          return;
        }
        activatePackage(pkg, glbFile.name, id);
      } catch (cause) {
        if (id === requestRef.current) {
          const message = cause instanceof Error ? cause.message : "";
          setError(isKnownUserError(message) ? message : copy.invalid);
        }
      } finally {
        if (id === requestRef.current) setStatus("");
      }
    },
    [activatePackage]
  );

  const openBasicFallback = useCallback(async () => {
    if (!pendingFallback) return;
    const id = ++requestRef.current;
    loadStartedAt.current = performance.now();
    const { fileName, glbBytes } = pendingFallback;
    setPendingFallback(null);
    setError("");
    setStatus(copy.decoding);
    try {
      const pkg = await importGlbBasicPackage(glbBytes, fileName);
      if (id !== requestRef.current) {
        pkg.dispose();
        return;
      }
      activatePackage(pkg, fileName, id);
    } catch (cause) {
      if (id === requestRef.current) {
        const message = cause instanceof Error ? cause.message : "";
        setError(isKnownUserError(message) ? message : copy.invalid);
      }
    } finally {
      if (id === requestRef.current) setStatus("");
    }
  }, [activatePackage, pendingFallback]);

  const cancelActiveLoad = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("");
    setAnnouncement("Carregamento cancelado.");
  }, []);

  const loadDemo = useCallback(
    async (kind: "basic" | "contract" | "pavilion" | "inspection" | "revision" | "catalog") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++requestRef.current;
      loadStartedAt.current = performance.now();
      setStatus(copy.reading);
      setError("");
      setPendingFallback(null);
      try {
        if (kind === "basic") {
          const glbBytes = await fetch("/demos/estrutura.glb", { signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error(copy.invalid);
            return response.arrayBuffer();
          });
          if (id !== requestRef.current || controller.signal.aborted) return;
          setStatus(copy.decoding);
          const pkg = await importGlbBasicPackage(glbBytes, "estrutura.glb");
          if (id !== requestRef.current || controller.signal.aborted) {
            pkg.dispose();
            return;
          }
          activatePackage(pkg, copy.demoName, id, undefined, "basic");
          return;
        }

        const demo = {
          pavilion: { stem: "pavilhao-explosao", title: copy.demoExplodeName },
          contract: { stem: "contrato-exemplo", title: copy.demoContractName },
          inspection: { stem: "inspection-lab", title: v06.labTitle },
          revision: { stem: "revision-lab/proto-01/model", title: v07.revisionLab },
          catalog: { stem: "catalog-lab/rev-01/model", title: v08.labTitle },
        }[kind];
        const fileName = demo.stem.split("/").at(-1) + ".glb";
        const glbUrl = "/demos/" + demo.stem + ".glb";
        const jsonUrl = kind === "revision" || kind === "catalog" ? "/demos/" + demo.stem.replace(/model$/, "manifest.json") : "/demos/" + demo.stem + ".manifest.json";
        const title = demo.title;

        const [glbBytes, jsonBytes] = await Promise.all([
          fetch(glbUrl, { signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error(copy.invalid);
            return response.arrayBuffer();
          }),
          fetch(jsonUrl, { signal: controller.signal }).then((response) => {
            if (!response.ok) throw new Error(copy.invalid);
            return response.arrayBuffer();
          }),
        ]);
        if (id !== requestRef.current || controller.signal.aborted) return;
        setStatus(copy.decoding);
        const pkg = await importGlbWithManifestPackage(
          glbBytes,
          jsonBytes,
          fileName
        );
        if (id !== requestRef.current || controller.signal.aborted) {
          pkg.dispose();
          return;
        }
        activatePackage(pkg, title, id, undefined, kind);
        if (kind === "inspection") useViewerStore.getState().setWorkspace("inspect");
        if (kind === "revision") useViewerStore.getState().setWorkspace("compare");
        if (kind === "catalog") {
          useKnollingMotion.getState().set(1);
          useViewerStore.getState().setWorkspace("knolling");
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (id === requestRef.current) {
          const message = cause instanceof Error ? cause.message : "";
          setError(isKnownUserError(message) ? message : copy.invalid);
        }
      } finally {
        if (id === requestRef.current) {
          abortRef.current = null;
          setStatus("");
        }
      }
    },
    [activatePackage]
  );

  const loadRevisionLab = useCallback(() => {
    setReversed(false);
    useViewerStore.getState().setWorkspace("compare");
    void loadDemo("revision");
    void secondary.demo();
  }, [loadDemo, secondary]);

  const loadCatalogLab = useCallback(() => {
    setReversed(false);
    docs.setRevisionSide("primary");
    void loadDemo("catalog");
    void secondary.demo("catalog");
  }, [docs, loadDemo, secondary]);

  const initialHandlersRef = useRef({ loadDemo, loadRevisionLab, loadCatalogLab });
  useEffect(() => {
    initialHandlersRef.current = { loadDemo, loadRevisionLab, loadCatalogLab };
  }, [loadDemo, loadRevisionLab, loadCatalogLab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get("demo");
      const handlers = initialHandlersRef.current;
      if (demoParam === "1" || demoParam === "basic") {
        void handlers.loadDemo("basic");
      } else if (demoParam === "contrato") {
        void handlers.loadDemo("contract");
      } else if (demoParam === "pavilhao") {
        void handlers.loadDemo("pavilion");
      } else if (demoParam === "inspecao") {
        void handlers.loadDemo("inspection");
      } else if (demoParam === "revisao") {
        handlers.loadRevisionLab();
      } else if (demoParam === "catalog") {
        handlers.loadCatalogLab();
      } else if (params.get("open") === "1") {
        const trigger = document.querySelector<HTMLButtonElement>(".gg-dropzone .gg-btn--primary");
        trigger?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function removeRevision(side: Side) {
    const removePrimary = (side === "base") !== reversed;
    setReversed(false);
    if (!removePrimary) { secondary.release(); return; }
    const remaining = secondary.release(false);
    const id = ++requestRef.current;
    setStatus("");
    setError("");
    setPendingFallback(null);
    if (remaining) {
      loadStartedAt.current = performance.now();
      activatePackage(remaining.scene, remaining.scene.sceneGraph.projectTitle, id, remaining);
    } else {
      setLoaded(undefined);
      setSceneGraph(null);
      useAssembly.getState().initialize(null);
      useInspection.getState().load(null);
      usePresentation.getState().resetViews();
      useViewerStore.getState().setWorkspace("compare");
    }
  }

  const onContextLost = useCallback(() => {
    setAnnouncement(copy.noWebgl);
    setLost(true);
  }, []);

  const handleViewportSelect = useCallback(
    (id: string | null, options: { multi: boolean }) => {
      if (!id) {
        if (!options.multi) clearSelection();
        return;
      }
      select(id, options.multi ? "toggle" : "replace");
      const compName = loaded?.scenePackage.sceneGraph.components[id]?.name ?? id;
      setAnnouncement(`${copy.selectionAnnouncement} ${compName}`);
    },
    [clearSelection, loaded, select]
  );

  const handleViewportContextMenu = useCallback(
    (id: string | null, x: number, y: number) => {
      if (!loaded) return;
      const currentSel = useViewerStore.getState().selectedIds;
      if (id) {
        const targetIds = currentSel.includes(id) && currentSel.length > 1 ? currentSel : [id];
        if (!currentSel.includes(id)) {
          select(id, "replace");
        }
        const label =
          targetIds.length > 1
            ? `${targetIds.length} componentes selecionados`
            : loaded.scenePackage.sceneGraph.components[id]?.name ?? id;
        setContextMenu({ x, y, targetIds, label });
      } else {
        setContextMenu({ x, y, targetIds: [], label: loaded.name });
      }
    },
    [loaded, select]
  );

  const selectQuantity = useCallback((ids: string[], multi: boolean) => {
    if (ownQuantity) {
      const viewer = useViewerStore.getState();
      if (multi && ids.length === 1) viewer.select(ids[0], "toggle");
      else viewer.selectMany(ids, multi ? "add" : "replace");
    } else if (quantityRevision) {
      setQuantitySecondarySelection((old) => {
        const active = old?.key === quantityRevision.key ? old.ids : [];
        const next = multi && ids.length === 1 && active.includes(ids[0]) ? active.filter((id) => id !== ids[0]) :
          multi ? [...new Set([...active, ...ids])] : ids;
        return { key: quantityRevision.key, ids: next };
      });
    }
  }, [ownQuantity, quantityRevision]);

  const selectQuantityFromModel = useCallback((id: string | null, multi: boolean) => {
    if (id || !multi) selectQuantity(id ? [id] : [], multi);
  }, [selectQuantity]);

  const quantityScopes = useMemo(() => {
    if (!quantities || !quantityRevision) return { visible: emptyIds, filtered: emptyIds };
    const graph = quantityRevision.scene.sceneGraph;
    const userOrganization = ownQuantity ? resolveOrganizationView(graph, { ...organization, activeSource: "user" }) : null;
    const denied = new Set(hiddenByFilters(graph, filters, quantitySelected, new Map(), userOrganization));
    const visible = ownQuantity ? effective.visible : visibleIds(graph.componentOrder, [...defaultHiddenIds(graph), ...denied], null);
    return { visible, filtered: graph.componentOrder.filter((id) => !denied.has(id)) };
  }, [quantities, quantityRevision, ownQuantity, effective.visible, filters, quantitySelected, organization]);

  const handleFrameIds = useCallback(
    (ids?: string[]) => {
      issueCommand({ kind: "fit", targetIds: ids });
    },
    [issueCommand]
  );

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

      if (helpOpen || commandOpen || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable || target.closest("[role=dialog]"))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "f" && loaded && !lost) {
        event.preventDefault();
        const currentSel = useViewerStore.getState().selectedIds;
        issueCommand({
          kind: "fit",
          targetIds: currentSel.length > 0 ? currentSel : undefined,
        });
      } else if (key === "r" && loaded && !lost) {
        event.preventDefault();
        issueCommand({ kind: "reset" });
      } else if (key === "h" && loaded && !lost) {
        const currentSel = useViewerStore.getState().selectedIds;
        if (currentSel.length > 0) {
          event.preventDefault();
          hideIds(currentSel);
        }
      } else if (key === "i" && loaded && !lost) {
        const currentSel = useViewerStore.getState().selectedIds;
        if (currentSel.length > 0) {
          event.preventDefault();
          isolateIds(currentSel);
        }
      } else if (key === "a" && loaded && !lost) {
        event.preventDefault();
        showAll();
      } else if (key === "e" && loaded && !lost) {
        event.preventDefault();
        setExplodeOpen(!useViewerStore.getState().explodeOpen);
      } else if (key === "v" && loaded && !lost) {
        event.preventDefault();
        const views = usePresentation.getState();
        views.setLayout(views.layout === "single" ? "quad" : "single");
      } else if (key === "j" && loaded && !lost) {
        event.preventDefault();
        setFocusMode((current) => !current);
      } else if (event.key === "[") {
        event.preventDefault();
        toggleLeftPanel();
      } else if (event.key === "]") {
        event.preventDefault();
        toggleRightPanel();
      } else if (event.key === "Escape") {
        if (useInspection.getState().tool === "measure") {
          event.preventDefault();
          const inspection = useInspection.getState();
          if (inspection.draft) inspection.cancel();
          else inspection.setTool("selection");
        } else if (focusMode) {
          event.preventDefault();
          setFocusMode(false);
        } else if (useViewerStore.getState().selectedIds.length > 0) {
          event.preventDefault();
          clearSelection();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSelection,
    commandOpen,
    focusMode,
    helpOpen,
    hideIds,
    isolateIds,
    issueCommand,
    loaded,
    lost,
    setExplodeOpen,
    showAll,
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
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void openFiles(files);
  }

  const hasVisibilityOverrides =
    hiddenIds.length > 0 || isolatedIds !== null || Object.values(filters).some((items) => items.length > 0);

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
      data-background={background}
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
          scenePackage={loaded.scenePackage}
          revision={loaded.revision}
          knolling={docs.scene}
          annotationVersion={docs.groups ?? docs.annotations}
          onDocumentationRenderer={attachDocumentationRenderer}
          command={command}
          mode={mode}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          hiddenIds={effective.hidden}
          isolatedIds={isolatedIds}
          multiSelectMode={multiSelectMode}
          explode={explode}
          explodeTransition={explodeTransition}
          onExplodeAnimationLiveFactor={emitLiveFactor}
          onExplodeAnimationSettled={stopExplodeAnimation}
          onExplodedBoundsChange={setExplodedBoundsMeters}
          onSelect={handleViewportSelect}
          onHover={setHoveredId}
          onContextMenu={handleViewportContextMenu}
          onContextLost={onContextLost}
          fallback={fallback}
          comparison={base && compared && (comparing || (quantities && !ownQuantity) || docUsingPeer) ? {
            base, comparison: compared, state: comp, primaryKey: loaded.revision.key, compact, onCaptureChange,
            single: docUsingPeer ? docSide : quantities ? actualSide : undefined,
            quantitySelection: docUsingPeer ? docs.selected : quantitySelected,
            onQuantitySelect: docUsingPeer ? (id, multi) => docs.peerSelect(id ? [id] : [], multi) : selectQuantityFromModel,
          } : undefined}
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
                issueCommand({ kind: "reset" });
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
                onClick={() => void loadDemo("pavilion")}
              >
                <PavilionIcon size={15} strokeWidth={1.75} />
                <span>{copy.demoExplode}</span>
              </button>
              <button type="button" className="gg-btn gg-btn--secondary" disabled={Boolean(status)} onClick={() => void loadDemo("inspection")}>
                <CubeIcon size={15} strokeWidth={1.75} /><span>{v06.lab}</span>
              </button>
              <button
                type="button"
                className="gg-btn gg-btn--secondary"
                disabled={Boolean(status)}
                onClick={() => void loadDemo("contract")}
              >
                <ManifestIcon size={15} strokeWidth={1.75} />
                <span>{copy.demoContract}</span>
              </button>
              <button
                type="button"
                className="gg-btn gg-btn--secondary"
                disabled={Boolean(status)}
                onClick={() => void loadDemo("basic")}
              >
                <CubeIcon size={15} strokeWidth={1.75} />
                <span>{copy.demo}</span>
              </button>
            </div>
            <button type="button" className="gg-btn gg-btn--secondary" disabled={Boolean(status) || secondary.busy}
              onClick={loadRevisionLab}>{v07.revisionLab}</button>
            <button type="button" className="gg-btn gg-btn--secondary" disabled={Boolean(status) || secondary.busy} onClick={loadCatalogLab}>{v08.lab}</button>
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
          <button
            type="button"
            className="gg-mini-link-btn"
            aria-label="Cancelar carregamento"
            onClick={cancelActiveLoad}
          >
            Cancelar
          </button>
        </div>
      )}

      {pendingFallback && (
        <div className="gg-error-banner gg-error-banner--choice" role="alert">
          <AlertIcon size={16} strokeWidth={1.75} className="gg-error-banner__icon" />
          <div className="gg-error-banner__body">
            <strong>{copy.manifestFailedChoiceTitle}</strong>
            <p className="gg-error-banner__text">{pendingFallback.reason}</p>
            <div className="gg-error-banner__actions">
              <button
                type="button"
                className="gg-btn gg-btn--secondary gg-btn--xs"
                onClick={() => void openBasicFallback()}
              >
                {copy.manifestOpenBasicFallback}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="gg-btn gg-btn--ghost gg-btn--icon-sm"
            aria-label={copy.dismissError}
            onClick={() => setPendingFallback(null)}
          >
            <CloseIcon size={15} strokeWidth={1.75} />
          </button>
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
        <ViewportTools key={"tools-" + loaded.id} loaded={loaded.scenePackage} loadTime={loaded.loadTime}
          onFit={handleFrameIds} onReset={() => issueCommand({ kind: "reset" })}
          comparison={Boolean(base && compared && (comparing || (quantities && !ownQuantity) || docUsingPeer))}
          documentation={docs.isPrimary && docs.revision && docs.settings ? { revision: docs.revision, settings: docs.settings, apply: docs.change } : undefined} />
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

      {comparing && base && compared && <RevisionViewLabels state={comp} compact={compact} />}
      {loaded && !lost && !comparing && !docUsingPeer && docs.isPrimary && (docs.annotations.length > 0 || docs.groups) &&
        <DocumentationOverlay revision={loaded.revision} annotations={docs.annotations} mask={docs.mask} groups={docs.groups} />}

      {loaded && !lost && explodeOpen && !analytics && (
        <ExplodePanel
          subscribeLiveFactor={subscribeLiveFactor}
          onClose={() => setExplodeOpen(false)}
        />
      )}

      {loaded && (!analytics || (quantities && ownQuantity)) && (
        <ViewerToolbar
          mode={mode}
          disabled={lost}
          multiSelectMode={multiSelectMode}
          selectedCount={selectedIds.length}
          hasVisibilityOverrides={hasVisibilityOverrides}
          explodeOpen={explodeOpen}
          explodeActive={explode.enabled && explode.factor > 1e-6}
          onModeChange={setMode}
          onToggleMultiSelect={() => setMultiSelectMode(!multiSelectMode)}
          onHideSelected={() => hideIds(selectedIds)}
          onIsolateSelected={() => isolateIds(selectedIds)}
          onShowAll={showAll}
          onClearSelection={clearSelection}
          onToggleExplode={() => setExplodeOpen(!explodeOpen)}
          onCommand={(next) => {
            if (next.kind === "fit") {
              issueCommand({
                kind: "fit",
                targetIds: selectedIds.length > 0 ? selectedIds : undefined,
              });
            } else {
              issueCommand(next);
            }
          }}
        />
      )}
    </div>
  );

  const tabletOverlayOpen = !focusMode && !isDesktopLayout && (leftOpen || rightOpen);

  return (
    <Tooltip.Provider delay={300}>
      <div className={`gg-app ${focusMode ? "gg-app--focus" : ""} ${workspace === "assembly" && loaded && !focusMode ? "gg-app--assembly" : ""}`}
        data-analytics={analytics && !focusMode || undefined}>
        {!focusMode && (
          <ViewerTopbar
            modelName={loaded?.name}
            revision={loaded?.scenePackage.sceneGraph.revisionId}
            sceneMode={loaded?.scenePackage.sceneGraph.mode}
            isBusy={Boolean(status)}
            leftOpen={leftOpen || mobileTab === "structure"}
            rightOpen={rightOpen || mobileTab === "properties"}
            onToggleLeft={toggleLeftPanel}
            onToggleRight={toggleRightPanel}
            onOpenFile={() => inputRef.current?.click()}
            onLoadDemo={() => void loadDemo("basic")}
            onLoadContractDemo={() => void loadDemo("contract")}
            onLoadExplodeDemo={() => void loadDemo("pavilion")}
            onLoadInspectionDemo={() => void loadDemo("inspection")}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
            onEnterFocusMode={() => setFocusMode(true)}
            onToggleTheme={toggleColorScheme}
          />
        )}

        <input
          type="file"
          accept=".glb,model/gltf-binary,.json,application/json"
          multiple
          aria-label={copy.open}
          ref={inputRef}
          hidden
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length > 0) void openFiles(files);
          }}
        />

        <main className="gg-workspace" data-v07={analytics && !focusMode || undefined}
          data-v07-layout={quantities && !focusMode ? quantitiesLayout : undefined} data-v08={publication && !focusMode || undefined}>
          <Group orientation="horizontal" className="gg-panel-group">
            {isDesktopLayout && !focusMode && leftOpen && (
              <>
                <Panel id="structure-panel" defaultSize={272} minSize={220} maxSize={400}
                  groupResizeBehavior="preserve-pixel-size" className="gg-resizable-panel">
                  <LeftHierarchyPanel
                    onFrameIds={handleFrameIds}
                    onOpenContextMenu={setContextMenu}
                    onClose={() => setLeftOverride(false)}
                  />
                </Panel>
                <Separator className="gg-resize-handle" aria-label={copy.panelResize} />
              </>
            )}
            <Panel key="viewport" id="viewport-panel" minSize={isDesktopLayout ? 400 : 0}
              groupResizeBehavior="preserve-relative-size" className="gg-resizable-panel gg-resizable-panel--viewport">
              {viewportSurface}
            </Panel>
            {isDesktopLayout && !focusMode && rightOpen && (
              <>
                <Separator className="gg-resize-handle" aria-label={copy.panelResize} />
                <Panel id="properties-panel" defaultSize={284} minSize={240} maxSize={420}
                  groupResizeBehavior="preserve-pixel-size" className="gg-resizable-panel">
                  <RightPropertiesPanel onFrameIds={handleFrameIds} onClose={() => setRightOverride(false)} />
                </Panel>
              </>
            )}
          </Group>
          {tabletOverlayOpen && (
            <div className="gg-tablet-scrim" aria-hidden="true" onClick={() => {
              setLeftOverride(false);
              setRightOverride(false);
            }} />
          )}
          {!focusMode && !isDesktopLayout && leftOpen && (
            <LeftHierarchyPanel
              onFrameIds={handleFrameIds}
              onOpenContextMenu={setContextMenu}
              onClose={() => setLeftOverride(false)}
            />
          )}
          {!focusMode && !isDesktopLayout && rightOpen && (
            <RightPropertiesPanel onFrameIds={handleFrameIds} onClose={() => setRightOverride(false)} />
          )}
          {comparing && !focusMode && <ComparisonPanel key={comp.key} base={base} comparison={compared} state={comp} compact={compact}
            busy={Boolean(status) || secondary.busy} error={secondary.error} baseOnLeft={!reversed} onBase={() => inputRef.current?.click()}
            onSecondary={(files) => void secondary.files(files)} onRemove={removeRevision} onReverse={() => setReversed((old) => !old)}
            onLab={loadRevisionLab} onFit={() => issueCommand({ kind: "fit" })} capture={capture} />}
          {base && quantities && !focusMode && <QuantitiesPanel configs={analysisConfigs} onConfig={onAnalysisConfig} base={base} comparison={compared} analysis={comp} side={actualSide} onSide={setQuantitySide}
              layout={quantitiesLayout} onLayout={setQuantitiesLayout} scopes={quantityScopes} selected={quantitySelected} onSelect={selectQuantity} />}
          {publication && docs.revision && !focusMode && <DocumentationPanel key={docs.revision.key} docs={docs} peer={secondary.revision}
            knolling={publication === "knolling"} renderer={documentationRenderer} counterpart={counterpart}
            onSelect={(ids) => docs.isPrimary ? useViewerStore.getState().selectMany(ids) : docs.peerSelect(ids)}
            onIsolate={(ids) => {
              if (!docs.isPrimary) { docs.peerSelect(ids); handleFrameIds(ids); return; }
              useViewerStore.getState().isolateIds(ids); handleFrameIds(ids);
            }}
            onLocate={(ids, step) => {
              if (!docs.isPrimary) {
                useViewerStore.getState().setWorkspace("compare");
                if (ids[0]) comp.select({ side: docSide, id: ids[0] });
                return;
              }
              useViewerStore.getState().showAll(); useViewerStore.getState().selectMany(ids);
              useViewerStore.getState().setWorkspace(step == null ? "explore" : "assembly");
              if (step != null) useAssembly.getState().seek(docs.timeline.schedule[step]?.start ?? 0);
              handleFrameIds(ids);
            }}
            onFit={handleFrameIds} />}
        </main>

        {loaded && workspace === "assembly" && !focusMode && <AssemblyPanel />}

        {!focusMode && !analytics && (
          <MobileBottomSheet
            activeTab={mobileTab}
            onTabChange={setMobileTab}
            onFrameIds={handleFrameIds}
            onOpenContextMenu={setContextMenu}
            onClose={() => setMobileTab(null)}
          />
        )}

        <ViewerContextMenu
          state={contextMenu}
          sceneGraph={loaded?.scenePackage.sceneGraph ?? null}
          onClose={() => setContextMenu(null)}
          onFrameIds={handleFrameIds}
          onNotify={(msg) => setAnnouncement(msg)}
        />

        <div className="visually-hidden" aria-live="polite">
          {announcement}
        </div>

        <ControlsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          hasModel={Boolean(loaded)}
          isLost={lost}
          isBusy={Boolean(status)}
          hasSelection={selectedIds.length > 0}
          hasVisibilityOverrides={hasVisibilityOverrides}
          onOpenFile={() => inputRef.current?.click()}
          onLoadDemo={() => void loadDemo("basic")}
          onLoadContractDemo={() => void loadDemo("contract")}
          onLoadExplodeDemo={() => void loadDemo("pavilion")}
          onFit={() =>
            issueCommand({
              kind: "fit",
              targetIds: selectedIds.length > 0 ? selectedIds : undefined,
            })
          }
          onReset={() => issueCommand({ kind: "reset" })}
          onSetOrbit={() => setMode("orbit")}
          onSetPan={() => setMode("pan")}
          onHideSelected={() => hideIds(selectedIds)}
          onIsolateSelected={() => isolateIds(selectedIds)}
          onShowAll={showAll}
          onClearSelection={clearSelection}
          onToggleMultiSelect={() => setMultiSelectMode(!multiSelectMode)}
          onToggleExplodePanel={() => setExplodeOpen(!explodeOpen)}
          onExplodeReset={() => resetExplode()}
          onExplodeRadial={() => {
            patchExplode({ mode: "radial", enabled: true });
            startExplodeAnimation(0.5);
          }}
          onExplodeAxial={(axis) => {
            patchExplode({ mode: "axial", axis, enabled: true });
            startExplodeAnimation(0.65);
          }}
          onToggleRefLines={() =>
            patchExplode({ showReferenceLines: !explode.showReferenceLines })
          }
          onToggleLeft={toggleLeftPanel}
          onToggleRight={toggleRightPanel}
          onToggleFocus={() => setFocusMode((prev) => !prev)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleTheme={toggleColorScheme}
        />
      </div>
    </Tooltip.Provider>
  );
}
