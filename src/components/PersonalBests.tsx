import { useId } from "react";
import type { Tree } from "../types";
import { bestProgression, formatKg, liftHistory, personalBest, type LiftEntry } from "../lib/lifts";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  log: LiftEntry[];
}

/** The Progress tab's personal bests: each lift's heaviest weight and how far it has gone up. Nothing for trees without lifts. */
export function PersonalBests({ tree, log }: Props) {
  const titleId = useId();
  const lifts = tree.skills.filter((s) => s.logWeight);
  if (lifts.length === 0) return null;
  const logged = lifts.flatMap((s) => {
    const best = personalBest(log, s.id);
    if (!best) return [];
    const first = bestProgression(log, s.id)[0];
    return [{ skill: s, best, first, times: liftHistory(log, s.id).length }];
  });

  return (
    <section className="card bests" aria-labelledby={titleId}>
      <h2 id={titleId} className="card-title">
        {t.lifts.bestsTitle}
      </h2>
      {logged.length === 0 ? (
        <p className="hint">{t.lifts.bestsEmpty}</p>
      ) : (
        <ul className="best-list">
          {logged.map(({ skill, best, first, times }) => (
            <li key={skill.id}>
              <span className="best-text">
                <span className="best-name">{skill.name}</span>
                <span className="best-sub">
                  {first.kg < best.kg ? t.lifts.upFrom(formatKg(first.kg), times) : t.lifts.timesLogged(times)}
                </span>
              </span>
              <span className="best-kg">{formatKg(best.kg)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
