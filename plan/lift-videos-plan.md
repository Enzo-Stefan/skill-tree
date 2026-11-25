# Videos for the weights lifts (plan for #108)

Status: proposal, for Stefan's yes. Nothing here is built.

## Goal

Every exercise in the Football Strength tree shows a how-to video in its panel, the same as the football tree (#16). Today the panel only offers a YouTube search link.

## What exists

- `src/data/weights.ts` has 22 skills: root, 20 exercises in four branches, and the final "Match Strong" skill. 10 exercises have `logWeight: true` (marked "lift" below).
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

### How links are chosen

- Use a YouTube link (watch, youtu.be or shorts) that `parseVideo` accepts.
- Pick a coach or physio channel that shows the movement in good form, ideally with light or bodyweight loads. Avoid max-lift and challenge videos, product or sponsor content, and anything that pushes to failure.
- The players are young: the tree already says under-16s train with an adult, and the videos must not suggest heavier or riskier work than the drills do.
- Both languages use the same link, so pick videos that make sense without speech.
- Stefan opens each link in the app before merging. The test checks only the link's shape, so a deleted or age-restricted video would still pass. Whether the embed blocks age-restricted videos is not verified here.

### The data change

In `src/data/weights.ts`, add one line to each of the 21 skills, after its `drill` text:

    video: "https://www.youtube.com/watch?v=<id>",

### Checklist (21 links)

- [ ] Root: root Bodyweight Basics
- [ ] Legs: lg1 Goblet Squat (lift), lg2 Split Squat (lift), lg3 Romanian Deadlift (lift), lg4 Back Squat (lift), lg5 Trap Bar Deadlift (lift)
- [ ] Power: pw1 Box Jump, pw2 Kettlebell Swing (lift), pw3 Med Ball Throw (lift), pw4 Single-Leg Bound, pw5 Jump Squat (lift)
- [ ] Core: cr1 Plank, cr2 Side Plank, cr3 Dead Bug, cr4 Pallof Press (lift), cr5 Hanging Knee Raise
- [ ] Injury-Proof: ip1 Single-Leg Calf Raise, ip2 Single-Leg Glute Bridge, ip3 Copenhagen Plank, ip4 Nordic Hamstring Curl, ip5 Single-Leg RDL (lift)

### Tests

- Existing: `video.test.ts` runs `parseVideo` on every video in every tree, so a malformed link fails `npm test`.
- Existing: `translations.test.ts` keeps the Spanish tree on the same links.
- Proposed: a presence check that every skill except `final` has a `video`. It goes in the last data PR, after all 21 links are in, so earlier PRs do not fail.
- Manual: open the panels in `npm run dev` and check each video plays at phone width.

### Skills without a video

They keep today's behaviour: the YouTube search link, and lifts still log their weight and personal best. Links can be merged in batches, with the presence check last.

## Order of work

1. Stefan answers the decisions below.
2. Stefan picks one link per skill and checks each plays in the app.
3. Stefan adds the `video` lines in one or more PRs, then the presence check in the last one. Run `npm test` and `npm run build`.
4. Enzo reviews the data PRs; no screen review is needed.

## Decisions for Stefan

1. Videos for all 21 non-final skills, or only the 10 lifts? (Recommended: all 21, as in football.)
2. Add the presence check, and in which PR? (Recommended: yes, in the last data PR.)

Relates to #108, #18 and #16.
