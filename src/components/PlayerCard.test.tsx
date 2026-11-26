// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tree } from "../types";
import { PlayerCard } from "./PlayerCard";
import { chartRange, historyPoints } from "./playerCardChart";
import type { RatingSnapshot } from "../lib/ratingHistory";

const tree = { branches: [{ id: "bc", name: "Ball Control", color: "#e07a1f" }, { id: "ps", name: "Passing", color: "#3a7bd5" }] } as unknown as Tree;
const fourBranchTree = {
  branches: [
    { id: "bc", name: "Ball Control", color: "#e07a1f" },
    { id: "ps", name: "Passing", color: "#3a7bd5" },
    { id: "sh", name: "Shooting", color: "#c94b4b" },
    { id: "de", name: "Defending", color: "#4b9c5a" },
  ],
} as unknown as Tree;
const snap = (week: string, overall: number): RatingSnapshot => ({ week, ratings: { bc: overall }, overall, at: "2026-11-25T10:00:00Z" });
const WEEKS = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];
/** Five weeks rising 2, 3, 4, 4, 5. */
const climb = WEEKS.map((week, i) => snap(week, [2, 3, 4, 4, 5][i]));

afterEach(cleanup);

describe("PlayerCard", () => {
  it("shows the prompt when hasProgress is false, even if the ratings are not zero", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 40, ps: 0 }, overall: 20 }} history={[]} hasProgress={false} />);
    expect(screen.getByText(/Pass your first skill/)).toBeTruthy();
    expect(screen.queryByText("Ball Control")).toBeNull();
    expect(container.querySelector(".player-overall")).toBeNull();
  });

  it("shows the card when hasProgress is true, even if the overall is zero", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 0, ps: 0 }, overall: 0 }} history={[]} hasProgress />);
    expect(screen.queryByText(/Pass your first skill/)).toBeNull();
    expect(container.querySelectorAll(".player-ratings li")).toHaveLength(2);
  });

  it("shows the overall and each branch rating, with the scale as visually hidden text", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 62, ps: 30 }, overall: 46 }} history={[snap("2026-11-16", 20)]} hasProgress />);
    expect(container.querySelector(".player-overall")?.textContent).toBe("46 out of 99Overall");
    const values = [...container.querySelectorAll(".player-ratings li strong")].map((s) => s.textContent);
    expect(values).toEqual(["62 out of 99", "30 out of 99"]);
    expect(container.querySelectorAll(".player-ratings .sr-only")).toHaveLength(2);
  });

  it("lists every branch of a four-branch tree in order", () => {
    const { container } = render(
      <PlayerCard tree={fourBranchTree} ratings={{ branches: { bc: 62, ps: 30, sh: 10, de: 0 }, overall: 26 }} history={[]} hasProgress />,
    );
    const rows = [...container.querySelectorAll(".player-ratings li")];
    expect(rows.map((r) => r.querySelector(".player-ratings-name")?.textContent)).toEqual(["Ball Control", "Passing", "Shooting", "Defending"]);
    expect(rows.map((r) => r.querySelector("strong")?.textContent)).toEqual(["62 out of 99", "30 out of 99", "10 out of 99", "0 out of 99"]);
  });

  it("draws the history only from two weeks on", () => {
    const r = { branches: { bc: 62, ps: 30 }, overall: 46 };
    const { container, rerender } = render(<PlayerCard tree={tree} ratings={r} history={[snap("2026-11-16", 20)]} hasProgress />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<PlayerCard tree={tree} ratings={r} history={[snap("2026-11-16", 20), snap("2026-11-23", 46)]} hasProgress />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("gives the chart a text alternative with the first and latest value and the number of weeks", () => {
    render(<PlayerCard tree={tree} ratings={{ branches: { bc: 62, ps: 30 }, overall: 46 }} history={climb} hasProgress />);
    expect(screen.getByRole("img", { name: "Overall rating went from 2 to 5, 5 weeks tracked" })).toBeTruthy();
  });

  it("shows the first and latest value beside the line", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 62, ps: 30 }, overall: 46 }} history={climb} hasProgress />);
    const values = [...container.querySelectorAll(".player-history-value")].map((v) => v.textContent);
    expect(values).toEqual(["2", "5"]);
  });

  it("lists each week and its overall in visually hidden text", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 62, ps: 30 }, overall: 46 }} history={climb} hasProgress />);
    const items = [...container.querySelectorAll(".player-history .sr-only li")].map((li) => li.textContent);
    expect(items).toEqual(["Week of 2026-11-02: overall 2", "Week of 2026-11-09: overall 3", "Week of 2026-11-16: overall 4", "Week of 2026-11-23: overall 4", "Week of 2026-11-30: overall 5"]);
  });

  it("draws a twenty-week history as one point per week", () => {
    const long = Array.from({ length: 20 }, (_, i) => snap(`2026-${String(1 + Math.floor(i / 4)).padStart(2, "0")}-${String(1 + (i % 4) * 7).padStart(2, "0")}`, i * 5));
    const { container } = render(<PlayerCard tree={tree} ratings={{ branches: { bc: 95, ps: 30 }, overall: 60 }} history={long} hasProgress />);
    expect(screen.getByRole("img", { name: "Overall rating went from 0 to 95, 20 weeks tracked" })).toBeTruthy();
    const points = container.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    expect(points).toHaveLength(20);
    expect(container.querySelectorAll(".player-history .sr-only li")).toHaveLength(20);
    expect(container.querySelector(".card-aside")?.textContent).toBe("20 weeks tracked");
  });
});

