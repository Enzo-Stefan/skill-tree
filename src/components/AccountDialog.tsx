import { useEffect, useRef, useState } from "react";
import type { Account } from "../auth/useAuth";
import { useModalFocus } from "./useModalFocus";

interface Props {
  account: Account;
  /** Resolves to an error message, or null once the account is gone. */
  onDelete: () => Promise<string | null>;
  onClose: () => void;
}

/** The signed-in account, with a two-step "Delete account". */
export function AccountDialog({ account, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // While the delete is running, Escape and taps outside must not hide it.
  useModalFocus(dialog, busy ? () => {} : onClose);

  // On the confirm step, start on Cancel so a stray Enter can't delete the account.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
  }, [confirming]);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const message = await onDelete();
    // On success the account is gone and this dialog unmounts, so only failures need handling.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div
        ref={dialog}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="account-title">{confirming ? "Delete your account?" : "Your account"}</h2>
        {confirming ? (
          <>
            <p>
              This deletes your account and the progress saved in it, on every device. It can't be undone.
            </p>
            <p>Progress saved in this browser stays here. Use Reset if you want to clear it too.</p>
          </>
        ) : (
          <p>
            Signed in with Google as <strong className="account-who">{account.email ?? account.name}</strong>.
          </p>
        )}
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {confirming ? (
            <>
              <button className="btn danger" type="button" onClick={() => void handleDelete()} disabled={busy}>
                {busy ? "Deleting…" : "Delete for good"}
              </button>
              <button ref={cancel} className="btn" type="button" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
                Delete account
              </button>
              <button className="btn" type="button" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
