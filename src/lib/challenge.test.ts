import { describe, expect, it, vi } from "vitest";
import { challengeText, shareChallenge, showChallengeButton, challengeResult, savesSeconds, type ChallengeStrings, type ShareEnv } from "./challenge";

const strings: ChallengeStrings = {
  lower: (s, v) => `I did ${s} in ${v}. Beat it?`,
  higher: (s, v) => `I got ${v} on ${s}. Beat it?`,
};
const url = "https://x.test/?skill=sl1";

describe("challengeText", () => {
  it("uses the lower-is-better wording for times", () => {
    expect(challengeText("the slalom", "13.2 s", "lower", url, strings)).toBe(`I did the slalom in 13.2 s. Beat it?\n${url}`);
  });
  it("uses the higher-is-better wording for counts", () => {
    expect(challengeText("juggling", "20", "higher", url, strings)).toBe(`I got 20 on juggling. Beat it?\n${url}`);
  });
  it("ends with the link on its own line", () => {
    expect(challengeText("a", "1 s", "lower", url, strings).split("\n").pop()).toBe(url);
  });
});

describe("shareChallenge", () => {
  const abort = (e: unknown) => Promise.reject(e);
  function setup(over: Partial<ShareEnv>) {
    const calls = { copied: 0, prompt: [] as string[][] };
    const env: ShareEnv = {
      writeText: () => Promise.resolve(),
      prompt: (m, v) => void calls.prompt.push([m, v]),
      ...over,
    };
    return { calls, run: () => shareChallenge("T", "msg", "P", () => void calls.copied++, env) };
  }

  it("shares and does not copy when the share succeeds", async () => {
    const share = vi.fn(() => Promise.resolve());
    const { calls, run } = setup({ share });
    await run();
    expect(share).toHaveBeenCalledWith({ title: "T", text: "msg" });
    expect(calls.copied).toBe(0);
    expect(calls.prompt).toEqual([]);
  });
  it("does nothing when the share sheet is cancelled, even with a plain Error", async () => {
    const plain = Object.assign(new Error("x"), { name: "AbortError" });
    const { calls, run } = setup({ share: () => abort(plain) });
    await run();
    expect(calls.copied).toBe(0);
    expect(calls.prompt).toEqual([]);
  });
  it("copies when the share is rejected for another reason", async () => {
    const { calls, run } = setup({ share: () => abort(new Error("NotAllowedError")) });
    await run();
    expect(calls.copied).toBe(1);
  });
  it("copies when there is no share sheet", async () => {
    const { calls, run } = setup({});
    await run();
    expect(calls.copied).toBe(1);
  });
  it("falls back to the prompt, with the copy wording, when the clipboard is blocked", async () => {
    const { calls, run } = setup({ writeText: () => abort(new Error("denied")) });
    await run();
    expect(calls.copied).toBe(0);
    expect(calls.prompt).toEqual([["P", "msg"]]);
  });
  it("falls back to the prompt when there is no clipboard", async () => {
    const { calls, run } = setup({ writeText: undefined });
    await run();
    expect(calls.prompt).toEqual([["P", "msg"]]);
  });
});

describe("showChallengeButton", () => {
  it("shows only when saved, challengeable, passed and a stopwatch test", () => {
    expect(showChallengeButton(true, true, "passed", "time")).toBe(true);
    expect(showChallengeButton(false, true, "passed", "time")).toBe(false);
    expect(showChallengeButton(true, false, "passed", "time")).toBe(false);
    expect(showChallengeButton(true, true, "failed", "time")).toBe(false);
  });
  it("hides for kinds that don't save seconds, so no '20 s on juggling'", () => {
    for (const kind of ["count", "hits", "hold"]) {
      expect(savesSeconds(kind)).toBe(false);
      expect(showChallengeButton(true, true, "passed", kind)).toBe(false);
    }
  });
  it("formats the result in seconds", () => {
    expect(challengeResult(13.2)).toMatch(/13.2 s/);
  });
});
