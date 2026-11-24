import type { Tree } from "../types";
import { completedDependents, skillState } from "../lib/progress";
import { SkillVideo } from "./SkillVideo";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  skillId: string;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  /** The player's level and step, e.g. "Beginner 2", or null if not picked yet. */
  playerLevelName: string | null;
  /** The chosen level's target for this skill, or null. */
  target: string | null;
  onChangeLevel: () => void;
  /** When set, the panel shows as a bottom sheet with a Close button (phones). */
  onClose?: () => void;
}

export function SkillPanel({
  tree,
  done,
  skillId,
  onComplete,
  onUndo,
  onClose,
  playerLevelName,
  target,
  onChangeLevel,
}: Props) {
  const skill = tree.skills.find((s) => s.id === skillId)!;
  const state = skillState(skill, done);
  const branch = tree.branches.find((b) => b.id === skill.branch);
  const color = branch?.color ?? "#f2c14e";
  const label = branch?.name ?? (skill.requires.length === 0 ? t.panel.startHere : t.panel.finalSkill);
  const missing = skill.requires
    .filter((r) => !done.has(r))
    .map((r) => tree.skills.find((s) => s.id === r)?.name);
  const dependents = completedDependents(tree, done, skill.id);
  const query = encodeURIComponent(t.panel.youtubeSearch(skill.name));

  return (
    <aside className={`panel${onClose ? " sheet" : ""}`} aria-live="polite">
      <div className="panel-top">
        <span className="chip" style={{ color }}>
          {label}
        </span>
        {onClose && (
          <button className="close" type="button" onClick={onClose} aria-label={t.panel.closeLabel}>
            {t.panel.close}
          </button>
        )}
      </div>
      <h2>{skill.name}</h2>
      <span className={`status ${state}`}>{t.panel.status[state]}</span>
      {state === "locked" && <p className="hint">{t.panel.finishFirst(missing.filter((n) => n !== undefined))}</p>}

      <div className="block">
        <h3>{t.panel.drill}</h3>
        <p>{skill.drill}</p>
        {skill.video && <SkillVideo key={skill.id} link={skill.video} title={skill.name} />}
      </div>
      <div className="block test">
        <h3>{t.panel.test}</h3>
        <p>{skill.test}</p>
        {skill.targets &&
          (target && playerLevelName ? (
            <p className="target">
              <span className="target-label">{t.panel.target(playerLevelName)}</span>
              <strong>{target}</strong>
              <button className="link-btn" type="button" onClick={onChangeLevel}>
                {t.panel.changeLevel}
              </button>
            </p>
          ) : (
            <button className="link-btn" type="button" onClick={onChangeLevel}>
              {t.panel.pickLevelForTarget}
            </button>
          ))}
      </div>
      <div className="block">
        <h3>{t.panel.tip}</h3>
        <p>{skill.tip}</p>
      </div>
      {!skill.video && (
        <a className="yt" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener">
          {t.panel.watchYoutube}
        </a>
      )}

      <div className="panel-actions">
        {state === "available" && (
          <button className="btn primary" type="button" onClick={() => onComplete(skill.id)}>
            {t.panel.passed}
          </button>
        )}
        {state === "done" &&
          (dependents.length ? (
            <p className="hint">{t.panel.undoFirst(dependents.map((d) => d.name))}</p>
          ) : (
            <button className="btn" type="button" onClick={() => onUndo(skill.id)}>
              {t.panel.undo}
            </button>
          ))}
      </div>
    </aside>
  );
}
