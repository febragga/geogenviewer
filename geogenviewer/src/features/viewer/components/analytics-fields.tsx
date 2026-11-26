"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const actionClass = "gg-btn gg-btn--secondary gg-btn--xs";
export const formatNumber = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 8 }).format;

export function FileButton({ label, accept = ".json", multiple = false, disabled = false, onFiles }: {
  label: string; accept?: string; multiple?: boolean; disabled?: boolean; onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <button type="button" className={actionClass} disabled={disabled} onClick={() => input.current?.click()}>{label}</button>
    <input ref={input} type="file" hidden accept={accept} multiple={multiple} aria-label={label}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        if (files.length) onFiles(files);
      }} />
  </>;
}

export function Choice<K extends string>({ label, value, options, onChange }: {
  label: string; value: K; options: Record<K, string>; onChange: (value: K) => void;
}) {
  return <label className="gg-v07-field"><span>{label}</span><select aria-label={label} value={value}
    onChange={(event) => onChange(event.currentTarget.value as K)}>
    {Object.entries<string>(options).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
  </select></label>;
}

export function NumericField({ label, value, onChange, min }: {
  label: string; value: number; onChange: (value: number) => void; min?: number;
}) {
  return <label className="gg-v07-field"><span>{label}</span>
    <input key={value} type="number" step="any" min={min} defaultValue={Number(value.toPrecision(12))} onBlur={(event) => {
      const next = event.currentTarget.valueAsNumber;
      if (Number.isFinite(next) && (min === undefined || next >= min)) onChange(next);
      else event.currentTarget.value = String(value);
    }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
  </label>;
}

export function VirtualRows<T>({ rows, label, rowHeight = 40, activeIndex = -1, table = false, render }: {
  rows: readonly T[]; label: string; rowHeight?: number; activeIndex?: number; table?: boolean;
  render: (row: T, index: number) => ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(320);
  const start = Math.min(Math.max(0, rows.length - Math.ceil(height / rowHeight)), Math.max(0, Math.floor(scroll / rowHeight) - 5));
  const count = Math.ceil(height / rowHeight) + 10;
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node || activeIndex < 0) return;
    const top = activeIndex * rowHeight;
    if (top < node.scrollTop || top + rowHeight > node.scrollTop + node.clientHeight) {
      node.scrollTop = Math.max(0, top - rowHeight);
    }
  }, [activeIndex, rowHeight]);

  return <div ref={viewport} className="gg-v07-virtual" role={table ? "rowgroup" : "region"} tabIndex={0} aria-label={table ? undefined : label}
    onScroll={(event) => setScroll(event.currentTarget.scrollTop)}>
    <div role="presentation" style={{ height: rows.length * rowHeight, position: "relative" }}>
      <div role="presentation" style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
        {rows.slice(start, start + count).map((row, index) => render(row, start + index))}
      </div>
    </div>
  </div>;
}
