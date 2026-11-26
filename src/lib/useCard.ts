import { useCallback, useEffect, useRef, useState } from "react";
import { loadSupabase } from "../auth/client";
import type { SyncStatus } from "./useCloudSync";
import { fetchCard, saveCard, type PlayerCard } from "./ratingHistory";
import { loadCard, mergeCard, sameCard, storeCard } from "./cardStore";

/**
 * The player's position and preferred foot (#123). Kept in this browser; once the account's progress has loaded it
 * is merged with the account's card (the account's value wins per field) and every later change is saved to it.
 * If the calls fail the choice stays in this browser.
 */
export function useCard(userId: string | null, status: SyncStatus): { card: PlayerCard; setCard: (next: PlayerCard) => void } {
  const [card, setCardState] = useState<PlayerCard>(loadCard);
  const latest = useRef(card);
  latest.current = card;
  const accountReady = useRef<string | null>(null);

  useEffect(() => storeCard(card), [card]);

  useEffect(() => {
    if (!userId || status !== "ready") {
      accountReady.current = null;
      return;
    }
    let active = true;
    loadSupabase()
      .then(async (client) => {
        if (!client || !active) return;
        const merged = mergeCard(await fetchCard(client, userId), latest.current);
        if (!active) return;
        accountReady.current = userId;
        setCardState((current) => (sameCard(current, merged) ? current : merged));
        await saveCard(client, userId, merged);
      })
      .catch((e: unknown) => console.warn("Player card sync failed", e));
    return () => {
      active = false;
    };
  }, [userId, status]);

  const setCard = useCallback(
    (next: PlayerCard) => {
      setCardState(next);
      if (!userId || status !== "ready" || accountReady.current !== userId) return;
      loadSupabase()
        .then((client) => (client ? saveCard(client, userId, next) : undefined))
        .catch((e: unknown) => console.warn("Player card save failed", e));
    },
    [userId, status],
  );

  return { card, setCard };
}
