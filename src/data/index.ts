import { football } from "./football";
import { weights } from "./weights";
import { footballEs } from "./es/football";
import { weightsEs } from "./es/weights";
import { translateTree, type TreeTranslation } from "../lib/translate";
import type { Tree } from "../types";

// Add new trees here (guitar, chess, Albanian...).
// The app shows the first one. The weight training tree opens from a side panel once Enzo adds it (#18).
export const trees: Tree[] = [football, weights];

/**
 * Skill content in other languages, by language code and tree id (#19, step 7). English is the
 * trees themselves. Add a language here once its translation files pass the tests.
 */
export const translations: Record<string, Record<string, TreeTranslation>> = {
  es: { football: footballEs, weights: weightsEs },
};

/**
 * The trees in a language, e.g. "es" or "es-MX". Anything without a translation, including a
 * language we don't have yet, shows in English.
 */
export function treesIn(language: string): Tree[] {
  const forLanguage = translations[language.toLowerCase().split("-")[0]];
  return trees.map((tree) => translateTree(tree, forLanguage?.[tree.id]));
}
