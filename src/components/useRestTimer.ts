import { useCallback, useEffect, useRef, useState } from "react";

export interface RestTimer {
  /** Whole seconds left, or null when no rest is running. */
  left: number | null;
  /** True for a moment after a rest ends, so the screen can say so. */
  over: boolean;
  start: (seconds: number) => void;
  skip: () => void;
}

/** A countdown for the rest between sets. It counts against the clock, so a hidden tab doesn't make it drift. */
export function useRestTimer(): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const overTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      if (remaining > 0) {
        setLeft(remaining);
        return;
      }
      setEndsAt(null);
      setLeft(null);
      setOver(true);
      window.clearTimeout(overTimer.current);
      overTimer.current = window.setTimeout(() => setOver(false), 4000);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => () => window.clearTimeout(overTimer.current), []);

  const start = useCallback((seconds: number) => {
    setOver(false);
    setEndsAt(Date.now() + seconds * 1000);
  }, []);
  const skip = useCallback(() => {
    setEndsAt(null);
    setLeft(null);
    setOver(false);
  }, []);

  return { left, over, start, skip };
}
