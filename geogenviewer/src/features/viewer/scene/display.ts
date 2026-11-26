import {
  Color, EdgesGeometry, LineBasicMaterial, LineSegments, MeshStandardMaterial,
  type BufferGeometry, type Intersection, type Material, type Mesh, type Object3D,
} from "three";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { ResolvedOrganizationView } from "../../../lib/geogen/organization/model";
import type { DisplaySettings } from "../state/presentation-store";
import { InstancedBatchManager, DEFAULT_MIN_BATCH_SIZE } from "./instancing.ts";

const clay = new Color("#c9c5ba");
const selection = new Color("#5cb3e8");
const hover = new Color("#89c9ee");

function palette(key: string) {
  let hash = 0;
  for (const character of key) hash = Math.imul(hash, 31) + character.charCodeAt(0);
  return new Color().setHSL(((hash >>> 0) % 360) / 360, 0.34, 0.58);
}

function tinted(base: Material, tint: Color | null, opacity: number, translucent: boolean) {
  const clone = base.clone() as Material & { color?: Color; emissive?: Color; emissiveIntensity?: number };
  if (tint) {
    if (clone.emissive) {
      clone.emissive.copy(tint);
      clone.emissiveIntensity = tint === selection ? 0.5 : 0.24;
    } else clone.color?.lerp(tint, 0.55);
  }
  clone.opacity *= opacity;
  clone.transparent ||= translucent || clone.opacity < 1;
  if (translucent) clone.depthWrite = false;
  return clone;
}

type Highlight = "selected" | "hovered" | "";
interface Renderable {
  object: Mesh;
  id: string | null;
  original: Material | Material[];
  visible: boolean;
  edges?: LineSegments;
  key?: string;
}

export class SceneDisplay {
  private readonly objects: Renderable[] = [];
  private readonly variants = new Map<string, Material>();
  private readonly edges = new Map<BufferGeometry, EdgesGeometry>();
  private readonly edgeMaterial = new LineBasicMaterial({ color: "#354457", transparent: true, opacity: 0.72 });
  private materialOpacity: number | null = null;
  private readonly loaded: LoadedScenePackage;
  private readonly batches: InstancedBatchManager | null = null;
  private readonly useLocalBatchMatrix: boolean;

  constructor(loaded: LoadedScenePackage, batchHost?: Object3D, useLocalBatchMatrix = false) {
    this.loaded = loaded;
    this.useLocalBatchMatrix = useLocalBatchMatrix;
    loaded.model.scene.traverse((object: Object3D) => {
      if (!("material" in object)) return;
      const obj = object as Mesh;
      if (!obj.material) return;
      this.objects.push({
        object: obj, original: obj.material, visible: obj.visible,
        id: loaded.resolveComponentId(obj),
      });
    });
    if (batchHost) {
      this.batches = new InstancedBatchManager(
        loaded.model.scene,
        batchHost,
        loaded.resolveComponentId,
        DEFAULT_MIN_BATCH_SIZE,
        useLocalBatchMatrix
      );
    }
  }

  batchGroup(): Object3D | null {
    return this.batches?.active ? this.batches.group : null;
  }

  resolveHit(hit: Intersection): string | null {
    return this.batches?.active
      ? this.batches.resolveHitComponentId(hit)
      : this.loaded.resolveComponentId(hit.object);
  }

  syncBatchTransforms(): void {
    this.batches?.syncTransforms(this.loaded.model.scene);
  }

