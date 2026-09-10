import {
  ArrowDownIcon,
  ArrowRightIcon,
  Crosshair2Icon,
  EnterFullScreenIcon,
  LayersIcon,
  Link2Icon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@radix-ui/react-icons";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "../i18n.js";
import type { Orientation } from "../graph.js";

export interface CanvasToolbarProps {
  showEdges: boolean;
  onShowEdges: (value: boolean) => void;
  showLegend: boolean;
  onShowLegend: (value: boolean) => void;
  orientation: Orientation;
  onOrientation: (value: Orientation) => void;
  stackBursts: boolean;
  onStackBursts: (value: boolean) => void;
  onClear: () => void;
  onRecenter: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const icon = "size-3.5";

export function CanvasToolbar(props: CanvasToolbarProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const button = "btn btn-ghost btn-sm btn-square";
  const active = "btn btn-sm btn-square bg-primary/15 text-primary";

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-0.5 rounded-box border border-base-300 bg-base-100/90 p-1 shadow-xl backdrop-blur"
      aria-label="Graph actions"
    >
      <button
        type="button"
        className={props.showEdges ? active : button}
        onClick={() => props.onShowEdges(!props.showEdges)}
        title={t("showTimelineEdges")}
        aria-label={t("showTimelineEdges")}
      >
        <Link2Icon className={icon} />
      </button>
      <button
        type="button"
        className={props.showLegend ? active : button}
        onClick={() => props.onShowLegend(!props.showLegend)}
        title={t("showDomainLegend")}
        aria-label={t("showDomainLegend")}
      >
        <LayersIcon className={icon} />
      </button>
      <button
        type="button"
        className={props.stackBursts ? active : button}
        onClick={() => props.onStackBursts(!props.stackBursts)}
        title={t("stackBursts")}
        aria-label={t("stackBursts")}
      >
        <span className="font-mono text-xs">××</span>
      </button>
      <span className="mx-1 h-5 w-px bg-base-300" />
      <button
        type="button"
        className={props.orientation === "horizontal" ? active : button}
        onClick={() => props.onOrientation("horizontal")}
        title={t("horizontalOrientation")}
        aria-label={t("horizontalOrientation")}
      >
        <ArrowRightIcon className={icon} />
      </button>
      <button
        type="button"
        className={props.orientation === "vertical" ? active : button}
        onClick={() => props.onOrientation("vertical")}
        title={t("verticalOrientation")}
        aria-label={t("verticalOrientation")}
      >
        <ArrowDownIcon className={icon} />
      </button>
      <span className="mx-1 h-5 w-px bg-base-300" />
      <button
        type="button"
        className={button}
        onClick={props.onZoomOut}
        title={t("zoomOut")}
        aria-label={t("zoomOut")}
      >
        <ZoomOutIcon className={icon} />
      </button>
      <button
        type="button"
        className={button}
        onClick={props.onRecenter}
        title={t("recenterTimeline")}
        aria-label={t("recenterTimeline")}
      >
        <Crosshair2Icon className={icon} />
      </button>
      <button
        type="button"
        className={button}
        onClick={props.onFitView}
        title={t("fitView")}
        aria-label={t("fitView")}
      >
        <EnterFullScreenIcon className={icon} />
      </button>
      <button
        type="button"
        className={button}
        onClick={props.onZoomIn}
        title={t("zoomIn")}
        aria-label={t("zoomIn")}
      >
        <ZoomInIcon className={icon} />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square text-error"
        onClick={props.onClear}
        title={t("clearRequests")}
        aria-label={t("clearRequests")}
      >
        <TrashIcon className={icon} />
      </button>
    </motion.div>
  );
}
