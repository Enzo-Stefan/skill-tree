import { describe, expect, it } from "vitest";
import { canUndo, elapsed, formatClock, remaining, runReducer, runResult, startRun, type RunAction, type RunState, type RunnableCheck } from "./testRun";

function play(check: RunnableCheck, actions: RunAction[], limit: number | null = null): RunState {
  return actions.reduce(runReducer, startRun(check, limit));
}

const hits = (n: number): RunAction[] => Array.from({ length: n }, () => ({ type: "hit" }));
const misses = (n: number): RunAction[] => Array.from({ length: n }, () => ({ type: "miss" }));
const adds = (n: number): RunAction[] => Array.from({ length: n }, () => ({ type: "add" }));
const run = (start: number, stop: number): RunAction[] => [
  { type: "start", now: start },
  { type: "stop", now: stop },
];

describe("hits: 8 of 10", () => {
  const check: RunnableCheck = { kind: "hits", needed: 8, attempts: 10 };

  it("counts straight away, no Start", () => {
    expect(startRun(check, null).phase).toBe("running");
  });

  it("passes as soon as the 8th hit lands", () => {
    const s = play(check, [...misses(2), ...hits(8)]);
    expect(s.phase).toBe("passed");
    expect(s.tries).toBe(10);
  });

  it("fails as soon as 8 is out of reach", () => {
    expect(play(check, misses(2)).phase).toBe("running");
    expect(play(check, misses(3)).phase).toBe("failed");
  });

  it("undo takes back the last tap, even the one that ended the run", () => {
    const s = runReducer(play(check, misses(3)), { type: "undo" });
    expect(s.phase).toBe("running");
    expect(s.tries).toBe(2);
  });

  it("ignores taps after the run is over", () => {
    const s = play(check, [...misses(3), ...hits(1)]);
    expect(s.hits).toBe(0);
  });
});

describe("hits with a timed try: 4 of 5, keep it 10 seconds", () => {
  const check: RunnableCheck = { kind: "hits", needed: 4, attempts: 5, seconds: 10 };
  const lasted = (start: number): RunAction[] => [
    { type: "start", now: start },
    { type: "tick", now: start + 10_000 },
  ];
  const lost = (start: number, at: number): RunAction[] => [
    { type: "start", now: start },
    { type: "miss", now: start + at },
  ];

  it("each try waits for Start and counts down from 10", () => {
    const s = startRun(check, null);
    expect(s.phase).toBe("ready");
    expect(remaining(s, 0)).toBe(10);
    const going = runReducer(s, { type: "start", now: 1000 });
    expect(remaining(going, 4000)).toBe(7);
  });

  it("lasting the 10 seconds is a hit, then the next try waits for Start", () => {
    const s = play(check, lasted(0));
    expect(s).toMatchObject({ phase: "ready", hits: 1, tries: 1, startedAt: null });
  });

  it("Miss during the try ends it early as a miss", () => {
    const s = play(check, lost(0, 4000));
    expect(s).toMatchObject({ phase: "ready", hits: 0, tries: 1, startedAt: null });
  });

  it("Hit can't be tapped: only the clock gives a hit", () => {
    const s = play(check, [{ type: "start", now: 0 }, { type: "hit", now: 1000 }]);
    expect(s).toMatchObject({ phase: "running", hits: 0, tries: 0 });
  });

  it("a Miss tapped after the time ran out, before the redraw, counts as the hit it was", () => {
    const s = play(check, [{ type: "start", now: 0 }, { type: "miss", now: 10_050 }]);
    expect(s).toMatchObject({ hits: 1, tries: 1, phase: "ready" });
  });

  it("passes on the 4th hit and fails when 4 is out of reach", () => {
    expect(play(check, [...lasted(0), ...lasted(20_000), ...lasted(40_000), ...lasted(60_000)]).phase).toBe("passed");
    expect(play(check, [...lost(0, 1000), ...lost(5000, 1000)]).phase).toBe("failed");
  });

  it("Undo takes back an automatic hit and goes back to before that try's Start", () => {
    const s = runReducer(play(check, lasted(0)), { type: "undo" });
    expect(s).toMatchObject({ phase: "ready", hits: 0, tries: 0, startedAt: null });
  });

  it("Undo waits while a try is counting down", () => {
    const s = play(check, [...lasted(0), { type: "start", now: 20_000 }]);
    expect(canUndo(s)).toBe(false);
    expect(runReducer(s, { type: "undo" })).toBe(s);
  });
});

