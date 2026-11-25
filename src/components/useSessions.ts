import { useEffect, useState } from "react";
import type { Tree } from "../types";
import { loadSessions, saveSessions, setSkillsOn, skillsOn, type SessionEntry } from "../lib/sessions";
import { storageWorks } from "./useLiftLog";

export interface Sessions {
  sessions: SessionEntry[];
  /** The skills trained on a day. */
  on: (date: string) => string[];
  /** Sets a day's skills to exactly these (an empty list clears the day). */
  set: (date: string, skillIds: string[]) => void;
  /** Empties the list (Reset). */
  clear: () => void;
  /** Shows the sessions loaded from the account, and keeps them in the browser too. */
  replace: (sessions: SessionEntry[]) => void;
}

/**
 * The open tree's training sessions (src/lib/sessions.ts), like the lift log: kept in React state,
 * saved to the browser on every change, and every change starts from what is saved so two open tabs
 * can't erase each other's. Signed-in players' sessions are also saved in the account.
 */
export function useSessions(tree: Tree): Sessions {
  const [sessions, setSessions] = useState(() => loadSessions(tree));
  // When the browser blocks saving, the saved list always reads as empty, so changes start from this visit's copy.
  const [canSave] = useState(storageWorks);
  const current = () => (canSave ? loadSessions(tree) : sessions);

  useEffect(() => {
    const reload = () => setSessions(loadSessions(tree));
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [tree]);

  function update(next: SessionEntry[]) {
    setSessions(next);
    saveSessions(tree.id, next);
  }

  return {
    sessions,
    on: (date) => skillsOn(sessions, date),
    set(date, skillIds) {
      update(setSkillsOn(tree, current(), date, skillIds));
    },
    clear() {
      update([]);
    },
    replace(next) {
      update(next);
    },
  };
}
