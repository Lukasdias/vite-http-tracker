import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { groupRecords } from "./graph.js";
import {
  formatTemporalTime,
  formatTemporalTimestamp,
  temporalTimeline,
  visibleRequestIds,
} from "./temporal.js";
import { TEMPORAL_STEP_DURATION_MS } from "./hooks/useTemporalPlayback.js";

const record = (requestId: string, startTime: number, endTime: number): RequestRecord => ({
  requestId,
  seq: startTime,
  method: "GET",
  url: `/${requestId}`,
  status: 200,
  startTime,
  endTime,
  duration: endTime - startTime,
});

describe("temporalTimeline", () => {
  test("uses the first start and last end time", () => {
    const groups = groupRecords([record("a", 100, 140), record("b", 180, 250)]);
    expect(temporalTimeline(groups)).toEqual({
      origin: 100,
      start: 0,
      end: 150,
      events: [
        { requestId: "a", time: 0, timestamp: 100 },
        { requestId: "b", time: 80, timestamp: 180 },
      ],
    });
  });

  test("returns null for an empty timeline", () => {
    expect(temporalTimeline([])).toBeNull();
  });

  test("keeps same-millisecond requests at the same exact timestamp", () => {
    const groups = groupRecords([
      record("a", 100, 100),
      record("b", 100, 100),
      record("c", 100, 100),
    ]);
    const timeline = temporalTimeline(groups)!;
    expect(timeline.origin).toBe(100);
    expect(timeline.events.map((event) => event.time)).toEqual([
      0,
      0,
      0,
    ]);
    expect(timeline.end).toBe(1);
  });
});

describe("visibleRequestIds", () => {
  test("reveals requests when their start time reaches the playhead", () => {
    const groups = groupRecords([record("a", 100, 140), record("b", 180, 250)]);
    const timeline = temporalTimeline(groups)!;
    expect([...visibleRequestIds(timeline, 79)]).toEqual(["a"]);
    expect([...visibleRequestIds(timeline, 80)]).toEqual(["a", "b"]);
  });
});

describe("formatTemporalTime", () => {
  test("formats milliseconds and seconds for the taskbar", () => {
    expect(formatTemporalTime(420)).toBe("420ms");
    expect(formatTemporalTime(2100)).toBe("2.10s");
    expect(formatTemporalTimestamp(0)).toMatch(/00:00:00\.000|12:00:00\.000/);
  });
});

describe("temporal playback", () => {
  test("uses a visible interval for automatic timestamp steps", () => {
    expect(TEMPORAL_STEP_DURATION_MS).toBeGreaterThanOrEqual(150);
    expect(TEMPORAL_STEP_DURATION_MS).toBeLessThan(500);
  });
});
