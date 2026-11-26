import { useEffect, useRef, useState } from "react";
import { renderShareImage, type ShareStats } from "./shareImage";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

/** Another picture in the same dialog (the player card, #123). */
export interface ShareCustom {
  render: () => Promise<Blob>;
  alt: string;
  text: string;
  fileName: string;
}

interface Props {
  stats: ShareStats;
  onClose: () => void;
  /** Without it the progress image is drawn. The caller passes a snapshot so the image is not redrawn on every render. */
  custom?: ShareCustom;
}

const FILE_NAME = "my-skill-tree.png";

export function ShareDialog({ stats, onClose, custom }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useModalFocus(dialog, onClose);

  // Draw once when the dialog opens, so the Share tap below still counts as a direct tap (phones require that).
  useEffect(() => {
    let url: string | null = null;
    let active = true;
    (custom ? custom.render() : renderShareImage(stats))
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : t.share.imageFailed);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stats, custom]);

  const file = image ? new File([image.blob], custom?.fileName ?? FILE_NAME, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: stats.title, text: custom?.text ?? t.share.shareText(stats.done, stats.total, stats.title) });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(t.share.shareFailed);
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
        <h2 id="share-title">{t.share.title}</h2>
        <div className="share-preview">
          {image ? <img src={image.url} alt={custom?.alt ?? t.share.imageAlt(stats.rank, stats.done, stats.total)} /> : <span>{t.share.drawing}</span>}
        </div>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {canShareFile && (
            <button className="btn primary" type="button" onClick={() => void share()}>
              {t.share.share}
            </button>
          )}
          {image && (
            <a className={`btn${canShareFile ? "" : " primary"}`} href={image.url} download={custom?.fileName ?? FILE_NAME}>
              {t.share.download}
            </a>
          )}
          <button className="btn" type="button" onClick={onClose}>
            {t.share.close}
          </button>
        </div>
      </div>
    </div>
  );
}
