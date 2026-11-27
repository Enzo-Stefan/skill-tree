import { useMemo, type CSSProperties } from "react";
import type { Tree } from "../types";
import type { LiftEntry } from "../lib/lifts";
import type { RatingSnapshot } from "../lib/ratingHistory";
import type { SessionEntry } from "../lib/sessions";
import type { TestResult } from "../lib/results";
import type { DayKey } from "../lib/streak";
import { totalXp, type XpEvent } from "../lib/xp";
import { branchLines, careerTotals, LINE_H, LINE_W, missionsCompleted, ranksReached, splitMinutes, xpPerWeek } from "../lib/career";
import { language, t } from "../i18n";
import { PersonalBests } from "./PersonalBests";

const XP_WEEKS = 8;

interface Props {
  tree: Tree;
  done: Set<string>;
  practiceDays: DayKey[];
  today: DayKey;
  sessions: SessionEntry[];
  results: TestResult[];
  playerLevelId: string | null;
  xpEvents: XpEvent[];
  ratingHistory: RatingSnapshot[];
  liftLog: LiftEntry[];
}

const dayText = (day: DayKey) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(y, m - 1, d));
};

/** The Progress tab's Career view (#124): lifetime totals, XP by week, a rating line per branch, the ranks reached and the personal bests. */
export function CareerView({ tree, done, practiceDays, today, sessions, results, playerLevelId, xpEvents, ratingHistory, liftLog }: Props) {
  const totals = useMemo(() => careerTotals(tree, practiceDays, sessions, results, playerLevelId), [tree, practiceDays, sessions, results, playerLevelId]);
  const weeks = useMemo(() => xpPerWeek(xpEvents, today, XP_WEEKS), [xpEvents, today]);
  const lines = useMemo(() => branchLines(tree, ratingHistory), [tree, ratingHistory]);
  const ranks = useMemo(() => ranksReached(tree, done, xpEvents), [tree, done, xpEvents]);
  const { hours, minutes } = splitMinutes(totals.minutes);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.xp));
  const stats: [string, string][] = [
    [t.career.sessions, String(totals.sessions)],
    [t.career.timeTrained, t.career.hoursMinutes(hours, minutes)],
    [t.career.longestStreak, t.practice.weeks(totals.longestStreak)],
    [t.career.skillsDone, t.progressScreen.branchCount(done.size, tree.skills.length)],
    [t.career.missionsDone, String(missionsCompleted(xpEvents))],
    [t.career.resultsSaved, String(totals.results)],
  ];

  return (
    <>
      <section className="card" aria-labelledby="career-totals">
        <h2 className="card-label" id="career-totals">
          {t.career.totals}
        </h2>
        <dl className="career-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="card-note">{t.career.timeNote}</p>
      </section>

      <section className="card" aria-labelledby="career-xp">
        <div className="card-row">
          <h2 className="card-label" id="career-xp">
            {t.career.xpTitle}
          </h2>
          <strong className="card-aside strong">{t.xp.total(totalXp(xpEvents))}</strong>
        </div>
        <ul className="career-weeks">
          {weeks.map((w) => (
            <li key={w.week}>
              <span className="career-week-name">{dayText(w.week)}</span>
              <span className="career-week-track" aria-hidden="true">
                <span style={{ width: `${(w.xp / maxWeek) * 100}%` }} />
              </span>
              <span className="career-week-xp">{t.xp.total(w.xp)}</span>
            </li>
          ))}
        </ul>
        {weeks.some((w) => w.undated) && <p className="card-note">{t.career.xpNote}</p>}
      </section>

      <section className="card" aria-labelledby="career-ratings">
        <h2 className="card-label" id="career-ratings">
          {t.career.ratingsTitle}
        </h2>
        {lines.length === 0 ? (
          <p className="card-note">{t.career.ratingsEmpty}</p>
        ) : (
          <ul className="career-lines">
            {lines.map((l) => {
              const branch = tree.branches.find((b) => b.id === l.branchId);
              if (!branch) return null;
              return (
                <li key={l.branchId} style={{ "--c": branch.color } as CSSProperties}>
                  <div className="card-row">
                    <span className="career-line-name">{branch.name}</span>
                    <span className="career-line-values">{t.career.lineValues(l.first, l.last)}</span>
                  </div>
                  <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} role="img" aria-label={t.career.lineLabel(branch.name, l.first, l.last)} preserveAspectRatio="none">
                    {l.points ? <polyline points={l.points} fill="none" stroke="var(--c)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : <circle cx={LINE_W / 2} cy={LINE_H / 2} r="4" fill="var(--c)" />}
                  </svg>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="career-ranks">
        <h2 className="card-label" id="career-ranks">
          {t.career.ranksTitle}
        </h2>
        <ol className="career-ranks">
          {ranks.map((r) => (
            <li key={r.name}>
              <span className="career-rank-name">{r.name}</span>
              <span className="career-rank-day">{r.day ? dayText(r.day) : t.career.noDate}</span>
            </li>
          ))}
        </ol>
      </section>

      <PersonalBests tree={tree} log={liftLog} />
    </>
  );
}
