import type { Routine } from "../types";
import { forLevel } from "../lib/progress";
import { t } from "../i18n";
import { exerciseLine } from "./exerciseAmount";

interface Props {
  routine: Routine;
  levelId: string | null;
  /** The skill is unlocked and not passed, so the plan already includes it. */
  inPlanAlready: boolean;
  /** Passed skills can't be planned. */
  canPlan: boolean;
  added: boolean;
  onToggleAdd: () => void;
}

/** A skill's full training routine on its sheet, with "Add to my plan". */
export function RoutineBlock({ routine, levelId, inPlanAlready, canPlan, added, onToggleAdd }: Props) {
  const minutes = forLevel(routine.minutes, levelId) ?? 0;
  return (
    <div className="block routine">
      <h3>{t.training.routine}</h3>
      <p className="routine-facts">{t.training.routineFacts(routine.sessionsPerWeek, minutes)}</p>
      <p>
        <strong>{t.training.warmUp}.</strong> {routine.warmUp}
      </p>
      <ol className="routine-list">
        {routine.exercises.map((ex) => (
          <li key={ex.name}>
            <span className="routine-name">{ex.name}</span>
            <span className="routine-amount">
              {exerciseLine(ex, levelId)}
            </span>
            <span className="routine-how">{ex.howTo}</span>
          </li>
        ))}
      </ol>
      <p>
        <strong>{t.training.coolDown}.</strong> {routine.coolDown}
      </p>
      {canPlan &&
        (inPlanAlready ? (
          <p className="hint">{t.training.inPlan}</p>
        ) : (
          <button className="btn" type="button" aria-pressed={added} onClick={onToggleAdd}>
            {added ? t.training.removeFromPlan : t.training.addToPlan}
          </button>
        ))}
    </div>
  );
}
