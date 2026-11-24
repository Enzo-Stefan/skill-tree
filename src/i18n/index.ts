import { en, type Strings } from "./en";
import { es } from "./es";

export type Language = "en" | "es";

/** Each language in its own words, so a player can find theirs whatever the app is showing. */
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
];

const STRINGS: Record<Language, Strings> = { en, es };
const LANGUAGE_KEY = "skill-tree:language";

function isLanguage(code: string): code is Language {
  return code in STRINGS;
}

/** The first of the phone's languages the app has, e.g. "es-MX" gives "es". English if none. */
export function phoneLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const code = tag.toLowerCase().split("-")[0];
    if (isLanguage(code)) return code;
  }
  return "en";
}

/** The language the player chose in Settings, or null to follow the phone. */
export function savedLanguage(): Language | null {
  try {
    const code = localStorage.getItem(LANGUAGE_KEY);
    return code && isLanguage(code) ? code : null;
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language ?? ""];
}

/** The language the app shows: the player's choice, else the phone's. Fixed until the page reloads. */
export const language: Language = savedLanguage() ?? phoneLanguage(browserLanguages());

/** The language the phone asks for, shown next to "Same as your phone". */
export const deviceLanguage: Language = phoneLanguage(browserLanguages());

/** The app's text in the current language. */
export const t: Strings = STRINGS[language];

if (typeof document !== "undefined") document.documentElement.lang = language;

/**
 * Save the choice (null follows the phone) and reload, because text is read once when the app starts.
 * Returns false if nothing changed.
 */
export function chooseLanguage(code: Language | null, reload: () => void = () => window.location.reload()): boolean {
  if (code === savedLanguage()) return false;
  try {
    if (code) localStorage.setItem(LANGUAGE_KEY, code);
    else localStorage.removeItem(LANGUAGE_KEY);
  } catch {
    // Private windows can block saving; the choice then lasts until the page reloads, which is now.
    return false;
  }
  reload();
  return true;
}

export type { Strings };
