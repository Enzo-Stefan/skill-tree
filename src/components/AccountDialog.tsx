import { useEffect, useRef, useState } from "react";
import type { Account } from "../auth/useAuth";
import { useModalFocus } from "./useModalFocus";
import { t } from "../i18n";

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
        <h2 id="account-title">{confirming ? t.accountDialog.confirmTitle : t.accountDialog.title}</h2>
        {confirming ? (
          <>
            <p>{t.accountDialog.confirmBody}</p>
            <p>{t.accountDialog.browserStays}</p>
          </>
        ) : (
          <p>
            {t.accountDialog.signedInAs} <strong className="account-who">{account.email ?? account.name}</strong>.
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
                {busy ? t.accountDialog.deleting : t.accountDialog.deleteForGood}
              </button>
              <button ref={cancel} className="btn" type="button" onClick={() => setConfirming(false)} disabled={busy}>
                {t.accountDialog.cancel}
              </button>
            </>
          ) : (
            <>
              <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
                {t.accountDialog.delete}
              </button>
              <button className="btn" type="button" onClick={onClose}>
                {t.accountDialog.close}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
