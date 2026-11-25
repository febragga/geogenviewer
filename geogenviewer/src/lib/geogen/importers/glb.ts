import { Box3, LoadingManager, Sphere, type BufferGeometry, type Material, type Object3D, type Texture, type Skeleton, type InstancedMesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const maxGlbBytes = 100 * 1024 * 1024;
export const invalidGlb = "Selecione um arquivo GLB 2.0 válido.";

const requiredExtensions = new Set([
  "EXT_mesh_gpu_instancing", "EXT_texture_avif", "EXT_texture_webp",
  "KHR_lights_punctual", "KHR_mesh_quantization", "KHR_texture_transform", "KHR_materials_unlit",
  "KHR_materials_anisotropy", "KHR_materials_clearcoat", "KHR_materials_diffuse_roughness",
  "KHR_materials_dispersion", "KHR_materials_emissive_strength", "KHR_materials_ior",
  "KHR_materials_iridescence", "KHR_materials_sheen", "KHR_materials_specular",
  "KHR_materials_transmission", "KHR_materials_volume",
]);

export function validateGlb(bytes: ArrayBuffer) {
  if (bytes.byteLength > maxGlbBytes) throw new Error("O arquivo excede 100 MiB.");
  if (bytes.byteLength < 20) throw new Error(invalidGlb);
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) {
    throw new Error(invalidGlb);
  }
  const jsonLength = header.getUint32(12, true);
  if (header.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || jsonLength > bytes.byteLength - 20) {
    throw new Error(invalidGlb);
  }
  for (let offset = 20 + jsonLength; offset < bytes.byteLength;) {
    if (bytes.byteLength - offset < 8) throw new Error(invalidGlb);
    const length = header.getUint32(offset, true);
    if (length % 4 || length > bytes.byteLength - offset - 8) throw new Error(invalidGlb);
    offset += 8 + length;
  }
  const json = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes, 20, jsonLength));
  const document = JSON.parse(json);
  if (document?.asset?.version !== "2.0" || (document.asset.minVersion && document.asset.minVersion !== "2.0")) {
    throw new Error("A versão glTF do arquivo é incompatível.");
  }
  for (const resource of [...(document.buffers ?? []), ...(document.images ?? [])]) {
    if (resource.uri !== undefined && (typeof resource.uri !== "string" || !resource.uri.startsWith("data:"))) {
      throw new Error("O GLB precisa conter todos os buffers e imagens.");
    }
  }
  if (document.extensionsRequired?.some((name: string) =>
    ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_meshopt_compression", "KHR_texture_basisu"].includes(name))) {
    throw new Error("Exporte o GLB sem compressão Draco, Meshopt ou Basis Universal.");
  }
  if (document.extensionsRequired?.some((name: string) => !requiredExtensions.has(name))) {
    throw new Error("O GLB exige uma extensão incompatível com este visualizador.");
  }
  const nodes = document.nodes ?? [];
  if (!Array.isArray(nodes)) throw new Error(invalidGlb);
  const parents = new Set<number>();
  for (const node of nodes) {
    for (const child of node?.children ?? []) {
      if (parents.has(child)) throw new Error("O GLB contém uma hierarquia com pais duplicados.");
      parents.add(child);
    }
  }
  const active = new Set<number>();
  const heights = new Map<number, number>();
  function height(index: number, depth: number): number {
    if (!Number.isInteger(index) || !nodes[index] || active.has(index) || depth > 256) {
      throw new Error("O GLB contém uma hierarquia inválida ou profunda demais.");
    }
    const known = heights.get(index);
    if (known !== undefined) return known;
    active.add(index);
    let result = 0;
    for (const child of nodes[index].children ?? []) result = Math.max(result, 1 + height(child, depth + 1));
    if (result > 256) throw new Error("O GLB contém uma hierarquia profunda demais.");
    active.delete(index);
    heights.set(index, result);
    return result;
  }
  for (let index = 0; index < nodes.length; index++) height(index, 0);
}

function disposeScenes(scenes: readonly Object3D[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<ImageBitmap>();
  const skeletons = new Set<Skeleton>();
  for (const scene of scenes) scene.traverse((object) => {
    const mesh = object as Object3D & { geometry?: BufferGeometry; material?: Material | Material[]; skeleton?: Skeleton };
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
    const instanced = object as InstancedMesh;
    if (instanced.isInstancedMesh) instanced.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) images.add(texture.image);
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export async function importGlb(bytes: ArrayBuffer) {
  validateGlb(bytes);
  const manager = new LoadingManager();
  const urls = new Set<string>();
  let finished = false;
  manager.setURLModifier((url) => {
    if (url.startsWith("blob:")) {
      if (finished) URL.revokeObjectURL(url);
      else urls.add(url);
    }
    if (!finished && /^(blob:|data:)/.test(url)) return url;
    throw new Error("O GLB contém um recurso externo ou foi interrompido.");
  });
  const { scene, scenes } = await new GLTFLoader(manager).parseAsync(bytes, "").finally(() => {
    finished = true;
    for (const url of urls) URL.revokeObjectURL(url);
  });
  try {
    const bounds = new Box3().setFromObject(scene);
    if (bounds.isEmpty() || !Number.isFinite(bounds.getBoundingSphere(new Sphere()).radius)) {
      throw new Error("A cena não contém geometria com dimensões válidas.");
    }
    return { scene, bounds, dispose: () => disposeScenes(scenes) };
  } catch (error) {
    disposeScenes(scenes);
    throw error;
  }
}

export type ImportedModel = Awaited<ReturnType<typeof importGlb>>;
