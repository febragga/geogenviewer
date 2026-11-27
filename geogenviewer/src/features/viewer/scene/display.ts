import {
  Color, EdgesGeometry, LineBasicMaterial, LineSegments, MeshStandardMaterial,
  type BufferGeometry, type Intersection, type Material, type Mesh, type Object3D, type Raycaster,
} from "three";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import type { ResolvedOrganizationView } from "../../../lib/geogen/organization/model";
import type { DisplaySettings } from "../state/presentation-store";
import { defaultEdges, displayProfile, legacySurface, uniformSurface } from "./display-profiles.ts";
import { InstancedBatchManager, DEFAULT_MIN_BATCH_SIZE } from "./instancing.ts";

const defaultSurface = new Color(legacySurface.color);
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
  shadows: [boolean, boolean];
  edges?: LineSegments;
  key?: string;
}

export class SceneDisplay {
  private readonly objects: Renderable[] = [];
  private readonly pickables: Object3D[] = [];
  private readonly variants = new Map<string, Material>();
  private readonly edges = new Map<BufferGeometry, EdgesGeometry>();
  private edgesActive = false;
  private readonly edgeMaterial = new LineBasicMaterial({ ...defaultEdges, transparent: true });
  private materialKey: string | null = null;
  private surface = defaultSurface;
  private roughness = legacySurface.roughness;
  private readonly loaded: LoadedScenePackage;
  private readonly batches: InstancedBatchManager | null = null;

