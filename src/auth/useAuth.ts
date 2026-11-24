import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { accountsConfigured, loadSupabase, mayHaveSession } from "./client";
import { t } from "../i18n";

export interface Account {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface Auth {
  /** False when the Supabase keys aren't set. The app then works without accounts. */
  configured: boolean;
  account: Account | null;
  /** True while we check for an existing session. */
  loading: boolean;
  /** Starts Google sign-in. Resolves to an error message, or null when the browser is being redirected. */
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Deletes the account and its saved progress for good, then signs out. Resolves to an error message, or null on success. */
  deleteAccount: () => Promise<string | null>;
}

function toAccount(user: User): Account {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: meta.full_name ?? meta.name ?? user.email ?? t.account.signedInFallback,
    email: user.email ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
}

export function useAuth(): Auth {
  const [account, setAccount] = useState<Account | null>(null);
  // Only wait for a session check when there may be a session; everyone else never loads the library at startup.
  const [loading, setLoading] = useState(mayHaveSession);

  useEffect(() => {
    if (!mayHaveSession()) return;
    let active = true;
    let unsubscribe = () => {};
    loadSupabase()
      .then(async (supabase) => {
        if (!supabase || !active) return;
        const { data } = await supabase.auth.getSession();
        if (active) setAccount(data.session ? toAccount(data.session.user) : null);
        const listener = supabase.auth.onAuthStateChange((_event, session) => {
          setAccount(session ? toAccount(session.user) : null);
        });
        unsubscribe = () => listener.data.subscription.unsubscribe();
        if (!active) unsubscribe();
      })
      .catch(() => {
        // A failed download or session check just means the player looks signed out.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const supabase = await loadSupabase();
      if (!supabase) return t.signIn.notSetUp;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return error ? error.message : null;
    } catch {
      return t.signIn.loadFailed;
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = await loadSupabase();
    await supabase?.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      const supabase = await loadSupabase();
      if (!supabase) return t.signIn.notSetUp;
      // supabase/migrations/002_delete_account.sql
      const { error } = await supabase.rpc("delete_my_account");
      if (error) return t.accountDialog.deleteFailed;
      // The account no longer exists on the server, so only clear this browser's session.
      await supabase.auth.signOut({ scope: "local" });
      return null;
    } catch {
      return t.accountDialog.unreachable;
    }
  }, []);

  return { configured: accountsConfigured, account, loading, signInWithGoogle, signOut, deleteAccount };
}
