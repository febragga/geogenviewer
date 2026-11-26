"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Square } from "lucide-react";
import { playbackTime } from "../../../lib/geogen/assembly/timeline";
import { useAssembly } from "../state/assembly-store";
import { playbackLabels, v05 } from "../v05-copy";
import { ActionTooltip } from "./ui-tooltip";
import { AssemblyEditor } from "./assembly-editor";

const seconds = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function AssemblyPanel() {
  const timeline = useAssembly((state) => state.timeline);
  const playback = useAssembly((state) => state.playback);
  const stepIndex = useAssembly((state) => state.stepIndex);
  const source = useAssembly((state) => state.source);
  const sourceIssue = useAssembly((state) => state.sourceIssue);
  const ghost = useAssembly((state) => state.ghost);
  const solo = useAssembly((state) => state.solo);
  const [editing, setEditing] = useState(false);
  const slider = useRef<HTMLInputElement>(null);
  const timestamp = useRef<HTMLOutputElement>(null);
  const playing = playback.status === "playing";
  const effectiveStep = timeline.schedule[solo ?? stepIndex];

  useEffect(() => {
    function update() {
      const time = playbackTime(playback, timeline.total, performance.now());
      if (slider.current) slider.current.value = String(time);
      if (timestamp.current) timestamp.current.value = seconds.format(time) + " / " + seconds.format(timeline.total) + " s";
    }
    update();
    if (!playing) return;
    const timer = window.setInterval(update, 80);
    return () => window.clearInterval(timer);
  }, [playback, playing, timeline]);

  function openEditor() {
    useAssembly.getState().pause();
    setEditing(true);
  }

  const controls = [
    { label: v05.prev, Icon: SkipBack, action: () => useAssembly.getState().advance(-1) },
    { label: playing ? v05.pause : v05.play, Icon: playing ? Pause : Play, action: () => {
      if (playing) useAssembly.getState().pause(); else useAssembly.getState().play();
    } },
    { label: v05.stop, Icon: Square, action: () => useAssembly.getState().stop() },
    { label: v05.restart, Icon: RotateCcw, action: () => useAssembly.getState().play(true) },
    { label: v05.next, Icon: SkipForward, action: () => useAssembly.getState().advance(1) },
  ];

  return (
    <section className="gg-assembly" aria-label={v05.sequence}>
      <div className="gg-assembly__header">
        <div className="gg-assembly__status">
          <h2>{v05.sequence}</h2>
          <span>{effectiveStep ? effectiveStep.step.title : playbackLabels[playback.status]}</span>
        </div>
        <button type="button" className="gg-btn gg-btn--secondary" onClick={openEditor} disabled={!source}>{v05.editor}</button>
      </div>
      {timeline.total > 0 ? (
        <>
          <div className="gg-assembly__timeline">
            <div className="gg-assembly__buttons" role="group" aria-label="Controles de reprodução">
              {controls.map(({ label, Icon, action }) => (
                <ActionTooltip key={label} label={label}>
                  <button type="button" className="gg-btn gg-btn--ghost gg-btn--icon" aria-label={label} onClick={action}><Icon size={16} /></button>
                </ActionTooltip>
              ))}
            </div>
            <input aria-label="Tempo da montagem" type="range" min="0" max={timeline.total} step="any" defaultValue={playback.seconds}
              ref={slider} onChange={(event) => {
                if (playing) useAssembly.getState().pause();
                useAssembly.getState().seek(Number(event.currentTarget.value));
              }} />
            <output aria-label="Progresso temporal" className="gg-mono" ref={timestamp} />
          </div>
          <div className="gg-assembly__options">
            <label>{v05.speed}
              <select value={playback.speed} onChange={(event) => useAssembly.getState().speed(Number(event.currentTarget.value))}>
                {[0.25, 0.5, 1, 1.5, 2, 4].map((value) => <option value={value} key={value}>{value}×</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={playback.loop} onChange={(event) => useAssembly.getState().loop(event.currentTarget.checked)} />{v05.loop}</label>
            <label><input type="checkbox" checked={ghost} onChange={(event) => useAssembly.setState({ ghost: event.currentTarget.checked })} />{v05.ghost}</label>
            {solo !== null && <button className="gg-btn gg-btn--ghost" onClick={() => useAssembly.getState().setSolo(null)} type="button">{v05.endPreview}</button>}
          </div>
        </>
      ) : <p className="gg-v05-hint">{sourceIssue ?? (source ? v05.noAssembly : v05.noManifest)}</p>}
      {editing && source && <AssemblyEditor onClose={() => setEditing(false)} />}
    </section>
  );
}
