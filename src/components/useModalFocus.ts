import { useEffect, useRef, type RefObject } from "react";

// Everything Tab can land on inside a dialog. Disabled controls are skipped, because focusing
// them does nothing and would stop the loop at that point.
const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/**
 * For dialogs: focuses the first button on open, keeps Tab inside (links and fields included), closes on Escape,
 * and gives focus back to whatever opened the dialog.
 */
export function useModalFocus(dialog: RefObject<HTMLElement | null>, onClose: () => void): void {
  // Callers often pass a new function every render, so read it through a ref.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => opener?.focus();
  }, [dialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!first || !last) return;
      if (!dialog.current.contains(active) || (e.shiftKey && active === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);
}
