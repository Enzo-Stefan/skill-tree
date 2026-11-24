import { describe, expect, it } from "vitest";
import { settleSheet } from "./sheetDrag";

describe("settleSheet", () => {
  it("stays where it was after a short, slow drag", () => {
    expect(settleSheet("half", 30, 0.1, 400)).toBe("half");
    expect(settleSheet("half", -30, -0.1, 400)).toBe("half");
    expect(settleSheet("full", 30, 0.1, 800)).toBe("full");
  });

  it("goes to full height when dragged up from half", () => {
    expect(settleSheet("half", -100, -0.1, 400)).toBe("full");
  });

  it("closes when dragged down from half", () => {
    expect(settleSheet("half", 100, 0.1, 400)).toBe("close");
  });

  it("drops to half when dragged down a little from full, and closes when dragged most of the way", () => {
    expect(settleSheet("full", 100, 0.1, 800)).toBe("half");
    expect(settleSheet("full", 600, 0.1, 800)).toBe("close");
  });

  it("follows a short flick", () => {
    expect(settleSheet("half", -20, -1, 400)).toBe("full");
    expect(settleSheet("half", 20, 1, 400)).toBe("close");
    expect(settleSheet("full", 20, 1, 800)).toBe("half");
  });

  it("ignores a flick that ended against the drag", () => {
    expect(settleSheet("half", 20, -1, 400)).toBe("half");
  });
});
