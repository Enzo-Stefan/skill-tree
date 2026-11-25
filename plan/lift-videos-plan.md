# Videos for the weights lifts (plan for #108)

Status: proposal, for Stefan's yes. Nothing here is built.

## Goal

Every exercise in the Football Strength tree shows a how-to video in its panel, the same as the football tree (#16). Today the panel only offers a YouTube search link.

Issue #108 asks whether the lifts get a video each. This plan recommends a video for all 21 non-final skills, which is wider than #108's question. Decision 1 below chooses between the two.

## What exists

- `src/data/weights.ts` has 22 skills: root, 20 exercises in four branches, and the final "Match Strong" skill. 10 exercises have `logWeight: true` (marked "lift" below).
- The file header says: "A FIRST DRAFT: lifts and reps are open for discussion." The video list may change with the lift list.
- No skill in `weights.ts` has a `video` field. The football tree has 32 skills and 31 videos; the only one without is its final skill, "Match Ready".
- `parseVideo` (`src/components/video.ts`) accepts YouTube watch, youtu.be, shorts, embed and live links, and direct .mp4, .webm, .mov or .m4v files.
- `SkillPanel.tsx` plays `skill.video` when it is set; otherwise it shows the YouTube search link.
- `src/data/translations.test.ts` requires the `video` field to match between English and Spanish.

## Decisions already made

- Stefan owns the data (`src/data`); Enzo owns the screens.
- A lift is passed by reps at the heaviest weight the player can manage, so each video should show good form, not a max attempt.

## Recommendation

Give every skill except the final one a video: root plus the 20 exercises, 21 in total. That matches the football tree. Videos only for the 10 lifts would leave the non-lift drills (Plank, Box Jump, Dead Bug) with no demo, and those need one as much as the lifts do. The final skill stays without a video, as in football.

## Design

### Code change: none needed

`SkillPanel` and `SkillVideo` already play any link that `parseVideo` accepts. This is a data-only change. No UI work is needed.

### Spanish: no edits needed

`translateTree` (`src/lib/translate.ts`) copies each English skill with `{ ...s }` and overwrites only the name, drill, test, tip, targets and routine text. The `video` field comes from the English skill, so the Spanish tree picks up each link without a Spanish edit. `translations.test.ts` then passes on the shared link.

### How links are chosen

- Use only the `https://www.youtube.com/watch?v=<id>` form. No youtu.be, shorts or embed links.
- Pick a coach or physio channel that shows the movement in good form, ideally with light or bodyweight loads. Avoid max-lift and challenge videos, product or sponsor content, and anything that pushes to failure.
- The players are young: the tree already says under-16s train with an adult, and the videos must not suggest heavier or riskier work than the drills do.
- Both languages use the same link, so pick videos that make sense without speech.
- Stefan opens each link in the app before merging. The automated tests check only the link's shape. The manual check is what catches age-restricted videos and videos with embedding disabled, since those pass the shape test and fail in the player.

### The data change

In `src/data/weights.ts`, add one line to each of the 21 skills, after its `drill` text:

    video: "https://www.youtube.com/watch?v=<id>",

### Checklist (21 links, one per skill)

- [ ] root: Bodyweight Basics (see decision 3)
- [ ] lg1: Goblet Squat (lift)
- [ ] lg2: Split Squat (lift)
- [ ] lg3: Romanian Deadlift (lift)
- [ ] lg4: Back Squat (lift)
- [ ] lg5: Trap Bar Deadlift (lift)
- [ ] pw1: Box Jump
- [ ] pw2: Kettlebell Swing (lift)
- [ ] pw3: Med Ball Throw (lift)
- [ ] pw4: Single-Leg Bound
- [ ] pw5: Jump Squat (lift)
- [ ] cr1: Plank
- [ ] cr2: Side Plank
- [ ] cr3: Dead Bug
- [ ] cr4: Pallof Press (lift)
- [ ] cr5: Hanging Knee Raise
- [ ] ip1: Single-Leg Calf Raise
- [ ] ip2: Single-Leg Glute Bridge
- [ ] ip3: Copenhagen Plank
- [ ] ip4: Nordic Hamstring Curl
- [ ] ip5: Single-Leg RDL (lift)

### Tests

- Existing: `video.test.ts` runs `parseVideo` on every video in every tree, so a malformed link fails `npm test`.
- Existing: `translations.test.ts` keeps the Spanish tree on the same links.
- Proposed: a presence check in `src/data/trees.test.ts`, next to the existing routine tests. Its scope depends on decision 1:
  - All 21: every skill except `final` must have a `video`.
  - Lifts only: every skill with `logWeight: true` (10 skills) must have a `video`.
  The check goes in the last data PR, after all links are in, so earlier PRs do not fail.
- Manual: open the panels in `npm run dev` and check each video plays at phone width, including age-restricted and embedding-disabled cases.

### Skills without a video

They keep today's behaviour: the YouTube search link, and lifts still log their weight and personal best. Links can be merged in batches, with the presence check last.

## Order of work

1. Stefan answers the decisions below.
2. Stefan picks one link per skill and checks each plays in the app.
3. Stefan adds the `video` lines in one or more PRs, then the presence check in the last one. Run `npm test` and `npm run build`.
4. Enzo reviews the data PRs; no screen review is needed.

## Decisions for Stefan

1. Videos for all 21 non-final skills, or only the 10 lifts? (Recommended: all 21, as in football. Issue #108 asks about the lifts only.)
2. Add the presence check, and in which PR? (Recommended: yes, in the last data PR. Its scope follows decision 1.)
3. Root "Bodyweight Basics" (`src/data/weights.ts`, line 27) covers four movements: squats, lunges, push-ups and a plank. The data has one `video` field per skill, so one link cannot show all four. The options are:
   - (a) One video that shows all four movements, if a coach has made one.
   - (b) One video for one movement, accepting partial coverage of the other three.
   - (c) No root video, so the root stays without a demo like the final skill.
   This plan does not choose. Stefan decides; a per-movement list would need a schema change.

Relates to #108, #18 and #16.
