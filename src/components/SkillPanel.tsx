import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Tree } from "../types";
import { completedDependents, skillState } from "../lib/progress";
import { SkillVideo } from "./SkillVideo";
import { LiftLogBlock } from "./LiftLogBlock";
import { TestMode } from "./TestMode";
import { RoutineBlock } from "./RoutineBlock";
import { isRunnable } from "./testRun";
import type { LiftLog } from "./useLiftLog";
import type { Results } from "./useResults";
import { bestResult, resultDirection } from "../lib/results";
import { t } from "../i18n";
import { useSheet } from "./useSheet";

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
  /** When set, the panel shows as a bottom sheet with a grabber, two heights and a Close button (phones). */
  onClose?: () => void;
  /** The tree's lift log, for skills with logWeight. */
  lifts?: LiftLog;
  /** The stopwatch limit in seconds for this skill's test at the player's level, or null. */
  timeLimit?: number | null;
  /** The tree's saved test results, for "Your best time" and saving a time in test mode. */
  results?: Results;
  /** The player's level id, for the routine's sets, reps and minutes. */
  levelId?: string | null;
  /** The skill was added to the weekly plan by hand ("Add to my plan"). */
  planAdded?: boolean;
  onTogglePlan?: () => void;
  /** Copies a link that opens this skill. When missing, the button is not shown. */
  onCopyLink?: (id: string) => void;
  /** Hides the sheet while a dialog is open over it, so only one shows at a time (phones). */
  hidden?: boolean;
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
  lifts,
  timeLimit = null,
  results,
  levelId = null,
  planAdded = false,
  onTogglePlan,
  onCopyLink,
  hidden = false,
}: Props) {
  const skill = tree.skills.find((s) => s.id === skillId)!;
  const heading = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const headingId = `skill-${skill.id}-title`;
  const isSheet = Boolean(onClose);
  // Which skill's test is open, so switching skills closes it.
  const [testFor, setTestFor] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const sheet = useSheet(isSheet, skill.id, sheetRef, mainRef, () => onCloseRef.current?.());

  // As a sheet (phones), move focus to the skill's name so a screen reader reads it, instead of the
  // whole sheet. App gives focus back to the skill in the tree when the sheet closes.
  useEffect(() => {
    if (isSheet) heading.current?.focus({ preventScroll: true });
  }, [isSheet, skillId]);

  // Escape closes the sheet, unless a dialog is open over it: that dialog handles its own Escape.
  useEffect(() => {
    if (!isSheet || hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".overlay")) onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSheet, hidden]);

  const state = skillState(skill, done);
  const branch = tree.branches.find((b) => b.id === skill.branch);
  const color = branch?.color ?? "var(--fg-2)";
  const label = branch?.name ?? (skill.requires.length === 0 ? t.panel.startHere : t.panel.finalSkill);
  const missing = skill.requires
    .filter((r) => !done.has(r))
    .map((r) => tree.skills.find((s) => s.id === r)?.name);
  const dependents = completedDependents(tree, done, skill.id);
  // Only stopwatch tests save a time from test mode for now; their targets say whether lower is better.
  const keepsTimes = results && skill.check?.kind === "time" && resultDirection(tree, skill) !== null ? results : undefined;
  const best = keepsTimes ? bestResult(tree, keepsTimes.results, skill.id) : null;
  const query = encodeURIComponent(t.panel.youtubeSearch(tree.id, skill.name));
  const runnable = isRunnable(skill.check) && state !== "locked";
  // Phones say "Swipe up…"; a narrow window with a mouse says "Show…". The button works by tap or click either way.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  const headline = (
    <>
      <h2 id={headingId} ref={heading} tabIndex={-1}>
        {skill.name}
      </h2>
      <span className={`status ${state}`}>{t.panel.status[state]}</span>
      {state === "locked" && <p className="hint">{t.panel.finishFirst(missing.filter((n) => n !== undefined))}</p>}
    </>
  );
  const drill = (
    <div className="block">
      <h3>{t.panel.drill}</h3>
      <p>{skill.drill}</p>
      {skill.video && <SkillVideo key={skill.id} link={skill.video} title={skill.name} />}
    </div>
  );
  const startTest = runnable && (
    <button className="btn" type="button" onClick={() => setTestFor(skill.id)}>
      {t.testMode.open}
    </button>
  );
  const testBlock = (
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
      {best && (
        <p className="lift-best">
          {t.testMode.bestTime} <strong>{t.testMode.seconds(best.value)}</strong>{" "}
          <span className="lift-date">{t.lifts.on(best.date)}</span>
        </p>
      )}
      {/* On laptops Start test stays inside the test; on phones it sits next to "I passed the test". */}
      {!isSheet && runnable && (
        <div className="test-open">
          {startTest}
          <span className="hint">{t.testMode.openHint}</span>
        </div>
      )}
    </div>
  );
  const passOrUndo = (
    <>
      {state === "available" && (
        <button className="btn primary" type="button" onClick={() => onComplete(skill.id)}>
          {t.panel.passed}
        </button>
      )}
      {isSheet && startTest}
      {state === "done" &&
        (dependents.length ? (
          <p className="hint">{t.panel.undoFirst(dependents.map((d) => d.name))}</p>
        ) : (
          <button className="btn" type="button" onClick={() => onUndo(skill.id)}>
            {t.panel.undo}
          </button>
        ))}
      {isSheet && runnable && <p className="hint panel-actions-hint">{t.testMode.openHint}</p>}
    </>
  );
  const rest = (
    <>
      {skill.logWeight && lifts && state !== "locked" && <LiftLogBlock key={skill.id} skillId={skill.id} lifts={lifts} />}
      {skill.routine && onTogglePlan && (
        <RoutineBlock
          routine={skill.routine}
          levelId={levelId}
          inPlanAlready={state === "available"}
          canPlan={state !== "done"}
          added={planAdded}
          onToggleAdd={onTogglePlan}
        />
      )}
      <div className="block">
        <h3>{t.panel.tip}</h3>
        <p>{skill.tip}</p>
      </div>
      {!skill.video && (
        <a className="yt" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener">
          {t.panel.watchYoutube}
        </a>
      )}
      {onCopyLink && (
        <button className="btn" type="button" onClick={() => onCopyLink(skill.id)}>
          {t.panel.copyLink}
        </button>
      )}
    </>
  );

  return (
    <aside
      ref={sheetRef}
      className={`panel${isSheet ? " sheet" : ""}${sheet.expanded ? " full" : ""}`}
      aria-labelledby={headingId}
      hidden={hidden}
      style={sheet.style}
      onScroll={sheet.onScroll}
    >
      {isSheet ? (
        <>
          {/* Half height ends below this part: the name, the test and its buttons. */}
          <div className="panel-main" ref={mainRef}>
            <div className="sheet-handle" {...sheet.handleProps}>
              <button
                className="sheet-grabber"
                type="button"
                aria-expanded={sheet.expanded}
                aria-label={sheet.expanded ? t.panel.showLess : t.panel.showAll}
                onClick={() => sheet.setExpanded(!sheet.expanded)}
              />
              <div className="panel-top">
                <span className="chip" style={{ "--c": color } as CSSProperties}>
                  {label}
                </span>
                <button className="close" type="button" onClick={onClose} aria-label={t.panel.closeLabel}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>
            {headline}
            {testBlock}
            {state !== "locked" && <div className="panel-actions">{passOrUndo}</div>}
            {!sheet.expanded && (
              <button className="sheet-more" type="button" aria-expanded={false} onClick={() => sheet.setExpanded(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m18 15-6-6-6 6" />
                </svg>
                {t.panel.showMore(Boolean(skill.video), touch)}
              </button>
            )}
          </div>
          {/* Below the half height. Tabbing or a screen reader landing here opens the sheet to full height. */}
          <div className="panel-rest" onFocus={() => !sheet.expanded && sheet.setExpanded(true)}>
            {drill}
            {rest}
          </div>
        </>
      ) : (
        <div className="panel-main">
          <div className="panel-top">
            <span className="chip" style={{ "--c": color } as CSSProperties}>
              {label}
            </span>
          </div>
          {headline}
          {drill}
          {testBlock}
          {rest}
          {state !== "locked" && <div className="panel-actions">{passOrUndo}</div>}
        </div>
      )}

      {testFor === skill.id && isRunnable(skill.check) && (
        <TestMode
          key={skill.id}
          skill={skill}
          check={skill.check}
          limit={timeLimit}
          canPass={state === "available"}
          onPassed={() => {
            // Close first: passing closes the sheet on phones and moves focus to the skill in the tree.
            setTestFor(null);
            onComplete(skill.id);
          }}
          onClose={() => setTestFor(null)}
          results={keepsTimes}
        />
      )}
    </aside>
  );
}
