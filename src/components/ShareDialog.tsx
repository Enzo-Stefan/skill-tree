import { useEffect, useRef, useState } from "react";
import { renderShareImage, type ShareStats } from "./shareImage";
import { useModalFocus } from "./useModalFocus";

interface Props {
  stats: ShareStats;
  onClose: () => void;
}

const FILE_NAME = "my-skill-tree.png";

export function ShareDialog({ stats, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useModalFocus(dialog, onClose);

  // Draw once when the dialog opens, so the Share tap below still counts as a direct tap (phones require that).
  useEffect(() => {
    let url: string | null = null;
    let active = true;
    renderShareImage(stats)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Couldn't make the image.");
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stats]);

  const file = image ? new File([image.blob], FILE_NAME, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: stats.title, text: `${stats.done} of ${stats.total} skills on ${stats.title}.` });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Sharing didn't work here. Try Download instead.");
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialog}
        className="dialog share"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-title">Share my tree</h2>
        <div className="share-preview">
          {image ? <img src={image.url} alt={`${stats.rank}: ${stats.done} of ${stats.total} skills`} /> : <span>Drawing…</span>}
        </div>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {canShareFile && (
            <button className="btn primary" type="button" onClick={() => void share()}>
              Share
            </button>
          )}
          {image && (
            <a className={`btn${canShareFile ? "" : " primary"}`} href={image.url} download={FILE_NAME}>
              Download
            </a>
          )}
          <button className="btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
