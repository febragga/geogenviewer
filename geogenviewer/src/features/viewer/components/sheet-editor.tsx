"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { defaultTechnicalOptions, type TechnicalOptions } from "../../../lib/geogen/inspection/document";
import { annotationModel } from "../../../lib/geogen/documentation/callouts";
import { catalogTypes, occurrenceItems, type CatalogEntry, type CatalogItem } from "../../../lib/geogen/documentation/catalog";
import { defaultLayout, layoutKnolling } from "../../../lib/geogen/documentation/knolling";
import { assemblyMoment, partsList, sheetPage, type SheetPage } from "../../../lib/geogen/documentation/sheets";
import type { SheetFrame, SheetSettings } from "../../../lib/geogen/documentation/document";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import type { RenderDocumentationImage } from "../scene/documentation-renderer";
import { useInspection } from "../state/inspection-store";
import { usePresentation, type PngOptions } from "../state/presentation-store";
import type { DocumentationWorkspace } from "../state/documentation-workspace";
import { v08, densityLabels, frameLabels, sheetFields, templateLabels } from "../v08-copy";
import { actionClass, Choice, NumericField } from "./analytics-fields";
import { downloadFile } from "./download-file";
import { drawPublication } from "./documentation-overlay";

export type SheetImages = { title: string; blob: Blob }[];
export type GenerateSheet = { page: SheetPage; images: SheetImages; settings: SheetSettings; manual: boolean;
  manualPages?: { overview: SheetImages[number]; stages: { page: SheetPage; image: SheetImages[number] }[] } };
export type Counterpart = { revision: Revision; entry: CatalogEntry; changes?: string[] } | null;

function technical(settings: SheetSettings): TechnicalOptions {
  return { ...defaultTechnicalOptions, background: settings.transparent ? "transparent" : "white",
    grid: settings.grid, axes: settings.axes, gizmos: false, measurements: settings.measurements,
    identifiers: settings.identifiers, scale: settings.scale };
}

export function publicationCapture(docs: DocumentationWorkspace, options: SheetSettings, forced = false): Promise<Blob> {
  const render = usePresentation.getState().access?.capture;
  const revision = docs.revision;
  if (!render || !revision) return Promise.reject(new Error(v08.noRenderer));
  const params: PngOptions = { width: 1920, transparent: options.transparent, background: options.background,
    technical: technical(options) };
  const labels = options.labels || forced;
  if (labels || options.titleInCapture || options.legend) {
    const annotations = docs.annotations.length ? docs.annotations : annotationModel(docs.rows, docs.settings?.callouts ?? [],
      docs.byPlacement.size ? [...docs.byPlacement.values()].map((item) => item.item.representative) : [], docs.scopes.selected);
    params.decorate = (ctx, width, height, camera, slot) => {
      if (labels) drawPublication(ctx, width, height, camera, slot, revision, annotations, docs.mask, false, options.leaders, docs.groups);
      if (options.titleInCapture || options.legend) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(12, 12, Math.min(width - 24, 420), options.legend ? 42 : 26);
        ctx.fillStyle = "#203347"; ctx.font = "14px system-ui";
        if (options.titleInCapture) ctx.fillText([revision.scene.sceneGraph.projectTitle, revision.identity.revisionId].filter(Boolean).join(" · "), 20, 29, Math.min(width - 40, 400));
        if (options.legend) ctx.fillText(v08.parts + " · " + docs.items.reduce((sum, item) => sum + item.quantity, 0), 20, options.titleInCapture ? 47 : 29);
      }
    };
  }
  return render(params);
}

function sheetsSize(settings: SheetSettings) {
  const paper = settings.page === "A4" ? [210, 297] : [297, 420];
  return settings.orientation === "portrait" ? paper : [...paper].reverse();
}