  constructor(loaded: LoadedScenePackage, batchHost?: Object3D, useLocalBatchMatrix = false) {
    this.loaded = loaded;

    loaded.model.scene.traverse((object: Object3D) => {
      if (!("material" in object)) return;
      const obj = object as Mesh;
      if (!obj.material) return;
      this.objects.push({
        object: obj, original: obj.material, visible: obj.visible, shadows: [obj.castShadow, obj.receiveShadow],
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

  intersections(raycaster: Raycaster): Intersection[] {
    this.pickables.length = 0;
    for (const { object, id } of this.objects) {
      if (id && object.visible) this.pickables.push(object);
    }
    if (this.batches?.active && this.batches.group.visible) {
      this.pickables.push(...this.batches.group.children);
    }
    return raycaster.intersectObjects(this.pickables, false);
  }

  resolveHit(hit: Intersection): string | null {
    return this.batches?.active
      ? this.batches.resolveHitComponentId(hit)
      : this.loaded.resolveComponentId(hit.object);
  }

  sourceIntersection(hit: Intersection): Intersection {
    return this.batches?.sourceIntersection(hit) ?? hit;
  }

  syncBatchTransforms(): void {
    this.batches?.syncTransforms();
  }

  apply(settings: DisplaySettings, selected: ReadonlySet<string>, hovered: string | null, hidden: ReadonlySet<string>, isolated: ReadonlySet<string> | null, ghosts: ReadonlySet<string>, overrides?: ReadonlyMap<string, Color>, organization?: ResolvedOrganizationView | null) {
    const profile = displayProfile(settings.mode);
    const material = profile.material ?? legacySurface;
    const materialKey = [profile.surface, material.color, material.roughness, settings.opacity].join(":");
    const settingsKey = [materialKey, organization?.source ?? "cad"].join(":");
    const mode = profile.surface;
    if (materialKey !== this.materialKey) {
      for (const entry of this.objects) {
        entry.object.material = entry.original;
        entry.key = undefined;
      }
      for (const material of this.variants.values()) material.dispose();
      this.variants.clear();
      this.batches?.resetDisplayMaterials();
      this.materialKey = materialKey;
      this.surface = material === legacySurface ? defaultSurface : new Color(material.color);
      this.roughness = material.roughness;
    }

    const edges = profile.edges ?? defaultEdges;
    const showProfileEdges = settings.edges || mode === "technical";
    if (!showProfileEdges && this.edgesActive) this.clearEdges();
    this.edgesActive = showProfileEdges;
    if (showProfileEdges) {
      this.edgeMaterial.color.set(edges.color);
      this.edgeMaterial.opacity = edges.opacity;
    }

    const batchActive = Boolean(this.batches?.active);
    if (this.batches?.active) {
      this.batches.applyDisplayAndVisibility({
        mode,
        opacity: settings.opacity,
        shadows: settings.shadows,
        edges: settings.edges,
        selected,
        hovered,
        hidden,
        isolated,
        ghosts,
        colorForComponent: (id) => this.semanticColor(id, mode, organization),
        overrideColors: overrides,
        clayColor: this.surface,
        roughness: this.roughness,
        selectionColor: selection,
        hoverColor: hover,
      });
    }

    for (const entry of this.objects) {
      const { id, object, original } = entry;
      const isManagedBatch = batchActive && this.batches!.isManaged(object);
      if (isManagedBatch && !object.visible) {
        if (entry.edges) entry.edges.visible = false;
        continue;
      }
      const future = id !== null && ghosts.has(id);
      if (!isManagedBatch) {
        object.visible = entry.visible && (id === null || (!hidden.has(id) && (!isolated || isolated.has(id))));
      }
      const highlight: Highlight = id && selected.has(id) ? "selected" : id && id === hovered ? "hovered" : "";
      const color = (id ? overrides?.get(id) : undefined) ?? this.semanticColor(id, mode, organization);
      const key = [settingsKey, highlight, future, color?.getHexString()].join(":");
      if (key !== entry.key && object.visible) {
        const map = (material: Material) => this.variant(material, object.isMesh, mode, settings.opacity, color, highlight, future, key);
        object.material = Array.isArray(original) ? original.map(map) : map(original);
        entry.key = key;
      }

      const showEdges = object.visible && !future && showProfileEdges;
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

    if (this.variants.size > 512) {
      const inUse = new Set<Material>();
      for (const entry of this.objects) {
        if (!entry.object.visible) {
          entry.object.material = entry.original;
          entry.key = undefined;
        }
        const materials = Array.isArray(entry.object.material) ? entry.object.material : [entry.object.material];
        for (const material of materials) inUse.add(material);
      }
      for (const [key, material] of this.variants) {
        if (inUse.has(material)) continue;
        material.dispose();
        this.variants.delete(key);
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

  private variant(base: Material, mesh: boolean, mode: DisplaySettings["mode"], baseOpacity: number, color: Color | null, highlight: Highlight, ghost: boolean, styleKey: string) {
    const tint = highlight === "selected" ? selection : highlight === "hovered" ? hover : null;
    const opacity = baseOpacity * (ghost ? 0.17 : mode === "xray" ? 0.28 : 1);
    const translucent = ghost || mode === "xray" || baseOpacity < 1;
    if ((!mesh || mode === "material") && !tint && !translucent) return base;
    const useBase = !mesh || mode === "material";
    const baseKey = useBase ? base.uuid : [
      base.side, base.opacity, base.transparent, base.depthWrite, base.alphaTest,
      !color && !uniformSurface(mode) ? (base as Material & { color?: Color }).color?.getHexString() : "",
    ].join(":");
    const key = baseKey + ":" + mesh + ":" + styleKey;
    const existing = this.variants.get(key);
    if (existing) return existing;
    let variant: Material;
    if (useBase) variant = tinted(base, tint, opacity, translucent);
    else {
      const source = base as Material & { color?: Color };
      variant = new MeshStandardMaterial({
        color: color ?? (uniformSurface(mode) ? this.surface : source.color ?? this.surface),
        roughness: this.roughness, side: base.side, opacity: base.opacity * opacity,
        transparent: base.transparent || translucent, depthWrite: base.depthWrite && !translucent,
        alphaTest: base.alphaTest, wireframe: mode === "wireframe",
        emissive: tint ?? 0x000000, emissiveIntensity: tint === selection ? 0.5 : 0.24,
      });
    }
    this.variants.set(key, variant);
    return variant;
  }

  private clearEdges() {
    for (const entry of this.objects) {
      if (entry.edges) entry.object.remove(entry.edges);
      entry.edges = undefined;
    }
    for (const geometry of this.edges.values()) geometry.dispose();
    this.edges.clear();
    this.edgeMaterial.dispose();
  }

  dispose() {
    this.batches?.dispose();
    this.clearEdges();
    for (const { object, original, visible, shadows } of this.objects) {
      object.material = original;
      object.visible = visible;
      [object.castShadow, object.receiveShadow] = shadows;
    }
    for (const material of this.variants.values()) material.dispose();
  }
}
