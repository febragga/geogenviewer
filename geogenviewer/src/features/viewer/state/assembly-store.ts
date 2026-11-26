import { create } from "zustand";
import type { ManifestAssemblyStep, ManifestV1 } from "../../../lib/geogen/domain/model";
import { withAssembly } from "../../../lib/geogen/assembly/manifest";
import {
  compileAssembly, idlePlayback, playbackTime, seekPlayback, type AssemblyTimeline, type Playback,
} from "../../../lib/geogen/assembly/timeline";

interface AssemblyState {
  source: ManifestV1 | null;
  sourceIssue: string | null;
  timeline: AssemblyTimeline;
  playback: Playback;
  ghost: boolean;
  solo: number | null;
  stepIndex: number;
  initialize: (source: ManifestV1 | null) => void;
  replace: (steps: ManifestAssemblyStep[]) => ManifestV1;
  play: (restart?: boolean) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  advance: (direction: -1 | 1) => void;
  speed: (speed: number) => void;
  loop: (loop: boolean) => void;
  setSolo: (solo: number | null) => void;
  frame: (now: number) => number;
}

function draftKey(source: ManifestV1) {
  return "geogen:assembly:v05:" + JSON.stringify([source.project.id, source.project.revisionId, source.geometry.sha256]);
}

function initialTimeline(source: ManifestV1 | null) {
  if (!source) return compileAssembly([]);
  try {
    const saved = localStorage.getItem(draftKey(source));
    if (saved) return compileAssembly(withAssembly(source, JSON.parse(saved)).assembly?.steps ?? []);
  } catch {
    // An invalid or unavailable local draft leaves the imported sequence available.
  }
  return compileAssembly(source.assembly?.steps ?? []);
}

function ready(timeline: AssemblyTimeline): Playback {
  return { ...idlePlayback, status: timeline.total > 0 ? "ready" : "idle" };
}

export const useAssembly = create<AssemblyState>((set, get) => ({
  source: null, sourceIssue: null, timeline: compileAssembly([]), playback: idlePlayback, ghost: false, solo: null, stepIndex: 0,
  initialize(source) {
    let timeline = compileAssembly([]);
    let sourceIssue: string | null = null;
    try {
      timeline = initialTimeline(source);
    } catch (error) {
      sourceIssue = error instanceof Error ? error.message : "A sequência importada excede o intervalo de tempo suportado.";
    }
    set({ source, sourceIssue, timeline, playback: ready(timeline), solo: null, stepIndex: 0, ghost: false });
  },
  replace(steps) {
    const { source } = get();
    if (!source) throw new Error("Abra um modelo com manifesto para editar a sequência.");
    const edited = withAssembly(source, steps);
    const timeline = compileAssembly(edited.assembly?.steps ?? []);
    set({ timeline, sourceIssue: null, playback: ready(timeline), solo: null, stepIndex: 0 });
    try { localStorage.setItem(draftKey(source), JSON.stringify(steps)); } catch { /* Session editing remains available. */ }
    return edited;
  },
  play(restart = false) {
    const { playback, timeline } = get();
    if (!timeline.total) return;
    const now = performance.now();
    const seconds = restart || playback.status === "completed" ? 0 : playbackTime(playback, timeline.total, now);
    set({ playback: { ...playback, status: "playing", seconds, startedAt: now }, solo: null, stepIndex: timeline.sample(seconds).index });
  },
  pause() {
    const { playback, timeline } = get();
    if (playback.status !== "playing") return;
    const now = performance.now();
    const seconds = playbackTime(playback, timeline.total, now);
    set({ playback: { ...seekPlayback({ ...playback, status: "paused" }, seconds, timeline.total, now), status: seconds >= timeline.total ? "completed" : "paused" }, stepIndex: timeline.sample(seconds).index });
  },
  stop() {
    const { playback, timeline } = get();
    set({ playback: { ...ready(timeline), speed: playback.speed, loop: playback.loop }, solo: null, stepIndex: 0 });
  },
  seek(seconds) {
    const { playback, timeline } = get();
    if (!Number.isFinite(seconds)) return;
    set({ playback: seekPlayback(playback, seconds, timeline.total, performance.now()), solo: null, stepIndex: timeline.sample(seconds).index });
  },
  advance(direction) {
    get().pause();
    const { timeline, playback } = get();
    const index = timeline.sample(playback.seconds).index + direction;
    get().seek(index < 0 ? 0 : timeline.schedule[index]?.start ?? timeline.total);
  },
  speed(speed) {
    const { playback, timeline } = get();
    const now = performance.now();
    set({ playback: { ...playback, seconds: playbackTime(playback, timeline.total, now), startedAt: now, speed } });
  },
  loop(loop) {
    const { playback, timeline } = get();
    const now = performance.now();
    set({ playback: { ...playback, seconds: playbackTime(playback, timeline.total, now), startedAt: now, loop } });
  },
  setSolo(solo) {
    get().pause();
    set({ solo });
  },
  frame(now) {
    const { timeline, playback, stepIndex } = get();
    const time = playbackTime(playback, timeline.total, now);
    const index = timeline.sample(time).index;
    if (playback.status === "playing" && time >= timeline.total) {
      set({ playback: seekPlayback(playback, time, timeline.total, now), stepIndex: index });
    } else if (index !== stepIndex) set({ stepIndex: index });
    return time;
  },
}));
