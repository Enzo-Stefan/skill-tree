import { useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";

interface Props {
  /** Starts Google sign-in. Resolves to an error message, or null when the browser is being redirected. */
  onGoogle: () => Promise<string | null>;
  onClose: () => void;
}

export function SignInDialog({ onGoogle, onClose }: Props) {
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
        <h2 id="sign-in-title">Sign in</h2>
        <p>Sign in to keep your progress on every device. The app works without an account too.</p>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn primary" type="button" onClick={handleGoogle} disabled={busy}>
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
