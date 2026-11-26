"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Box3, DirectionalLight, EdgesGeometry, HemisphereLight, LineBasicMaterial, LineSegments, Matrix4, MeshStandardMaterial, OrthographicCamera, Scene,
  Vector3, type BufferGeometry, type InstancedMesh, type Object3D, type Plane, type WebGLRenderer } from "three";
import { viewDirections, viewUp, type ViewPreset } from "./camera-state";
import { capturePng } from "./viewport-cameras";
import type { Revision, Triple } from "../../../lib/geogen/revisions/revision";
import type { ThumbnailStyle } from "../../../lib/geogen/documentation/document";
import { drawCallouts, projectCallouts, type annotationModel } from "../../../lib/geogen/documentation/callouts";

export interface DocumentationImage {
  revision: Revision;
  ids: readonly string[];
  orientation: ViewPreset;
  style: ThumbnailStyle;
  width: number;
  background?: string;
  transparent?: boolean;
  planes?: Plane[];
  componentFrame?: string;
  layoutPose?: ReadonlyMap<string, Matrix4>;
  annotations?: ReturnType<typeof annotationModel>;
  leaders?: boolean;
  scale?: boolean;
  assembly?: { time: number; step: number; stage: "before" | "during" | "after"; offsets: ReadonlyMap<string, Triple> };
}
export type RenderDocumentationImage = (request: DocumentationImage, signal?: AbortSignal) => Promise<Blob>;
const abortError = () => new DOMException("Solicitação cancelada.", "AbortError");

export class ThumbnailQueue {
  private readonly cache = new Map<string, Blob>();
  private readonly pending: { request: DocumentationImage; signal?: AbortSignal; resolve: (blob: Blob) => void; reject: (reason: unknown) => void }[] = [];
  private frame = 0;
  private busy = false;
  private disposed = false;

  constructor(private readonly draw: RenderDocumentationImage, private readonly limit = 96) {}

  request: RenderDocumentationImage = (request, signal) => {
    if (this.disposed || signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      this.pending.push({ request, signal, resolve, reject });
      this.schedule();
    });
  };

  private schedule() {
    if (this.busy || this.frame || this.disposed || !this.pending.length) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      void this.next();
    });
  }

  private async next() {
    const job = this.pending.shift();
    if (!job) return;
    this.busy = true;
    try {
      if (this.disposed || job.signal?.aborted) throw abortError();
      const request = job.request;
      const { revision, ids, orientation, style, width, background, transparent, planes, assembly, componentFrame, annotations } = request;
      const key = width <= 256 && !planes?.length && !assembly && !annotations && !request.scale && !request.layoutPose ? JSON.stringify([revision.key, revision.identity.sha256,
        revision.identity.revisionId, ids, orientation, style, width, background, transparent, componentFrame]) : null;
      const cached = key ? this.cache.get(key) : undefined;
      const blob = cached ?? await this.draw(request, job.signal);
      if (this.disposed || job.signal?.aborted) throw abortError();
      if (key) {
        this.cache.delete(key);
        this.cache.set(key, blob);
        if (this.cache.size > this.limit) this.cache.delete(this.cache.keys().next().value!);
      }
      job.resolve(blob);
    } catch (reason) { job.reject(reason); }
    finally { this.busy = false; this.schedule(); }
  }

  dispose() {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const job of this.pending.splice(0)) job.reject(abortError());
    this.cache.clear();
  }
}

