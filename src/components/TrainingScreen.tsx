import { useState } from "react";
import type { Skill, Tree } from "../types";
import { MAX_DAY_MINUTES, MIN_DAY_MINUTES, trainedPlanDays, type PlanDay } from "../lib/plan";
import type { DayKey } from "../lib/streak";
import { language, t } from "../i18n";
import { exerciseAmount } from "./exerciseAmount";
import type { PlanState } from "./usePlan";
import { useRestTimer } from "./useRestTimer";

interface Props {
  tree: Tree;
  state: PlanState;
  levelId: string | null;
  today: DayKey;
  practiceDays: DayKey[];
  /** "Finish session": counts today as a training day. */
  onFinish: () => void;
}

const DAY_STEP = 15;

function parse(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The Training tab: today's session as a checklist, and the week's plan. */
export function TrainingScreen({ tree, state, levelId, today, practiceDays, onFinish }: Props) {
  const [view, setView] = useState<"today" | "week">("today");
  const { plan } = state;
  const empty = plan.days.every((d) => d.items.length === 0) && plan.unplaced.length === 0;
  const trained = new Set(trainedPlanDays(plan, practiceDays));
  const skills = new Map(tree.skills.map((s) => [s.id, s]));

  return (
    <div className="screen training">
      <div className="screen-head">
        <h1 className="screen-title">{t.tabs.plan}</h1>
        <div className="seg" role="group" aria-label={t.training.views}>
          {(["today", "week"] as const).map((v) => (
            <button key={v} type="button" className="seg-btn" aria-pressed={view === v} onClick={() => setView(v)}>
              {t.training[v]}
            </button>
          ))}
        </div>
      </div>
      {empty ? (
        <p className="hint">{t.training.noPlan}</p>
      ) : view === "today" ? (
        <TodayView day={plan.days.find((d) => d.date === today)} skills={skills} levelId={levelId} state={state} finished={practiceDays.includes(today)} onFinish={onFinish} />
      ) : (
        <WeekView days={plan.days} skills={skills} today={today} trained={trained} state={state} unplaced={plan.unplaced.length} />
      )}
    </div>
  );
}

function TodayView({ day, skills, levelId, state, finished, onFinish }: { day: PlanDay | undefined; skills: Map<string, Skill>; levelId: string | null; state: PlanState; finished: boolean; onFinish: () => void }) {
  const rest = useRestTimer();
  if (!day || day.items.length === 0) return <p className="hint">{t.training.restDay}</p>;

  const keys = day.items.flatMap((it) => skills.get(it.skillId)!.routine!.exercises.map((_, i) => `${day.date}|${it.skillId}|${i}`));
  const doneCount = keys.filter((k) => state.ticks.has(k)).length;

  return (
    <>
      <p className="hint" aria-live="polite">
        {t.training.progress(doneCount, keys.length)}
      </p>
      {day.items.map((item) => {
        const skill = skills.get(item.skillId)!;
        const routine = skill.routine!;
        return (
          <section key={item.skillId} className="session" aria-labelledby={`session-${item.skillId}`}>
            <h2 id={`session-${item.skillId}`} className="session-title">
              {t.training.sessionOf(skill.name, item.minutes)}
            </h2>
            <p>
              <strong>{t.training.warmUp}.</strong> {routine.warmUp}
            </p>
            <ul className="checklist">
              {routine.exercises.map((ex, i) => {
                const key = `${day.date}|${item.skillId}|${i}`;
                const id = `ex-${item.skillId}-${i}`;
                return (
                  <li key={key}>
                    <input id={id} type="checkbox" checked={state.ticks.has(key)} onChange={() => state.toggleTick(key)} />
                    <label htmlFor={id}>
                      <span className="routine-name">{ex.name}</span>
                      <span className="routine-amount">
                        {exerciseAmount(ex, levelId)} · {t.training.rest(ex.restSeconds)}
                      </span>
                      <span className="routine-how">{ex.howTo}</span>
                    </label>
                    <button className="btn rest-btn" type="button" onClick={() => rest.start(ex.restSeconds)}>
                      {t.training.startRest(ex.restSeconds)}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p>
              <strong>{t.training.coolDown}.</strong> {routine.coolDown}
            </p>
          </section>
        );
      })}
      <div className="rest-bar" data-running={rest.left !== null}>
        {rest.left !== null && (
          <>
            <span className="rest-time" aria-hidden="true">
              {t.training.restRunning(rest.left)}
            </span>
            <button className="btn" type="button" onClick={rest.skip}>
              {t.training.skipRest}
            </button>
          </>
        )}
        <span className="sr-only" role="status">
          {rest.over ? t.training.restOver : ""}
        </span>
      </div>
      <button className="btn primary finish" type="button" disabled={finished} onClick={onFinish}>
        {finished ? t.training.finishedToday : t.training.finish}
      </button>
    </>
  );
}

function WeekView({ days, skills, today, trained, state, unplaced }: { days: PlanDay[]; skills: Map<string, Skill>; today: DayKey; trained: Set<DayKey>; state: PlanState; unplaced: number }) {
  const long = new Intl.DateTimeFormat(language, { weekday: "long" });
  const date = new Intl.DateTimeFormat(language, { day: "numeric", month: "short" });
  return (
    <>
      <ol className="week-plan">
        {days.map((d) => {
          const when = parse(d.date);
          const isTrained = trained.has(d.date);
          return (
            <li key={d.date} className={`${isTrained ? "trained" : ""}${d.date === today ? " today" : ""}`}>
              <div className="week-plan-day">
                <strong>{long.format(when)}</strong>
                <span>{date.format(when)}</span>
              </div>
              <div className="week-plan-items">
                {d.items.length === 0 ? (
                  <span className="hint">{t.training.dayRest}</span>
                ) : (
                  d.items.map((it, i) => (
                    <span key={i} className={`week-plan-item${it.heavy ? " heavy" : ""}`}>
                      {skills.get(it.skillId)!.name}
                      <span className="hint">{t.training.minutes(it.minutes)}</span>
                    </span>
                  ))
                )}
              </div>
              <span className="week-plan-mark">
                {isTrained && (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="sr-only">{t.training.dayDone}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {unplaced > 0 && <p className="hint">{t.training.unplaced(unplaced)}</p>}
      <div className="day-limit">
        <span id="day-limit-label">{t.training.dayLimit}</span>
        <div className="stepper" role="group" aria-labelledby="day-limit-label">
          <button className="btn" type="button" aria-label={t.training.lessTime} disabled={state.dayMinutes <= MIN_DAY_MINUTES} onClick={() => state.setDayMinutes(state.dayMinutes - DAY_STEP)}>
            −
          </button>
          <output>{t.training.minutes(state.dayMinutes)}</output>
          <button className="btn" type="button" aria-label={t.training.moreTime} disabled={state.dayMinutes >= MAX_DAY_MINUTES} onClick={() => state.setDayMinutes(state.dayMinutes + DAY_STEP)}>
            +
          </button>
        </div>
      </div>
    </>
  );
}
