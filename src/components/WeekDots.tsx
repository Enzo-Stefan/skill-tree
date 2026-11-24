import { dayKey, weekOf, type DayKey } from "../lib/streak";
import { language, t } from "../i18n";

interface Props {
  /** Every day the player trained, as day keys. */
  days: DayKey[];
  today: DayKey;
}

function parse(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** This week, Monday to Sunday, with a filled dot on each day the player trained. */
export function WeekDots({ days, today }: Props) {
  const monday = parse(weekOf(today));
  const trained = new Set(days);
  const short = new Intl.DateTimeFormat(language, { weekday: "narrow" });
  const long = new Intl.DateTimeFormat(language, { weekday: "long" });
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = dayKey(date);
    return { key, date, trained: trained.has(key), isToday: key === today };
  });

  return (
    <ol className="week-dots">
      {week.map((d) => (
        <li key={d.key} className={`${d.trained ? "trained" : ""}${d.isToday ? " today" : ""}`}>
          <span className="week-dot" aria-hidden="true">
            {d.trained && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
          <span className="week-day" aria-hidden="true">
            {short.format(d.date)}
          </span>
          <span className="sr-only">{t.progressScreen.dayLabel(long.format(d.date), d.trained, d.isToday)}</span>
        </li>
      ))}
    </ol>
  );
}
