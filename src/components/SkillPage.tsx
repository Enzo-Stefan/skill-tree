import type { CSSProperties, ReactNode } from "react";
import type { Skill, Tree } from "../types";
import { skillState } from "../lib/progress";
import { bestResult, resultDirection, resultHistory, type TestResult } from "../lib/results";
import { skillHistory, type SessionEntry } from "../lib/sessions";
import type { MasteryTier, XpEvent } from "../lib/xp";
import { passedOn, prerequisites, skillRewards } from "./skillFacts";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  skill: Skill;
  results: TestResult[];
  sessions: SessionEntry[];
  xpEvents: XpEvent[];
  tier?: MasteryTier;
  /** Goes to another skill's page (a prerequisite or a skill this one opens). */
  onOpen: (skillId: string) => void;
  onBack: () => void;
  /** The skill's actions and details: the drill, the test, the pass button. */
  children: ReactNode;
}

/**
 * One skill on its own page, with its own address (?tree=...&skill=...). It shows what the skill needs,
 * what passing gives, and the player's history with it, above the same panel the tree shows beside or over it.
 */
export function SkillPage({ tree, done, skill, results, sessions, xpEvents, tier, onOpen, onBack, children }: Props) {
  const state = skillState(skill, done);
  const branch = tree.branches.find((b) => b.id === skill.branch);
  const needs = prerequisites(tree, skill);
  const { xp, opens } = skillRewards(tree, skill);
  const passed = passedOn(xpEvents, skill.id);
  const saved = resultHistory(results, skill.id);
  const best = resultDirection(tree, skill) ? bestResult(tree, results, skill.id) : null;
  const trained = skillHistory(sessions, skill.id);

  const links = (skills: Skill[]) => (
    <ul className="skill-links">
      {skills.map((s) => {
        const st = skillState(s, done);
        return (
          <li key={s.id}>
            <button type="button" className={`skill-link ${st}`} onClick={() => onOpen(s.id)}>
              <span>{s.name}</span>
              <span className="skill-link-state">{t.panel.status[st]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="screen skill-page" aria-labelledby="skill-page-title" style={{ "--c": branch?.color ?? "var(--fg-2)" } as CSSProperties}>
      <button type="button" className="btn skill-back" onClick={onBack}>
        {t.skillPage.back}
      </button>
      <header className="skill-page-head">
        <span className="chip">{branch?.name ?? (skill.requires.length === 0 ? t.panel.startHere : t.panel.finalSkill)}</span>
        <h1 className="screen-title" id="skill-page-title" tabIndex={-1}>
          {skill.name}
        </h1>
        <p className={`status ${state}`}>
          {t.panel.status[state]}
          {tier ? `, ${t.tree.mastery[tier]} ${t.skillPage.masteryWord}` : ""}
        </p>
      </header>

      <div className="card skill-block">
        <h2>{t.skillPage.needs}</h2>
        {needs.length ? links(needs) : <p className="hint">{t.skillPage.needsNone}</p>}
      </div>

      <div className="card skill-block">
        <h2>{t.skillPage.rewards}</h2>
        <p className="reward-xp">{done.has(skill.id) ? t.skillPage.xpEarned(xp) : t.skillPage.xpFor(xp)}</p>
        <h3>{t.skillPage.opens}</h3>
        {opens.length ? links(opens) : <p className="hint">{t.skillPage.opensNone}</p>}
      </div>

      <div className="card skill-block">
        <h2>{t.skillPage.history}</h2>
        <ul className="history-list">
          <li>{done.has(skill.id) ? (passed ? t.skillPage.passedOn(t.lifts.on(passed)) : t.panel.status.done) : t.skillPage.notPassed}</li>
          {trained.days > 0 && trained.last && <li>{t.skillPage.trained(trained.days, t.lifts.on(trained.last))}</li>}
          {best && (
            <li>
              {t.testMode.bestTime} <strong>{t.testMode.seconds(best.value)}</strong> <span className="lift-date">{t.lifts.on(best.date)}</span>
            </li>
          )}
          {saved.length > 0 && <li>{t.skillPage.savedResults(saved.length)}</li>}
        </ul>
        {!done.has(skill.id) && trained.days === 0 && saved.length === 0 && <p className="hint">{t.skillPage.historyEmpty}</p>}
      </div>

      {children}
    </section>
  );
}
