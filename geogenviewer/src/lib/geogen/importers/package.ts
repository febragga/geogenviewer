import { Box3, Vector3, type BufferGeometry, type Material, type Mesh, type Object3D } from "three";
import { importedComponentIdentity } from "../domain/component-identity.ts";
import {
  type ComponentRecord,
  type GroupRecord,
  type LayerRecord,
  type ManifestV1,
  type MaterialRecord,
  type NodeMatchStrategy,
  type ViewerSceneGraph,
} from "../domain/model.ts";
import {
  ManifestValidationError,
  parseAndValidateManifest,
} from "../validation/manifest.ts";
import { importGlb, type ImportedModel } from "./glb.ts";

export interface LoadedScenePackage {
  manifest?: ManifestV1;
  binarySha256?: string | null;
  model: ImportedModel;
  sceneGraph: ViewerSceneGraph;
  objectByComponentId: Map<string, Object3D>;
  resolveComponentId: (object: Object3D | null) => string | null;
  dispose: () => void;
}

interface SubtreeStats {
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  geometryUuids: Set<string>;
  materialNames: Set<string>;
  bounds: Box3;
}

function measureSubtree(root: Object3D): SubtreeStats {
  const bounds = new Box3();
  const geometryUuids = new Set<string>();
  const materialNames = new Set<string>();
  let meshCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;

  root.updateWorldMatrix(true, true);
  bounds.setFromObject(root);

  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshCount += 1;
    const geom = mesh.geometry as BufferGeometry;
    geometryUuids.add(geom.uuid);

    const pos = geom.getAttribute("position");
    if (pos) vertexCount += pos.count;
    if (geom.index) {
      triangleCount += Math.floor(geom.index.count / 3);
    } else if (pos) {
      triangleCount += Math.floor(pos.count / 3);
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as Material | undefined;
      if (m && m.name?.trim()) materialNames.add(m.name.trim());
    }
  });

  return {
    meshCount,
    vertexCount,
    triangleCount,
    geometryUuids,
    materialNames,
    bounds,
  };
}

function subtreeHasMesh(obj: Object3D): boolean {
  let found = false;
  obj.traverse((child) => {
    if ((child as Mesh).isMesh) found = true;
  });
  return found;
}

function getExtrasId(obj: Object3D): string | null {
  const val = obj.userData?.geogenElementId;
  if (typeof val === "string" && val.trim().length > 0) {
    return val.trim();
  }
  return null;
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._:-]+/g, "_")
    .slice(0, 64);
}

function makePathKey(ancestors: readonly number[], obj: Object3D): string {
  const pathStr = ancestors.join(".");
  const label = sanitizeToken(obj.name || "node");
  return `glb:${label}:${pathStr}`;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(hashBuffer);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function optionalBinaryHash(bytes: ArrayBuffer) {
  try { return await sha256Hex(bytes); } catch { return null; }
}

function buildHierarchyMaps(
  layers: ManifestV1["layers"],
  groups: ManifestV1["groups"]
): {
  layerMap: Record<string, LayerRecord>;
  rootLayerIds: string[];
  groupMap: Record<string, GroupRecord>;
  rootGroupIds: string[];
} {
  const layerMap: Record<string, LayerRecord> = Object.create(null);
  const rootLayerIds: string[] = [];
  for (const l of layers) {
    layerMap[l.id] = {
      id: l.id,
      name: l.name,
      parentId: l.parentId,
      fullPath: l.fullPath ?? l.name,
      colorHex: l.colorHex ?? null,
      defaultVisible: l.visible ?? true,
      childLayerIds: [],
      elementIds: [],
    };
  }
  for (const l of layers) {
    if (l.parentId && layerMap[l.parentId]) {
      layerMap[l.parentId].childLayerIds.push(l.id);
    } else {
      rootLayerIds.push(l.id);
    }
  }

  const groupMap: Record<string, GroupRecord> = Object.create(null);
  const rootGroupIds: string[] = [];
  for (const g of groups) {
    groupMap[g.id] = {
      id: g.id,
      name: g.name,
      parentId: g.parentId,
      childGroupIds: [],
      elementIds: [],
    };
  }
  for (const g of groups) {
    if (g.parentId && groupMap[g.parentId]) {
      groupMap[g.parentId].childGroupIds.push(g.id);
    } else {
      rootGroupIds.push(g.id);
    }
  }

  return { layerMap, rootLayerIds, groupMap, rootGroupIds };
}

function mapMeshesToComponents(
  objectByComponentId: ReadonlyMap<string, Object3D>
): WeakMap<Object3D, string> {
  // Store only component roots so resolveComponentId() walks up to the nearest owning component.
  const meshToComponent = new WeakMap<Object3D, string>();
  for (const [componentId, root] of objectByComponentId.entries()) {
    meshToComponent.set(root, componentId);
  }
  return meshToComponent;
}

function countSharedGeometries(
  objectByComponentId: ReadonlyMap<string, Object3D>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const root of objectByComponentId.values()) {
    const localSet = new Set<string>();
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh && mesh.geometry) {
        localSet.add(mesh.geometry.uuid);
      }
    });
    for (const uuid of localSet) {
      counts.set(uuid, (counts.get(uuid) ?? 0) + 1);
    }
  }
  return counts;
}

