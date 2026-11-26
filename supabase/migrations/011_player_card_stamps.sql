-- Player card: when each field was last changed (#123, pickers).
--
-- Run it BEFORE the app version that writes it is merged: main deploys itself. Additive only.
--
-- A null position or foot meant both "never chosen" and "cleared", so a second device that still held the old choice
-- put it back. These two columns record when the player last changed each field, so the newer change wins on every
-- device, including a change to "none". Rows saved before this have null stamps and count as the oldest.

alter table public.player_cards add column if not exists position_at timestamptz;
alter table public.player_cards add column if not exists foot_at timestamptz;

-- Per-column writes, as for the other card fields.
grant insert (position_at, foot_at), update (position_at, foot_at) on public.player_cards to authenticated;
