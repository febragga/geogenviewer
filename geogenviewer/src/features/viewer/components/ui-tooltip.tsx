"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

interface ActionTooltipProps {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}

export function ActionTooltip({
  label,
  shortcut,
  side = "bottom",
  children,
}: ActionTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} className="gg-tooltip-pos">
          <Tooltip.Popup className="gg-tooltip">
            <span>{label}</span>
            {shortcut && <kbd className="gg-tooltip__kbd">{shortcut}</kbd>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
