import { useEffect, useRef, useState } from "react";

/** True for `ms` milliseconds after `value` goes up. Stays false on first render and when it goes down. */
export function useIncreased(value: number, ms = 800): boolean {
  const prev = useRef(value);
  const [increased, setIncreased] = useState(false);

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (value <= before) return;
    setIncreased(true);
    const timer = window.setTimeout(() => setIncreased(false), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);

  return increased;
}
