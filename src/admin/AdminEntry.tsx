import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSupabase } from "../auth/client";
import { fetchIsAdmin } from "./adminApi";
import { AdminPage } from "./AdminPage";

/**
 * What /#admin shows. Only an admin sees the page; everyone else, signed in or not, gets the normal app
 * (children) and nothing says an admin page exists. To sign in, use the app's own sign-in, then open /#admin.
 */
export default function AdminEntry({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ kind: "checking" } | { kind: "app" } | { kind: "admin"; client: SupabaseClient }>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const client = await loadSupabase();
        const session = client ? (await client.auth.getSession()).data.session : null;
        const admin = client && session ? await fetchIsAdmin(client) : false;
        if (active) setState(client && admin ? { kind: "admin", client } : { kind: "app" });
      } catch {
        if (active) setState({ kind: "app" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "checking") return null;
  if (state.kind === "admin") return <AdminPage client={state.client} />;
  return <>{children}</>;
}