describe("PlayerCard pickers", () => {
  const r = { branches: { bc: 0, ps: 0 }, overall: 0 };

  it("shows the pickers even before the first skill, with the chosen ones marked", () => {
    render(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: "MID", foot: null }} onCardChange={() => undefined} />);
    expect(screen.getByRole("radio", { name: "MID" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "GK" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: "Left" }).getAttribute("aria-checked")).toBe("false");
  });

  it("picks a value, and pressing the chosen one again clears it", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: null, foot: "left" }} onCardChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "FWD" }));
    expect(onChange).toHaveBeenLastCalledWith({ position: "FWD", foot: "left" });
    rerender(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: "FWD", foot: "left" }} onCardChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Left" }));
    expect(onChange).toHaveBeenLastCalledWith({ position: "FWD", foot: null });
  });

  it("makes only the chosen button (or the first) a tab stop", () => {
    const { rerender } = render(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: null, foot: null }} onCardChange={() => undefined} />);
    expect(screen.getByRole("radio", { name: "GK" }).tabIndex).toBe(0);
    expect(screen.getByRole("radio", { name: "DEF" }).tabIndex).toBe(-1);
    rerender(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: "MID", foot: null }} onCardChange={() => undefined} />);
    expect(screen.getByRole("radio", { name: "GK" }).tabIndex).toBe(-1);
    expect(screen.getByRole("radio", { name: "MID" }).tabIndex).toBe(0);
  });

  it("moves and chooses with the arrow keys, wrapping around, and clears with Backspace or Delete", () => {
    const onChange = vi.fn();
    render(<PlayerCard tree={tree} ratings={r} history={[]} card={{ position: "FWD", foot: "left" }} onCardChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "FWD" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith({ position: "GK", foot: "left" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "FWD" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith({ position: "MID", foot: "left" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "Left" }), { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith({ position: "FWD", foot: null });
    fireEvent.keyDown(screen.getByRole("radio", { name: "FWD" }), { key: "Delete" });
    expect(onChange).toHaveBeenLastCalledWith({ position: null, foot: "left" });
  });

  it("hides the pickers when no card is given", () => {
    render(<PlayerCard tree={tree} ratings={r} history={[]} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("historyPoints", () => {
  it("is empty below two weeks", () => {
    expect(historyPoints([snap("2026-11-16", 5)])).toBe("");
  });

  it("puts a 0 to 99 history at the very bottom and very top of the chart", () => {
    expect(historyPoints([snap("2026-11-16", 0), snap("2026-11-23", 99)])).toBe("0,74 280,6");
  });

  it("zooms in so a small change is visible, not squeezed flat near the bottom", () => {
    const ys = historyPoints(climb)
      .split(" ")
      .map((p) => Number(p.split(",")[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
  });

  it("keeps a flat history in the middle of the chart", () => {
    expect(historyPoints([snap("2026-11-16", 46), snap("2026-11-23", 46)])).toBe("0,40 280,40");
  });
});

describe("chartRange", () => {
  it("never goes outside 0 to 99 and keeps at least eight points of range", () => {
    expect(chartRange([snap("2026-11-16", 0), snap("2026-11-23", 99)])).toEqual({ low: 0, high: 99 });
    expect(chartRange([snap("2026-11-16", 99), snap("2026-11-23", 99)])).toEqual({ low: 91, high: 99 });
    expect(chartRange([snap("2026-11-16", 46), snap("2026-11-23", 46)])).toEqual({ low: 42, high: 50 });
  });
});
