import { useEffect, useRef } from "react";

/**
 * Focus for the skill page: its title gets focus when it opens (a screen reader starts at the skill's name),
 * and closing it returns focus to the tree button of the skill that opened it, even after following
 * prerequisites to other pages.
 */
export function usePageFocus(pageId: string | null, focusSkill: (id: string) => void) {
  const opener = useRef<string | null>(null);
  const focusRef = useRef(focusSkill);
  focusRef.current = focusSkill;
  const open = pageId !== null;
  useEffect(() => {
    if (open) {
      document.getElementById("skill-page-title")?.focus({ preventScroll: true });
    } else if (opener.current) {
      focusRef.current(opener.current);
      opener.current = null;
    }
  }, [open, pageId]);
  if (pageId && !opener.current) opener.current = pageId;
}
