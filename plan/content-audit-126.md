# Content audit and test-gating proposal (#126, items 3 and 4)

Produced from the data on `main` by loading both trees. Stefan fills in the content; this lists what to look at.

## 1. Videos

- **Skill videos:** football has 32 skills and 31 videos (only `final`, "Match Ready", has none). Weights has 22 skills and 21 videos (only `final`, "Match Strong", has none). Both final skills are intentional.
- **Exercise videos:** none. A video belongs to a skill, not to each exercise inside its routine. A mission step for an exercise has no video of its own, so a mission would link to the skill's video. If you want a video per exercise, that is a new field on `RoutineExercise` and about 110 links (63 football exercises, 47 weights). I suggest not doing it now: the skill video plus a clear how-to line is enough, and many exercises repeat (see 3).
- **Not checked:** I did not watch the videos. Whether each one shows good form for young players is a human check.

## 2. Weak or short how-to lines

A how-to under 60 characters is usually a name plus a few words, not instructions. These are the ones to rewrite (length in brackets):

Football
- bc3 Alternating juggles (37), ft1 Run-walk intervals (29), ft1 Easy run (39), ft5 Tempo run (39), ft4 40 m repeats (37), ft2 10 m starts (42), ft2 30 m sprints (49), sh5 Wall volleys (53), ft5 Sprint bursts (54), sh4 Rolling ball shots (57), bc1 Juggles in a row (59).

Weights
- final Plank (33), cr5 Plank (35), cr4 Side plank (36), cr2 Plank (42), pw5 Box jump (48), final Goblet squat (49).

All of these say what to do but not how to do it well, how long, or what to avoid. A good how-to is two sentences: the movement, then the one thing that must stay right (back flat, knees out, land softly).

## 3. Repeated exercises

Weights repeats the same exercise in several routines (Plank x5, Goblet squat x4, and eight more twice). That is fine for training, but each copy has its own how-to text, so they can drift apart or be written at different quality. Plank appears five times with different how-to lengths (33, 35 and 42 characters among them). Suggestion: one shared exercise text in `routines-weights.ts` that each routine points to. Football has no repeated names.

## 4. Counts and timers

Every exercise in both trees has sets plus either reps or seconds, so every exercise gets a time estimate and a mission step. No exercise is missing numbers.

## 5. Skill tests: which skills need one today

None need one. Every skill has a `check` (a counter or timer test: 18 hits, 6 time, 5 count and 3 done in football; 17 count, 3 hold and 2 done in weights), but the "I passed" button in the skill panel passes any unlocked skill without running it. Only 2 football skills have per-level targets.

## 6. Proposal: which skills should need a passed test

Rule: from the fourth tier of a branch (row 3 and row 4, so the x4 and x5 skills, plus Repeat Sprints and Last 90 Minutes), "I passed" is replaced by "Take the test", and the skill is only marked passed when test mode records a pass at the player's current level and step. Earlier skills keep the plain button.

Why: the early skills teach the basics and a mis-tap costs little. The advanced ones are what the leaderboard's skills count and the new XP, mastery and ranks are built on, and they are the easiest to over-claim. Mastery (bronze, silver, gold in #121) already means "pass again at a higher step", which needs a test anyway, so gating the advanced skills makes the whole system consistent.

Which skills (football): bc4, bc5, ps4, ps5, dr4, dr5, sh4, sh5, df3, df5, ft4, ft5 (12 of 32). Weights: the fourth and fifth skill of each branch, 8 of 22.

Things to decide before building:
- Skills whose check is `done` ("Run 3 km", "play a full match") have no counter. For those, "Take the test" would just be a confirm dialog, so they should be exempt: ft1, df1 and the final skills.
- Offline: test mode works offline already, so gating does not need a connection.
- Existing players: skills they have already passed stay passed. The rule only applies to new passes.
- Undo: a skill passed by test can still be undone with the existing Undo.
