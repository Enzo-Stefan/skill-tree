import { PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS } from "../lib/streak";
import { t } from "../i18n";

interface Props {
  onYes: () => void;
  onLater: () => void;
}

export function LevelUpBanner({ onYes, onLater }: Props) {
  return (
    <section className="levelup" role="region" aria-label={t.levelUp.label}>
      <p>
        {t.levelUp.trainedFor(PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS)} <strong>{t.levelUp.improved}</strong>
      </p>
      <div className="levelup-actions">
        <button className="btn primary" type="button" onClick={onYes}>
          {t.levelUp.yes}
        </button>
        <button className="btn" type="button" onClick={onLater}>
          {t.levelUp.notYet}
        </button>
      </div>
    </section>
  );
}
