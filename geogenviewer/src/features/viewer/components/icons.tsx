import type { SVGProps } from "react";
export {
  AlertTriangle as AlertIcon,
  Box as CubeIcon,
  Command as CommandIcon,
  FolderOpen as FolderOpenIcon,
  Hand as HandIcon,
  HelpCircle as HelpIcon,
  Layers as LayersIcon,
  Maximize as MaximizeIcon,
  Maximize2 as FitViewIcon,
  Moon as MoonIcon,
  MoreHorizontal as MoreIcon,
  Orbit as OrbitIcon,
  PanelLeft as SidebarLeftIcon,
  PanelRight as SidebarRightIcon,
  RotateCcw as ResetCameraIcon,
  Ruler as RulerIcon,
  SlidersHorizontal as SlidersIcon,
  SquareSplitHorizontal as SectionIcon,
  Sun as SunIcon,
  Ungroup as ExplodeIcon,
  X as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "lucide-react";

export function BrandMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3 4.5 7.3v9.4L12 21l7.5-4.3V7.3L12 3Z" />
      <path d="M12 12 4.5 7.3" />
      <path d="M12 12v9" />
      <path d="M12 12l7.5-4.7" />
    </svg>
  );
}
