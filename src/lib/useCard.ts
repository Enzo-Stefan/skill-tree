import { useCallback, useEffect, useRef, useState } from "react";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { fetchCard, saveCard, type PlayerCard } from "./ratingHistory";
import { loadStored, reconcileCard, sameCard, storeCard, type Touched } from "./cardStore";

const UNTOUCHED: Touched = { position: false, foot: false };

/**
 * The player's position and preferred foot (#123). Kept in this browser together with the id of the account it
 * belongs to (null when made signed out). Once the account's progress has loaded, the account's card is fetched; this
 * browser's card only fills the account's empty fields when it is a signed-out card or the same user's. Another
 * user's card is replaced by the account's. Later changes are saved to the account one after another.
 * If the calls fail the choice stays in this browser.
 */
export function useCard(userId: string | null, status: SyncStatus): { card: PlayerCard; setCard: (next: PlayerCard) => void } {
  const [initial] = useState(loadStored);
  const [card, setCardState] = useState<PlayerCard>(initial.card);
  const latest = useRef(card);
  const owner = useRef<string | null>(initial.userId);
  const touched = useRef<Touched>(UNTOUCHED);
  const accountReady = useRef<string | null>(null);
  const saves = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(false);

  useEffect(() => {
    latest.current = card;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    storeCard(card, owner.current);
  }, [card]);

  /** Queue a save behind the ones already running, so an older value can never land after a newer one. */
  const enqueueSave = useCallback((id: string, value: PlayerCard) => {
    saves.current = saves.current
      .then(async () => {
        const client = await loadSupabase();
        if (client) await saveCard(client, id, value);
      })
      .catch((e: unknown) => console.warn("Player card save failed", e));
    return saves.current;
  }, []);

  useEffect(() => {
    if (!userId || status !== "ready") {
      accountReady.current = null;
      return;
    }
    let active = true;
    touched.current = UNTOUCHED;
    loadSupabase()
      .then(async (client) => {
        if (!client || !active) return;
        const account = await fetchCard(client, userId);
        if (!active) return;
        const merged = reconcileCard(account, latest.current, owner.current, userId, touched.current);
        owner.current = userId;
        accountReady.current = userId;
        latest.current = merged;
        setCardState((current) => (sameCard(current, merged) ? current : merged));
        storeCard(merged, userId);
        if (!sameCard(merged, account)) await enqueueSave(userId, merged);
      })
      .catch((e: unknown) => console.warn("Player card sync failed", e));
    return () => {
      active = false;
    };
  }, [userId, status, enqueueSave]);

  const setCard = useCallback(
    (next: PlayerCard) => {
      const before = latest.current;
      touched.current = { position: touched.current.position || next.position !== before.position, foot: touched.current.foot || next.foot !== before.foot };
      latest.current = next;
      setCardState(next);
      if (userId && status === "ready" && accountReady.current === userId) void enqueueSave(userId, next);
    },
    [userId, status, enqueueSave],
  );

  return { card, setCard };
}
