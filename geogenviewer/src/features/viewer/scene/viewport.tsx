"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { MOUSE, PerspectiveCamera, Sphere, TOUCH, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ImportedModel } from "../../../lib/geogen/importers/glb";

export type CameraCommand = { kind: "fit" | "reset" | "closer" | "farther" };
export type NavigationMode = "orbit" | "pan";

const initialDirection = new Vector3(1.3, 0.9, 1.5).normalize();

function CameraRig({ model, command, mode, onContextLost }: {
  model: ImportedModel;
  command: CameraCommand;
  mode: NavigationMode;
  onContextLost: () => void;
}) {
  const { camera, gl, invalidate, get } = useThree();
  const controlsRef = useRef<OrbitControls>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    const controls = new OrbitControls(camera, canvas);
    controlsRef.current = controls;
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    canvas.setAttribute("tabindex", "0");
    controls.listenToKeyEvents(canvas);
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => {
      controlsRef.current = null;
      controls.removeEventListener("change", onChange);
      controls.dispose();
      canvas.removeEventListener("webglcontextlost", onContextLost);
    };
  }, [camera, gl, invalidate, onContextLost]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.mouseButtons.LEFT = mode === "pan" ? MOUSE.PAN : MOUSE.ROTATE;
    controls.touches.ONE = mode === "pan" ? TOUCH.PAN : TOUCH.ROTATE;
  }, [camera, gl, mode]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { width, height } = get().size;
    applyCameraCommand(camera as PerspectiveCamera, controls, model, command, width / Math.max(height, 1));
    invalidate();
  }, [camera, command, get, gl, invalidate, model]);

  return null;
}

function applyCameraCommand(camera: PerspectiveCamera, controls: OrbitControls, model: ImportedModel, command: CameraCommand, aspect: number) {
  if (command.kind === "closer" || command.kind === "farther") {
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length() * (command.kind === "closer" ? 0.8 : 1.25);
    camera.position.copy(controls.target).add(offset.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, distance))));
  } else {
    const sphere = model.bounds.getBoundingSphere(new Sphere());
    const radius = Math.max(sphere.radius, 0.000001);
    const vertical = camera.fov * Math.PI / 360;
    const horizontal = Math.atan(Math.tan(vertical) * Math.max(aspect, 0.01));
    const distance = 1.16 * radius / Math.sin(Math.min(vertical, horizontal));
    const direction = command.kind === "reset"
      ? initialDirection
      : camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.minDistance = radius * 0.02;
    controls.maxDistance = distance * 30;
    camera.near = radius * 0.001;
    camera.far = controls.maxDistance + 4 * radius;
    camera.updateProjectionMatrix();
  }
  controls.update();
}

class RenderBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Viewport({ model, command, mode, onContextLost, fallback }: {
  model: ImportedModel;
  command: CameraCommand;
  mode: NavigationMode;
  onContextLost: () => void;
  fallback: ReactNode;
}) {
  const sphere = model.bounds.getBoundingSphere(new Sphere());
  const origin = model.bounds.min;
  return (
    <RenderBoundary fallback={fallback}>
      <Canvas fallback={fallback} frameloop="demand" dpr={[1, 1.5]} role="region" aria-label="Modelo tridimensional">
        <hemisphereLight intensity={2.2} groundColor="#788698" />
        <directionalLight position={[3, 5, 4]} intensity={2.6} />
        <primitive object={model.scene} />
        <axesHelper args={[Math.max(sphere.radius * 0.35, 0.000001)]} position={[origin.x, origin.y, origin.z]} />
        <CameraRig model={model} command={command} mode={mode} onContextLost={onContextLost} />
      </Canvas>
    </RenderBoundary>
  );
}
