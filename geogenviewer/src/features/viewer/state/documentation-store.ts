import { create } from "zustand";

interface KnollingMotion {
  amount: number;
  playing: boolean;
  start: number;
  from: number;
  set: (amount: number) => void;
  play: () => void;
  pause: () => void;
  frame: (time: number) => number;
}

export const useKnollingMotion = create<KnollingMotion>((set, get) => ({
  amount: 1, playing: false, start: 0, from: 0,
  set: (amount) => set({ amount: Math.max(0, Math.min(amount, 1)), playing: false }),
  play: () => {
    const from = get().amount >= 1 ? 0 : get().amount;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set({ amount: 1, playing: false });
      return;
    }
    set({ from, amount: from, start: performance.now(), playing: true });
  },
  pause: () => set({ playing: false }),
  frame: (time) => {
    const { start, from, playing, amount } = get();
    if (!playing) return amount;
    const t = Math.min(1, Math.max(0, (time - start) / 680));
    const next = from + (1 - from) * t * t * (3 - 2 * t);
    set({ amount: next, playing: t < 1 });
    return next;
  },
}));
