// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Vitest runs from the project root; import.meta.url is an http URL under jsdom, so it cannot locate the file.
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

/** Puts the splash from index.html into the test document and runs its inline fallback script. */
function loadSplash() {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!inlineScript) throw new Error("inline splash script not found in index.html");
  new Function(inlineScript)();
  return parsed;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("startup splash", () => {
  it("explains the missing JavaScript case in a noscript block", () => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("noscript p.splash-note")?.textContent).toContain("needs JavaScript");
  });

  it("offers a retry only once the splash has been up for 8 seconds", () => {
    vi.useFakeTimers();
    loadSplash();
    const retry = document.getElementById("splash-retry") as HTMLButtonElement;

    expect(retry.hidden).toBe(true);
    vi.advanceTimersByTime(7_999);
    expect(retry.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(retry.hidden).toBe(false);
  });

  it("does nothing when the app has already replaced the splash", () => {
    vi.useFakeTimers();
    loadSplash();
    document.getElementById("root")!.innerHTML = "<main>app</main>";

    expect(() => vi.advanceTimersByTime(8_000)).not.toThrow();
    expect(document.getElementById("splash-retry")).toBeNull();
  });
});
