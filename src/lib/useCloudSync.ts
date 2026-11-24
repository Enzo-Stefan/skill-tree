import { useCallback, useEffect, useRef, useState } from "react";
import { loadSupabase } from "../auth/client";
import type { Tree } from "../types";
import { createCloudSaver, mergeProgress, type SavedProgress } from "./cloud";
import { isSyncedHere, loadAccountProgress, markSyncedHere, sameProgress, setUnsavedChanges, shouldMerge } from "./sync";

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
 * On sign-in (or opening the app while signed in) it loads the account's progress. The account's
 * copy wins, unless this browser may have progress the account doesn't (see shouldMerge in
 * sync.ts): then the two are merged. Every change is saved to the account a moment later. The
 * browser keeps its own copy the whole time, so the app works the same offline.
 *
 * Any change the player makes, signed in or not, marks the browser as having unsaved changes. The
 * mark is cleared only once a save of the latest progress succeeds. So if the app closes before a
 * save gets through (offline, a failed save, signed out, still loading), the next load merges
 * instead of letting the account's older copy win.
 *
 * Nothing is saved to the account until loading has worked, so an old copy in this browser can't
 * overwrite newer progress from another device. A failed load or save is tried again when the
 * connection comes back.
 *
 * Returns:
 *   The sync status, flush() to send any waiting save (call it before signing out), and
 *   discard() to drop a waiting save (call it before deleting the account).
 */
export function useCloudSync({ tree, userId, progress, apply, onMessage }: Options) {
  const [status, setStatus] = useState<SyncStatus>("off");
  const [attempt, setAttempt] = useState(0);
  const saver = useRef<ReturnType<typeof createCloudSaver> | null>(null);
  const lastSynced = useRef<SavedProgress | null>(null);
  // The progress the change tracker last saw, and the progress just loaded from the account
  // (showing that isn't a change by the player).
  const seen = useRef(progress);
  const fromAccount = useRef<SavedProgress | null>(null);
  // Read the latest values inside async work without restarting it on every change.
  const latest = useRef({ progress, apply, onMessage });
  latest.current = { progress, apply, onMessage };

  // Every change by the player marks the browser as having unsaved changes, signed in or not.
  useEffect(() => {
    if (sameProgress(progress, seen.current)) return;
    seen.current = progress;
    // Showing what was just loaded isn't a change, but skip it only once: a later change that
    // happens to match it again (un-tick, then tick again) is the player's and must be marked.
    if (fromAccount.current && sameProgress(progress, fromAccount.current)) {
      fromAccount.current = null;
      return;
    }
    setUnsavedChanges(tree.id, true);
  }, [tree, progress]);

  // Load the account's progress when someone signs in.
  useEffect(() => {
    if (!userId) {
      setStatus("off");
      return;
    }
    let active = true;
    setStatus("loading");
    const snapshot = latest.current.progress;
    const firstHere = !isSyncedHere(tree.id, userId);
    const merge = shouldMerge(tree.id, userId);
    loadSupabase()
      .then(async (client) => {
        if (!client) throw new Error("Accounts aren't set up.");
        let loaded = await loadAccountProgress(client, userId, tree, snapshot, merge);
        // If this load was abandoned, any change made meanwhile is still marked unsaved, so the
        // next load merges it.
        if (!active) return;
        // The player may have ticked something while this was loading. Keep it.
        const changedMeanwhile = !sameProgress(latest.current.progress, snapshot);
        if (changedMeanwhile) loaded = mergeProgress(tree, latest.current.progress, loaded);
        markSyncedHere(tree.id, userId);
        saver.current = createCloudSaver(
          client,
          userId,
          tree.id,
          (detail) => {
            console.warn(detail);
            latest.current.onMessage("Couldn't save to your account. Your progress is still saved on this device.");
          },
          800,
          () => setUnsavedChanges(tree.id, false),
        );
        lastSynced.current = loaded;
        if (changedMeanwhile) saver.current.save(loaded);
        // Without changes meanwhile, the account now has everything this browser has.
        else setUnsavedChanges(tree.id, false);
        // Only when showing it changes something, or the tracker would never see it and clear it.
        fromAccount.current = sameProgress(loaded, latest.current.progress) ? null : loaded;
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

  // When the connection comes back: load again if loading failed, or send a save that failed.
  useEffect(() => {
    if (status !== "error" && status !== "ready") return;
    const retry = () => (status === "error" ? setAttempt((n) => n + 1) : void saver.current?.flush());
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

  const discard = useCallback(() => {
    saver.current?.discard();
  }, []);

  return { status, flush, discard };
}
