import { useState } from "react";
import { useOnline } from "./useOnline";
import { parseVideo } from "./video";

interface Props {
  link: string;
  /** Skill name, used for the player's accessible label. */
  title: string;
}

/**
 * Plays a skill's video in the panel.
 *
 * YouTube videos show a plain play box and contact YouTube only when tapped (no thumbnail,
 * no player, no cookies before that), so opening a skill never shares anything with YouTube.
 * Our own video files use the browser's built-in player.
 * Videos are never stored for offline use, so offline the box says so instead of showing a broken player.
 */
export function SkillVideo({ link, title }: Props) {
  const [playing, setPlaying] = useState(false);
  const online = useOnline();
  const video = parseVideo(link);
  if (!video) return null;

  if (!online) {
    return (
      <div className="video video-offline" role="note">
        <p>
          <strong>Video needs internet</strong>
          The drill, test and tip all work offline.
        </p>
      </div>
    );
  }

  if (video.kind === "file") {
    return (
      <div className="video">
        <video src={video.src} controls playsInline preload="metadata" aria-label={`${title} video`} />
      </div>
    );
  }

  if (playing) {
    return (
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
          title={`${title} video`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button className="video video-poster" type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title} video`}>
      <span className="play" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        </svg>
      </span>
      <span className="poster-note">Tap to play. This loads the video from YouTube.</span>
    </button>
  );
}
