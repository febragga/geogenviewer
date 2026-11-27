import { componentLabel } from "../../../lib/geogen/domain/component-identity";
import {
  Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial,
  OrthographicCamera, Vector3, type Camera, type InstancedMesh, type Intersection, type Plane, type Scene, type WebGLRenderer,
} from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { axisNormals, clippedBounds, clippingPlanes, pointSurvives, rangeOnAxis, sectionAt, type CadAxis, type SectionPlane, type SectionSettings } from "../../../lib/geogen/inspection/sections";
import { intersectMeshSection } from "../../../lib/geogen/inspection/section-mesh";
import { formatMeasurement, measurementValue, meshReferences, type MeshAnchor, type SnapMode } from "../../../lib/geogen/inspection/measurements";
import type { TechnicalOptions } from "../../../lib/geogen/inspection/document";
import { useAssembly } from "../state/assembly-store";
import { useInspection } from "../state/inspection-store";
import { usePresentation } from "../state/presentation-store";
import { viewportScope } from "../state/viewport-scopes";
import { useViewerStore } from "../state/viewer-store";
import type { ViewRegion } from "./camera-state";
import { paintSvg, paintTechnical, projectPoint, type Mark } from "./inspection-overlay";

export interface InspectionRenderPass {
  slot: number;
  camera: Camera;
  region: ViewRegion;
  render: () => void;
  technical?: TechnicalOptions;
  capture?: boolean;
}

interface CapEntry {
  key: readonly unknown[];
  group: Group;
  issues: number;
}

type Gizmo = { plane: SectionPlane; start: { x: number; y: number }; direction: { x: number; y: number }; units: number };

function isVisible(object: Mesh) {
  for (let cursor: Mesh | Mesh["parent"] = object; cursor; cursor = cursor.parent) if (!cursor.visible) return false;
  return true;
}

const planeCache = new WeakMap<SectionSettings, Plane[]>();
const snapNames: Record<SnapMode, string> = { surface: "Superfície", vertex: "Vértice", midpoint: "Ponto médio", edge: "Aresta" };

export function activeClipping(slot: number) {
  const config = useInspection.getState().doc?.sections;
  if (!config) return [];
  const section = sectionAt(config, slot);
  let planes = planeCache.get(section);
  if (!planes) {
    planes = clippingPlanes(section);
    planeCache.set(section, planes);
  }
  return planes;
}

export class InspectionScene {
  readonly refs;
  private readonly gl: WebGLRenderer;
  private readonly root: Scene;
  private readonly model: LoadedScenePackage;
  private readonly invalidate: () => void;
  private readonly overlay = document.createElement("div");
  private readonly panels = new Map<number, { root: HTMLDivElement; svg: SVGSVGElement; handles: Map<CadAxis, HTMLButtonElement> }>();
  private readonly entries: CapEntry[] = [];
  private readonly meshes: Mesh[] = [];
  private candidate: { slot: number; point: Vector3; mode: SnapMode } | null = null;
  private dragging = false;
  activeCapMaterials = 0;
  private readonly unsubscribe: () => void;
  private warnScheduled = false;
  private disposed = false;
  private warnings: string[] = [];

  constructor(gl: WebGLRenderer, root: Scene, model: LoadedScenePackage, invalidate: () => void) {
    this.gl = gl;
    this.root = root;
    this.model = model;
    this.invalidate = invalidate;
    this.refs = meshReferences(model.model.scene, model.objectByComponentId);
    model.model.scene.traverse((object) => { if ((object as Mesh).isMesh) this.meshes.push(object as Mesh); });
    this.overlay.className = "gg-inspection-overlay";
    gl.domElement.closest(".gg-viewport")?.append(this.overlay);
    useInspection.getState().bind(this.refs);
    this.unsubscribe = useInspection.subscribe((state, previous) => {
      if (state.tool !== "measure") this.candidate = null;
      if (state.doc !== previous.doc || state.draft !== previous.draft || state.tool !== previous.tool || state.positionDragging !== previous.positionDragging) invalidate();
    });
  }

  setCandidate(slot: number, candidate: { point: Vector3; mode: SnapMode } | null) {
    if (!candidate && !this.candidate) return;
    this.candidate = candidate && { ...candidate, slot };
    this.invalidate();
  }

  clearCandidate() { this.setCandidate(-1, null); }

  anchor(hit: Intersection, id: string, point: Vector3, mode: SnapMode): MeshAnchor | null {
    const mesh = hit.object as Mesh;
    return mesh.isMesh ? this.refs.anchor(mesh, id, point, hit.instanceId, mode) : null;
  }

  beginFrame() {
    for (const panel of this.panels.values()) panel.root.hidden = true;
  }

