"use client";

import { Filter, Layers2, SlidersHorizontal } from "lucide-react";
import type { LoadedScenePackage } from "../../../lib/geogen/importers/package";
import { viewRegions } from "../scene/camera-state";
import { usePresentation } from "../state/presentation-store";
import { v05 } from "../v05-copy";
import { DisplayOptions } from "./display-options";
import { FilterOptions } from "./filter-options";
import { NavigationCube } from "./navigation-cube";
import { ViewOptions } from "./view-options";
import { ViewerPopover } from "./viewer-popover";

export function ViewportTools({ loaded, loadTime, onFit, onReset }: {
  loaded: LoadedScenePackage; loadTime: number; onFit: (selected?: string[]) => void; onReset: () => void;
}) {
  const layout = usePresentation((state) => state.layout);
  const active = usePresentation((state) => state.active);
  const maximized = usePresentation((state) => state.maximized);
  const projection = usePresentation((state) => state.projections[state.active]);
  const regions = viewRegions(layout, maximized, 100, 100);
  return (
    <>
      {layout !== "single" && <div className="gg-view-regions" aria-label="Viewports">
        {regions.map(({ slot, x, y, width, height }) => (
          <div key={slot} className={`gg-view-region ${slot === active ? "gg-view-region--active" : ""}`}
            data-lower={y > 0} data-full-height={height === 100}
            style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` }}>
            <button type="button" className="gg-btn gg-btn--elevated gg-view-region__label" aria-pressed={slot === active}
              onClick={() => usePresentation.getState().setActive(slot)}
              onDoubleClick={usePresentation.getState().toggleMaximize}>Vista {slot + 1}</button>
          </div>
        ))}
      </div>}
      <div className="gg-v05-tools" role="group" aria-label="Ferramentas da viewport">
        <ViewerPopover label={v05.views} icon={<Layers2 size={15} />}><ViewOptions loaded={loaded} /></ViewerPopover>
        <ViewerPopover label={v05.filters} icon={<Filter size={15} />}><FilterOptions loaded={loaded} onFit={onFit} /></ViewerPopover>
        <ViewerPopover label={v05.display} title={v05.settings} icon={<SlidersHorizontal size={15} />}>
          <DisplayOptions count={loaded.sceneGraph.componentOrder.length} loadTime={loadTime} onReset={onReset} />
        </ViewerPopover>
        <span className="gg-projection-indicator">{projection === "perspective" ? v05.perspective : v05.orthographic}</span>
      </div>
      <NavigationCube />
    </>
  );
}
