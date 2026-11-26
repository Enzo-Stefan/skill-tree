import { ACHIEVEMENTS } from "../data/achievements";
import { t } from "../i18n";

interface Props {
  /** Ids of the achievements earned, from the XP ledger. */
  earned: string[];
}

const names: Record<string, { title: string; text: string }> = t.trophyText;

/**
 * The achievements as trophies on the player card (#123). Earned ones show their name; locked ones are dimmed
 * and show how to earn them. Each one also says Earned or Locked in text, so the state does not rely on colour.
 */
export function PlayerTrophies({ earned }: Props) {
  const won = new Set(earned);
  const count = ACHIEVEMENTS.filter((a) => won.has(a.id)).length;
  return (
    <details className="player-trophies">
      <summary>{t.xp.trophies(count, ACHIEVEMENTS.length)}</summary>
      {count === 0 && <p className="card-note">{t.playerCard.noTrophies}</p>}
      <ul className="player-trophy-list">
        {ACHIEVEMENTS.map((a) => {
          const done = won.has(a.id);
          const text = names[a.id];
          return (
            <li key={a.id} className={done ? "trophy earned" : "trophy locked"}>
              <span className="trophy-name">{text.title}</span>
              <span className="trophy-state">{done ? t.playerCard.earned : t.playerCard.locked}</span>
              {!done && <span className="trophy-hint">{text.text}</span>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
