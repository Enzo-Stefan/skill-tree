import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./touch.css", import.meta.url), "utf8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match ? match[1] : "";
}

describe("touch.css tap targets", () => {
  it("gives each Training checkbox row's label a 44px minimum height", () => {
    expect(ruleBody(".checklist label")).toMatch(/min-height:\s*44px/);
  });

  it("keeps the checkbox row at least 44px tall so its label fills the tap area", () => {
    expect(ruleBody(".checklist li")).toMatch(/min-height:\s*44px/);
  });

  it("applies the checklist rules only under the touch or narrow-screen query", () => {
    const start = css.indexOf(".checklist label");
    const mediaStart = css.lastIndexOf("@media", start);
    expect(css.slice(mediaStart, start)).toContain("(max-width: 700px), (pointer: coarse)");
  });
});
