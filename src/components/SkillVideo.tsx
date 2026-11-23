import { useState } from "react";
import { parseVideo } from "./video";

interface Props {
  link: string;
  /** Skill name, used for the player's accessible label. */
  title: string;
}

/**
 * Plays a skill's video in the panel.
 *
 * YouTube videos show a thumbnail first and load YouTube's player only when tapped,
 * so opening a skill stays fast and YouTube sets no cookies until then.
 * Our own video files use the browser's built-in player.
 */
export function SkillVideo({ link, title }: Props) {
  const [playing, setPlaying] = useState(false);
  const video = parseVideo(link);
  if (!video) return null;

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
      <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" loading="lazy" />
      <span className="play" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
