import { useEffect, useRef } from "react";

/**
 * The phone's back gesture (Android) closes the sheet instead of leaving the app: an open sheet
 * adds a history entry, and every other way of closing it takes that entry off again.
 * Forward onto the sheet's entry (after Back closed it) opens the sheet again, so history and sheet agree.
 */
export function useSheetHistory(isPhone: boolean, sheetOpen: boolean, close: () => void, reopen: () => void) {
  const inHistory = useRef(false);
  const closeRef = useRef(close);
  const reopenRef = useRef(reopen);
  useEffect(() => {
    closeRef.current = close;
    reopenRef.current = reopen;
  });
  const shown = isPhone && sheetOpen;
  useEffect(() => {
    if (!shown) {
      if (inHistory.current) {
        inHistory.current = false;
        window.history.back();
      }
      return;
    }
    if (!inHistory.current) {
      window.history.pushState({ ...window.history.state, skillSheet: true }, "");
      inHistory.current = true;
    }
    const onPop = () => {
      inHistory.current = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [shown]);

  useEffect(() => {
    if (!isPhone) return;
    const onPop = (e: PopStateEvent) => {
      if (!e.state?.skillSheet || inHistory.current) return;
      inHistory.current = true;
      reopenRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isPhone]);
}
