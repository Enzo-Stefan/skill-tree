import { useCallback, useEffect, useState } from "react";
import type { LeaderboardProfile } from "../types";
import { loadSupabase } from "../auth/client";
import { fetchProfile, LeaderboardError, saveProfile } from "./leaderboardApi";

export interface LeaderboardProfileState {
  /** The player's own settings; null when signed out or they never made a profile. */
  profile: LeaderboardProfile | null;
  /** True while the profile is being loaded after sign-in. */
  loading: boolean;
  /** True when loading the profile failed; the player may well have one, so never offer Join or save. */
  error: boolean;
  /** Tries loading the profile again. */
  retry: () => void;
  /** Saves the profile. Resolves to the problem code, or null when it worked. */
  save: (next: LeaderboardProfile) => Promise<Extract<LeaderboardError["code"], "taken" | "blocked" | "failed"> | null>;
  /** Takes the player off the leaderboard. Their other settings stay for next time. */
  leave: () => Promise<boolean>;
}

/** The signed-in player's leaderboard profile (#96), kept in step with what they save. */
export function useLeaderboardProfile(userId: string | null): LeaderboardProfileState {
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    setProfile(null);
    setError(false);
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
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const save = useCallback(
    async (next: LeaderboardProfile) => {
      if (!userId || error) return "failed" as const;
      try {
        const client = await loadSupabase();
        if (!client) return "failed" as const;
        await saveProfile(client, userId, next);
        setProfile(next);
        return null;
      } catch (e) {
        if (e instanceof LeaderboardError && (e.code === "taken" || e.code === "blocked")) return e.code;
        return "failed" as const;
      }
    },
    [userId, error],
  );

  const leave = useCallback(async () => {
    if (!profile) return true;
    return (await save({ ...profile, leaderboardOptIn: false })) === null;
  }, [profile, save]);

  return { profile, loading, error, retry, save, leave };
}
