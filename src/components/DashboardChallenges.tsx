import { challengeCards, type ChallengeCard } from "../lib/dashboard";
import type { ChallengeContext } from "../lib/challenges";
import { challengeWords, seasonTitle } from "../lib/challengeText";
import { language, t } from "../i18n";

const label = (c: ChallengeCard) => (c.kind === "daily" ? t.dashboard.challengeDaily : c.kind === "weekly" ? t.dashboard.challengeWeekly : t.dashboard.challengeSeason(seasonTitle(c.seasonId!, c.seasonTitle!, language)));

/** Today's and this week's challenge, and the active season's, each with how far the player is. */
export function DashboardChallenges({ today, ctx }: { today: string; ctx: ChallengeContext }) {
  const cards = challengeCards(today, ctx);
  return (
    <div className="card dash-card">
      <h2 className="card-label">{t.dashboard.challenges}</h2>
      <ul className="dash-list challenge-list">
        {cards.map((c) => {
          const words = challengeWords(c.id, c, language);
          return (
            <li key={`${c.kind}|${c.id}`} className={c.done ? "done" : undefined}>
              <div className="challenge-head">
                <span className="challenge-kind">{label(c)}</span>
                <span className="card-aside strong">{c.done ? t.dashboard.challengeDone : t.dashboard.challengeProgress(c.have, c.need)}</span>
              </div>
              <span className="challenge-title">{words.title}</span>
              <span className="card-note">{words.text}</span>
              <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.need} aria-valuenow={c.have} aria-label={words.title}>
                <span style={{ width: `${(c.have / c.need) * 100}%` }} />
              </div>
              <span className="sr-only">{c.done ? t.dashboard.challengeDone : t.dashboard.challengeOpen}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
