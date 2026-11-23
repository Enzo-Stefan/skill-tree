import { useEffect, useState } from "react";
import { dayKey, type DayKey } from "../lib/streak";

function msUntilMidnight(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** Today's date, kept fresh when the tab is left open overnight, brought back to, or focused again. */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKey(new Date()));

  useEffect(() => {
    const refresh = () => setToday(dayKey(new Date()));
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, msUntilMidnight() + 1000);
    };
    schedule();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return today;
}
