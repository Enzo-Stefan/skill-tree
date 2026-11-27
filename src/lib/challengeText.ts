import { challengesEs, seasonTitlesEs } from "../data/es/challenges";

// Challenge and season words in the player's language (#122). English lives in src/data/challenges.ts and
// src/data/seasons.ts; other languages add the words by id, and anything missing shows in English.

type Words = { title: string; text: string };

const WORDS: Record<string, Record<string, Words> | undefined> = { es: challengesEs };
const SEASON_TITLES: Record<string, Record<string, string> | undefined> = { es: seasonTitlesEs };

/** A challenge's title and text in a language, falling back to the English given. */
export function challengeWords(id: string, english: Words, language: string): Words {
  const tr = WORDS[language]?.[id];
  return { title: tr?.title || english.title, text: tr?.text || english.text };
}

/** A season's title in a language, falling back to the English given. */
export function seasonTitle(id: string, english: string, language: string): string {
  return SEASON_TITLES[language]?.[id] || english;
}
