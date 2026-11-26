import {
  Color, EdgesGeometry, LineBasicMaterial, LineSegments, MeshStandardMaterial,
  type BufferGeometry, type Material, type Mesh, type Object3D,
} from "three";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { DisplaySettings } from "../state/presentation-store";

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

  constructor(loaded: LoadedScenePackage) {
    this.loaded = loaded;
    loaded.model.scene.traverse((object: Object3D) => {
      if (!("material" in object)) return;
      const obj = object as Mesh;
      if (!obj.material) return;
      this.objects.push({
        object: obj, original: obj.material, visible: obj.visible,
        id: loaded.resolveComponentId(obj),
      });
    });
  }

  apply(settings: DisplaySettings, selected: ReadonlySet<string>, hovered: string | null, hidden: ReadonlySet<string>, isolated: ReadonlySet<string> | null, ghosts: ReadonlySet<string>) {
    const settingsKey = [settings.mode, settings.opacity].join(":");
    if (settings.opacity !== this.materialOpacity) {
      for (const entry of this.objects) {
        entry.object.material = entry.original;
        entry.key = undefined;
      }
      for (const material of this.variants.values()) material.dispose();
      this.variants.clear();
      this.materialOpacity = settings.opacity;
    }
    for (const entry of this.objects) {
      const { id, object, original } = entry;
      const future = id !== null && ghosts.has(id);
      object.visible = entry.visible && (id === null || (!hidden.has(id) && (!isolated || isolated.has(id))));
      const highlight: Highlight = id && selected.has(id) ? "selected" : id && id === hovered ? "hovered" : "";
      const color = this.semanticColor(id, settings.mode);
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
      if (object.isMesh) {
        object.castShadow = object.visible && !future && settings.shadows;
        object.receiveShadow = settings.shadows;
      }
    }
  }

  private semanticColor(id: string | null, mode: DisplaySettings["mode"]) {
    const graph = this.loaded.sceneGraph;
    const component = id ? graph.components[id] : undefined;
    if (!component) return null;
    if (mode === "layer" && component.layerId) {
      const layer = graph.layers[component.layerId];
      return layer?.colorHex ? new Color(layer.colorHex) : palette(component.layerId);
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
    for (const { object, original, visible, edges } of this.objects) {
      object.material = original;
      object.visible = visible;
      if (edges) object.remove(edges);
    }
    for (const geometry of this.edges.values()) geometry.dispose();
    for (const material of this.variants.values()) material.dispose();
    this.edgeMaterial.dispose();
  }
}
