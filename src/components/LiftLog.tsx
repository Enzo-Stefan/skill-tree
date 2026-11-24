import { useId, useState, type FormEvent } from "react";
import { formatKg, liftHistory, MAX_KG, parseKg, personalBest, type LiftEntry } from "../lib/lifts";
import { t } from "../i18n";

/** How many recent entries the panel lists under the best. */
const RECENT = 3;

interface Props {
  skillId: string;
  log: LiftEntry[];
  /**
   * True while the lift isn't passed yet: the button then passes it and logs the weight in one go.
   * Afterwards the same form logs each new session.
   */
  passing: boolean;
  onLog: (skillId: string, kg: number) => void;
  /** The entry logged last in this visit, if it was for this lift, so a typo can be taken back. */
  lastLogged: LiftEntry | null;
  onUndo: (entry: LiftEntry) => void;
}

/** "Weight you used" for lifts (#18): enter the kilos, see your best and your last few sessions. */
export function LiftLog({ skillId, log, passing, onLog, lastLogged, onUndo }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const inputId = useId();
  const best = personalBest(log, skillId);
  const recent = liftHistory(log, skillId).slice(-RECENT).reverse();

  function submit(e: FormEvent) {
    e.preventDefault();
    const kg = parseKg(text);
    if (kg === null) {
      setError(true);
      return;
    }
    setError(false);
    setText("");
    onLog(skillId, kg);
  }

  return (
    <div className="block lift-log">
      <h3>{t.lifts.title}</h3>
      <p className="lift-best">
        {best ? (
          <>
            {t.lifts.best} <strong>{formatKg(best.kg)}</strong> <span className="hint-inline">{formatDay(best.date)}</span>
          </>
        ) : (
          t.lifts.noneYet
        )}
      </p>
      {recent.length > 0 && (
        <ul className="lift-recent" aria-label={t.lifts.recentLabel}>
          {recent.map((e, i) => (
            <li key={`${e.date}-${e.kg}-${i}`}>
              <span>{formatDay(e.date)}</span>
              <span>{formatKg(e.kg)}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="lift-form" onSubmit={submit} noValidate>
        <label htmlFor={inputId}>{t.lifts.weightLabel}</label>
        <div className="lift-row">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          <span className="lift-unit" aria-hidden="true">
            kg
          </span>
          <button className={`btn${passing ? " primary" : ""}`} type="submit">
            {passing ? t.lifts.passWithWeight : t.lifts.log}
          </button>
        </div>
        {error && (
          <p className="hint lift-error" id={`${inputId}-error`} role="alert">
            {t.lifts.invalid(MAX_KG)}
          </p>
        )}
      </form>
      {lastLogged && lastLogged.skillId === skillId && (
        <p className="hint">
          {t.lifts.logged(formatKg(lastLogged.kg))}{" "}
          <button className="link-btn" type="button" onClick={() => onUndo(lastLogged)} aria-label={t.lifts.undoLabel(formatKg(lastLogged.kg))}>
            {t.lifts.undo}
          </button>
        </p>
      )}
    </div>
  );
}

/** "12 Nov" in the player's own language. */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
