import { useCallback, useEffect, useRef, useState } from "react";
import { loadSupabase } from "../auth/client";
import type { Tree } from "../types";
import { createCloudSaver, mergeProgress, type SavedProgress } from "./cloud";
import { isSyncedHere, loadAccountProgress, markSyncedHere, sameProgress } from "./sync";

export type SyncStatus = "off" | "loading" | "ready" | "error";

interface Options {
  tree: Tree;
  /** The signed-in account's id, or null when signed out. */
  userId: string | null;
  /** The progress the app shows right now. */
  progress: SavedProgress;
  /** Show progress from the account in the app (and save it in the browser). */
  apply: (p: SavedProgress) => void;
  /** Tell the player something went wrong, in plain words. */
  onMessage: (message: string) => void;
}

/**
 * Keeps a signed-in player's progress in their account.
 *
 * On sign-in (or opening the app while signed in) it loads the account's progress: merged with
 * the browser's the first time on this device, the account's copy after that. Then every change
 * is saved to the account a moment later. The browser keeps its own copy the whole time, so the
 * app works the same when offline or when the account can't be reached.
 *
 * Nothing is saved to the account until loading has worked, so an old copy in this browser can't
 * overwrite newer progress from another device. If loading fails it tries again when the
 * connection comes back.
 *
 * Returns:
 *   The sync status, and flush() to send any waiting save. Call flush() before signing out.
 */
export function useCloudSync({ tree, userId, progress, apply, onMessage }: Options) {
  const [status, setStatus] = useState<SyncStatus>("off");
  const [attempt, setAttempt] = useState(0);
  const saver = useRef<ReturnType<typeof createCloudSaver> | null>(null);
  const lastSynced = useRef<SavedProgress | null>(null);
  // The browser's progress before the first try to load this account. If loading fails and the
  // player keeps going, a later try compares against this, so nothing done meanwhile is lost.
  const beforeLoad = useRef<{ userId: string; progress: SavedProgress } | null>(null);
  // Read the latest values inside async work without restarting it on every change.
  const latest = useRef({ progress, apply, onMessage });
  latest.current = { progress, apply, onMessage };

  // Load the account's progress when someone signs in.
  useEffect(() => {
    if (!userId) {
      setStatus("off");
      return;
    }
    let active = true;
    setStatus("loading");
    const snapshot = latest.current.progress;
    if (beforeLoad.current?.userId !== userId) beforeLoad.current = { userId, progress: snapshot };
    const baseline = beforeLoad.current.progress;
    const firstHere = !isSyncedHere(tree.id, userId);
    loadSupabase()
      .then(async (client) => {
        if (!client) throw new Error("Accounts aren't set up.");
        let loaded = await loadAccountProgress(client, userId, tree, snapshot, firstHere);
        if (!active) return;
        // The player may have ticked something while loading, or while the account couldn't be
        // reached before this try. Keep it.
        const now = latest.current.progress;
        const changedMeanwhile = !sameProgress(now, baseline);
        if (changedMeanwhile) loaded = mergeProgress(tree, now, loaded);
        beforeLoad.current = null;
        markSyncedHere(tree.id, userId);
        saver.current = createCloudSaver(client, userId, tree.id, (detail) => {
          console.warn(detail);
          latest.current.onMessage("Couldn't save to your account. Your progress is still saved on this device.");
        });
        lastSynced.current = loaded;
        if (changedMeanwhile) saver.current.save(loaded);
        latest.current.apply(loaded);
        setStatus("ready");
        if (firstHere) latest.current.onMessage("Signed in. Your progress is saved to your account.");
      })
      .catch((e: unknown) => {
        if (!active) return;
        setStatus("error");
        // The technical reason goes to the console. Players get a plain message.
        console.warn(e);
        latest.current.onMessage("Couldn't reach your account. Your progress is still saved on this device.");
      });
    return () => {
      active = false;
      void saver.current?.flush();
      saver.current = null;
      lastSynced.current = null;
    };
  }, [tree, userId, attempt]);

  // If loading failed, try again when the connection comes back.
  useEffect(() => {
    if (status !== "error") return;
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [status]);

  // Save each change to the account, once loading has worked.
  useEffect(() => {
    if (status !== "ready" || !saver.current || !lastSynced.current) return;
    if (sameProgress(progress, lastSynced.current)) return;
    lastSynced.current = progress;
    saver.current.save(progress);
  }, [status, progress]);

  const flush = useCallback(async () => {
    await saver.current?.flush();
  }, []);

  return { status, flush };
}
