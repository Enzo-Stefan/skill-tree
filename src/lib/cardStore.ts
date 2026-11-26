import { FEET, NO_STAMPS, POSITIONS, type CardStamps, type PlayerCard, type StampedCard } from "./ratingHistory";

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

/** One field: the later change wins, and a change to "none" counts. On a tie (or no stamps) the account's value wins and this browser fills a gap. */
function pickField<T>(account: T | null, accountAt: number | null, local: T | null, localAt: number | null): { value: T | null; at: number | null } {
  if ((localAt ?? 0) > (accountAt ?? 0)) return { value: local, at: localAt };
  if ((accountAt ?? 0) > (localAt ?? 0)) return { value: account, at: accountAt };
  return { value: account ?? local, at: accountAt ?? localAt };
}

/** Per field, the later change wins, so a field cleared on one device stays cleared on the others. */
export function mergeCard(account: StampedCard, local: StampedCard): StampedCard {
  const position = pickField(account.position, account.at.position, local.position, local.at.position);
  const foot = pickField(account.foot, account.at.foot, local.foot, local.at.foot);
  return { position: position.value, foot: foot.value, at: { position: position.at, foot: foot.at } };
}

export const sameCard = (a: PlayerCard, b: PlayerCard): boolean => a.position === b.position && a.foot === b.foot;

export const sameStamped = (a: StampedCard, b: StampedCard): boolean => sameCard(a, b) && a.at.position === b.at.position && a.at.foot === b.at.foot;

const cleanStamp = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** Which fields the player changed by hand since the account sync started. */
export interface Touched {
  position: boolean;
  foot: boolean;
}

/** The card this browser holds and whose account it belongs to; null when it was made while signed out. */
export interface StoredCard {
  card: PlayerCard;
  at: CardStamps;
  userId: string | null;
}

const EMPTY_STORED: StoredCard = { card: EMPTY_CARD, at: NO_STAMPS, userId: null };

/**
 * The card to show after the account's card has been fetched. This browser's card only fills the account's empty
 * fields when it was made signed out or belongs to this same user; another user's card is ignored. Fields the player
 * changed during the fetch keep the player's value.
 */
export function reconcileCard(account: StampedCard, local: StampedCard, owner: string | null, userId: string, touched: Touched): StampedCard {
  const base = owner === null || owner === userId ? mergeCard(account, local) : account;
  return {
    position: touched.position ? local.position : base.position,
    foot: touched.foot ? local.foot : base.foot,
    at: { position: touched.position ? local.at.position : base.at.position, foot: touched.foot ? local.at.foot : base.at.foot },
  };
}

export function loadStored(): StoredCard {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORED;
    const parsed: unknown = JSON.parse(raw);
    const r = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    const stamps = (r.at && typeof r.at === "object" ? r.at : {}) as Record<string, unknown>;
    // A card saved before owners were recorded has no userId and counts as made signed out; one saved before stamps has none.
    return { card: cleanCard(parsed), at: { position: cleanStamp(stamps.position), foot: cleanStamp(stamps.foot) }, userId: typeof r.userId === "string" && r.userId !== "" ? r.userId : null };
  } catch {
    return EMPTY_STORED;
  }
}

export const loadCard = (): PlayerCard => loadStored().card;

export function storeCard(card: PlayerCard, userId: string | null = null, at: CardStamps = NO_STAMPS): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...card, userId, at }));
  } catch {
    // Storage can be full or blocked. The choice is still kept in memory and in the account.
  }
}
