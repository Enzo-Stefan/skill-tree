import { describe, expect, it } from "vitest";
import { challengeText, type ChallengeStrings } from "./challenge";

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
