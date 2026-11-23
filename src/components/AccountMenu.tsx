import { useState } from "react";
import type { Auth } from "../auth/useAuth";
import { SignInDialog } from "./SignInDialog";

interface Props {
  auth: Auth;
}

/** Sign in button, or the signed-in name with Sign out. Renders nothing when accounts aren't set up. */
export function AccountMenu({ auth }: Props) {
  const [open, setOpen] = useState(false);
  const { account } = auth;

  if (!auth.configured || auth.loading) return null;

  if (account) {
    return (
      <div className="account">
        {account.avatarUrl ? (
          <img className="account-avatar" src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="account-avatar" aria-hidden="true">
            {account.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="account-name" title={account.email ?? undefined}>
          {account.name}
        </span>
        <button className="btn" type="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
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
