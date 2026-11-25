import { useMemo, useRef, useState } from "react";
import type { Hemisphere, LeaderboardProfile } from "../types";
import { countries as COUNTRIES } from "../data/countries";
import { NAME_MAX } from "../lib/leaderboard";
import { countryName, flagEmoji, nameProblem, needsHemispherePick, type NameProblem } from "../lib/leaderboardApi";
import { useModalFocus } from "./useModalFocus";
import { language, t } from "../i18n";

interface Props {
  /** The saved profile, or null for a player joining for the first time. */
  initial: LeaderboardProfile | null;
  /** Resolves to a problem code, or null once it is saved. */
  onSave: (profile: LeaderboardProfile) => Promise<NameProblem | "taken" | "failed" | null>;
  onClose: () => void;
}

/** Display name, country and the on/off choice: the whole leaderboard profile in one dialog. */
export function LeaderboardProfileDialog({ initial, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initial?.displayName ?? "");
  const [country, setCountry] = useState(initial?.countryCode ?? "");
  const [hemisphere, setHemisphere] = useState<Hemisphere | null>(initial?.hemisphere ?? null);
  // Someone who opened this to join starts switched on; someone editing keeps their choice.
  const [optIn, setOptIn] = useState(initial ? initial.leaderboardOptIn : true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<NameProblem | "taken" | "failed" | null>(null);
  useModalFocus(dialog, busy ? () => {} : onClose);

  const countries = useMemo(
    () =>
      COUNTRIES.map((c) => ({ code: c.code, label: `${flagEmoji(c.code)} ${countryName(c.code, language)}`, name: countryName(c.code, language) }))
        .sort((a, b) => a.name.localeCompare(b.name, language)),
    [],
  );
  const askHemisphere = needsHemispherePick(country || null);
  const missingHemisphere = askHemisphere && hemisphere === null;

  async function handleSave() {
    const found = nameProblem(name);
    if (found) return setProblem(found);
    if (missingHemisphere) return;
    setBusy(true);
    setProblem(null);
    const result = await onSave({
      displayName: name.trim(),
      countryCode: country || null,
      hemisphere: askHemisphere ? hemisphere : null,
      leaderboardOptIn: optIn,
    });
    setBusy(false);
    if (result) setProblem(result);
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div ref={dialog} className="dialog profile-dialog" role="dialog" aria-modal="true" aria-labelledby="lb-profile-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="lb-profile-title">{t.leaderboardProfile.title}</h2>
        <p>{t.leaderboardProfile.intro}</p>

        <label className="field">
          <span>{t.leaderboardProfile.name}</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            aria-describedby="lb-name-help"
            aria-invalid={problem !== null && problem !== "failed"}
            onChange={(e) => setName(e.target.value)}
          />
          <small id="lb-name-help">{t.leaderboardProfile.nameHelp}</small>
        </label>

        <label className="field">
          <span>{t.leaderboardProfile.country}</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t.leaderboardProfile.noCountry}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {askHemisphere && (
          <fieldset className="field">
            <legend>{t.leaderboardProfile.hemisphere}</legend>
            {(["N", "S"] as const).map((h) => (
              <label key={h} className="radio">
                <input type="radio" name="lb-hemisphere" checked={hemisphere === h} onChange={() => setHemisphere(h)} />
                {h === "N" ? t.leaderboard.hemisphereN : t.leaderboard.hemisphereS}
              </label>
            ))}
          </fieldset>
        )}

        <label className="radio">
          <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          {t.leaderboardProfile.optIn}
        </label>

        {problem && (
          <p className="dialog-error" role="alert">
            {t.leaderboardProfile.problems[problem]}
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn primary" type="button" onClick={handleSave} disabled={busy || missingHemisphere}>
            {busy ? t.leaderboardProfile.saving : t.leaderboardProfile.save}
          </button>
          <button className="btn" type="button" onClick={onClose} disabled={busy}>
            {t.leaderboardProfile.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
