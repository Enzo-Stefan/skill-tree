// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { t } from "./i18n";
import { trees } from "./data";
import App from "./App";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.scrollTo = () => {};
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });

// The full suite can leave a broken localStorage behind; give this file its own in-memory one.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
});

const tree = trees[0];
const first = tree.skills[0];

/** Resets the address and drops entries from earlier tests as far as jsdom allows. */
function startAt(url: string) {
  window.history.replaceState(null, "", url);
}

const search = () => window.location.search;
const onPage = () => document.querySelector(".skill-page");
const back = () => screen.getByRole("button", { name: t.skillPage.back });

/** Waits for a history.go() to land: it is async in jsdom and fires popstate. */
async function afterGo(act: () => void) {
  const pop = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
  act();
  await pop;
}

beforeEach(() => {
  store.clear();
  store.set("skill-tree:active-tree", tree.id);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("skill page history", () => {
  it("(a) opens a page from the tree and closes back to the tree without ?skill=", async () => {
    startAt("/");
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: t.panel.openPage })[0]);
    expect(search()).toContain(`skill=${first.id}`);
    expect(window.history.state?.pageDepth).toBe(1);
    expect(onPage()).not.toBeNull();

    await afterGo(() => fireEvent.click(back()));
    await waitFor(() => expect(onPage()).toBeNull());
    expect(search()).not.toContain("skill=");
  });

  it("(b) follows a skill link (depth 2), then Back to the tree lands on the tree, not the first page", async () => {
    startAt("/");
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: t.panel.openPage })[0]);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".skill-link")!);
    expect(window.history.state?.pageDepth).toBe(2);
    expect(search()).not.toContain(`skill=${first.id}`);

    await afterGo(() => fireEvent.click(back()));
    await waitFor(() => expect(onPage()).toBeNull());
    expect(search()).not.toContain("skill=");
  });

  it("(c) shared link: follow a skill link, close: ends on the tree with the params dropped", async () => {
    startAt(`/?tree=${tree.id}&skill=${first.id}`);
    render(<App />);
    expect(onPage()).not.toBeNull();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".skill-link")!);
    expect(window.history.state?.pageDepth).toBe(1);

    await afterGo(() => fireEvent.click(back()));
    await waitFor(() => expect(onPage()).toBeNull());
    expect(search()).not.toContain("skill=");
    expect(search()).not.toContain("tree=");
  });

  it("(d) reload: state says skillPage but nothing was pushed this session, so close uses replaceState, not go/back", () => {
    startAt(`/?tree=${tree.id}&skill=${first.id}`);
    window.history.replaceState({ skillPage: true, pageDepth: 1 }, "", window.location.href);
    const go = vi.spyOn(window.history, "go");
    const backSpy = vi.spyOn(window.history, "back");
    const replace = vi.spyOn(window.history, "replaceState");
    render(<App />);
    expect(onPage()).not.toBeNull();

    fireEvent.click(back());
    expect(go).not.toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
    expect(onPage()).toBeNull();
    expect(search()).not.toContain("skill=");
  });
});