export async function sheetPng(document: GenerateSheet) {
  const { page, images, settings } = document;
  const [w, h] = sheetsSize(settings);
  const scale = settings.page === "A4" ? 5.5 : 5;
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error(v08.failed);
  const ctx: CanvasRenderingContext2D = context;
  const margin = settings.marginMm * scale;
  const width = canvas.width - margin * 2;
  const height = canvas.height;
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, canvas.width, height);
  ctx.fillStyle = "#172b3d";
  const font = (size: number, strong = false) => { ctx.font = (strong ? "600 " : "") + size + "px system-ui, sans-serif"; };
  font(30, true); ctx.fillText(page.title, margin, margin + 30, width);
  font(15); ctx.fillText([page.project, page.prototype, page.revision, settings.brand].filter(Boolean).join(" · "), margin, margin + 56, width);
  if (page.subtitle) ctx.fillText(page.subtitle, margin, margin + 76, width);
  ctx.strokeStyle = "#8297aa"; ctx.beginPath(); ctx.moveTo(margin, margin + 89); ctx.lineTo(margin + width, margin + 89); ctx.stroke();
  const top = margin + 106;
  const bottom = height - margin - 45;
  const columns = settings.orientation === "landscape" ? 2 : 1;
  const imageWidth = images.length ? (columns === 2 ? width * 0.56 : width) : 0;
  const galleryHeight = columns === 2 ? bottom - top : (bottom - top) * 0.48;
  if (images.length) {
    const cols = images.length > 1 ? 2 : 1;
    const rows = Math.ceil(images.length / cols);
    const cellWidth = imageWidth / cols, cellHeight = galleryHeight / rows;
    for (const [index, image] of images.entries()) {
      const bitmap = await createImageBitmap(image.blob);
      try {
        const x = margin + (index % cols) * cellWidth, y = top + Math.floor(index / cols) * cellHeight;
        const factor = Math.min((cellWidth - 12) / bitmap.width, (cellHeight - 24) / bitmap.height);
        if (factor > 0) ctx.drawImage(bitmap, x + (cellWidth - bitmap.width * factor) / 2, y + 4, bitmap.width * factor, bitmap.height * factor);
        font(12, true); ctx.fillText(image.title, x + 6, y + cellHeight - 5, cellWidth - 12);
      } finally { bitmap.close(); }
    }
  }
  const textX = columns === 2 && imageWidth ? margin + imageWidth + 18 : margin;
  const textWidth = margin + width - textX;
  let y = columns === 1 && imageWidth ? top + galleryHeight + 18 : top + 7;
  let overflow = false;
  const fontSize = settings.density === "compact" ? 12 : settings.density === "detailed" ? 17 : 14;
  function wrap(value: string) {
    const lines: string[] = [];
    let line = "";
    for (const word of value.replace(/\s+/gu, " ").trim().split(" ")) {
      if (line && ctx.measureText(line + " " + word).width > textWidth) { lines.push(line); line = word; }
      else line = line ? line + " " + word : word;
    }
    if (line) lines.push(line);
    return lines;
  }
  for (const group of page.groups) {
    if (y + 24 > bottom) { overflow = true; break; }
    font(fontSize + 2, true); ctx.fillText(group.title, textX, y, textWidth); y += 22;
    font(fontSize);
    for (const line of group.lines) {
      const label = [line.label, line.value].filter(Boolean).join(" · ") + (line.provenance ? "  [" + line.provenance + "]" : "");
      for (const part of wrap(label)) {
        if (y > bottom - 14) { overflow = true; break; }
        ctx.fillText(part, textX, y, textWidth); y += fontSize + 4;
      }
      if (overflow) break;
    }
    if (overflow) break;
    y += 9;
  }
  font(12);
  if (overflow) ctx.fillText("Conteúdo adicional na ficha imprimível ou no JSON.", textX, bottom + 1, textWidth);
  ctx.fillText(v08.meshBasis, margin, height - margin, width);
  ctx.fillText(page.date.slice(0, 10), margin, height - margin + 18, width);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(v08.failed)), "image/png"));
}

function PageImage({ image }: { image: SheetImages[number] }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const address = URL.createObjectURL(image.blob);
    const frame = requestAnimationFrame(() => setUrl(address));
    return () => { cancelAnimationFrame(frame); URL.revokeObjectURL(address); };
  }, [image]);
  return <figure>{url && <Image unoptimized src={url} alt={image.title} width={420} height={420} />}
    <figcaption>{image.title}</figcaption></figure>;
}

