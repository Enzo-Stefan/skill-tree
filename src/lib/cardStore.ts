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

/** Which fields the player changed by hand since the account sync started. */
export interface Touched {
  position: boolean;
  foot: boolean;
}

/** The card this browser holds and whose account it belongs to; null when it was made while signed out. */
export interface StoredCard {
  card: PlayerCard;
  userId: string | null;
}

const EMPTY_STORED: StoredCard = { card: EMPTY_CARD, userId: null };

/**
 * The card to show after the account's card has been fetched. This browser's card only fills the account's empty
 * fields when it was made signed out or belongs to this same user; another user's card is ignored. Fields the player
 * changed during the fetch keep the player's value.
 */
export function reconcileCard(account: PlayerCard, local: PlayerCard, owner: string | null, userId: string, touched: Touched): PlayerCard {
  const base = owner === null || owner === userId ? mergeCard(account, local) : account;
  return { position: touched.position ? local.position : base.position, foot: touched.foot ? local.foot : base.foot };
}

export function loadStored(): StoredCard {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORED;
    const parsed: unknown = JSON.parse(raw);
    const id = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).userId : null;
    // A card saved before owners were recorded has no userId and counts as made signed out.
    return { card: cleanCard(parsed), userId: typeof id === "string" && id !== "" ? id : null };
  } catch {
    return EMPTY_STORED;
  }
}

export const loadCard = (): PlayerCard => loadStored().card;

export function storeCard(card: PlayerCard, userId: string | null = null): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...card, userId }));
  } catch {
    // Storage can be full or blocked. The choice is still kept in memory and in the account.
  }
}
