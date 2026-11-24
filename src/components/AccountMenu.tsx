import { useState } from "react";
import type { Auth } from "../auth/useAuth";
import { AccountDialog } from "./AccountDialog";
import { SignInDialog } from "./SignInDialog";

interface Props {
  auth: Auth;
  /** Called after the account was deleted, e.g. to show a message. */
  onDeleted?: () => void;
}

/** Sign in button, or the signed-in name with Sign out. Renders nothing when accounts aren't set up. */
export function AccountMenu({ auth, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { account } = auth;

  if (!auth.configured || auth.loading) return null;

  if (account) {
    return (
      <div className="account">
        <button
          className="account-button"
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label={`Account: ${account.name}`}
          title={account.email ?? undefined}
        >
          {account.avatarUrl ? (
            <img className="account-avatar" src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="account-avatar" aria-hidden="true">
              {account.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="account-name">{account.name}</span>
        </button>
        <button className="btn" type="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
        {accountOpen && (
          <AccountDialog
            account={account}
            onClose={() => setAccountOpen(false)}
            onDelete={async () => {
              const error = await auth.deleteAccount();
              if (!error) {
                setAccountOpen(false);
                onDeleted?.();
              }
              return error;
            }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        Sign in
      </button>
      {open && <SignInDialog onGoogle={auth.signInWithGoogle} onClose={() => setOpen(false)} />}
    </>
  );
}