function renderImage(gl: WebGLRenderer, request: DocumentationImage) {
  const { revision, ids, orientation, style, width, planes, assembly, componentFrame } = request;
  const subject = new Scene();
  const include = new Set(ids);
  const neutral = style === "materials" ? null : new MeshStandardMaterial({
    color: style === "technical" || style === "mono" ? "#c3ced6" : "#829daf", roughness: 0.85,
  });
  const inverse = new Matrix4();
  if (componentFrame) {
    const matrix = revision.occurrences.get(componentFrame)?.rest;
    if (matrix?.determinant()) {
      const rotation = new Matrix4().extractRotation(matrix);
      inverse.copy(rotation).invert();
    }
  }
  const nodes: Object3D[] = [];
  const edges = new Map<BufferGeometry, EdgesGeometry>();
  const edgeStyle = style === "technical" ? new LineBasicMaterial({ color: "#546c80" }) : null;
  const temporarily = new Map<string, Matrix4>();
  if (request.layoutPose) for (const [id, world] of request.layoutPose) {
    const rest = revision.occurrences.get(id)?.rest;
    if (rest?.determinant()) temporarily.set(id, world.clone().multiply(rest.clone().invert()));
  }
  const renderables = revision.renderables;
  // Index the import once. Small card captures visit their owner's mesh list only.
  let index = meshIndex.get(revision);
  if (!index) {
    index = new Map();
    for (const row of renderables) {
      let meshes = index.get(row.id);
      if (!meshes) index.set(row.id, meshes = []);
      meshes.push(row);
    }
    meshIndex.set(revision, index);
  }
  for (const id of include) for (const { mesh, world } of index.get(id) ?? []) {
    const object = mesh.clone(false);
    const transform = WorldForThumbnail(world, id, revision, assembly);
    const layout = temporarily.get(id);
    if (layout) transform.premultiply(layout);
    object.matrix.copy(transform.premultiply(inverse));
    object.matrixAutoUpdate = false;
    if (neutral) object.material = neutral;
    if (edgeStyle && !(object as InstancedMesh).isInstancedMesh) {
      let geometry = edges.get(object.geometry);
      if (!geometry) { geometry = new EdgesGeometry(object.geometry, 22); edges.set(object.geometry, geometry); }
      object.add(new LineSegments(geometry, edgeStyle));
    }
    nodes.push(object);
    subject.add(object);
  }
  const dispose = () => {
    for (const node of nodes) if ((node as InstancedMesh).isInstancedMesh) (node as InstancedMesh).dispose();
    neutral?.dispose();
    edgeStyle?.dispose();
    for (const geometry of edges.values()) geometry.dispose();
  };
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) { dispose(); return Promise.reject(new Error("Geometria indisponível.")); }
  const center = box.getCenter(new Vector3());
  const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-7);
  const aim = new Vector3(...viewDirections[orientation]).normalize();
  const depth = radius * 4;
  const size = radius * 1.15;
  const camera = new OrthographicCamera(-size, size, size, -size, radius * 0.001, radius * 16);
  camera.position.copy(center).addScaledVector(aim, depth);
  camera.up.fromArray(viewUp(viewDirections[orientation]));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const sunlight = new DirectionalLight("#ffffff", 2.35);
  sunlight.position.copy(center).add(new Vector3(depth, depth * 2, depth));
  sunlight.target.position.copy(center);
  subject.add(new HemisphereLight("#ffffff", "#858c9c", 2.1), sunlight, sunlight.target);
  const previous = gl.clippingPlanes;
  try {
    gl.clippingPlanes = planes ?? [];
    return capturePng(gl, camera, { width: Math.min(width, 2048), background: request.background ?? "#ffffff",
      transparent: request.transparent ?? false }, () => gl.render(subject, camera), (ctx, w, h) => {
        if (request.annotations?.length) {
          ctx.font = "12px system-ui, sans-serif";
          const markers = projectCallouts(request.annotations, camera, w, h, (id) => {
            const rest = revision.occurrences.get(id)?.rest;
            return include.has(id) && rest ? WorldForThumbnail(rest, id, revision, assembly).premultiply(inverse) : undefined;
          }, planes ?? [], (value) => ctx.measureText(value).width);
          drawCallouts(ctx, markers, false, request.leaders);
        }
        if (request.scale) {
          const magnitude = 10 ** Math.floor(Math.log10(size * 0.5));
          const length = w * magnitude / (2 * size);
          const y = h - 16;
          ctx.strokeStyle = "#233b4d"; ctx.fillStyle = "#233b4d"; ctx.font = "12px system-ui";
          ctx.beginPath(); ctx.moveTo(12, y - 3); ctx.lineTo(12, y); ctx.lineTo(12 + length, y); ctx.lineTo(12 + length, y - 3); ctx.stroke();
          ctx.fillText(new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 3 }).format(magnitude * 1000) + " mm", 14, y - 5);
        }
      });
  } finally {
    gl.clippingPlanes = previous;
    // readRenderTargetPixels completes before the async PNG encoder begins.
    dispose();
  }
}

const meshIndex = new WeakMap<Revision, Map<string, Revision["renderables"]>>();

function WorldForThumbnail(world: Matrix4, id: string, revision: Revision, assembly: DocumentationImage["assembly"]) {
  const matrix = world.clone();
  if (!assembly) return matrix;
  const offset = new Vector3();
  let current: string | null = id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const move = assembly.offsets.get(current);
    if (move) offset.add(new Vector3(...move));
    current = revision.occurrences.get(current)?.record.parentId ?? null;
  }
  return matrix.setPosition(new Vector3().setFromMatrixPosition(matrix).add(offset));
}

export function DocumentationRenderer({ attach }: { attach: (service: RenderDocumentationImage | null) => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const queue = new ThumbnailQueue((request) => renderImage(gl, request));
    attach(queue.request);
    return () => { attach(null); queue.dispose(); };
  }, [attach, gl]);
  return null;
}
