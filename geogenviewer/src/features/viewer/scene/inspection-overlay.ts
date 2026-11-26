import { Vector3, type Camera } from "three";

export interface ScreenPoint { x: number; y: number }

export interface Mark {
  start: ScreenPoint;
  end?: ScreenPoint;
  label?: string;
  kind: "measure" | "candidate" | "id" | "gizmo";
}

const ns = "http://www.w3.org/2000/svg";
const font = "600 12px system-ui, sans-serif";
const stroke = "#17496d";
const tint = "#e8f4ff";
const screenPad = 4;

export function projectPoint(point: Vector3, camera: Camera, width: number, height: number, allowOutside = false): ScreenPoint | null {
  const ndc = point.clone().project(camera);
  if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y) || ndc.z < -1 || ndc.z > 1) return null;
  if (!allowOutside && (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1)) return null;
  return { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2 };
}

function layoutLabels(marks: Mark[], width: number, height: number, textWidth: (label: string) => number) {
  const occupied: { x: number; y: number; w: number }[] = [];
  return marks.map((mark) => {
    if (!mark.label) return { mark };
    const midpoint = mark.end ? { x: (mark.start.x + mark.end.x) / 2, y: (mark.start.y + mark.end.y) / 2 } : mark.start;
    const label = mark.label.slice(0, Math.max(14, Math.floor((width - 24) / 7)));
    const w = Math.min(width - 2 * screenPad, textWidth(label) + 12);
    const x = Math.max(screenPad, Math.min(width - w - screenPad, midpoint.x - w / 2));
    const base = Math.max(screenPad, Math.min(height - 24, midpoint.y - 27));
    for (const shift of [0, -22, 22, -44, 44, -66, 66, -88, 88]) {
      const y = base + shift;
      if (y < screenPad || y > height - 24) continue;
      if (occupied.some((other) => Math.abs(other.y - y) < 21 && x < other.x + other.w + 3 && other.x < x + w + 3)) continue;
      const box = { x, y, w };
      occupied.push(box);
      return { mark, box, label };
    }
    return { mark };
  });
}

function node<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) {
  const result = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, String(value));
  return result;
}

export function paintSvg(svg: SVGSVGElement, marks: Mark[], width: number, height: number) {
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const fragment = document.createDocumentFragment();
  for (const { mark, box, label } of layoutLabels(marks, width, height, (text) => text.length * 7.1)) {
    const { start, end, kind } = mark;
    if (end) {
      fragment.append(node("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, stroke: tint, "stroke-width": 4 }));
      fragment.append(node("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, stroke, "stroke-width": 2, ...(kind === "candidate" ? { "stroke-dasharray": "4 3" } : {}) }));
    }
    if (kind !== "id") {
      for (const point of end ? [start, end] : [start]) {
        fragment.append(node("circle", { cx: point.x, cy: point.y, r: kind === "candidate" ? 5 : 3.5, fill: tint, stroke, "stroke-width": 2 }));
      }
    }
    if (box && label) {
      fragment.append(node("rect", { x: box.x, y: box.y, width: box.w, height: 20, rx: 4, fill: "#14354f" }));
      const text = node("text", { x: box.x + 6, y: box.y + 14, fill: "#fff", "font-size": 12, "font-weight": 600 });
      text.textContent = label;
      fragment.append(text);
    }
  }
  svg.replaceChildren(fragment);
}

export function paintTechnical(ctx: CanvasRenderingContext2D, marks: Mark[], width: number, height: number, scale: number, title?: string, ruler?: { width: number; label: string }) {
  ctx.save();
  ctx.scale(scale, scale);
  const w = width / scale;
  const h = height / scale;
  ctx.font = font;
  ctx.textBaseline = "middle";
  for (const { mark, box, label } of layoutLabels(marks, w, h, (text) => ctx.measureText(text).width)) {
    if (mark.end) {
      ctx.beginPath();
      ctx.moveTo(mark.start.x, mark.start.y);
      ctx.lineTo(mark.end.x, mark.end.y);
      ctx.lineWidth = 4;
      ctx.strokeStyle = tint;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    if (mark.kind !== "id") {
      for (const point of mark.end ? [mark.start, mark.end] : [mark.start]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = tint;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (box && label) textPlate(label, box.x, box.y, box.w);
  }
  if (title) textPlate(title, 12, 12, Math.min(w - 24, ctx.measureText(title).width + 16));
  if (ruler) {
    const y = h - 22;
    const x = 14;
    ctx.fillStyle = "#14354f";
    ctx.fillRect(x - 4, y - 23, Math.max(ruler.width + 8, ctx.measureText(ruler.label).width + 12), 31);
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x, y); ctx.lineTo(x + ruler.width, y);
    ctx.moveTo(x + ruler.width, y - 4); ctx.lineTo(x + ruler.width, y + 4);
    ctx.stroke();
    ctx.fillText(ruler.label, x, y - 14);
  }
  ctx.restore();

  function textPlate(text: string, x: number, y: number, w: number) {
    ctx.fillStyle = "#14354f";
    ctx.fillRect(x, y, w, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x + 6, y + 10, w - 10);
  }
}
