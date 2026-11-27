"use client";

import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export function ViewerPopover({ label, title, icon, children, onOpenChange }: {
  label: string; title?: string; icon?: ReactNode; children: ReactNode; onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover.Root onOpenChange={onOpenChange}>
      <Popover.Trigger className="gg-btn gg-btn--elevated gg-v05-trigger" aria-label={label}>
        {icon}<span>{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="gg-v05-positioner" collisionPadding={8}>
          <Popover.Popup className="gg-v05-popover">
            <Popover.Title className="gg-v05-title">{title ?? label}</Popover.Title>
            <div className="gg-v05-fields">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
