import { describe, expect, it } from "vitest";
import { trees } from "../data";
import { parseVideo } from "./video";

describe("parseVideo", () => {
  it.each([
    ["https://www.youtube.com/watch?v=bH3vhjIGgpQ", "bH3vhjIGgpQ"],
    ["https://youtu.be/bH3vhjIGgpQ?t=30", "bH3vhjIGgpQ"],
    ["https://www.youtube.com/shorts/tD67iZFST1U", "tD67iZFST1U"],
    ["https://m.youtube.com/watch?v=_dqa4rkjzpg&feature=share", "_dqa4rkjzpg"],
  ])("reads the YouTube id from %s", (link, id) => {
    expect(parseVideo(link)).toEqual({ kind: "youtube", id });
  });

  it("plays our own files directly", () => {
    expect(parseVideo("/videos/juggle-20.mp4")).toEqual({ kind: "file", src: "/videos/juggle-20.mp4" });
    expect(parseVideo("https://cdn.example.com/a/first-touch.webm")).toEqual({
      kind: "file",
      src: "https://cdn.example.com/a/first-touch.webm",
    });
  });

  it.each(["https://www.youtube.com/results?search_query=juggling", "https://example.com/page", "not a link"])(
    "rejects %s",
    (link) => {
      expect(parseVideo(link)).toBeNull();
    },
  );
});

describe.each(trees)("$id tree videos", (tree) => {
  it("only has video links the player can play", () => {
    const broken = tree.skills.filter((s) => s.video && !parseVideo(s.video)).map((s) => s.id);
    expect(broken).toEqual([]);
  });
});

describe("weights tree videos", () => {
  it("gives every skill except the final one a video", () => {
    const weights = trees.find((t) => t.id === "weights");
    const missing = weights?.skills.filter((s) => s.id !== "final" && !s.video).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});