export async function importGlbBasicPackage(
  glbBytes: ArrayBuffer,
  fileName: string
): Promise<LoadedScenePackage> {
  const model = await importGlb(glbBytes);
  try {
    const binarySha256 = await optionalBinaryHash(glbBytes);
    const warnings: string[] = [];
    const components: Record<string, ComponentRecord> = Object.create(null);
    const componentOrder: string[] = [];
    const rootComponentIds: string[] = [];
    const objectByComponentId = new Map<string, Object3D>();
    const seenIds = new Set<string>();

    let totalNodes = 0;
    model.scene.traverse((obj) => {
      if (obj !== model.scene) totalNodes += 1;
    });

    function visitNode(
      obj: Object3D,
      pathIndices: number[],
      parentComponentId: string | null,
      ancestorHasElementId: boolean
    ): void {
      const rawExtrasId = getExtrasId(obj);
      const hasMeshDescendant = subtreeHasMesh(obj);
      if (!rawExtrasId && !hasMeshDescendant) return;

      // If an ancestor already claimed geogenElementId, do not allow nested element roots;
      // descendents belong to the owning composite root.
      if (rawExtrasId && ancestorHasElementId) {
        warnings.push(
          `Nó aninhado "${obj.name || rawExtrasId}" possui geogenElementId dentro de outro componente; tratado como sub-malha do pai.`
        );
        return;
      }

      // If this node has geogenElementId OR is a direct mesh leaf OR is a container with multiple child branches without geogenElementId
      const isDirectMesh = Boolean((obj as Mesh).isMesh);
      const childWithMeshCount = obj.children.filter((c) => subtreeHasMesh(c)).length;
      const shouldBeComponent =
        Boolean(rawExtrasId) ||
        isDirectMesh ||
        (childWithMeshCount === 0 && hasMeshDescendant);

      if (shouldBeComponent) {
        let id = rawExtrasId ?? makePathKey(pathIndices, obj);
        if (seenIds.has(id)) {
          let suffix = 2;
          while (seenIds.has(`${id}#${suffix}`)) suffix += 1;
          const disambiguated = `${id}#${suffix}`;
          warnings.push(
            `Identificador duplicado "${id}" no GLB em modo básico; renomeado na sessão para "${disambiguated}".`
          );
          id = disambiguated;
        }
        seenIds.add(id);

        const stats = measureSubtree(obj);
        const sizeVec = stats.bounds.isEmpty()
          ? new Vector3(0, 0, 0)
          : stats.bounds.getSize(new Vector3());
        const minArr: [number, number, number] = stats.bounds.isEmpty()
          ? [0, 0, 0]
          : [stats.bounds.min.x, stats.bounds.min.y, stats.bounds.min.z];
        const maxArr: [number, number, number] = stats.bounds.isEmpty()
          ? [0, 0, 0]
          : [stats.bounds.max.x, stats.bounds.max.y, stats.bounds.max.z];

        components[id] = {
          id,
          name: obj.name?.trim() || id,
          identity: importedComponentIdentity({ glbNames: model.sourceNames.get(obj) ?? [], extras: obj.userData }),
          category: "other",
          sourceObjectId: null,
          layerId: null,
          groupIds: [],
          materialId: null,
          materialNames: Array.from(stats.materialNames),
          parentId: parentComponentId,
          childIds: [],
          blockDefinitionId: null,
          instancePath: null,
          isComposite: stats.meshCount > 1,
          isInstance: false,
          meshCount: stats.meshCount,
          vertexCount: stats.vertexCount,
          triangleCount: stats.triangleCount,
          meshBoundsMeters: [sizeVec.x, sizeVec.y, sizeVec.z],
          meshMinMaxMeters: { min: minArr, max: maxArr },
          cad: null,
        };
        componentOrder.push(id);
        objectByComponentId.set(id, obj);

        if (parentComponentId && components[parentComponentId]) {
          components[parentComponentId].childIds.push(id);
        } else {
          rootComponentIds.push(id);
        }

        // If it had no rawExtrasId and has child branches, also inspect non-self children only if not a leaf mesh
        if (!rawExtrasId && !isDirectMesh && obj.children.length > 0) {
          obj.children.forEach((child, idx) => {
            visitNode(child, [...pathIndices, idx], id, false);
          });
        } else if (rawExtrasId && obj.children.length > 0) {
          obj.traverse((descendant) => {
            if (descendant === obj) return;
            const nestedId = getExtrasId(descendant);
            if (nestedId) {
              warnings.push(
                `Nó aninhado "${descendant.name || nestedId}" possui geogenElementId dentro de "${id}"; tratado como sub-malha do pai.`
              );
            }
          });
        }
        return;
      }

      // Structural grouping node (no geogenElementId, not a direct mesh):
      // Create a logical parent container node so nested GLB hierarchies appear in the tree!
      let containerId = makePathKey(pathIndices, obj);
      if (seenIds.has(containerId)) {
        let suffix = 2;
        while (seenIds.has(`${containerId}#${suffix}`)) suffix += 1;
        containerId = `${containerId}#${suffix}`;
      }
      seenIds.add(containerId);

      const stats = measureSubtree(obj);
      const sizeVec = stats.bounds.isEmpty()
        ? new Vector3(0, 0, 0)
        : stats.bounds.getSize(new Vector3());
      components[containerId] = {
        id: containerId,
        name: obj.name?.trim() || `Grupo ${pathIndices.join(".")}`,
        category: "other",
        sourceObjectId: null,
        layerId: null,
        groupIds: [],
        materialId: null,
        materialNames: Array.from(stats.materialNames),
        parentId: parentComponentId,
        childIds: [],
        blockDefinitionId: null,
        instancePath: null,
        isComposite: stats.meshCount > 1,
        isInstance: false,
        meshCount: stats.meshCount,
        vertexCount: stats.vertexCount,
        triangleCount: stats.triangleCount,
        meshBoundsMeters: [sizeVec.x, sizeVec.y, sizeVec.z],
        meshMinMaxMeters: {
          min: stats.bounds.isEmpty()
            ? [0, 0, 0]
            : [stats.bounds.min.x, stats.bounds.min.y, stats.bounds.min.z],
          max: stats.bounds.isEmpty()
            ? [0, 0, 0]
            : [stats.bounds.max.x, stats.bounds.max.y, stats.bounds.max.z],
        },
        cad: null,
      };
      componentOrder.push(containerId);
      objectByComponentId.set(containerId, obj);
      if (parentComponentId && components[parentComponentId]) {
        components[parentComponentId].childIds.push(containerId);
      } else {
        rootComponentIds.push(containerId);
      }

      obj.children.forEach((child, idx) => {
        visitNode(child, [...pathIndices, idx], containerId, false);
      });
    }

    model.scene.children.forEach((child, idx) => {
      visitNode(child, [idx], null, false);
    });

    // Mark instances sharing geometry UUIDs
    const geomCounts = countSharedGeometries(objectByComponentId);
    let totalMeshes = 0;
    let totalVertices = 0;
    let totalTriangles = 0;
    for (const id of componentOrder) {
      const comp = components[id];
      const obj = objectByComponentId.get(id);
      if (comp.childIds.length === 0) {
        totalMeshes += comp.meshCount;
        totalVertices += comp.vertexCount;
        totalTriangles += comp.triangleCount;
      }
      if (obj) {
        let shared = false;
        obj.traverse((child) => {
          const mesh = child as Mesh;
          if (mesh.isMesh && mesh.geometry && (geomCounts.get(mesh.geometry.uuid) ?? 0) > 1) {
            shared = true;
          }
        });
        comp.isInstance = shared;
      }
    }

    const meshToComponent = mapMeshesToComponents(objectByComponentId);
    const sceneSize = model.bounds.getSize(new Vector3());

    const sceneGraph: ViewerSceneGraph = {
      mode: "glb-basic",
      fileName,
      fileSizeBytes: glbBytes.byteLength,
      projectTitle: fileName,
      revisionId: null,
      geometryKind: "unknown",
      scaleDenominator: null,
      displayUnit: "mm",
      sourceApplication: null,
      sourceUnit: null,
      totalNodes,
      totalMeshes,
      totalVertices,
      totalTriangles,
      sceneBoundsMeters: [sceneSize.x, sceneSize.y, sceneSize.z],
      components,
      componentOrder,
      rootComponentIds,
      layers: {},
      rootLayerIds: [],
      groups: {},
      rootGroupIds: [],
      materials: {},
      diagnostics: {
        sha256Verified: null,
        nodeMatchStrategy: "extras",
        warnings,
        matchedCount: componentOrder.length,
      },
    };

    return {
      model,
      binarySha256,
      sceneGraph,
      objectByComponentId,
      resolveComponentId(object) {
        let cursor: Object3D | null = object;
        while (cursor) {
          const found = meshToComponent.get(cursor);
          if (found) return found;
          cursor = cursor.parent;
        }
        return null;
      },
      dispose: () => model.dispose(),
    };
  } catch (err) {
    model.dispose();
    throw err;
  }
}