  private announce(issues: string[]) {
    if (this.warnings.join("|") === issues.join("|")) return;
    this.warnings = issues;
    if (this.warnScheduled) return;
    this.warnScheduled = true;
    queueMicrotask(() => {
      this.warnScheduled = false;
      if (!this.disposed) useInspection.setState({ warnings: this.warnings });
    });
  }

  draw(pass: InspectionRenderPass, moving: boolean, poseKey: string) {
    const state = useInspection.getState();
    const { slot, camera, region, technical, render, capture } = pass;
    const section = state.doc ? sectionAt(state.doc.sections, slot) : null;
    const planes = activeClipping(slot);
    const old = this.gl.clippingPlanes;
    const helpers: { object: Group; visible: boolean }[] = [];
    let caps: CapEntry | undefined;
    const shouldCap = section && planes.length && section.mode !== "open" && (capture || (!moving && !this.dragging && !state.positionDragging));
    if (shouldCap) caps = this.capEntry(slot, section, planes, poseKey);
    if (caps) {
      this.root.add(caps.group);
      caps.group.traverse((object) => {
        const line = object as LineSegments2;
        if (line.isLineSegments2) line.material.linewidth = section!.lineWidth * (technical ? Math.max(1, technical.width / region.width) : 1);
      });
    }
    if (technical) {
      for (const object of this.root.children) {
        if (object.userData.ggInspectionHelper !== "grid" && object.userData.ggInspectionHelper !== "axes") continue;
        helpers.push({ object: object as Group, visible: object.visible });
        object.visible = object.userData.ggInspectionHelper === "grid" ? technical.grid : technical.axes;
      }
    }
    if (planes.length || old.length) this.gl.clippingPlanes = planes;
    try {
      render();
      if (!capture) this.renderScreen(slot, camera, region, section, planes);
    } finally {
      this.gl.clippingPlanes = old;
      caps?.group.removeFromParent();
      for (const { object, visible } of helpers) object.visible = visible;
    }
    if (!capture && slot === usePresentation.getState().active) {
      this.activeCapMaterials = caps?.group.children.length ?? 0;
      const notice = caps?.issues ? [`${caps.issues} malha(s) ficaram abertas por falta de fechamento confiável.`] : [];
      if (moving && planes.length && section?.mode !== "open") notice.push("Contornos e preenchimento são atualizados ao pausar o movimento.");
      this.announce(notice);
    }
  }

