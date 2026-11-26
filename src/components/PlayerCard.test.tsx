// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { PlayerCard } from "./PlayerCard";
import { historyPoints } from "./playerCardChart";
import type { RatingSnapshot } from "../lib/ratingHistory";

const tree = { branches: [{ id: "bc", name: "Ball Control", color: "#e07a1f" }, { id: "ps", name: "Passing", color: "#3a7bd5" }] } as unknown as Tree;
const snap = (week: string, overall: number): RatingSnapshot => ({ week, ratings: { bc: overall }, overall, at: "2026-11-25T10:00:00Z" });

afterEach(cleanup);

describe("PlayerCard", () => {
  it("asks for a first skill instead of showing zeros", () => {
    render(<PlayerCard tree={tree} ratings={{ branches: { bc: 0, ps: 0 }, overall: 0 }} history={[]} />);
    expect(screen.getByText(/Pass your first skill/)).toBeTruthy();
    expect(screen.queryByText("Ball Control")).toBeNull();
  });

  it("shows the overall and each branch rating", () => {
    render(<PlayerCard tree={tree} ratings={{ branches: { bc: 62, ps: 30 }, overall: 46 }} history={[snap("2026-11-16", 20)]} />);
    expect(screen.getByLabelText("Overall rating 46 out of 99")).toBeTruthy();
    expect(screen.getByLabelText("Ball Control 62 out of 99").textContent).toBe("62");
    expect(screen.getByLabelText("Passing 30 out of 99").textContent).toBe("30");
  });

  it("draws the history only from two weeks on", () => {
    const r = { branches: { bc: 62, ps: 30 }, overall: 46 };
    const { container, rerender } = render(<PlayerCard tree={tree} ratings={r} history={[snap("2026-11-16", 20)]} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<PlayerCard tree={tree} ratings={r} history={[snap("2026-11-16", 20), snap("2026-11-23", 46)]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("historyPoints", () => {
  it("is empty below two weeks and puts 0 at the bottom and 99 at the top", () => {
    expect(historyPoints([snap("2026-11-16", 5)])).toBe("");
    expect(historyPoints([snap("2026-11-16", 0), snap("2026-11-23", 99)])).toBe("0,80 280,0");
  });
});
