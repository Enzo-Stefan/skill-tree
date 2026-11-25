import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Skill, SkillState, Tree } from "../types";
import { skillState } from "../lib/progress";
import { inUnlockOrder } from "./nextUp";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  selectedId: string;
  onSelect: (id: string) => void;
  /** Show one branch only, as a list. Used on phones. */
  branchId?: string | null;
  /** The skill suggested next (nextSkill in lib/progress.ts), marked in the tree. */
  nextId: string | null;
}

/**
 * The skill tree. Wide screens: one column per branch, with the start skill above and the final
 * skill below, so every branch fits on screen. Phones: the chosen branch as a list.
 *
 * Inside a branch, skills are listed in the order they unlock. A branch isn't a straight line
 * (two skills open after the first, and the last needs two), so a locked skill says which skills
 * it is waiting for instead of relying on lines to show it.
 */
export function SkillTree({ tree, done, selectedId, onSelect, branchId = null, nextId }: Props) {
  const effects = useUnlockEffects(tree, done);
  const start = tree.skills.filter((s) => s.branch === null && s.requires.length === 0);
  const finish = tree.skills.filter((s) => s.branch === null && s.requires.length > 0);
  const colorOf = (s: Skill) => tree.branches.find((b) => b.id === s.branch)?.color ?? "var(--fg-2)";
  const nameOf = (id: string) => tree.skills.find((s) => s.id === id)?.name ?? id;

  const item = (s: Skill, layout: "card" | "row") => {
    const state = skillState(s, done);
    const waitingFor = s.requires.filter((id) => !done.has(id)).map(nameOf);
    return (
      <SkillItem
        key={s.id}
        skill={s}
        state={state}
        layout={layout}
        color={colorOf(s)}
        // In the phone list the open skill shows in the sheet instead.
        selected={layout === "card" && s.id === selectedId}
        next={s.id === nextId}
        effect={effects.get(s.id)}
        sub={state === "done" ? t.tree.passed : state === "locked" ? t.tree.after(waitingFor) : t.panel.status.available}
        onSelect={onSelect}
      />
    );
  };

  if (branchId !== null) {
    const branch = tree.branches.find((b) => b.id === branchId);
    const skills = [...start, ...inUnlockOrder(tree.skills.filter((s) => s.branch === branchId)), ...finish];
    return (
      <div className="tree-wrap">
        <ol className="skill-list" aria-label={branch?.name}>
          {skills.map((s) => (
            <li key={s.id} className={`skill-li ${skillState(s, done)}`} style={{ "--c": colorOf(s) } as CSSProperties}>
              {item(s, "row")}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="tree-wrap">
      <div className="tree">
        <div className="tree-end">{start.map((s) => item(s, "card"))}</div>
        <div className="branch-cols">
          {tree.branches.map((b) => {
            const skills = inUnlockOrder(tree.skills.filter((s) => s.branch === b.id));
            const count = skills.filter((s) => done.has(s.id)).length;
            return (
              <section key={b.id} className="branch-col" aria-label={b.name} style={{ "--c": b.color } as CSSProperties}>
                <h3>
                  <span className="branch-dot" aria-hidden="true" />
                  {b.name}
                </h3>
                <p className="branch-count">{t.tree.branchCount(count, skills.length)}</p>
                <ol>
                  {skills.map((s) => (
                    <li key={s.id} className={`skill-li ${skillState(s, done)}`}>
                      {item(s, "card")}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
        <div className="tree-end">{finish.map((s) => item(s, "card"))}</div>
      </div>
    </div>
  );
}

interface ItemProps {
  skill: Skill;
  state: SkillState;
  layout: "card" | "row";
  color: string;
  selected: boolean;
  next: boolean;
  effect?: Effect;
  /** Passed, Ready to train, or what it's waiting for. Shown in the phone list, and read out everywhere. */
  sub: string;
  onSelect: (id: string) => void;
}

function SkillItem({ skill, state, layout, color, selected, next, effect, sub, onSelect }: ItemProps) {
  const classes = ["skill", layout, state, selected && "selected", next && "next", skill.big && "big", effect && `fx-${effect}`];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(" ")}
      style={{ "--c": color } as CSSProperties}
      onClick={() => onSelect(skill.id)}
      data-skill-id={skill.id}
      aria-label={t.tree.nodeLabel(skill.name, sub, next)}
      aria-current={selected ? "true" : undefined}
    >
      <span className="skill-node" aria-hidden="true">
        {state === "done" ? <CheckIcon /> : state === "locked" ? <LockIcon /> : tileLabel(skill)}
      </span>
      <span className="skill-text">
        <span className="skill-name">{skill.name}</span>
        {layout === "row" && <span className="skill-sub">{sub}</span>}
      </span>
      {next && <span className="skill-badge">{t.tree.nextUp}</span>}
    </button>
  );
}

/** Text inside an open skill's circle: GO for the start, 90' for the final, else a dot. */
function tileLabel(s: Skill) {
  if (s.big) return t.tree.finalTile;
  if (s.requires.length === 0) return t.tree.startTile;
  return <span className="skill-dot" />;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

type Effect = "done" | "unlock";

/** Which skills just finished or just unlocked, so their circles can animate for a moment. */
function useUnlockEffects(tree: Tree, done: Set<string>): Map<string, Effect> {
  const previous = useRef<Map<string, SkillState> | null>(null);
  const [effects, setEffects] = useState<Map<string, Effect>>(new Map());

  useEffect(() => {
    const current = new Map(tree.skills.map((s) => [s.id, skillState(s, done)]));
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    const changed = new Map<string, Effect>();
    for (const [id, state] of current) {
      const was = before.get(id);
      if (state === "done" && was !== "done") changed.set(id, "done");
      else if (state === "available" && was === "locked") changed.set(id, "unlock");
    }
    // Always replace the effects, even with an empty map. A quick undo cancels the
    // previous clear-timer, so returning early here would leave old fx classes stuck.
    setEffects(changed);
    if (changed.size === 0) return;
    const timer = window.setTimeout(() => setEffects(new Map()), 900);
    return () => window.clearTimeout(timer);
  }, [tree, done]);

  return effects;
}
