"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { categoryLabels } from "../../../lib/geogen/assembly/step-labels";
import type { ElementCategory } from "../../../lib/geogen/domain/model";
import { collectModelSummary, groupModelSummary, summarizeModel, type SummaryGrouping } from "../../../lib/geogen/revisions/model-summary";
import { defaultFabrication, type FabricationSettings, type MassMethod } from "../../../lib/geogen/revisions/fabrication";
import type { Revision } from "../../../lib/geogen/revisions/revision";
import type { coverage } from "../../../lib/geogen/revisions/quantities";
import { useAssembly } from "../state/assembly-store";
import { summaryCopy as copy } from "../v0912-copy";
import { formatNumber } from "./analytics-fields";
import { ViewerPopover } from "./viewer-popover";

type Scope = keyof typeof copy.scopes;
type Coverage = ReturnType<typeof coverage>;
type Props = {
  revision: Revision;
  visible: readonly string[];
  selected: readonly string[];
  settings?: FabricationSettings;
  stepTitles?: Readonly<Record<string, string>>;
};

function value(total: Coverage, unit: string) {
  if (total.subtotal === null) return copy.unavailable;
  return formatNumber(total.subtotal) + (unit ? " " + unit : "");
}

function Metric({ label, text, coverage }: { label: string; text: string; coverage?: Coverage }) {
  const partial = coverage && coverage.included > 0 && coverage.excluded > 0;
  return (
    <>
      <dt>{label}</dt>
      <dd className="gg-tabular">
        <span>{text}</span>
        {partial && (
          <small className="gg-summary-coverage" title={copy.coverage}>
            {coverage.included}/{coverage.included + coverage.excluded}
          </small>
        )}
      </dd>
    </>
  );
}

function methods(label: string, units: string, totals: Record<string, Coverage>) {
  const entries = Object.entries(totals);
  if (!entries.length) return <Metric label={label} text={copy.unavailable} />;
  return entries.map(([method, coverage]) => {
    const source = method.endsWith("-cad") ? copy.methods.cad : method.endsWith("-authored") ? copy.methods.authored : copy.methods.mesh;
    return <Metric key={method} label={label + " · " + source} text={value(coverage, units)} coverage={coverage} />;
  });
}

function SummaryFields({ revision, visible, selected, settings = defaultFabrication, stepTitles }: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [group, setGroup] = useState<SummaryGrouping>("category");
  const [groupValue, setGroupValue] = useState("");
  const timeline = useAssembly((state) => state.timeline);
  const ids = scope === "visible" ? visible : scope === "selected" ? selected : undefined;
  const { rows, fabrication } = useMemo(() => collectModelSummary(revision, ids && new Set(ids), settings), [revision, ids, settings]);
  const groups = useMemo(() => groupModelSummary(revision, rows, fabrication, timeline, group, stepTitles),
    [revision, rows, fabrication, timeline, group, stepTitles]);
  const scoped = groups.find((entry) => JSON.stringify(entry.key) === groupValue);
  const summary = useMemo(() => summarizeModel(scoped?.rows ?? rows, scoped?.fabrication ?? fabrication), [scoped, rows, fabrication]);
  const masses = Object.entries(summary.mass).filter(([, total]) => total.subtotal !== null);
  const costs = Object.entries(summary.costs);

  return (
    <>
      <div className="gg-summary-filters">
        <label>
          <span>{copy.scope}</span>
          <select value={scope} onChange={(event) => {
            setScope(event.currentTarget.value as Scope);
            setGroupValue("");
          }}>
            {Object.entries(copy.scopes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.group}</span>
          <select value={group} onChange={(event) => {
            setGroup(event.currentTarget.value as SummaryGrouping);
            setGroupValue("");
          }}>
            {Object.entries(copy.groups).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
        {rows.length > 0 && (
          <label className="gg-summary-filters__full">
            <span>{copy.groupValue}</span>
            <select value={scoped ? groupValue : ""} onChange={(event) => setGroupValue(event.currentTarget.value)}>
              <option value="">{copy.allGroups} · {groups.length}</option>
              {groups.map(({ key, label, rows }) => (
                <option key={JSON.stringify(key)} value={JSON.stringify(key)}>
                  {(group === "category" && label ? categoryLabels[label as ElementCategory] : label) ?? copy.unknown} · {rows.length}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {rows.length ? (
        <div className="gg-summary-sections" aria-live="polite">
          <section className="gg-summary-section">
            <h3 className="gg-summary-section__title">{copy.sections.identity}</h3>
            <dl className="gg-v05-stats gg-model-summary">
              <Metric label={copy.components} text={formatNumber(summary.components)} />
              {summary.occurrences !== summary.components && <Metric label={copy.occurrences} text={formatNumber(summary.occurrences)} />}
              <Metric label={copy.types} text={summary.types ? formatNumber(summary.types) : copy.unavailable} coverage={summary.typeCoverage} />
            </dl>
          </section>
          <section className="gg-summary-section">
            <h3 className="gg-summary-section__title">{copy.sections.geometry}</h3>
            <dl className="gg-v05-stats gg-model-summary">
              <Metric label={copy.length} text={value(summary.length, "m")} coverage={summary.length} />
              {methods(copy.area, "m²", summary.area)}
              {methods(copy.volume, "m³", summary.volume)}
              {summary.fabricationVolume.included > 0 && (
                <Metric label={copy.fabricationVolume} text={value(summary.fabricationVolume, "m³")} coverage={summary.fabricationVolume} />
              )}
            </dl>
          </section>
          <section className="gg-summary-section">
            <h3 className="gg-summary-section__title">{copy.sections.fabrication}</h3>
            <dl className="gg-v05-stats gg-model-summary">
              {masses.length ? masses.map(([method, total]) => (
                <Metric key={method} label={copy.mass + " " + copy.masses[method as MassMethod]} text={value(total, "kg")} coverage={total} />
              )) : <Metric label={copy.mass} text={copy.unavailable} />}
              {costs.length ? costs.map(([key, total]) => {
                const [currency, method] = key.split(" ");
                return <Metric key={key} label={copy.cost + " · " + copy.masses[method as MassMethod]} text={value(total, currency)} coverage={total} />;
              }) : <Metric label={copy.cost} text={copy.unavailable} />}
            </dl>
          </section>
        </div>
      ) : <p className="gg-v05-hint" role="status">{copy.empty}</p>}
    </>
  );
}

export function ModelSummary(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <ViewerPopover label={copy.title} icon={<ListChecks size={15} aria-hidden="true" />} onOpenChange={setOpen}>
      {open && <SummaryFields {...props} />}
    </ViewerPopover>
  );
}
