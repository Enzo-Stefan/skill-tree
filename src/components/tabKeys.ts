/**
 * Where arrow-key navigation in a row of tabs goes, for the tabs pattern in the ARIA guide:
 * Right and Left move one tab and wrap around, Home and End jump to the first and last.
 *
 * Returns:
 *   The index to focus, or null when the key isn't one of these (so the browser handles it).
 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Key handler for a `role="tablist"` element: moves focus between its `role="tab"` children.
 * Returns the index it moved to, or null when nothing moved, so the caller can also select it
 * (tabs that select as they get focus) or leave selecting to Enter and Space (tabs that
 * do something big, like switching the whole tree).
 */
export function moveTabFocus(event: { key: string; currentTarget: HTMLElement; preventDefault: () => void }): number | null {
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const from = tabs.findIndex((tab) => tab === document.activeElement);
  if (from === -1) return null;
  const to = nextTabIndex(event.key, from, tabs.length);
  if (to === null) return null;
  event.preventDefault();
  tabs[to].focus();
  return to;
}
