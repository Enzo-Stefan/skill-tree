import { FEET, POSITIONS, type PlayerCard } from "./ratingHistory";

// The player's position and preferred foot (#123), kept in this browser and, when signed in, in the account
// (public.player_cards, private to the owner). One card per player, not per tree.

const KEY = "skill-tree:card";

export const EMPTY_CARD: PlayerCard = { position: null, foot: null };

/** A card from untrusted data: anything outside the allowed lists becomes null. */
export function cleanCard(raw: unknown): PlayerCard {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    position: POSITIONS.find((p) => p === r.position) ?? null,
    foot: FEET.find((f) => f === r.foot) ?? null,
  };
}

/** Per field, the account's value wins when it has one; this browser only fills what the account leaves empty. */
export function mergeCard(account: PlayerCard, local: PlayerCard): PlayerCard {
  return { position: account.position ?? local.position, foot: account.foot ?? local.foot };
}

export const sameCard = (a: PlayerCard, b: PlayerCard): boolean => a.position === b.position && a.foot === b.foot;

export function loadCard(): PlayerCard {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? cleanCard(JSON.parse(raw)) : EMPTY_CARD;
  } catch {
    return EMPTY_CARD;
  }
}

export function storeCard(card: PlayerCard): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(card));
  } catch {
    // Storage can be full or blocked. The choice is still kept in memory and in the account.
  }
}