describe("count", () => {
  it("20 in a row: a slip starts again, undo brings the count back", () => {
    const check: RunnableCheck = { kind: "count", needed: 20, inARow: true };
    let s = play(check, [...adds(12), { type: "slip" }]);
    expect(s.count).toBe(0);
    s = runReducer(s, { type: "undo" });
    expect(s.count).toBe(12);
    expect(play(check, adds(20)).phase).toBe("passed");
  });

  it("slip does nothing when the count isn't in a row", () => {
    expect(play({ kind: "count", needed: 10 }, [...adds(3), { type: "slip" }]).count).toBe(3);
  });

  it("40 in 60 seconds: waits for Start, passes early, fails when time runs out", () => {
    const check: RunnableCheck = { kind: "count", needed: 40, seconds: 60 };
    expect(play(check, adds(5)).count).toBe(0);
    expect(play(check, [{ type: "start", now: 0 }, ...adds(40)]).phase).toBe("passed");
    const late = play(check, [{ type: "start", now: 0 }, ...adds(39), { type: "tick", now: 59_999 }]);
    expect(late.phase).toBe("running");
    expect(runReducer(late, { type: "tick", now: 60_000 }).phase).toBe("failed");
  });

  it("a tap after the time ran out, before the redraw, doesn't count", () => {
    const check: RunnableCheck = { kind: "count", needed: 40, seconds: 60 };
    const late = play(check, [{ type: "start", now: 0 }, ...adds(39), { type: "add", now: 60_100 }]);
    expect(late).toMatchObject({ phase: "failed", count: 39 });
  });

  it("on each side: passes the first side, then the second", () => {
    const check: RunnableCheck = { kind: "count", needed: 8, perSide: true };
    let s = play(check, adds(8));
    expect(s.phase).toBe("sideDone");
    s = runReducer(s, { type: "nextSide" });
    expect(s).toMatchObject({ phase: "running", side: 1, count: 0 });
    s = adds(8).reduce(runReducer, s);
    expect(s.phase).toBe("passed");
  });
});

describe("time", () => {
  it("one run under the limit passes, at the limit fails", () => {
    const check: RunnableCheck = { kind: "time", under: 15 };
    expect(play(check, run(1000, 15_990), 15).phase).toBe("passed");
    expect(play(check, run(1000, 16_000), 15).phase).toBe("failed");
  });

  it("best of 3: a slow run waits for the next try", () => {
    const check: RunnableCheck = { kind: "time", tries: 3 };
    const s = play(check, [...run(0, 6000), ...run(10_000, 15_500)], 5.8);
    expect(s.phase).toBe("passed");
    expect(s.times).toEqual([6, 5.5]);
    expect(play(check, [...run(0, 6000), ...run(0, 6000), ...run(0, 6000)], 5.8).phase).toBe("failed");
  });

  it("10 reps: every one must be under, one slow sprint fails", () => {
    const check: RunnableCheck = { kind: "time", reps: 10 };
    const fast = Array.from({ length: 10 }, () => run(0, 6000)).flat();
    expect(play(check, fast, 6.5).phase).toBe("passed");
    expect(play(check, [...run(0, 6000), ...run(0, 7000)], 6.5).phase).toBe("failed");
  });

  it("without a target, records the times and finishes", () => {
    const s = play({ kind: "time", tries: 3 }, [...run(0, 6000), ...run(0, 5000), ...run(0, 5500)], null);
    expect(s.phase).toBe("finished");
    expect(s.times).toEqual([6, 5, 5.5]);
  });

  it("on each foot: the slalom runs twice", () => {
    const check: RunnableCheck = { kind: "time", under: 18, perSide: true };
    let s = play(check, run(0, 17_000), 18);
    expect(s.phase).toBe("sideDone");
    s = [{ type: "nextSide" } as RunAction, ...run(0, 17_500)].reduce(runReducer, s);
    expect(s.phase).toBe("passed");
  });

  it("the clock is wall time, not ticks", () => {
    const s = play({ kind: "time", under: 15 }, [{ type: "start", now: 1000 }], 15);
    expect(elapsed(s, 4500)).toBe(3.5);
  });
});

