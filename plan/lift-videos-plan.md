# Videos for the weights lifts (plan for #108)

Status: proposal, for Stefan's yes. Nothing here is built.

## Goal

Each lift in the Football Strength tree shows a how-to video in its panel, like the football skills (#16). Today the panel only offers a YouTube search link.

## What exists

- `src/data/weights.ts` has 22 skills. 10 have `logWeight: true`, which makes them lifts (checklist below). The other 12 are root, final and 10 non-lift drills.
- No skill in `weights.ts` has a `video` field. The 31 football video fields are in `src/data/football.ts`.
- `parseVideo` (`src/components/video.ts`) accepts YouTube watch, youtu.be, shorts, embed and live links, and direct .mp4, .webm, .mov or .m4v files.
- `SkillPanel.tsx` plays `skill.video` when it is set; otherwise it shows the YouTube search link.
- `src/data/translations.test.ts` requires the `video` field to match between English and Spanish.

## Decisions already made

- Stefan owns the data (`src/data`); Enzo owns the screens, which do not change here.
- A lift is passed by reps at the heaviest weight the player can manage, so the video should show good form, not a max attempt.

## Recommendation

Give the 10 lifts a video. Leave the 12 non-lift skills on the search link for now, since the issue asks about lifts. Adding them later is the same one-line change.

## Design

### Code change: none needed

`SkillPanel` and `SkillVideo` already play any link that `parseVideo` accepts. This is a data-only change.

### How links are chosen

- Use a YouTube link (watch, youtu.be or shorts).
- Pick a coach or physio channel that shows the lift in good form, ideally with light or bodyweight loads. Avoid max-lift and challenge videos, product or sponsor content, and lifts to failure.
- Stefan opens each link in the app before merging. The test checks only the link's shape, so a deleted video would still pass. Whether the embed blocks age-restricted videos is not verified here.
- Both languages use the same link, so pick videos that make sense without speech.

### The data change

In `src/data/weights.ts`, add one line to each of the 10 lifts, after its `drill` text:

    video: "https://www.youtube.com/watch?v=<id>",

### Checklist of lifts needing a link

- [ ] lg1 Goblet Squat
- [ ] lg2 Split Squat
- [ ] lg3 Romanian Deadlift
- [ ] lg4 Back Squat
- [ ] lg5 Trap Bar Deadlift
- [ ] pw2 Kettlebell Swing
- [ ] pw3 Med Ball Throw
- [ ] pw5 Jump Squat
- [ ] cr4 Pallof Press
- [ ] ip5 Single-Leg RDL

### Tests

- Existing: `video.test.ts` runs `parseVideo` on every video in every tree, so a malformed link fails `npm test`.
- Existing: `translations.test.ts` keeps the Spanish tree on the same links.
- Proposed, same PR: assert that every `logWeight` skill has a `video`, so a future lift cannot ship without one.
- Manual: open each of the 10 panels in `npm run dev` and check the video plays at phone width.

### Lifts without a video

They keep today's behaviour: the search link, and the weight and personal best still log. Lifts can be merged one at a time.

## Order of work

1. Stefan answers the decisions below.
2. Stefan picks one link per lift and checks each plays in the app.
3. Stefan adds the 10 `video` lines and the presence test, then runs `npm test` and `npm run build`.
4. Enzo reviews the data PR; no screen review is needed.

## Decisions for Stefan

1. Do the 10 lifts get videos? (Recommended: yes.)
2. Do the 12 non-lift drills get videos now or later? (Recommended: later.)
3. Add the test that every lift has a video? (Recommended: yes.)

Relates to #108, #18 and #16.