  private capEntry(slot: number, section: SectionSettings, planes: readonly Plane[], poseKey: string) {
    const scope = viewportScope(slot);
    const assembly = useAssembly.getState();
    const workspace = useViewerStore.getState().workspace;
    const key = [section, scope.hiddenIds, scope.isolatedIds, scope.filters, scope.filters.selection ? scope.selectedIds : null,
      poseKey, workspace, assembly.timeline, assembly.stepIndex, assembly.ghost, assembly.solo];
    const previous = this.entries.findIndex((item) => item.key.every((value, index) => value === key[index]));
    if (previous >= 0) {
      const item = this.entries.splice(previous, 1)[0];
      this.entries.push(item);
      return item;
    }
    this.model.model.scene.updateWorldMatrix(true, true);
    const lines: number[] = [];
    const triangles: number[] = [];
    const skipped = new Set<Mesh>();
    const fill = section.fill && (section.mode === "filled" || section.mode === "technical");
    const instance = new Matrix4();
    const world = new Matrix4();
    for (const mesh of this.meshes) {
      const visible = mesh.userData.ggInstancedManaged
        ? Boolean(mesh.userData.ggInstancedVisible)
        : isVisible(mesh);
      if (!visible || !mesh.geometry || (mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) continue;
      const id = this.model.resolveComponentId(mesh);
      if (workspace === "assembly" && assembly.ghost && id !== null &&
        (assembly.timeline.byElement.get(id) ?? -1) > assembly.stepIndex) continue;
      const instanced = mesh as InstancedMesh;
      const count = instanced.isInstancedMesh ? instanced.count : 1;
      for (let index = 0; index < count; index++) {
        world.copy(mesh.matrixWorld);
        if (instanced.isInstancedMesh) {
          instanced.getMatrixAt(index, instance);
          world.multiply(instance);
        }
        for (const plane of planes) {
          const result = intersectMeshSection(mesh.geometry, world, plane, fill);
          if (result.incomplete) skipped.add(mesh);
          for (const value of result.lines) lines.push(value);
          for (const value of result.triangles) triangles.push(value);
        }
      }
    }
    const group = new Group();
    if (triangles.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
      const material = new MeshBasicMaterial({ color: section.fillColor, opacity: section.opacity,
        transparent: section.opacity < 1, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const mesh = new Mesh(geometry, material);
      group.add(mesh);
    }
    if (lines.length) {
      const geometry = new LineSegmentsGeometry().setPositions(lines);
      const material = new LineMaterial({ color: section.outlineColor, linewidth: section.lineWidth, opacity: section.opacity, transparent: section.opacity < 1 });
      const edges = new LineSegments2(geometry, material);
      edges.renderOrder = 4;
      group.add(edges);
    }
    const entry: CapEntry = { key, group, issues: skipped.size };
    this.entries.push(entry);
    if (this.entries.length > 4) this.release(this.entries.shift()!);
    return entry;
  }

  private release(entry: CapEntry) {
    entry.group.removeFromParent();
    for (const object of entry.group.children) {
      const mesh = object as Mesh<BufferGeometry, MeshBasicMaterial>;
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }

  private marks(slot: number, camera: Camera, width: number, height: number, planes: readonly Plane[], technical?: TechnicalOptions) {
    const state = useInspection.getState();
    const marks: Mark[] = [];
    if (!state.doc) return marks;
    if (!technical || technical.measurements) {
      const assembly = useAssembly.getState();
      const assembling = useViewerStore.getState().workspace === "assembly";
      for (const record of state.doc.measurements) {
        if (!record.visible || state.invalidIds.includes(record.id) || (assembling && assembly.solo === null && record.anchors.some((anchor) =>
          (assembly.timeline.byElement.get(anchor.elementId) ?? -1) > assembly.stepIndex))) continue;
        const world = record.anchors.map((anchor) => {
          const mesh = this.refs.target(anchor);
          return mesh && isVisible(mesh) ? this.refs.point(anchor, "presentation") : null;
        });
        if (!world.every((point) => point !== null && pointSurvives(point, planes))) continue;
        const screens = world.map((point) => point && projectPoint(point, camera, width, height));
        if (!screens[0] || (screens.length > 1 && !screens[1])) continue;
        const value = record.pose === "rest" ? record.valueM : measurementValue(record.kind, world as Vector3[]);
        const suffix = record.pose === "rest" ? " · original" : " · pose atual";
        marks.push({ start: screens[0], end: screens[1] ?? undefined,
          label: formatMeasurement(value, state.unit) + suffix, kind: "measure" });
      }
    }
    if (!technical && this.candidate?.slot === slot && state.tool === "measure") {
      const point = projectPoint(this.candidate.point, camera, width, height);
      const first = state.draft && this.refs.point(state.draft, "presentation");
      const previous = first && projectPoint(first, camera, width, height);
      if (point) {
        const label = first ? formatMeasurement(first.distanceTo(this.candidate.point), state.unit) : snapNames[this.candidate.mode];
        marks.push({ start: previous || point, end: previous ? point : undefined, label, kind: "candidate" });
      }
    } else if (!technical && state.draft) {
      const first = this.refs.point(state.draft, "presentation");
      const projected = first && projectPoint(first, camera, width, height);
      if (projected && first && pointSurvives(first, planes)) marks.push({ start: projected, kind: "candidate" });
    }
    if (technical?.identifiers) {
      const scope = viewportScope(slot);
      const selected = scope.selectedIds;
      const relevant = selected.length ? selected : [...new Set(state.doc.measurements.filter((record) => record.visible)
        .flatMap((record) => record.anchors.map((anchor) => anchor.elementId)))];
      for (const id of relevant.slice(0, 40)) {
        const object = this.model.objectByComponentId.get(id);
        const bounds = new Box3();
        object?.traverseVisible((child) => {
          const mesh = child as Mesh;
          if (mesh.isMesh) bounds.expandByObject(mesh);
        });
        const retained = clippedBounds(bounds, planes);
        if (retained.isEmpty()) continue;
        const world = retained.getCenter(new Vector3());
        if (!pointSurvives(world, planes)) continue;
        const point = projectPoint(world, camera, width, height);
        if (point) marks.push({ start: point, label: componentLabel(this.model.sceneGraph.components[id], id), kind: "id" });
      }
    }
    return marks;
  }

  private gizmos(section: SectionSettings, camera: Camera, width: number, height: number) {
    const bounds = this.model.model.bounds;
    const extent = Math.max(bounds.getSize(new Vector3()).length(), 1e-6);
    const center = bounds.getCenter(new Vector3());
    return section.planes.flatMap((plane): Gizmo[] => {
      if (!plane.enabled || !plane.gizmo) return [];
      const normal = new Vector3(...axisNormals[plane.axis]);
      const coord = center.clone().addScaledVector(normal, plane.positionM - center.dot(normal));
      const origin = projectPoint(coord, camera, width, height, true);
      const end = projectPoint(coord.clone().addScaledVector(normal, extent / 4), camera, width, height, true);
      if (!origin || !end) return [];
      const dx = end.x - origin.x;
      const dy = end.y - origin.y;
      const length = Math.hypot(dx, dy);
      const index = ["X", "Y", "Z"].indexOf(plane.axis);
      const start = { x: Math.max(18, Math.min(width - 18, origin.x + (index - 1) * 40)), y: Math.max(58, Math.min(height - 70, origin.y + 30)) };
      return [{ plane, start,
        direction: length > 2 ? { x: dx / length, y: dy / length } : { x: 0, y: -1 },
        units: length > 2 ? extent / (4 * length) : extent / Math.max(height, 1),
      }];
    });
  }

  private renderScreen(slot: number, camera: Camera, region: ViewRegion, section: SectionSettings | null, planes: Plane[]) {
    const state = useInspection.getState();
    let panel = this.panels.get(slot);
    const marks = this.marks(slot, camera, region.width, region.height, planes);
    const showGizmos = state.tool === "sections" && slot === usePresentation.getState().active;
    const gizmos = section && showGizmos ? this.gizmos(section, camera, region.width, region.height) : [];
    if (!panel && !marks.length && !gizmos.length) return;
    if (!panel) {
      const root = document.createElement("div");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("aria-hidden", "true");
      root.append(svg);
      this.overlay.append(root);
      panel = { root, svg, handles: new Map() };
      this.panels.set(slot, panel);
    }
    panel.root.hidden = !marks.length && !gizmos.length;
    Object.assign(panel.root.style, { left: region.x + "px", top: region.y + "px", width: region.width + "px", height: region.height + "px" });
    paintSvg(panel.svg, marks, region.width, region.height);
    for (const button of panel.handles.values()) button.hidden = true;
    for (const gizmo of gizmos) {
      let button = panel.handles.get(gizmo.plane.axis);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "gg-inspection-gizmo";
        button.textContent = gizmo.plane.axis;
        button.setAttribute("aria-label", "Mover corte " + gizmo.plane.axis);
        panel.handles.set(gizmo.plane.axis, button);
        panel.root.append(button);
      }
      button.hidden = false;
      button.style.left = gizmo.start.x + "px";
      button.style.top = gizmo.start.y + "px";
      button.style.opacity = String(gizmo.plane.gizmoOpacity);
      if (!this.dragging) this.bindDrag(button, slot, gizmo);
    }
  }

  private bindDrag(button: HTMLButtonElement, slot: number, gizmo: Gizmo) {
    const { plane, direction, units } = gizmo;
    const [min, max] = rangeOnAxis(this.model.model.bounds, plane.axis);
    const setPosition = (positionM: number) => useInspection.getState().patchPlane(slot, plane.axis, { positionM: Math.max(min, Math.min(max, positionM)) });
    button.onkeydown = (event) => {
      if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      setPosition(plane.positionM + (max - min) / 100 * (["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1));
    };
    button.onpointerdown = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const { clientX, clientY, pointerId } = event;
      this.dragging = true;
      button.setPointerCapture(pointerId);
      button.onpointermove = (move) => {
        const delta = (move.clientX - clientX) * direction.x + (move.clientY - clientY) * direction.y;
        setPosition(plane.positionM + delta * units);
      };
      button.onlostpointercapture = () => {
        button.onpointermove = null;
        this.dragging = false;
        this.invalidate();
      };
    };
  }

  capture(slot: number, camera: Camera, ctx: CanvasRenderingContext2D, width: number, height: number, regionWidth: number, options: TechnicalOptions) {
    const state = useInspection.getState();
    const scale = Math.max(1, width / Math.max(regionWidth, 640));
    const w = width / scale;
    const h = height / scale;
    const marks = this.marks(slot, camera, w, h, activeClipping(slot), options);
    if (options.gizmos && state.doc) {
      for (const gizmo of this.gizmos(sectionAt(state.doc.sections, slot), camera, w, h)) {
        marks.push({ start: gizmo.start, label: gizmo.plane.name, kind: "gizmo" });
      }
    }
    let ruler: { width: number; label: string } | undefined;
    if (options.scale && camera instanceof OrthographicCamera) {
      const span = (camera.right - camera.left) / camera.zoom;
      const maximum = span * 0.2;
      const exponent = 10 ** Math.floor(Math.log10(maximum));
      const length = [5, 2, 1].map((step) => step * exponent).find((step) => step <= maximum) ?? exponent;
      ruler = { width: length / span * w, label: formatMeasurement(length, state.unit) };
    }
    paintTechnical(ctx, marks, width, height, scale, this.model.sceneGraph.projectTitle + " · " + state.viewName, ruler);
  }

  dispose() {
    this.disposed = true;
    this.unsubscribe();
    this.overlay.remove();
    for (const entry of this.entries) this.release(entry);
    useInspection.getState().bind(null);
  }
}
