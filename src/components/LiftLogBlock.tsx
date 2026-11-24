import { useId, useState, type FormEvent } from "react";
import { formatKg, liftHistory, parseKg, personalBest, type LiftEntry } from "../lib/lifts";
import type { LiftLog, LoggedLift } from "./useLiftLog";
import { language, t } from "../i18n";

/** How many of the latest entries the sheet lists under the input. */
const RECENT = 5;

interface Props {
  skillId: string;
  lifts: LiftLog;
}

/**
 * "Your weights" in the skill sheet for a lift: log today's weight, see the personal best and the
 * latest entries. Render it with key={skillId} so the input and the Undo reset when the skill changes.
 */
export function LiftLogBlock({ skillId, lifts }: Props) {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [last, setLast] = useState<LoggedLift | null>(null);
  const best = personalBest(lifts.log, skillId);
  const recent = liftHistory(lifts.log, skillId).slice(-RECENT).reverse();

  function submit(e: FormEvent) {
    e.preventDefault();
    const kg = parseKg(text);
    const saved = kg === null ? null : lifts.add(skillId, kg);
    setError(saved === null);
    if (!saved) return;
    setLast(saved);
    setText("");
  }

  function undo(entry: LiftEntry) {
    lifts.remove(entry);
    setLast(null);
  }

  return (
    <div className="block lift-log">
      <h3>{t.lifts.title}</h3>
      {best ? (
        <p className="lift-best">
          {t.lifts.best} <strong>{formatKg(best.kg, language)}</strong> <span className="lift-date">{t.lifts.on(best.date)}</span>
        </p>
      ) : (
        <p className="hint">{t.lifts.empty}</p>
      )}

      <form className="lift-form" onSubmit={submit} noValidate>
        <label htmlFor={inputId}>{t.lifts.inputLabel}</label>
        <div className="lift-input-row">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(false);
            }}
            aria-invalid={error}
            aria-describedby={error ? errorId : undefined}
          />
          <span className="lift-unit" aria-hidden="true">
            kg
          </span>
          <button className="btn primary" type="submit">
            {t.lifts.log}
          </button>
        </div>
        {error && (
          <p id={errorId} className="lift-error" role="alert">
            {t.lifts.invalid}
          </p>
        )}
      </form>

      {last && (
        <p className="lift-saved" role="status">
          {last.best ? t.lifts.newBest(formatKg(last.entry.kg, language)) : t.lifts.logged(formatKg(last.entry.kg, language))}{" "}
          <button className="link-btn" type="button" onClick={() => undo(last.entry)}>
            {t.lifts.undo}
          </button>
        </p>
      )}

      {recent.length > 0 && (
        <ol className="lift-history" aria-label={t.lifts.recent}>
          {recent.map((e, i) => (
            <li key={`${e.date}-${e.kg}-${i}`}>
              <span>{t.lifts.on(e.date)}</span>
              <span className="lift-kg">{formatKg(e.kg, language)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
