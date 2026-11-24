import type { CSSProperties } from "react";
import type { Skill, Tree } from "../types";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  skill: Skill;
  done: Set<string>;
  onOpen: (skill: Skill) => void;
}

/** The suggested next skill, with why it was picked. Tapping it opens the skill. */
export function NextUpCard({ tree, skill, done, onOpen }: Props) {
  const branch = tree.branches.find((b) => b.id === skill.branch);
  const doneIn = (id: string) => tree.skills.filter((s) => s.branch === id && done.has(s.id)).length;
  const allTied = new Set(tree.branches.map((b) => doneIn(b.id))).size === 1;
  const reason =
    skill.requires.length === 0
      ? t.nextUp.start
      : !branch
        ? t.nextUp.final
        : allTied
          ? t.nextUp.goodNextStep(branch.name)
          : t.nextUp.leastDone(branch.name);
  return (
    <button
      type="button"
      className="next-up"
      style={{ "--c": branch?.color ?? "#f2c14e" } as CSSProperties}
      onClick={() => onOpen(skill)}
    >
      <span className="branch-dot" aria-hidden="true" />
      <span className="next-up-text">
        <span className="next-up-label">{t.tree.nextUp}</span>
        <span className="next-up-name">{skill.name}</span>
        <span className="next-up-reason">{reason}</span>
      </span>
      <svg className="settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
