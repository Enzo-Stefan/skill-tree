// Whether the player has already been shown the sign-in screen that opens the app,
// and chose to skip it. Remembered in this browser, so skipping is asked once, not on every visit.

const SKIPPED_KEY = "skill-tree:welcome-skipped";

export function loadWelcomeSkipped(): boolean {
  try {
    return localStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveWelcomeSkipped(): void {
  try {
    localStorage.setItem(SKIPPED_KEY, "1");
  } catch {
    // Storage can be blocked. Then the sign-in screen is shown again next visit.
  }
}
