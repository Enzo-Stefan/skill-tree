import { PRACTICE_DAYS_PER_WEEK, type DayKey } from "../lib/streak";
import { t } from "../i18n";
import { WeekDots } from "./WeekDots";

interface Props {
  daysThisWeek: number;
  /** Every day the player trained, for the week's dots. */
  days: DayKey[];
  today: DayKey;
  /** Days still needed this week, when the Friday or Saturday line applies (weekNudge), or null. */
  nudge: number | null;
  streak: number;
  trainedToday: boolean;
  onToggle: () => void;
}

export function PracticeBar({ daysThisWeek, days, today, nudge, streak, trainedToday, onToggle }: Props) {
  return (
    <section className="practice" aria-label={t.practice.label}>
      <div className="practice-main">
        <p>
          {t.practice.thisWeek} <strong>{t.practice.days(daysThisWeek, PRACTICE_DAYS_PER_WEEK)}</strong> {t.practice.trainingDays}
          <span className="practice-sep" aria-hidden="true"> · </span>
          {t.practice.streak} <strong>{t.practice.weeks(streak)}</strong>
        </p>
        <WeekDots days={days} today={today} />
        {nudge !== null && <p className="practice-nudge">{t.practice.nudge(nudge)}</p>}
      </div>
      <button className={`btn${trainedToday ? "" : " primary"}`} type="button" aria-pressed={trainedToday} onClick={onToggle}>
        {trainedToday ? t.practice.trained : t.practice.train}
      </button>
    </section>
  );
}
