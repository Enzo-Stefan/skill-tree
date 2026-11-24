import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Skill } from "../types";
import { elapsed, formatClock, needsStart, remaining, runCount, runReducer, sideCount, startRun, type Phase, type RunState, type RunnableCheck } from "./testRun";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

interface Props {
  skill: Skill;
  check: RunnableCheck;
  /** The stopwatch limit in seconds for timed tests, or null (no level picked, or not timed). */
  limit: number | null;
  /** True when the skill is ready to pass, so a passed test can mark it. */
  canPass: boolean;
  /** Marks the skill as passed. The dialog is already closing and won't put focus back. */
  onPassed: () => void;
  onClose: () => void;
}

/** How often the clock redraws while it runs. The time itself comes from timestamps, not from counting these. */
const TICK_MS = 100;

/**
 * Test mode: counts hits or reps, or times the test, so the player doesn't have to remember the
 * count and hold a timer at the same time. Opens over the skill sheet. A running test ignores taps
 * outside it and Escape, so a stray touch can't throw away a run.
 */
export function TestMode({ skill, check, limit, canPass, onPassed, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);
  const [state, dispatch] = useReducer(runReducer, null, () => startRun(check, limit));
  const [now, setNow] = useState(() => Date.now());
  const running = state.phase === "running";
  const busy = running && state.startedAt !== null;
  // Escape and taps outside can't throw away a run in progress. The Close button still can, once the clock is stopped.
  const safeClose = () => {
    if (!(running && (busy || state.past.length > 0))) onClose();
  };
  useModalFocus(dialog, safeClose, restoreFocus);
  useWakeLock();

  // While the clock runs: redraw it, and let countdowns end on their own.
  useEffect(() => {
    if (state.startedAt === null) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      dispatch({ type: "tick", now: at });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.startedAt]);

  // A buzz when a side or the whole run ends, for a phone in a pocket or on the grass.
  const lastPhase = useRef<Phase>(state.phase);
  useEffect(() => {
    if (state.phase !== lastPhase.current && ["passed", "failed", "sideDone", "finished"].includes(state.phase)) {
      navigator.vibrate?.(state.phase === "passed" ? [120, 80, 120] : 200);
    }
    lastPhase.current = state.phase;
  }, [state.phase]);

  function markPassed() {
    restoreFocus.current = false;
    onPassed();
  }

  const at = (action: "start" | "stop") => dispatch({ type: action, now: Date.now() });
  const sides = sideCount(check);
  const titleId = `test-${skill.id}-title`;

  // On the page itself, not inside the phone sheet, so it covers the tab bar too.
  return createPortal(
    <div className="overlay test-overlay" onClick={safeClose}>
      <div
        ref={dialog}
        className="dialog test-mode"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="test-head">
          <h2 id={titleId}>{t.testMode.title(skill.name)}</h2>
          <button className="close" type="button" onClick={onClose} disabled={busy}>
            {t.testMode.close}
          </button>
        </div>
        <p className="test-goal">
          {sides > 1 && <span className="test-side">{t.testMode.side(state.side + 1, sides)}</span>}
          {goalText(check, limit)}
        </p>

        <Display state={state} now={now} />

        <div className="test-controls">
          {running && check.kind === "hits" && (
            <>
              <button className="btn test-big hit" type="button" onClick={() => dispatch({ type: "hit" })}>
                {t.testMode.hit}
              </button>
              <button className="btn test-big miss" type="button" onClick={() => dispatch({ type: "miss" })}>
                {t.testMode.miss}
              </button>
            </>
          )}
          {running && check.kind === "count" && (
            <>
              <button
                className="btn primary test-big"
                type="button"
                aria-label={t.testMode.addLabel}
                onClick={() => dispatch({ type: "add" })}
              >
                {t.testMode.add}
              </button>
              {check.inARow && (
                <button className="btn test-wide" type="button" onClick={() => dispatch({ type: "slip" })} disabled={state.count === 0}>
                  {t.testMode.slip}
                </button>
              )}
            </>
          )}
          {state.phase === "ready" && (
            <button className="btn primary test-big" type="button" onClick={() => at("start")}>
              {t.testMode.start}
            </button>
          )}
          {running && check.kind === "time" && (
            <button className="btn primary test-big" type="button" onClick={() => at("stop")}>
              {t.testMode.stop}
            </button>
          )}
          {running && needsStart(check) && check.kind !== "time" && (
            <button className="btn test-wide" type="button" onClick={() => at("stop")}>
              {t.testMode.giveUp}
            </button>
          )}
          {state.phase === "sideDone" && (
            <button className="btn primary test-wide" type="button" onClick={() => dispatch({ type: "nextSide" })}>
              {t.testMode.nextSide}
            </button>
          )}
          {state.phase === "passed" &&
            (canPass ? (
              <button className="btn primary test-wide" type="button" onClick={markPassed}>
                {t.testMode.markPassed}
              </button>
            ) : (
              <p className="hint">{t.testMode.alreadyPassed}</p>
            ))}
        </div>

        <p className={`test-result ${state.phase}`} role="status">
          {resultText(state.phase)}
        </p>

        <div className="dialog-actions test-secondary">
          {state.past.length > 0 && (
            <button className="btn" type="button" onClick={() => dispatch({ type: "undo" })}>
              {t.testMode.undoTap}
            </button>
          )}
          {!isUntouched(state) && (
            <button className="btn" type="button" onClick={() => dispatch({ type: "restart" })} disabled={busy}>
              {t.testMode.restart}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Display({ state, now }: { state: RunState; now: number }) {
  const check = state.check;
  if (check.kind === "hits") {
    return (
      <div className="test-display" aria-live="polite">
        <span className="test-number">{state.hits}</span>
        <span className="test-sub">
          {t.testMode.hitsFrom(state.tries)} · {t.testMode.hitsLeft(check.attempts - state.tries)}
        </span>
      </div>
    );
  }
  if (check.kind === "count") {
    const left = remaining(state, now);
    return (
      <div className="test-display" aria-live="polite">
        <span className="test-number">{state.count}</span>
        <span className="test-sub">{t.testMode.countOf(check.needed)}</span>
        {left !== null && (
          <span className="test-clock" aria-hidden="true">
            {formatClock(left, false)}
          </span>
        )}
      </div>
    );
  }
  if (check.kind === "hold") {
    return (
      <div className="test-display">
        <span className="test-number test-time">{formatClock(remaining(state, now) ?? 0, false)}</span>
      </div>
    );
  }
  const runs = runCount(check);
  const runNumber = Math.min(state.times.length + (state.phase === "ready" || state.phase === "running" ? 1 : 0), runs);
  return (
    <div className="test-display">
      {runs > 1 && <span className="test-sub">{t.testMode.run(Math.max(runNumber, 1), runs)}</span>}
      <span className="test-number test-time">{formatClock(shownTime(state, now))}</span>
      {state.times.length > 0 && (
        <ol className="test-times" aria-label={t.testMode.times}>
          {state.times.map((time, i) => (
            <li key={i} className={state.limit !== null && time >= state.limit ? "slow" : undefined}>
              {formatClock(time)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The big stopwatch number: the running clock, or the time just run once it stops. */
function shownTime(state: RunState, now: number): number {
  if (state.phase === "running") return elapsed(state, now);
  if (state.phase === "ready") return 0;
  return state.times[state.times.length - 1] ?? 0;
}

function goalText(check: RunnableCheck, limit: number | null): string {
  const d = t.testMode.duration;
  switch (check.kind) {
    case "hits":
      return [t.testMode.goalHits(check.needed, check.attempts), check.seconds ? t.testMode.eachTry(check.seconds) : ""].join(" ").trim();
    case "count":
      return check.seconds ? t.testMode.goalCountTimed(check.needed, d(check.seconds)) : t.testMode.goalCount(check.needed, Boolean(check.inARow));
    case "hold":
      return t.testMode.goalHold(d(check.seconds));
    case "time": {
      const main = limit === null ? t.testMode.goalTimeNoLimit : t.testMode.goalTime(d(limit));
      const extra = check.tries ? t.testMode.bestOf(check.tries) : check.reps ? t.testMode.everyRun(check.reps) : "";
      return `${main} ${extra}`.trim();
    }
  }
}

function resultText(phase: Phase): string {
  switch (phase) {
    case "passed":
      return t.testMode.passed;
    case "sideDone":
      return t.testMode.sideDone;
    case "failed":
      return t.testMode.failed;
    case "finished":
      return t.testMode.finished;
    default:
      return "";
  }
}

function isUntouched(state: RunState): boolean {
  return state.side === 0 && state.tries === 0 && state.count === 0 && state.times.length === 0 && state.startedAt === null && (state.phase === "ready" || state.phase === "running");
}

/** Keeps the screen on while test mode is open, where the browser allows it. Asks again after the tab comes back. */
function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let closed = false;
    const request = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (closed) void next.release();
        else lock = next;
      } catch {
        // Refused (battery saver, or the page is hidden). The test still works; the screen may sleep.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}
