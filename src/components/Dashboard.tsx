import type { CSSProperties } from "react";
import type { Skill, Tree } from "../types";
import type { XpState } from "../lib/useXp";
import type { SessionEntry } from "../lib/sessions";
import type { WeekPlan } from "../lib/plan";
import { branchShares, continueTarget, daySessions, recentActivity, weekSessionCount } from "../lib/dashboard";
import { language, t } from "../i18n";
import { DashboardChallenges } from "./DashboardChallenges";
import type { ChallengeContext } from "../lib/challenges";
import { NextUpCard } from "./NextUpCard";

interface Props {
  tree: Tree;
  xp: XpState;
  done: Set<string>;
  plan: WeekPlan;
  ticks: Set<string>;
  sessions: SessionEntry[];
  today: string;
  /** What the daily, weekly and season challenges count: the days trained, the skills worked on, the days skills were passed. */
  challengeContext: ChallengeContext;
  /** The player's rank name ("Rookie"), from the finished skills. */
  rank: string;
  /** The suggested next skill (nextSkill), shown as the Next up card. */
  suggested: Skill | null;
  onOpenSkill: (skill: Skill) => void;
  /** Opens today's session on the Training tab. */
  onOpenToday: () => void;
}

const pct = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);

/** The top of the Train tab: level and XP, football progress, today's and the week's sessions, recent activity, and Continue training. */
export function Dashboard({ tree, xp, done, plan, ticks, sessions, today, challengeContext, rank, suggested, onOpenSkill, onOpenToday }: Props) {
  const names = new Map(tree.skills.map((s) => [s.id, s.name]));
  const target = continueTarget(tree, plan, ticks, done, today);
  const sessionsToday = daySessions(tree, plan, ticks, today);
  const week = weekSessionCount(tree, plan, ticks);
  const recent = recentActivity(tree, sessions, xp.events);
  const shortDate = new Intl.DateTimeFormat(language, { day: "numeric", month: "short" });
  const when = (key: string) => {
    if (key === today) return t.dashboard.todayWord;
    const [y, m, d] = key.split("-").map(Number);
    return shortDate.format(new Date(y!, m! - 1, d));
  };

  return (
    <section className="dash" aria-label={t.dashboard.label}>
      {target && (
        <button
          type="button"
          className="btn primary dash-continue"
          onClick={() => (target.kind === "session" ? onOpenToday() : onOpenSkill(target.skill))}
        >
          <span className="dash-continue-title">{t.dashboard.continue}</span>
          <span className="dash-continue-sub">{names.get(target.kind === "session" ? target.skillId : target.skill.id)}</span>
        </button>
      )}

      <div className="card dash-card">
        <div className="card-row">
          <h2 className="card-label">{t.xp.form}</h2>
          <span className="card-aside strong">{t.xp.total(xp.total)}</span>
        </div>
        <div className="card-row">
          <span className="card-big">{t.xp.level(xp.level.level)}</span>
          <span className="card-aside">{t.dashboard.rank(rank)}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuenow={xp.level.into} aria-label={t.xp.level(xp.level.level)}>
          <span style={{ width: `${xp.level.progress * 100}%` }} />
        </div>
        <p className="card-note">{t.xp.toNext(xp.level.span - xp.level.into)}</p>
      </div>

      <div className="card dash-card">
        <div className="card-row">
          <h2 className="card-label">{t.dashboard.football}</h2>
          <span className="card-aside strong">{t.dashboard.skillsDone(done.size, tree.skills.length)}</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={tree.skills.length} aria-valuenow={done.size} aria-label={t.dashboard.football}>
          <span style={{ width: `${pct(done.size, tree.skills.length)}%` }} />
        </div>
        <ul className="branch-bars">
          {branchShares(tree, done).map((b) => (
            <li key={b.id} className="branch-bar" style={{ "--c": b.color } as CSSProperties}>
              <span className="branch-bar-name">{b.name}</span>
              <span className="branch-bar-track" aria-hidden="true">
                <span style={{ width: `${pct(b.done, b.total)}%` }} />
              </span>
              <span className="branch-bar-count">{t.progressScreen.branchCount(b.done, b.total)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card dash-card">
        <div className="card-row">
          <h2 className="card-label">{t.dashboard.missions}</h2>
          {week.total > 0 && <span className="card-aside strong">{t.dashboard.weekSessions(week.done, week.total)}</span>}
        </div>
        {week.total > 0 && (
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={week.total} aria-valuenow={week.done} aria-label={t.dashboard.weekSessions(week.done, week.total)}>
            <span style={{ width: `${pct(week.done, week.total)}%` }} />
          </div>
        )}
        {sessionsToday.length === 0 ? (
          <p className="card-note">{week.total > 0 ? t.dashboard.restToday : t.dashboard.noMissions}</p>
        ) : (
          <ul className="dash-list">
            {sessionsToday.map((s) => (
              <li key={s.skillId} className={s.done ? "done" : undefined}>
                <span className="dash-check" aria-hidden="true">{s.done ? "✓" : ""}</span>
                <span>{names.get(s.skillId)}</span>
                <span className="sr-only">{s.done ? t.dashboard.missionDone : t.dashboard.missionOpen}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DashboardChallenges today={today} ctx={challengeContext} />

      <div className="card dash-card">
        <h2 className="card-label">{t.dashboard.recent}</h2>
        {recent.length === 0 ? (
          <p className="card-note">{t.dashboard.recentEmpty}</p>
        ) : (
          <ul className="dash-list">
            {recent.map((r) => (
              <li key={`${r.kind}|${r.date}|${r.skillId}`}>
                <span>{names.get(r.skillId)}</span>
                <span className="card-aside">{r.kind === "pass" ? t.dashboard.passed : t.dashboard.trained} · {when(r.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggested && target?.kind === "session" && <NextUpCard tree={tree} skill={suggested} done={done} onOpen={onOpenSkill} />}
    </section>
  );
}
