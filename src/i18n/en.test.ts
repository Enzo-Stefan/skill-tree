import { describe, expect, it } from "vitest";
import { en } from "./en";

/** Every leaf of the language file, as [path, value] pairs. */
function leaves(node: object, path = ""): [string, unknown][] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leaves(value, `${path}${key}.`) : [[`${path}${key}`, value]],
  );
}

describe("English language file", () => {
  it("has no empty text", () => {
    for (const [path, value] of leaves(en)) {
      if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      else expect(typeof value, path).toBe("function");
    }
  });

  it("keeps the wording the app had before", () => {
    expect(en.header.moreToReach(6, "Academy")).toBe("6 more to reach Academy");
    expect(en.practice.weeks(1)).toBe("1 week");
    expect(en.practice.weeks(3)).toBe("3 weeks");
    expect(en.app.skillCompleteUnlocked("Juggling", ["Passing", "Dribbling"])).toBe(
      "Juggling complete. Unlocked: Passing, Dribbling.",
    );
    expect(en.tree.after(["Weak-Foot Pass"])).toBe("After Weak-Foot Pass");
    expect(en.tree.after(["Driven Pass 30m", "One-Touch Wall Passes"])).toBe("After Driven Pass 30m and One-Touch Wall Passes");
    expect(en.tree.after(["a", "b", "c", "d", "e", "f"])).toBe("After 6 more skills");
    expect(en.panel.youtubeSearch("football", "Juggling")).toBe("football Juggling drill tutorial");
    expect(en.share.imageTraining("Beginner 2", en.share.imageStreak(4))).toBe("Training at Beginner 2 · 4-week streak");
  });
});

describe("test times", () => {
  it("writes decimals with a point", () => {
    expect(en.testMode.seconds(5.8)).toBe("5.8 s");
    expect(en.testMode.duration(7.5)).toBe("7.5 seconds");
    expect(en.testMode.duration(90.5)).toBe("1 min 30.5 s");
  });
});

describe("YouTube search", () => {
  it("doesn't call a Strength lift a football drill", () => {
    expect(en.panel.youtubeSearch("weights", "Goblet Squat")).toBe("Goblet Squat exercise form tutorial");
  });

  it("uses plain words for a tree it doesn't know", () => {
    expect(en.panel.youtubeSearch("swimming", "Flip Turn")).toBe("Flip Turn tutorial");
  });
});

describe("lift log text", () => {
  it("shows a day without the year when it's this year", () => {
    const year = new Date().getFullYear();
    expect(en.lifts.on(`${year}-11-03`)).toBe("3 Nov");
    expect(en.lifts.on("2019-11-03")).toBe("3 Nov 2019");
  });

  it("counts entries in plain words", () => {
    expect(en.lifts.upFrom("20 kg", 2)).toBe("Up from 20 kg · logged 2 times");
    expect(en.lifts.timesLogged(1)).toBe("Logged 1 time");
  });
});
