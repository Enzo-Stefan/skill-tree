import { PRACTICE_DAYS_PER_WEEK } from "../lib/streak";
import { t } from "../i18n";

interface Props {
  daysThisWeek: number;
  streak: number;
  trainedToday: boolean;
  onToggle: () => void;
}

export function PracticeBar({ daysThisWeek, streak, trainedToday, onToggle }: Props) {
  return (
    <section className="practice" aria-label={t.practice.label}>
      <p>
        {t.practice.thisWeek} <strong>{t.practice.days(daysThisWeek, PRACTICE_DAYS_PER_WEEK)}</strong> {t.practice.trainingDays}
        <span className="practice-sep" aria-hidden="true"> · </span>
        {t.practice.streak} <strong>{t.practice.weeks(streak)}</strong>
      </p>
      <button className={`btn${trainedToday ? "" : " primary"}`} type="button" aria-pressed={trainedToday} onClick={onToggle}>
        {trainedToday ? t.practice.trained : t.practice.train}
      </button>
    </section>
  );
}
