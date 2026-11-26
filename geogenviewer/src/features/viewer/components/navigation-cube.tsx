"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Quaternion, Vector3 } from "three";
import {
  buildNavCubeStations,
  defaultNavCubeOrientation,
  projectNavCube,
  type NavCubeStation,
  type ProjectedNavCubeFace,
} from "../../../lib/geogen/domain/nav-cube";
import type { Projection } from "../scene/camera-state";
import { usePresentation } from "../state/presentation-store";
import { presets, v05 } from "../v05-copy";
import { HomeIcon, ResetCameraIcon, RotateCwIcon } from "./icons";

export function NavigationCube() {
  const showNavCube = usePresentation((state) => state.showNavCube);
  const root = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const polyRefs = useRef<(SVGPolygonElement | null)[]>([]);
  const textRefs = useRef<(SVGTextElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stationSlotMapRef = useRef<number[]>([]);
  const homeButton = useRef<HTMLButtonElement>(null);
  const highlight = useRef<number | null>(null);

  const [hoveredStation, setHoveredStation] = useState<number | null>(null);
  const [focusedStation, setFocusedStation] = useState<number | null>(null);
  const [projection, setProjection] = useState<Projection>("perspective");

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ active: false, pointerId: -1, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const suppressClickRef = useRef(false);

  const stations: NavCubeStation[] = useMemo(
    () =>
      buildNavCubeStations({
        left: presets.left,
        right: presets.right,
        bottom: presets.bottom,
        top: presets.top,
        back: presets.back,
        front: presets.front,
      }),
    []
  );

  const initialOrientation = useMemo(() => defaultNavCubeOrientation(), []);
  const orientationRef = useRef<Quaternion>(initialOrientation.clone());

  useEffect(() => {
    if (!showNavCube) return;
    const surface = root.current?.closest(".gg-viewport");
    if (!surface) return;

    const previous = new Quaternion(0, 0, 0, 0);

    function renderCube(orientation: Quaternion) {
      if (orientation.equals(previous)) return;
      previous.copy(orientation);
      orientationRef.current.copy(orientation);

      const sorted: ProjectedNavCubeFace[] = projectNavCube(stations, orientation, 100, 30);

      for (let slotIndex = 0; slotIndex < sorted.length; slotIndex += 1) {
        const face = sorted[slotIndex];
        const poly = polyRefs.current[slotIndex];
        const text = textRefs.current[slotIndex];
        const btn = buttonRefs.current[face.index];

        if (poly) {
          poly.setAttribute(
            "points",
            face.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")
          );
          poly.dataset.station = String(face.index);
          poly.dataset.kind = String(face.station.kind);
          poly.dataset.visible = face.visible ? "true" : "false";
          poly.dataset.highlighted = String(highlight.current === face.index);
          poly.style.setProperty("--gg-cube-shade", face.shade.toFixed(3));
          stationSlotMapRef.current[face.index] = slotIndex;
        }

        if (text) {
          if (face.visible && face.station.kind === 1 && face.textMatrix) {
            text.setAttribute("transform", face.textMatrix);
            text.textContent = face.station.shortLabel ?? "";
            text.dataset.station = String(face.index);
            text.dataset.highlighted = String(highlight.current === face.index);
            text.style.display = "";
          } else {
            text.style.display = "none";
          }
        }

        if (btn) {
          if (!face.visible && document.activeElement === btn) homeButton.current?.focus({ preventScroll: true });
          btn.hidden = !face.visible;
          btn.style.zIndex = String(2 + slotIndex);
          if (face.visible && face.points.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of face.points) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            }
            const bw = Math.max(6, maxX - minX);
            const bh = Math.max(6, maxY - minY);
            const bx = Math.max(0, Math.min(100 - bw, (minX + maxX) / 2 - bw / 2));
            const by = Math.max(0, Math.min(100 - bh, (minY + maxY) / 2 - bh / 2));
            btn.style.left = `${bx.toFixed(2)}%`;
            btn.style.top = `${by.toFixed(2)}%`;
            btn.style.width = `${bw.toFixed(2)}%`;
            btn.style.height = `${bh.toFixed(2)}%`;
            btn.style.clipPath = `polygon(${face.points
              .map((p) => `${(((p.x - bx) / bw) * 100).toFixed(1)}% ${(((p.y - by) / bh) * 100).toFixed(1)}%`)
              .join(", ")})`;
          } else {
            btn.style.clipPath = "";
          }
        }
      }
    }

    const onFrame = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          orientation: Quaternion;
          pose?: { projection: Projection };
        }>
      ).detail;
      if (detail?.orientation) renderCube(detail.orientation);
      if (detail?.pose?.projection) {
        setProjection((prev) => (prev === detail.pose!.projection ? prev : detail.pose!.projection));
      }
    };

    renderCube(initialOrientation);
    surface.addEventListener("geogen-camera-frame", onFrame);
    return () => surface.removeEventListener("geogen-camera-frame", onFrame);
  }, [initialOrientation, showNavCube, stations]);

  const activeHighlight = hoveredStation ?? focusedStation;

  useEffect(() => {
    highlight.current = activeHighlight;
    for (let slotIndex = 0; slotIndex < polyRefs.current.length; slotIndex += 1) {
      const poly = polyRefs.current[slotIndex];
      const text = textRefs.current[slotIndex];
      const isHighlighted = activeHighlight !== null && Number(poly?.dataset.station) === activeHighlight;
      if (poly) poly.dataset.highlighted = isHighlighted ? "true" : "false";
      if (text) text.dataset.highlighted = text.dataset.station === String(activeHighlight) ? "true" : "false";
    }
  }, [activeHighlight]);

  if (!showNavCube) return null;

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const totalDist = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && totalDist > 5) {
      drag.moved = true;
      suppressClickRef.current = true;
      try {
        stageRef.current?.setPointerCapture(event.pointerId);
      } catch {
        /* ignore synthetic pointer events */
      }
    }
    if (!drag.moved) return;

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;

    const access = usePresentation.getState().access;
    const activeSlot = usePresentation.getState().active;
    const pose = access?.pose(activeSlot);
    if (!access || !pose) return;

    const target = new Vector3(...pose.target);
    const offset = new Vector3(...pose.position).sub(target);
    const right = new Vector3().crossVectors(new Vector3(...pose.up), offset).normalize();
    const yawQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -dx * 0.012);
    const pitchQuat = new Quaternion().setFromAxisAngle(right, dy * 0.012);
    offset.applyQuaternion(yawQuat).applyQuaternion(pitchQuat);
    const up = new Vector3(0, 1, 0);
    if (Math.abs(offset.clone().normalize().y) < 0.985) {
      access.apply({
        ...pose,
        position: offset.add(target).toArray(),
        up: [up.x, up.y, up.z],
      });
    }
  }

  function handleStagePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    if (drag.moved) {
      try {
        stageRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function triggerStation(station: NavCubeStation) {
    if (suppressClickRef.current) return;
    const access = usePresentation.getState().access;
    access?.direction(station.vector);
  }

  const nextProjection: Projection = projection === "orthographic" ? "perspective" : "orthographic";

  return (
    <div
      className="gg-view-cube"
      ref={root}
      role="group"
      aria-label={v05.navCubeLabel}
      data-hovered-station={activeHighlight ?? ""}
    >
      <div
        className="gg-view-cube__stage"
        ref={stageRef}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerEnd}
        onPointerCancel={handleStagePointerEnd}
      >
        <svg className="gg-view-cube__svg" viewBox="0 0 100 100" aria-hidden="true">
          <g className="gg-view-cube__faces">
            {stations.map((_, slotIndex) => (
              <polygon
                key={`poly-${slotIndex}`}
                className="gg-view-cube__poly"
                ref={(node) => {
                  polyRefs.current[slotIndex] = node;
                }}
              />
            ))}
          </g>
          <g className="gg-view-cube__labels">
            {stations.map((_, slotIndex) => (
              <text
                key={`label-${slotIndex}`}
                className="gg-view-cube__text"
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                ref={(node) => {
                  textRefs.current[slotIndex] = node;
                }}
              />
            ))}
          </g>
        </svg>

        <div className="gg-view-cube__hits">
          {stations.map((station, index) => (
            <button
              key={station.id}
              type="button"
              className={`gg-cube-point gg-cube-point--${station.kind}`}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              title={station.label}
              aria-label={station.label}
              data-short={station.shortLabel}
              data-highlighted={activeHighlight === index ? "true" : undefined}
              onMouseEnter={() => setHoveredStation(index)}
              onMouseLeave={() => setHoveredStation((prev) => (prev === index ? null : prev))}
              onFocus={() => setFocusedStation(index)}
              onBlur={() => setFocusedStation((prev) => (prev === index ? null : prev))}
              onClick={() => triggerStation(station)}
            />
          ))}
        </div>
      </div>

      <div className="gg-view-cube__bar" role="group" aria-label={v05.orientation}>
        <button
          type="button"
          className="gg-view-cube__ctrl"
          ref={homeButton}
          title={v05.homeView}
          aria-label={v05.homeView}
          onClick={() => {
            const access = usePresentation.getState().access;
            if (access?.home) access.home();
            else access?.preset("perspective");
          }}
        >
          <HomeIcon size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="gg-view-cube__ctrl"
          title={v05.rotate90Ccw}
          aria-label={v05.rotate90Ccw}
          onClick={() => usePresentation.getState().access?.rotate90?.(-1)}
        >
          <ResetCameraIcon size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="gg-view-cube__ctrl"
          title={v05.rotate90Cw}
          aria-label={v05.rotate90Cw}
          onClick={() => usePresentation.getState().access?.rotate90?.(1)}
        >
          <RotateCwIcon size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="gg-view-cube__ctrl gg-view-cube__ctrl--proj"
          title={v05.toggleProjection}
          aria-label={`${projection === "orthographic" ? v05.orthoShort : v05.perspShort} ${v05.toggleProjection} (${projection === "orthographic" ? v05.orthographic : v05.perspective})`}
          aria-pressed={projection === "orthographic"}
          onClick={() => usePresentation.getState().access?.projection(nextProjection)}
        >
          {projection === "orthographic" ? v05.orthoShort : v05.perspShort}
        </button>
      </div>
    </div>
  );
}
