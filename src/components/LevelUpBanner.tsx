import { PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS } from "../lib/streak";

interface Props {
  onYes: () => void;
  onLater: () => void;
}

export function LevelUpBanner({ onYes, onLater }: Props) {
  return (
    <section className="levelup" role="region" aria-label="Level up question">
      <p>
        You've trained at least {PRACTICE_DAYS_PER_WEEK} days a week for {STREAK_WEEKS} weeks in a row.{" "}
        <strong>Do you think you've improved?</strong>
      </p>
      <div className="levelup-actions">
        <button className="btn primary" type="button" onClick={onYes}>
          Yes
        </button>
        <button className="btn" type="button" onClick={onLater}>
          Not yet
        </button>
      </div>
    </section>
  );
}
