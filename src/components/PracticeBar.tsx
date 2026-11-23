import { PRACTICE_DAYS_PER_WEEK } from "../lib/streak";

interface Props {
  daysThisWeek: number;
  streak: number;
  trainedToday: boolean;
  onToggle: () => void;
}

export function PracticeBar({ daysThisWeek, streak, trainedToday, onToggle }: Props) {
  return (
    <section className="practice" aria-label="Training this week">
      <p>
        This week: <strong>{daysThisWeek} of {PRACTICE_DAYS_PER_WEEK}</strong> training days
        <span className="practice-sep" aria-hidden="true"> · </span>
        Streak: <strong>{streak} {streak === 1 ? "week" : "weeks"}</strong>
      </p>
      <button className={`btn${trainedToday ? "" : " primary"}`} type="button" aria-pressed={trainedToday} onClick={onToggle}>
        {trainedToday ? "Trained today ✓ (tap to undo)" : "I trained today"}
      </button>
    </section>
  );
}
