import type { RecordGroup } from "./graph.js";

export interface TemporalEvent {
  requestId: string;
  time: number;
  timestamp: number;
}

export interface TemporalTimeline {
  origin: number;
  start: number;
  end: number;
  events: TemporalEvent[];
}

export function temporalTimeline(groups: RecordGroup[]): TemporalTimeline | null {
  if (!groups.length) return null;
  const sorted = [...groups].sort((a, b) => a.canonical.seq - b.canonical.seq);
  const origin = sorted[0]!.canonical.startTime;
  const events = sorted.map((group) => ({
    requestId: group.canonical.requestId,
    time: Math.max(0, group.canonical.startTime - origin),
    timestamp: group.canonical.startTime,
  }));

  const actualEnd = Math.max(...sorted.map((group) => group.canonical.endTime - origin));
  const end = Math.max(events.at(-1)!.time, actualEnd, 1);
  return { origin, start: 0, end, events };
}

export function visibleRequestIds(timeline: TemporalTimeline, playhead: number): Set<string> {
  return new Set(
    timeline.events
      .filter((event) => event.time <= playhead)
      .map((event) => event.requestId),
  );
}

export function formatTemporalTime(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function formatTemporalTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}
