import { useEffect, useMemo, useState } from "react";
import type { RecordGroup } from "../graph.js";
import { temporalTimeline, visibleRequestIds } from "../temporal.js";

export const TEMPORAL_STEP_DURATION_MS = 220;

export interface TemporalPlayback {
  enabled: boolean;
  playing: boolean;
  playhead: number;
  speed: number;
  bounds: ReturnType<typeof temporalTimeline>;
  visibleIds: Set<string>;
  toggle: () => void;
  togglePlaying: () => void;
  rewind: () => void;
  next: () => void;
  setPlayhead: (value: number) => void;
  setSpeed: (value: number) => void;
}

export function useTemporalPlayback(groups: RecordGroup[]): TemporalPlayback {
  const bounds = useMemo(() => temporalTimeline(groups), [groups]);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [speed, setSpeed] = useState(1);
  const boundedPlayhead = bounds
    ? Math.min(bounds.end, Math.max(bounds.start, playhead))
    : 0;

  useEffect(() => {
    if (!playing || !bounds) return;
    const nextEvent = bounds.events.find((event) => event.time > boundedPlayhead);
    const timer = window.setTimeout(() => {
      if (!nextEvent) {
        setPlayhead(bounds.end);
        setPlaying(false);
        return;
      }
      setPlayhead(nextEvent.time);
    }, TEMPORAL_STEP_DURATION_MS / speed);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bounds, boundedPlayhead, playing, speed]);

  const toggle = () => {
    if (!bounds) return;
    setEnabled((current) => {
      const next = !current;
      if (next) setPlayhead(bounds.start);
      setPlaying(false);
      return next;
    });
  };

  const togglePlaying = () => {
    if (!bounds || !enabled) return;
    setPlayhead((current) => (current >= bounds.end ? bounds.start : current));
    setPlaying((current) => !current);
  };

  const rewind = () => {
    if (!bounds) return;
    setPlaying(false);
    setPlayhead(bounds.start);
  };

  const next = () => {
    if (!bounds) return;
    const nextEvent = bounds.events.find((event) => event.time > boundedPlayhead);
    setPlaying(false);
    setPlayhead(nextEvent?.time ?? bounds.end);
  };

  return {
    enabled: enabled && bounds !== null,
    playing,
    playhead: boundedPlayhead,
    speed,
    bounds,
    visibleIds: enabled && bounds ? visibleRequestIds(bounds, boundedPlayhead) : new Set(),
    toggle,
    togglePlaying,
    rewind,
    next,
    setPlayhead: (value) => {
      if (!bounds) return;
      setPlaying(false);
      setPlayhead(Math.min(bounds.end, Math.max(bounds.start, value)));
    },
    setSpeed,
  };
}