describe("runResult: the time to save", () => {
  it("best of 3: the fastest run, once the test is over", () => {
    const check: RunnableCheck = { kind: "time", tries: 3 };
    expect(runResult(play(check, run(0, 6000), 5.8))).toBeNull();
    expect(runResult(play(check, [...run(0, 6000), ...run(0, 5500)], 5.8))).toBe(5.5);
    expect(runResult(play(check, [...run(0, 6000), ...run(0, 6200), ...run(0, 6100)], 5.8))).toBe(6);
    expect(runResult(play(check, [...run(0, 6000), ...run(0, 5000), ...run(0, 5500)], null))).toBe(5);
  });

  it("every run under: the slowest run, only when all of them were run", () => {
    const check: RunnableCheck = { kind: "time", reps: 3 };
    expect(runResult(play(check, [...run(0, 6000), ...run(0, 6400), ...run(0, 6100)], 6.5))).toBe(6.4);
    expect(runResult(play(check, [...run(0, 6000), ...run(0, 7000)], 6.5))).toBeNull();
  });

  it("nothing to save for a run stopped as soon as it started", () => {
    expect(runResult(play({ kind: "time", tries: 1 }, run(0, 0), null))).toBeNull();
  });

  it("nothing to save for other kinds of test", () => {
    expect(runResult(play({ kind: "hold", seconds: 5 }, [{ type: "start", now: 0 }, { type: "tick", now: 5000 }]))).toBeNull();
  });
});

describe("hold", () => {
  const check: RunnableCheck = { kind: "hold", seconds: 60 };

  it("counts down and passes at zero", () => {
    let s = play(check, [{ type: "start", now: 0 }]);
    expect(remaining(s, 20_000)).toBe(40);
    s = runReducer(s, { type: "tick", now: 60_000 });
    expect(s.phase).toBe("passed");
  });

  it("Stop early tapped after the time ran out, before the redraw, still passes", () => {
    expect(play(check, [{ type: "start", now: 0 }, { type: "stop", now: 60_050 }]).phase).toBe("passed");
  });

  it("stopping early fails", () => {
    expect(play(check, [{ type: "start", now: 0 }, { type: "stop", now: 30_000 }]).phase).toBe("failed");
  });

  it("restart goes back to the start", () => {
    const s = runReducer(play(check, [{ type: "start", now: 0 }, { type: "stop", now: 1 }]), { type: "restart" });
    expect(s).toMatchObject({ phase: "ready", startedAt: null, past: [] });
  });
});

describe("formatClock", () => {
  it("shows tenths under a minute and minutes after", () => {
    expect(formatClock(8.46)).toBe("8.4");
    expect(formatClock(1499.9)).toBe("24:59");
    expect(formatClock(58.2, false)).toBe("59");
    expect(formatClock(59.2, false)).toBe("1:00");
    expect(formatClock(90, false)).toBe("1:30");
  });

  it("uses a decimal comma in Spanish", () => {
    expect(formatClock(8.46, true, "es")).toBe("8,4");
    expect(formatClock(5, true, "es")).toBe("5,0");
    expect(formatClock(1499.9, true, "es")).toBe("24:59");
  });
});

describe("a tap after the countdown ran out", () => {
  const check: RunnableCheck = { kind: "count", needed: 40, seconds: 60 };
  const tapsAt = (times: number[]): RunAction[] => times.map((now) => ({ type: "add", now }));

  it("doesn't count, even before the next tick, so a late 40th tap can't pass", () => {
    const s = play(check, [{ type: "start", now: 0 }, ...tapsAt(Array.from({ length: 39 }, (_, i) => i * 1000)), { type: "add", now: 60_050 }]);
    expect(s.phase).toBe("failed");
    expect(s.count).toBe(39);
  });

  it("still counts a 40th tap just inside the time", () => {
    const s = play(check, [{ type: "start", now: 0 }, ...tapsAt(Array.from({ length: 40 }, (_, i) => i * 1000 + 59_000 - 39_000))]);
    expect(s.phase).toBe("passed");
  });
});