  apply(settings: DisplaySettings, selected: ReadonlySet<string>, hovered: string | null, hidden: ReadonlySet<string>, isolated: ReadonlySet<string> | null, ghosts: ReadonlySet<string>, overrides?: ReadonlyMap<string, Color>, organization?: ResolvedOrganizationView | null) {
    const settingsKey = [settings.mode, settings.opacity, organization?.source ?? "cad"].join(":");
    if (settings.opacity !== this.materialOpacity) {
      for (const entry of this.objects) {
        entry.object.material = entry.original;
        entry.key = undefined;
      }
      for (const material of this.variants.values()) material.dispose();
      this.variants.clear();
      this.materialOpacity = settings.opacity;
    }

    const batchActive = Boolean(this.batches?.active);
    if (this.batches?.active) {
      this.batches.applyDisplayAndVisibility({
        mode: settings.mode,
        opacity: settings.opacity,
        shadows: settings.shadows,
        selected,
        hovered,
        hidden,
        isolated,
        ghosts,
        colorForComponent: (id) => this.semanticColor(id, settings.mode, organization),
        overrideColors: overrides,
        clayColor: clay,
        selectionColor: selection,
        hoverColor: hover,
      });
    }

    for (const entry of this.objects) {
      const { id, object, original } = entry;
      const future = id !== null && ghosts.has(id);
      const isManagedBatch = batchActive && this.batches!.isManaged(object);
      if (!isManagedBatch) {
        object.visible = entry.visible && (id === null || (!hidden.has(id) && (!isolated || isolated.has(id))));
      }
      const highlight: Highlight = id && selected.has(id) ? "selected" : id && id === hovered ? "hovered" : "";
      const color = (id ? overrides?.get(id) : undefined) ?? this.semanticColor(id, settings.mode, organization);
      const key = [settingsKey, highlight, future, color?.getHexString()].join(":");
      if (key !== entry.key && object.visible) {
        const map = (material: Material) => this.variant(material, object.isMesh, settings, color, highlight, future, key);
        object.material = Array.isArray(original) ? original.map(map) : map(original);
        entry.key = key;
      }

      const showEdges = object.visible && !future && (settings.edges || settings.mode === "technical");
      if (showEdges && object.isMesh && !entry.edges) {
        const geometry = object.geometry;
        let edge = this.edges.get(geometry);
        if (!edge) {
          edge = new EdgesGeometry(geometry, 22);
          this.edges.set(geometry, edge);
        }
        const lines = new LineSegments(edge, this.edgeMaterial);
        lines.raycast = () => {};
        object.add(lines);
        entry.edges = lines;
      }
      if (entry.edges) entry.edges.visible = showEdges;
      if (object.isMesh && !isManagedBatch) {
        object.castShadow = object.visible && !future && settings.shadows;
        object.receiveShadow = settings.shadows;
      }
    }
  }

  private semanticColor(id: string | null, mode: DisplaySettings["mode"], organization?: ResolvedOrganizationView | null) {
    const graph = this.loaded.sceneGraph;
    const component = id ? graph.components[id] : undefined;
    if (!component) return null;
    if (mode === "layer") {
      if (organization?.source === "user") {
        const userLayerId = organization.componentLayerId[id!];
        if (userLayerId && organization.layers[userLayerId]) {
          return new Color(organization.layers[userLayerId].color);
        }
        return null;
      }
      if (component.layerId) {
        const layer = graph.layers[component.layerId];
        return layer?.colorHex ? new Color(layer.colorHex) : palette(component.layerId);
      }
    }
    if (mode === "category" && graph.mode === "manifest-full") return palette(component.category);
    if (mode === "semanticMaterial" && component.materialId) {
      const material = graph.materials[component.materialId];
      return material?.colorHex ? new Color(material.colorHex) : palette(component.materialId);
    }
    return null;
  }

  private variant(base: Material, mesh: boolean, settings: DisplaySettings, color: Color | null, highlight: Highlight, ghost: boolean, styleKey: string) {
    const { mode } = settings;
    const tint = highlight === "selected" ? selection : highlight === "hovered" ? hover : null;
    const opacity = settings.opacity * (ghost ? 0.17 : mode === "xray" ? 0.28 : 1);
    const translucent = ghost || mode === "xray" || settings.opacity < 1;
    if ((!mesh || mode === "material") && !tint && !translucent) return base;
    const key = base.uuid + ":" + mesh + ":" + styleKey;
    const existing = this.variants.get(key);
    if (existing) return existing;
    let variant: Material;
    if (!mesh || mode === "material") variant = tinted(base, tint, opacity, translucent);
    else {
      const source = base as Material & { color?: Color };
      variant = new MeshStandardMaterial({
        color: color ?? (["clay", "technical", "layer", "category", "semanticMaterial"].includes(mode) ? clay : source.color ?? clay),
        roughness: 0.85, side: base.side, opacity: base.opacity * opacity,
        transparent: base.transparent || translucent, depthWrite: base.depthWrite && !translucent,
        alphaTest: base.alphaTest, wireframe: mode === "wireframe",
        emissive: tint ?? 0x000000, emissiveIntensity: tint === selection ? 0.5 : 0.24,
      });
    }
    this.variants.set(key, variant);
    return variant;
  }

  dispose() {
    this.batches?.dispose();
    for (const { object, original, visible, edges } of this.objects) {
      object.material = original;
      object.visible = visible;
      if (edges) object.remove(edges);
    }
    for (const geometry of this.edges.values()) geometry.dispose();
    for (const material of this.variants.values()) material.dispose();
    this.edgeMaterial.dispose();
    void this.useLocalBatchMatrix;
  }
}
