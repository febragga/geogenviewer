import type { ManifestAssemblyStep } from "../domain/model.ts";
import type { AssemblyVisibility } from "../domain/visibility.ts";

interface ScheduledStep {
  step: ManifestAssemblyStep;
  start: number;
  end: number;
}

export function compileAssembly(steps: readonly ManifestAssemblyStep[]) {
  let total = 0;
  const byElement = new Map<string, number>();
  const schedule: ScheduledStep[] = steps.map((step, index) => {
    const start = total;
    total += step.durationSeconds ?? 1;
    if (!Number.isFinite(total) || total <= start) {
      throw new RangeError("A duração acumulada da montagem é inválida.");
    }
    for (const id of step.elementIds) byElement.set(id, index);
    return { step, start, end: total };
  });
  let states = new Map<string, AssemblyVisibility>();
  let previousIndex = -2;
  return {
    schedule, total, byElement,
    sample(time: number) {
      const seconds = Math.min(total, Math.max(0, Number.isFinite(time) ? time : 0));
      let first = 0;
      let last = schedule.length;
      while (first < last) {
        const middle = Math.floor((first + last) / 2);
        if (schedule[middle].end <= seconds) first = middle + 1;
        else last = middle;
      }
      const active = schedule[first];
      if (first !== previousIndex) {
        states = new Map();
        for (const [id, index] of byElement) {
          states.set(id, index < first ? "mounted" : index === first ? "active" : "future");
        }
        previousIndex = first;
      }
      return {
        seconds, index: first, active, states,
        progress: active ? (seconds - active.start) / (active.end - active.start) : 1,
      };
    },
  };
}

export type AssemblyTimeline = ReturnType<typeof compileAssembly>;
export type PlaybackStatus = "idle" | "ready" | "playing" | "paused" | "completed";

export interface Playback {
  status: PlaybackStatus;
  seconds: number;
  startedAt: number;
  speed: number;
  loop: boolean;
}

export const idlePlayback: Playback = { status: "idle", seconds: 0, startedAt: 0, speed: 1, loop: false };

export function playbackTime(playback: Playback, total: number, now: number) {
  if (playback.status !== "playing") return playback.seconds;
  const raw = playback.seconds + Math.max(0, now - playback.startedAt) / 1000 * playback.speed;
  return playback.loop && total > 0 ? raw % total : Math.min(total, raw);
}

export function seekPlayback(playback: Playback, seconds: number, total: number, now: number): Playback {
  const value = Math.max(0, Math.min(total, seconds));
  return {
    ...playback, seconds: value, startedAt: now,
    status: total === 0 ? "idle" : value === total ? "completed"
      : playback.status === "playing" ? "playing" : value === 0 ? "ready" : "paused",
  };
}
