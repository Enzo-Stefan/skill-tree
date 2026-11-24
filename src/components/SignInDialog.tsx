import { useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

interface Props {
  /** Starts Google sign-in. Resolves to an error message, or null when the browser is being redirected. */
  onGoogle: () => Promise<string | null>;
  onClose: () => void;
  /** The screen shown when the app opens: says what skipping costs, and the close button reads "Skip". */
  welcome?: boolean;
}

export function SignInDialog({ onGoogle, onClose, welcome = false }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useModalFocus(dialog, onClose);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const message = await onGoogle();
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sign-in-title">{welcome ? t.signIn.welcomeTitle : t.signIn.title}</h2>
        <p>{welcome ? t.signIn.welcomeBody : t.signIn.body}</p>
        {welcome && <p className="dialog-note">{t.signIn.skipWarning}</p>}
        <p className="dialog-note">
          <a className="privacy-link" href="/privacy.html" target="_blank" rel="noopener">
            {t.signIn.privacy}
          </a>
        </p>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn primary" type="button" onClick={handleGoogle} disabled={busy}>
            {busy ? t.signIn.opening : t.signIn.google}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            {welcome ? t.signIn.skip : t.signIn.notNow}
          </button>
        </div>
      </div>
    </div>
  );
}
