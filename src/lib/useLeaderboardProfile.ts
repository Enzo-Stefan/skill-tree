import { useCallback, useEffect, useState } from "react";
import type { LeaderboardProfile } from "../types";
import { loadSupabase } from "../auth/client";
import { fetchProfile, LeaderboardError, saveProfile } from "./leaderboardApi";

export interface LeaderboardProfileState {
  /** The player's own settings; null when signed out or they never made a profile. */
  profile: LeaderboardProfile | null;
  /** True while the profile is being loaded after sign-in. */
  loading: boolean;
  /** Saves the profile. Resolves to the problem code, or null when it worked. */
  save: (next: LeaderboardProfile) => Promise<LeaderboardError["code"] | null>;
  /** Takes the player off the leaderboard. Their other settings stay for next time. */
  leave: () => Promise<boolean>;
}

/** The signed-in player's leaderboard profile (#96), kept in step with what they save. */
export function useLeaderboardProfile(userId: string | null): LeaderboardProfileState {
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProfile(null);
    if (!userId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadSupabase()
      .then((client) => (client ? fetchProfile(client, userId) : null))
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        // A failed load looks like no profile; saving one later still works.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const save = useCallback(
    async (next: LeaderboardProfile) => {
      if (!userId) return "failed" as const;
      try {
        const client = await loadSupabase();
        if (!client) return "failed" as const;
        await saveProfile(client, userId, next);
        setProfile(next);
        return null;
      } catch (e) {
        return e instanceof LeaderboardError ? e.code : ("failed" as const);
      }
    },
    [userId],
  );

  const leave = useCallback(async () => {
    if (!profile) return true;
    return (await save({ ...profile, leaderboardOptIn: false })) === null;
  }, [profile, save]);

  return { profile, loading, save, leave };
}
