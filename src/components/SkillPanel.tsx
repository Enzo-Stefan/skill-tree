import type { Tree } from "../types";
import { completedDependents, skillState } from "../lib/progress";

interface Props {
  tree: Tree;
  done: Set<string>;
  skillId: string;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  /** When set, the panel shows as a bottom sheet with a Close button (phones). */
  onClose?: () => void;
}

const STATUS_TEXT = { done: "Completed", available: "Ready to train", locked: "Locked" } as const;

export function SkillPanel({ tree, done, skillId, onComplete, onUndo, onClose }: Props) {
  const skill = tree.skills.find((s) => s.id === skillId)!;
  const state = skillState(skill, done);
  const branch = tree.branches.find((b) => b.id === skill.branch);
  const color = branch?.color ?? "#f2c14e";
  const label = branch?.name ?? (skill.requires.length === 0 ? "Start here" : "Final skill");
  const missing = skill.requires
    .filter((r) => !done.has(r))
    .map((r) => tree.skills.find((s) => s.id === r)?.name);
  const dependents = completedDependents(tree, done, skill.id);
  const query = encodeURIComponent(`football ${skill.name} drill tutorial`);

  return (
    <aside className={`panel${onClose ? " sheet" : ""}`} aria-live="polite">
      <div className="panel-top">
        <span className="chip" style={{ color }}>
          {label}
        </span>
        {onClose && (
          <button className="close" type="button" onClick={onClose} aria-label="Close skill details">
            Close
          </button>
        )}
      </div>
      <h2>{skill.name}</h2>
      <span className={`status ${state}`}>{STATUS_TEXT[state]}</span>
      {state === "locked" && <p className="hint">Finish these first: {missing.join(", ")}.</p>}

      <div className="block">
        <h3>The drill</h3>
        <p>{skill.drill}</p>
      </div>
      <div className="block test">
        <h3>Pass the test</h3>
        <p>{skill.test}</p>
      </div>
      <div className="block">
        <h3>Coach's tip</h3>
        <p>{skill.tip}</p>
      </div>
      <a className="yt" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener">
        Watch tutorials on YouTube
      </a>

      <div className="panel-actions">
        {state === "available" && (
          <button className="btn primary" type="button" onClick={() => onComplete(skill.id)}>
            I passed the test
          </button>
        )}
        {state === "done" &&
          (dependents.length ? (
            <p className="hint">To undo this, first undo: {dependents.map((d) => d.name).join(", ")}.</p>
          ) : (
            <button className="btn" type="button" onClick={() => onUndo(skill.id)}>
              Undo
            </button>
          ))}
      </div>
    </aside>
  );
}
