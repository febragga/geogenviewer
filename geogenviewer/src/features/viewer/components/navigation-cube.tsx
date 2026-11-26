"use client";

import { useEffect, useMemo, useRef } from "react";
import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "../scene/camera-state";
import { usePresentation } from "../state/presentation-store";
import { presets, v05 } from "../v05-copy";

const axes = [[presets.left, presets.right], [presets.bottom, presets.top], [presets.back, presets.front]];

const stations = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((z) => {
  const vector: Vec3 = [x, y, z];
  const labels = vector.flatMap((value, axis) => value ? [axes[axis][value > 0 ? 1 : 0]] : []);
  return labels.length ? [{ vector, label: labels.join(" · "), kind: labels.length }] : [];
})));

const corners = stations.filter((station) => station.kind === 3);
const edges = corners.flatMap(({ vector }, index) => corners.slice(index + 1)
  .filter((end) => end.vector.filter((value, axis) => value !== vector[axis]).length === 1)
  .map((end) => [vector, end.vector] as const));

export function NavigationCube() {
  const root = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const lines = useRef<(HTMLSpanElement | null)[]>([]);
  const initial = useMemo(() => {
    const position = new Vector3(1.3, 0.9, 1.5);
    const forward = position.normalize();
    return new Quaternion().setFromUnitVectors(forward, new Vector3(0, 0, 1)).invert();
  }, []);

  useEffect(() => {
    const surface = root.current?.closest(".gg-viewport");
    if (!surface) return;
    const previous = new Quaternion(0, 0, 0, 0);
    const rotation = new Quaternion();
    const point = new Vector3();
    const end = new Vector3();
    const radius = 19;
    function draw(orientation: Quaternion) {
      if (orientation.equals(previous)) return;
      previous.copy(orientation);
      rotation.copy(orientation).invert();
      stations.forEach((station, index) => {
        const dot = dots.current[index];
        if (!dot) return;
        point.fromArray(station.vector).applyQuaternion(rotation);
        dot.style.transform = `translate(${38 + point.x * radius}px, ${38 - point.y * radius}px) translate(-50%, -50%)`;
        dot.style.zIndex = String(4 + Math.round((point.z + 2) * 10));
        dot.hidden = point.z < -0.025;
      });
      edges.forEach(([start, finish], index) => {
        const line = lines.current[index];
        if (!line) return;
        point.fromArray(start).applyQuaternion(rotation);
        end.fromArray(finish).applyQuaternion(rotation);
        const dx = (end.x - point.x) * radius;
        const dy = (point.y - end.y) * radius;
        line.style.width = `${Math.hypot(dx, dy)}px`;
        line.style.transform = `translate(${38 + point.x * radius}px, ${38 - point.y * radius}px) rotate(${Math.atan2(dy, dx)}rad)`;
        line.style.opacity = point.z + end.z >= -0.05 ? "0.85" : "0.22";
      });
    }
    const onFrame = (event: Event) => draw((event as CustomEvent<{ orientation: Quaternion }>).detail.orientation);
    draw(initial);
    surface.addEventListener("geogen-camera-frame", onFrame);
    return () => surface.removeEventListener("geogen-camera-frame", onFrame);
  }, [initial]);

  return (
    <div className="gg-view-cube" ref={root} role="group" aria-label={v05.orientation}>
      {edges.map(([start, end], index) => <span aria-hidden="true" key={start.join() + ":" + end.join()} ref={(node) => { lines.current[index] = node; }} />)}
      {stations.map(({ vector, label, kind }, index) => (
        <button type="button" key={vector.join()} className={`gg-cube-point gg-cube-point--${kind}`}
          ref={(node) => { dots.current[index] = node; }} title={label} aria-label={label}
          data-short={kind === 1 ? label.substring(0, 2).toUpperCase() : undefined}
          onClick={() => usePresentation.getState().access?.direction(vector)} />
      ))}
    </div>
  );
}