export function SheetEditor({ docs, item, counterpart, renderer, knolling, manual, setManual, selectedStep, setSelectedStep,
  generated, onGenerated, fail }: {
  docs: DocumentationWorkspace; item: CatalogItem | null; counterpart: Counterpart; renderer: RenderDocumentationImage | null;
  knolling: boolean; manual: boolean; setManual: (value: boolean) => void; selectedStep: number; setSelectedStep: (value: number) => void;
  generated: GenerateSheet | null; onGenerated: (value: GenerateSheet) => void; fail: (reason: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(false);
  const inspection = useInspection((state) => state.doc);
  const revision = docs.revision;
  const settings = docs.settings?.sheet;
  if (!revision || !settings) return null;
  const patch = (value: Partial<SheetSettings>) => docs.change((old) => ({ ...old, sheet: { ...old.sheet, ...value } }));
  const measurementRows = docs.isPrimary ? inspection?.measurements ?? [] : [];
  const byStep = docs.timeline.schedule;
  const assembly = settings.template === "assembly";
  const composite = settings.template === "knolling";
  const dual = settings.template === "comparison";

  async function prepare() {
    if (!revision || !settings || !renderer) { fail(v08.noRenderer); return; }
    setBusy(true);
    try {
      const moment = assembly ? assemblyMoment(docs.timeline, selectedStep, settings.stage, settings.progress) : null;
      if (assembly && !moment) throw new Error(v08.noAssembly);
      if (composite && !knolling) throw new Error("Abra o workspace Knolling para gerar a prancha da disposição.");
      if (!assembly && !composite && !item) throw new Error(v08.noSelection);
      if (dual && !counterpart) throw new Error(v08.noCounterpart);
      const target = moment ? new Set([...moment.previously, ...moment.installed]) : null;
      const type = settings.template === "type" && item && docs.settings ? catalogTypes(docs.entries, docs.settings.types)
        .find((candidate) => candidate.members.some((entry) => entry.occurrence.id === item.representative.occurrence.id)) : null;
      const rows = moment ? occurrenceItems(docs.entries.filter((row) => target!.has(row.occurrence.id))) :
        composite ? docs.items : item ? [type ?? item] : [];
      const page = sheetPage(revision, settings, rows, measurementRows, docs.settings?.callouts ?? [], moment, counterpart?.entry);
      if (dual && counterpart?.changes?.length) page.groups.push({ title: "Alterações registradas",
        lines: counterpart.changes.map((value) => ({ label: "", value, provenance: "comparação V0.7" })) });
      if (manual && assembly) page.groups.unshift({
        title: v08.manual, lines: [{ label: "Projeto", value: page.project }, { label: "Índice", value: byStep.map(({ step }, i) => (i + 1) + " · " + step.title).join(" / ") },
          { label: "Ocorrências no catálogo", value: String(docs.entries.length) },
          { label: "Sem etapa autorada", value: String(docs.entries.filter((entry) => entry.step === null).length) }],
      });
      const images: SheetImages = [];
      const ids = moment ? [...target!] : item ? [item.representative.occurrence.id] : [];
      if (composite || settings.template === "inspection") images.push({
        title: composite ? v08.knolling : v08.current, blob: await publicationCapture(docs, settings),
      });
      const frames: SheetFrame[] = settings.frames.length ? settings.frames : ["axonometric"];
      const annotations = settings.labels ? annotationModel(docs.rows, docs.settings?.callouts ?? [], [], new Set(ids)) : undefined;
      if (!composite && !dual && ids.length) for (const frame of frames) {
        const blob = frame === "current" && docs.isPrimary ? await publicationCapture(docs, settings) : await renderer({
          revision, ids, orientation: frame === "current" ? "axonometric" : frame, width: 560,
          style: "materials", background: settings.background, transparent: settings.transparent,
          annotations, leaders: settings.leaders, scale: settings.scale,
          componentFrame: local && !assembly ? ids[0] : undefined,
          assembly: moment ? { time: moment.time, offsets: moment.offsets, step: moment.index, stage: moment.stage } : undefined,
        });
        images.push({ title: frameLabels[frame] + (local && frame !== "current" && !assembly ? " · " + v08.localFrame : ""), blob });
      }
      if (dual && item && counterpart) for (const [model, entry] of [[revision, item.representative], [counterpart.revision, counterpart.entry]] as const) {
        images.push({ title: model.identity.revisionId ?? v08.revision, blob: await renderer({
          revision: model, ids: [entry.occurrence.id], orientation: "axonometric", width: 560, style: "materials", background: settings.background,
        }) });
      }
      let manualPages: GenerateSheet["manualPages"];
      if (manual && assembly) {
        const allParts = occurrenceItems(docs.entries);
        const layout = layoutKnolling(allParts, defaultLayout(Math.max(...revision.scene.sceneGraph.sceneBoundsMeters)));
        const poses = new Map(layout.placements.map((entry) => [entry.item.representative.occurrence.id, entry.world]));
        const overview = { title: v08.knolling, blob: await renderer({ revision, ids: [...poses.keys()], layoutPose: poses,
          orientation: "top", style: "materials", width: 620, background: settings.background }) };
        const stages: NonNullable<GenerateSheet["manualPages"]>["stages"] = [];
        for (let index = 0; index < Math.min(20, byStep.length); index++) {
          const phase = assemblyMoment(docs.timeline, index, "after", 1)!;
          const scope = new Set([...phase.previously, ...phase.installed]);
          const stagePage = sheetPage(revision, { ...settings, title: "" },
            allParts.filter((part) => scope.has(part.representative.occurrence.id)), measurementRows, docs.settings?.callouts ?? [], phase);
          const image = { title: phase.entry.step.title, blob: await renderer({ revision, ids: [...scope],
            orientation: "axonometric", style: "materials", width: 400, background: settings.background }) };
          stages.push({ page: stagePage, image });
        }
        manualPages = { overview, stages };
      }
      onGenerated({ page, images, settings, manual: manual && assembly, manualPages });
      fail(null);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }

  function exportPng() {
    if (!generated) return;
    setBusy(true);
    void sheetPng(generated).then((image) => downloadFile(image, "ficha-tecnica.png"), fail).finally(() => setBusy(false));
  }

  function printGenerated() {
    if (!generated) return;
    const rule = document.createElement("style");
    const result = generated.settings;
    rule.textContent = "@page { size: " + result.page + " " + result.orientation + "; margin: " + result.marginMm + "mm; }";
    document.head.append(rule);
    window.addEventListener("afterprint", () => rule.remove(), { once: true });
    window.print();
  }

  return <details className="gg-v08-sheet" data-sheet-editor>
    <summary>{v08.sheet}</summary>
    <div className="gg-v07-grid">
      <Choice label="Modelo da ficha" value={settings.template} options={templateLabels} onChange={(template) => patch({ template })} />
      <Choice label={v08.page} value={settings.page} options={{ A4: "A4", A3: "A3" }} onChange={(page) => patch({ page })} />
      <Choice label="Orientação da página" value={settings.orientation} options={{ portrait: v08.vertical, landscape: v08.horizontal }}
        onChange={(orientation) => patch({ orientation })} />
      <Choice label={v08.density} value={settings.density} options={densityLabels} onChange={(density) => patch({ density })} />
      <NumericField label={v08.margin + " (mm)"} value={settings.marginMm} min={5} onChange={(marginMm) => patch({ marginMm: Math.min(35, marginMm) })} />
      <label className="gg-v07-field">{v08.background}<input type="color" value={settings.background} onChange={(event) => patch({ background: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.title}<input value={settings.title} onChange={(event) => patch({ title: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.subtitle}<input value={settings.subtitle} onChange={(event) => patch({ subtitle: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.brand}<input value={settings.brand} onChange={(event) => patch({ brand: event.currentTarget.value })} /></label>
      <label className="gg-v07-field">{v08.notes}<textarea rows={2} value={settings.notes} onChange={(event) => patch({ notes: event.currentTarget.value })} /></label>
    </div>
    {assembly && (byStep.length ? <>
      <Choice label={v08.step} value={String(selectedStep)} options={Object.fromEntries(byStep.map((entry, index) => [String(index), (index + 1) + " · " + entry.step.title]))}
        onChange={(step) => setSelectedStep(Number(step))} />
      <Choice label={v08.stage} value={settings.stage} options={{ before: v08.before, during: v08.during, after: v08.after }} onChange={(stage) => patch({ stage })} />
      {settings.stage === "during" && <label className="gg-v07-field">{v08.stageFraction}<input type="range" min={0} max={1} step={0.01} value={settings.progress}
        onChange={(event) => patch({ progress: event.currentTarget.valueAsNumber })} /></label>}
      <label className="gg-v07-check"><input type="checkbox" checked={manual} onChange={(event) => setManual(event.currentTarget.checked)} />{v08.manual}</label>
    </> : <p>{v08.noAssembly}</p>)}
    <details><summary>{v08.views}</summary>
      <Choice label={v08.viewFrame} value={local ? "piece" : "world"} options={{ world: v08.globalFrame, piece: v08.localFrame }} onChange={(value) => setLocal(value === "piece")} />
      <div className="gg-v07-grid">{(Object.keys(frameLabels) as SheetFrame[]).map((frame) => <label key={frame} className="gg-v07-check">
        <input type="checkbox" checked={settings.frames.includes(frame)} onChange={(event) => patch({
          frames: event.currentTarget.checked ? [...settings.frames, frame] : settings.frames.filter((item) => item !== frame),
        })} />{frameLabels[frame]}
      </label>)}</div>
    </details>
    <details><summary>{v08.fields}</summary>
      <div className="gg-v07-grid">{(Object.keys(sheetFields) as (keyof typeof sheetFields)[]).map((field) => <label key={field} className="gg-v07-check">
        <input type="checkbox" checked={settings.fields.includes(field)} onChange={(event) => patch({
          fields: event.currentTarget.checked ? [...settings.fields, field] : settings.fields.filter((item) => item !== field),
        })} />{sheetFields[field]}</label>)}</div>
      {measurementRows.length > 0 && <fieldset><legend>{v08.measurements}</legend>
        {measurementRows.slice(0, 200).map((row) => <label key={row.id} className="gg-v07-check">
          <input type="checkbox" checked={!settings.measurementIds.length || settings.measurementIds.includes(row.id)}
            onChange={(event) => {
              const ids = settings.measurementIds.length ? settings.measurementIds : measurementRows.map(({ id }) => id);
              const next = event.currentTarget.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id);
              patch({ measurementIds: next, measurements: next.length > 0 });
            }} />{row.name}
        </label>)}
      </fieldset>}
    </details>
    <div className="gg-v07-actions">
      <button type="button" className={actionClass} disabled={busy || !renderer || (assembly && !byStep.length) || (dual && !counterpart)}
        onClick={() => void prepare()}>{busy ? v08.preparing : v08.preview}</button>
      <button type="button" className={actionClass} disabled={!generated || busy} onClick={exportPng}>{v08.exportSheet}</button>
      <button type="button" className={actionClass} disabled={!generated || busy} onClick={printGenerated}>{v08.print}</button>
    </div>
    {generated && <article className="gg-v08-page" style={{ "--gg-v08-paper": generated.settings.background } as React.CSSProperties}>
      <h3>{generated.page.title}</h3><p>{[generated.page.project, generated.page.prototype, generated.page.revision].filter(Boolean).join(" · ")}</p>
      {generated.page.subtitle && <p>{generated.page.subtitle}</p>}
      <div className="gg-v08-page__views">{generated.images.map((image, index) => <PageImage key={image.title + index} image={image} />)}</div>
      {generated.page.groups.map((group) => <section key={group.title}><h4>{group.title}</h4>
        <dl>{group.lines.map((line, index) => <div key={index}><dt>{line.label || v08.notes}</dt>
          <dd>{line.value}{line.provenance && <small> · {line.provenance}</small>}</dd></div>)}</dl>
      </section>)}
      {generated.manualPages && <details open className="gg-v08-manual">
        <summary>{v08.manual}</summary>
        <h4>{generated.page.project}</h4>
        <PageImage image={generated.manualPages.overview} />
        {generated.manualPages.stages.map(({ page, image }, index) => <section key={index}>
          <h4>{index + 1} · {page.title}</h4>
          <PageImage image={image} />
          {page.groups.map((group) => <div key={group.title}><strong>{group.title}</strong>
            <ul>{group.lines.map((line, i) => <li key={i}>{[line.label, line.value, line.provenance].filter(Boolean).join(" · ")}</li>)}</ul>
          </div>)}
        </section>)}
      </details>}
      <p>{v08.meshBasis}</p>
    </article>}
  </details>;
}

export function sheetReport(generated: GenerateSheet | null, items: readonly CatalogItem[], docs: DocumentationWorkspace) {
  return { page: generated?.page ?? null, settings: generated?.settings ?? null, parts: partsList(items, docs.settings?.callouts ?? []),
    manual: generated?.manual ? docs.timeline.schedule.map(({ start, end, step }, index) =>
      ({ number: index + 1, start, end, ...step, page: generated.manualPages?.stages[index]?.page })) : undefined };
}
