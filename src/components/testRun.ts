import type { TestCheck } from "../types";

// One run of a skill's test at the pitch (test mode, idea 4 in #17): counting hits, counting reps,
// a stopwatch or a countdown, worked out from the skill's `check`. Pure, and the time is always
// passed in, so the tests can play a whole run without a real clock.

/** A check that test mode can run. "done" checks have nothing to count or time. */
export type RunnableCheck = Exclude<TestCheck, { kind: "done" }>;

/**
 * - `ready`: waiting for Start (timed tests, between stopwatch runs, and between timed tries).
 * - `running`: counting or timing.
 * - `sideDone`: the first side passed, the other side is next.
 * - `passed` / `failed`: the run is over.
 * - `finished`: a stopwatch run with no target to compare with (no level picked yet).
 */
export type Phase = "ready" | "running" | "sideDone" | "passed" | "failed" | "finished";

interface Core {
  phase: Phase;
  /** 0 for the first side, 1 for the second (perSide checks only). */
  side: number;
  /** Hits so far (hits checks). */
  hits: number;
  /** Attempts so far (hits checks). */
  tries: number;
  /** The count so far (count checks). With inARow, the current run of good ones. */
  count: number;
  /** When the clock started, in ms, or null when it isn't running. */
  startedAt: number | null;
  /** Finished stopwatch runs on this side, in seconds. */
  times: number[];
}

export interface RunState extends Core {
  check: RunnableCheck;
  /** The stopwatch limit in seconds (time checks), or null if there's no target yet. */
  limit: number | null;
  /** Earlier states, for "Undo last tap". */
  past: Core[];
}

/**
 * Taps carry the time when they can, so a tap that lands after a countdown ran out (before the
 * next redraw noticed) is judged by the countdown first, not counted as if it were in time.
 */
export type RunAction =
  | { type: "start"; now: number }
  | { type: "hit"; now?: number }
  | { type: "miss"; now?: number }
  | { type: "add"; now?: number }
  /** Counts "in a row": a miss starts the count again. */
  | { type: "slip" }
  | { type: "stop"; now: number }
  | { type: "tick"; now: number }
  | { type: "nextSide" }
  | { type: "undo" }
  | { type: "restart" };

export function isRunnable(check: TestCheck | undefined): check is RunnableCheck {
  return check !== undefined && check.kind !== "done";
}

/** How many sides the test runs on: 2 for "on each leg", otherwise 1. */
export function sideCount(check: RunnableCheck): number {
  return check.perSide ? 2 : 1;
}

/** How many stopwatch runs a side gets: `tries` (best of), `reps` (every one), or 1. */
export function runCount(check: RunnableCheck): number {
  if (check.kind !== "time") return 1;
  return check.tries ?? check.reps ?? 1;
}

/** True when the test waits for a Start tap: anything with a clock. Untimed hits and plain counts start counting straight away. */
export function needsStart(check: RunnableCheck): boolean {
  return check.kind === "time" || check.kind === "hold" || ((check.kind === "count" || check.kind === "hits") && check.seconds !== undefined);
}

/** Hits where every try lasts a set time ("keep the ball for 10 seconds"): each try has its own countdown, and lasting it out is a hit. */
export function timedTries(check: RunnableCheck): boolean {
  return check.kind === "hits" && check.seconds !== undefined;
}

function fresh(check: RunnableCheck, side: number): Core {
  return { phase: needsStart(check) ? "ready" : "running", side, hits: 0, tries: 0, count: 0, startedAt: null, times: [] };
}

export function startRun(check: RunnableCheck, limit: number | null): RunState {
  return { ...fresh(check, 0), check, limit, past: [] };
}

/** Seconds on the clock since Start, or 0 when it isn't running. */
export function elapsed(state: RunState, now: number): number {
  return state.startedAt === null ? 0 : Math.max(0, (now - state.startedAt) / 1000);
}

/** Seconds left on a countdown (hold, or a count with `seconds`), or null if the test has no countdown. */
export function remaining(state: RunState, now: number): number | null {
  const total = countdownSeconds(state.check);
  if (total === null) return null;
  if (state.startedAt === null) return state.phase === "ready" ? total : 0;
  return Math.max(0, total - elapsed(state, now));
}

function countdownSeconds(check: RunnableCheck): number | null {
  if (check.kind === "hold") return check.seconds;
  if (check.kind === "count" || check.kind === "hits") return check.seconds ?? null;
  return null;
}

/** True when a countdown is running and has reached 0 at `now`. */
function countdownOver(state: RunState, now: number | undefined): boolean {
  if (now === undefined || state.phase !== "running" || state.startedAt === null) return false;
  return remaining(state, now) === 0;
}

/**
 * What happens when a countdown reaches 0: a hold is done, a timed count didn't get there in time,
 * and a timed try lasted the whole time, so it's a hit (which Undo can take back if it wasn't).
 */
function countdownEnded(state: RunState): RunState {
  const check = state.check;
  if (check.kind === "hold") return { ...state, ...sidePassed(state), past: [] };
  if (check.kind === "hits") {
    return withPast(state, afterHitOrMiss(state, { ...core(state), hits: state.hits + 1, tries: state.tries + 1 }));
  }
  return { ...state, phase: "failed", startedAt: null, past: [] };
}

/** Ends this side as passed: on to the other side, or the whole test passes. */
function sidePassed(state: RunState): Core {
  const last = state.side + 1 >= sideCount(state.check);
  return { ...core(state), phase: last ? "passed" : "sideDone", startedAt: null };
}