export async function importGlbWithManifestPackage(
  glbBytes: ArrayBuffer,
  manifestBytes: ArrayBuffer,
  fileName: string
): Promise<LoadedScenePackage> {
  const manifest = parseAndValidateManifest(manifestBytes);
  const warnings: string[] = [];

  let sha256Verified: boolean | null = null;
  let binarySha256: string | null = null;
  if (manifest.geometry.sha256) {
    const actual = await sha256Hex(glbBytes);
    if (actual.toLowerCase() !== manifest.geometry.sha256.toLowerCase()) {
      throw new ManifestValidationError(
        "SHA256_MISMATCH",
        `Integridade SHA-256 do GLB divergiu do manifesto (esperado ${manifest.geometry.sha256.slice(0, 12)}…, obtido ${actual.slice(0, 12)}…).`
      );
    }
    sha256Verified = true;
    binarySha256 = actual;
  } else {
    binarySha256 = await optionalBinaryHash(glbBytes);
    warnings.push(
      "O manifesto não declara geometry.sha256; a integridade binária do GLB não foi verificada."
    );
  }

  const model = await importGlb(glbBytes);
  try {
    const strategy: NodeMatchStrategy =
      manifest.geometry.nodeMatchStrategy ?? "extras";

    const glbById = new Map<string, Object3D>();
    const glbByName = new Map<string, Object3D[]>();

    model.scene.traverse((obj) => {
      if (obj === model.scene) return;
      const extrasId = getExtrasId(obj);
      if (extrasId) {
        if (glbById.has(extrasId)) {
          throw new ManifestValidationError(
            "DUPLICATE_GLB_ID",
            `O GLB contém identificador duplicado "${extrasId}" em extras.geogenElementId.`
          );
        }
        // Check no ancestor already has geogenElementId
        let p = obj.parent;
        while (p && p !== model.scene) {
          if (getExtrasId(p)) {
            throw new ManifestValidationError(
              "NESTED_GLB_ID",
              `O GLB contém raiz de elemento aninhada "${extrasId}" dentro de outro elemento.`
            );
          }
          p = p.parent;
        }
        glbById.set(extrasId, obj);
      }
      if (obj.name?.trim()) {
        const list = glbByName.get(obj.name.trim()) ?? [];
        list.push(obj);
        glbByName.set(obj.name.trim(), list);
      }
    });

    const objectByComponentId = new Map<string, Object3D>();
    const ownerByNode = new Map<Object3D, string>();
    for (const el of manifest.elements) {
      let matched: Object3D | undefined;
      if (strategy === "extras") {
        matched = glbById.get(el.id);
      } else if (strategy === "nameExact") {
        const key = el.glbNodeName?.trim() || el.name;
        const candidates = glbByName.get(key) ?? [];
        if (candidates.length > 1) {
          throw new ManifestValidationError(
            "AMBIGUOUS_GLB_MATCH",
            `Correspondência ambígua para "${el.id}": múltiplos nós GLB chamados "${key}".`
          );
        }
        matched = candidates[0];
      } else if (strategy === "namePrefix") {
        const prefix = el.glbNodeName?.trim() || el.id;
        const matches: Object3D[] = [];
        for (const [name, objs] of glbByName.entries()) {
          if (name.startsWith(prefix)) matches.push(...objs);
        }
        if (matches.length > 1) {
          throw new ManifestValidationError(
            "AMBIGUOUS_GLB_MATCH",
            `Correspondência ambígua por prefixo "${prefix}" para elemento "${el.id}".`
          );
        }
        matched = matches[0];
      }

      if (!matched) {
        throw new ManifestValidationError(
          "MISSING_GLB_NODE",
          `Elemento "${el.id}" (${el.name}) declarado no manifesto não foi encontrado no GLB pela estratégia "${strategy}".`
        );
      }
      const owner = ownerByNode.get(matched);
      if (owner) {
        throw new ManifestValidationError(
          "DUPLICATE_NODE_OWNER",
          `Os elementos "${owner}" e "${el.id}" apontam para o mesmo nó GLB.`
        );
      }
      if (!subtreeHasMesh(matched)) {
        throw new ManifestValidationError("MISSING_ELEMENT_MESH", `O elemento "${el.id}" está vinculado a um nó GLB sem malhas.`);
      }
      ownerByNode.set(matched, el.id);
      objectByComponentId.set(el.id, matched);
    }
    for (const [id, obj] of objectByComponentId) {
      for (let parent = obj.parent; parent; parent = parent.parent) {
        if (ownerByNode.has(parent)) {
          throw new ManifestValidationError(
            "NESTED_GLB_ID",
            `O elemento "${id}" aponta para uma sub-malha de "${ownerByNode.get(parent)}".`
          );
        }
      }
    }

    if (strategy === "extras" && glbById.size > manifest.elements.length) {
      for (const extraId of glbById.keys()) {
        if (!objectByComponentId.has(extraId)) {
          warnings.push(`Nó GLB "${extraId}" não está listado em elements[].`);
        }
      }
    }

    const { layerMap, rootLayerIds, groupMap, rootGroupIds } =
      buildHierarchyMaps(manifest.layers, manifest.groups);

    const materialMap: Record<string, MaterialRecord> = Object.create(null);
    for (const m of manifest.materials) {
      materialMap[m.id] = {
        id: m.id,
        name: m.name,
        colorHex: m.colorHex ?? null,
        densityKgM3: m.densityKgM3 ?? null,
      };
    }

    const geomCounts = countSharedGeometries(objectByComponentId);
    const components: Record<string, ComponentRecord> = Object.create(null);
    const componentOrder: string[] = [];
    const rootComponentIds: string[] = [];

    let totalNodes = 0;
    model.scene.traverse((obj) => {
      if (obj !== model.scene) totalNodes += 1;
    });

    let totalMeshes = 0;
    let totalVertices = 0;
    let totalTriangles = 0;

    for (const el of manifest.elements) {
      const obj = objectByComponentId.get(el.id)!;
      const stats = measureSubtree(obj);
      const sizeVec = stats.bounds.isEmpty()
        ? new Vector3(0, 0, 0)
        : stats.bounds.getSize(new Vector3());
      const minArr: [number, number, number] = stats.bounds.isEmpty()
        ? [0, 0, 0]
        : [stats.bounds.min.x, stats.bounds.min.y, stats.bounds.min.z];
      const maxArr: [number, number, number] = stats.bounds.isEmpty()
        ? [0, 0, 0]
        : [stats.bounds.max.x, stats.bounds.max.y, stats.bounds.max.z];

      let sharedGeom = false;
      obj.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh && mesh.geometry && (geomCounts.get(mesh.geometry.uuid) ?? 0) > 1) {
          sharedGeom = true;
        }
      });

      const matNames = new Set(stats.materialNames);
      if (el.materialId && materialMap[el.materialId]) {
        matNames.add(materialMap[el.materialId].name);
      }

      components[el.id] = {
        id: el.id,
        name: el.name,
        identity: importedComponentIdentity({
          manifestName: el.name, glbNames: [...(model.sourceNames.get(obj) ?? []), el.glbNodeName],
          extras: obj.userData, properties: el.properties, userText: el.userText,
        }),
        category: el.category,
        sourceObjectId: el.sourceObjectId ?? null,
        layerId: el.layerId,
        groupIds: [...el.groupIds],
        materialId: el.materialId,
        materialNames: Array.from(matNames),
        parentId: el.parentId ?? null,
        childIds: [],
        blockDefinitionId: el.blockDefinitionId ?? null,
        instancePath: el.instancePath ?? null,
        isComposite: stats.meshCount > 1 || el.geometryType === "composite",
        isInstance: Boolean(el.blockDefinitionId) || sharedGeom,
        meshCount: stats.meshCount,
        vertexCount: stats.vertexCount,
        triangleCount: stats.triangleCount,
        meshBoundsMeters: [sizeVec.x, sizeVec.y, sizeVec.z],
        meshMinMaxMeters: { min: minArr, max: maxArr },
        cad: {
          geometryType: el.geometryType ?? null,
          colorHex: el.colorHex ?? null,
          isClosed: el.isClosed ?? null,
          isValid: el.isValid ?? null,
          boundingBoxM: el.boundingBoxM ?? null,
          dimensions: el.dimensions ?? null,
          areaM2: el.areaM2 ?? null,
          volumeM3: el.volumeM3 ?? null,
          centroidM: el.centroidM ?? null,
          explodeOffsetM: el.explodeOffsetM ?? null,
          assemblyDirectionM: el.assemblyDirectionM ?? null,
          connectorIds: el.connectorIds ? [...el.connectorIds] : [],
          userText: el.userText ?? {},
          properties: el.properties ?? {},
          fabrication: el.fabrication ?? null,
        },
      };

      componentOrder.push(el.id);
      if (el.layerId && layerMap[el.layerId]) {
        layerMap[el.layerId].elementIds.push(el.id);
      }
      for (const gid of el.groupIds) {
        if (groupMap[gid]) groupMap[gid].elementIds.push(el.id);
      }

      totalMeshes += stats.meshCount;
      totalVertices += stats.vertexCount;
      totalTriangles += stats.triangleCount;
    }

    for (const el of manifest.elements) {
      if (el.parentId && components[el.parentId]) {
        components[el.parentId].childIds.push(el.id);
      } else {
        rootComponentIds.push(el.id);
      }
    }

    const meshToComponent = mapMeshesToComponents(objectByComponentId);
    const sceneSize = model.bounds.getSize(new Vector3());

    const sceneGraph: ViewerSceneGraph = {
      mode: "manifest-full",
      fileName,
      fileSizeBytes: glbBytes.byteLength,
      projectTitle: manifest.project.title,
      revisionId: manifest.project.revisionId,
      geometryKind: manifest.project.geometryKind,
      scaleDenominator: manifest.project.scaleDenominator,
      displayUnit: manifest.project.displayUnit,
      sourceApplication: manifest.source.application,
      sourceUnit: manifest.source.sourceUnit,
      totalNodes,
      totalMeshes,
      totalVertices,
      totalTriangles,
      sceneBoundsMeters: [sceneSize.x, sceneSize.y, sceneSize.z],
      components,
      componentOrder,
      rootComponentIds,
      layers: layerMap,
      rootLayerIds,
      groups: groupMap,
      rootGroupIds,
      materials: materialMap,
      diagnostics: {
        sha256Verified,
        nodeMatchStrategy: strategy,
        warnings,
        matchedCount: componentOrder.length,
      },
    };

    return {
      manifest,
      binarySha256,
      model,
      sceneGraph,
      objectByComponentId,
      resolveComponentId(object) {
        let cursor: Object3D | null = object;
        while (cursor) {
          const found = meshToComponent.get(cursor);
          if (found) return found;
          cursor = cursor.parent;
        }
        return null;
      },
      dispose: () => model.dispose(),
    };
  } catch (err) {
    model.dispose();
    throw err;
  }
}
