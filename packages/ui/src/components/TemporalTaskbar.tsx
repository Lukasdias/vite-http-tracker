import {
  ChevronDownIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from "@radix-ui/react-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { formatTemporalTime, formatTemporalTimestamp } from "../temporal.js";
import { useI18n } from "../i18n.js";
import type { TemporalPlayback } from "../hooks/useTemporalPlayback.js";

export interface TemporalTaskbarProps {
  playback: TemporalPlayback;
}

const spring = { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.7 };
const icon = "size-3.5";

export function TemporalTaskbar({ playback }: TemporalTaskbarProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const bounds = playback.bounds;
  const range = bounds ? Math.max(1, bounds.end - bounds.start) : 1;
  const progress = bounds ? ((playback.playhead - bounds.start) / range) * 100 : 0;
  const markerTimes = bounds
    ? [...new Set(bounds.events.map((event) => event.time))]
    : [];

  return (
    <motion.div
      layout
      transition={reducedMotion ? { duration: 0 } : spring}
      className="pointer-events-auto flex items-center gap-1.5 rounded-box border border-base-300 bg-base-100/90 p-1.5 shadow-xl backdrop-blur"
    >
      <div className="tooltip tooltip-top" data-tip={t("timelineReplay")}>
        <motion.button
          type="button"
          className={`btn btn-sm btn-square ${playback.enabled ? "btn-primary" : "btn-ghost"}`}
          whileHover={reducedMotion ? undefined : { scale: 1.03 }}
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          onClick={playback.toggle}
          aria-label={t("timelineReplay")}
        >
          <ClockIcon className={icon} />
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {playback.enabled && bounds ? (
          <motion.div
            key="controls"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, width: 0, x: -8 }}
            animate={{ opacity: 1, width: "auto", x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, width: 0, x: -8 }}
            transition={reducedMotion ? { duration: 0 } : spring}
            className="flex min-w-0 items-center gap-1.5 overflow-hidden"
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={playback.rewind}
              aria-label={t("temporalRewind")}
              title={t("temporalRewind")}
            >
              <TrackPreviousIcon className={icon} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={playback.togglePlaying}
              aria-label={playback.playing ? t("temporalPause") : t("temporalPlay")}
              title={playback.playing ? t("temporalPause") : t("temporalPlay")}
            >
              {playback.playing ? <PauseIcon className={icon} /> : <PlayIcon className={icon} />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={playback.next}
              aria-label={t("temporalNext")}
              title={t("temporalNext")}
            >
              <TrackNextIcon className={icon} />
            </button>
            <div className="w-36 sm:w-64">
              <div className="relative pt-1">
                <input
                  type="range"
                  min={bounds.start}
                  max={bounds.end}
                  step={1}
                  value={playback.playhead}
                  onChange={(event) => playback.setPlayhead(Number(event.target.value))}
                  className="range range-xs range-primary"
                  style={{ "--value": `${progress}` } as CSSProperties}
                  aria-label={t("temporalPosition")}
                />
                {markerTimes.map((time) => {
                  const markerPosition = (time / range) * 100;
                  return (
                    <motion.button
                      key={time}
                      type="button"
                      className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-primary/70 p-0"
                      style={{ left: `${markerPosition}%` }}
                      whileHover={reducedMotion ? undefined : { scaleY: 1.5 }}
                      onClick={() => playback.setPlayhead(time)}
                      aria-label={formatTemporalTimestamp(bounds.origin + time)}
                      title={formatTemporalTimestamp(bounds.origin + time)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between font-mono text-[9px] tabular-nums text-base-content/50">
                <span>
                  +{formatTemporalTime(playback.playhead - bounds.start)} · {" "}
                  {formatTemporalTimestamp(bounds.origin + playback.playhead)}
                </span>
                <span>+{formatTemporalTime(bounds.end - bounds.start)}</span>
              </div>
            </div>
            <label className="flex items-center gap-1 text-[10px] text-base-content/60">
              <span className="hidden sm:inline">{t("temporalSpeed")}</span>
              <select
                className="select select-ghost select-xs w-14 px-1 font-mono"
                value={playback.speed}
                onChange={(event) => playback.setSpeed(Number(event.target.value))}
                aria-label={t("temporalSpeed")}
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
              </select>
            </label>
            <ChevronDownIcon className="hidden size-3 text-base-content/40 sm:block" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
