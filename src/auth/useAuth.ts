import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./client";

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
}

function toAccount(user: User): Account {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: meta.full_name ?? meta.name ?? user.email ?? "Signed in",
    email: user.email ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
}

export function useAuth(): Auth {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setAccount(data.session ? toAccount(data.session.user) : null);
      })
      .catch(() => {
        // A failed session check just means the player is signed out.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session ? toAccount(session.user) : null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return "Accounts aren't set up yet.";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return { configured: supabase !== null, account, loading, signInWithGoogle, signOut };
}