function core(state: RunState): Core {
  const { phase, side, hits, tries, count, startedAt, times } = state;
  return { phase, side, hits, tries, count, startedAt, times };
}

/**
 * A tap that changes counts can be undone; the earlier state goes on the stack. A timed try goes
 * back to before its Start, not into a countdown that has already run out.
 */
function withPast(state: RunState, next: Core): RunState {
  const before = timedTries(state.check) ? { ...core(state), phase: "ready" as const, startedAt: null } : core(state);
  return { ...state, ...next, past: [...state.past, before] };
}

function afterHitOrMiss(state: RunState, next: Core): Core {
  const check = state.check;
  if (check.kind !== "hits") return next;
  if (next.hits >= check.needed) return sidePassed({ ...state, ...next });
  if (next.hits + (check.attempts - next.tries) < check.needed) return { ...next, phase: "failed", startedAt: null };
  // A timed try is over either way; the next one waits for Start.
  return check.seconds !== undefined ? { ...next, phase: "ready", startedAt: null } : next;
}

function stopwatchStop(state: RunState, now: number): Core {
  const check = state.check;
  const time = Math.round(elapsed(state, now) * 100) / 100;
  const times = [...state.times, time];
  const next: Core = { ...core(state), startedAt: null, times };
  const runs = runCount(check);
  const lastRun = times.length >= runs;
  if (state.limit === null) return { ...next, phase: lastRun ? "finished" : "ready" };
  const under = time < state.limit;
  if (check.kind === "time" && check.reps !== undefined) {
    if (!under) return { ...next, phase: "failed" };
    return lastRun ? sidePassed({ ...state, ...next }) : { ...next, phase: "ready" };
  }
  // A single run, or best of `tries`: one run under the limit is enough.
  if (under) return sidePassed({ ...state, ...next });
  return { ...next, phase: lastRun ? "failed" : "ready" };
}

export function runReducer(state: RunState, action: RunAction): RunState {
  const check = state.check;
  switch (action.type) {
    case "start":
      if (state.phase !== "ready") return state;
      return { ...state, phase: "running", startedAt: action.now };

    case "hit":
    case "miss": {
      if (check.kind !== "hits") return state;
      if (countdownOver(state, action.now)) return countdownEnded(state);
      if (state.phase !== "running") return state;
      // In a timed try only the clock gives a hit; the player taps Miss if it goes wrong.
      const hit = action.type === "hit";
      if (hit && check.seconds !== undefined) return state;
      const next = { ...core(state), hits: state.hits + (hit ? 1 : 0), tries: state.tries + 1 };
      return withPast(state, afterHitOrMiss(state, next));
    }

    case "add": {
      if (check.kind !== "count") return state;
      if (countdownOver(state, action.now)) return countdownEnded(state);
      if (state.phase !== "running") return state;
      const next = { ...core(state), count: state.count + 1 };
      return withPast(state, next.count >= check.needed ? sidePassed({ ...state, ...next }) : next);
    }

    case "slip":
      if (check.kind !== "count" || !check.inARow || state.phase !== "running" || state.count === 0) return state;
      return withPast(state, { ...core(state), count: 0 });

    case "stop":
      if (countdownOver(state, action.now)) return countdownEnded(state);
      if (state.phase !== "running") return state;
      if (check.kind === "time") return { ...state, ...stopwatchStop(state, action.now), past: [] };
      // Giving up a hold or a timed count before the end.
      if (check.kind === "hold" || (check.kind === "count" && check.seconds !== undefined)) {
        return { ...state, phase: "failed", startedAt: null, past: [] };
      }
      return state;

    case "tick": {
      if (state.phase !== "running") return state;
      return countdownOver(state, action.now) ? countdownEnded(state) : state;
    }

    case "nextSide":
      if (state.phase !== "sideDone") return state;
      return { ...state, ...fresh(check, state.side + 1), past: [] };

    case "undo": {
      if (!canUndo(state)) return state;
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { ...state, ...previous, past: state.past.slice(0, -1) };
    }

    case "restart":
      return startRun(check, state.limit);
  }
}

/** True when "Undo last tap" can do something: there is a tap to take back, and no timed try is counting down. */
export function canUndo(state: RunState): boolean {
  return state.past.length > 0 && !(timedTries(state.check) && state.startedAt !== null);
}

/**
 * The number to save as the player's result once a stopwatch test is over: the best run for "best
 * of 3", the slowest run for "every run under" (the target is about that one). Null while the test
 * is still going, when not every run was done, or for tests that aren't a stopwatch on one side.
 */
export function runResult(state: RunState): number | null {
  const check = state.check;
  if (check.kind !== "time" || check.perSide || state.times.length === 0) return null;
  if (state.phase !== "passed" && state.phase !== "failed" && state.phase !== "finished") return null;
  const value = check.reps !== undefined ? (state.times.length === check.reps ? Math.max(...state.times) : null) : Math.min(...state.times);
  // A Start then Stop by mistake gives 0, which isn't a time worth keeping.
  return value !== null && value > 0 ? value : null;
}

/** Seconds as the clock shows them: "8.4" ("8,4" in Spanish) under a minute, "24:59" from a minute up. */
export function formatClock(seconds: number, tenths = true, locale = "en"): string {
  // Countdowns round up, so the clock never shows 0 while time is left.
  const whole = tenths ? Math.floor(seconds) : Math.ceil(seconds);
  if (whole >= 60) return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  if (!tenths) return String(whole);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.floor(seconds * 10) / 10);
}
