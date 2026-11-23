export type VideoSource = { kind: "youtube"; id: string } | { kind: "file"; src: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
const FILE_EXT = /\.(mp4|webm|mov|m4v)$/i;

/**
 * Works out how to play a skill's video link.
 *
 * Args:
 *   link: A YouTube link, or a link (absolute or site-relative) to a video file.
 *
 * Returns:
 *   The YouTube id or the file address, or null when the link is neither.
 */
export function parseVideo(link: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(link, "https://skill-tree.local");
  } catch {
    return null;
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      url.hostname === "youtu.be"
        ? parts[0]
        : parts[0] === "watch"
          ? url.searchParams.get("v")
          : ["shorts", "embed", "live"].includes(parts[0])
            ? parts[1]
            : null;
    return id && YOUTUBE_ID.test(id) ? { kind: "youtube", id } : null;
  }

  return FILE_EXT.test(url.pathname) ? { kind: "file", src: link } : null;
}
