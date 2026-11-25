# Strength tree side panel (plan for #107)

Status: built in this PR (#110); the decisions for Stefan below still stand.

## Goal

Open the Strength tree (the weights tree, `id: "weights"`) from a side panel that slides out, as #18 decided. Football stays the main tree.

## What exists

- `src/App.tsx` builds `treeChoices` with `treeSummaries` (`src/lib/activeTree.ts`) and passes them to `AreasScreen`, which renders `TreeSwitch` (`src/components/TreeSwitch.tsx`): a tablist with one pill per tree. It renders nothing when there is only one tree.
- `switchToTree` in `App.tsx` waits up to 3 seconds for the cloud save, then calls `switchTree`. That saves the id and reloads the page. `App.tsx` reads the active tree once at mount, so the panel must switch the same way.
- Today the tree choice is reached from the Areas tab (bottom bar on phones, sidebar on laptops) and from the `.area-pill` at the top of Train, which opens Areas.
- Laptops (701 to 1499px) have a 72px icon sidebar (`src/nav.css`, line 290). The skill panel is 280px wide from 861px (`nav.css`, line 296).
- `src/lib/areaSlide.ts` has `slideIn`: 260 ms, 48px, skipped under `prefers-reduced-motion`. Its test covers only `slideDirection`, so the reduced-motion branch has no test.
- `src/components/useModalFocus.ts` focuses the first button on open, keeps Tab inside, closes on Escape and gives focus back to the opener. `AccountDialog.tsx` uses it with a `.overlay` backdrop that closes on click.
- `SkillPanel.tsx` closes on Escape only when no `.overlay` is open, so a new overlay panel will not also close the skill sheet.
- Strings: `t.treeSwitch` in `src/i18n/en.ts` (line 176) and `src/i18n/es.ts` (line 170). Strength's tagline is in `src/data/weights.ts` and `src/data/es/weights.ts`, so no new copy is needed for it.

## Decisions already made

- Strength is its own tree, not a branch inside Football (#18).
- It opens from a side panel that slides out (#18).
- Respect reduced motion, like the area slide in #106 (#107).

## Design

### 1. Where the handle lives

The dialog is rendered with `createPortal` on `document.body`, not inside `.switcher`: on phones `.switcher` is sticky (`z-index: 2`) and has `backdrop-filter`, which would make it the containing block of a `position: fixed` overlay and shrink the overlay to the strip. Only the handle stays in the header.

Recommendation: one "Strength" button in the Train header, in a row with the area pill (`.area-row`, inside `.switcher`), on both phones and laptops. It is the screen a player is on when they want to train, and it needs no edge tab. An edge tab would sit on top of the tree's horizontal scroll and is harder to hit at 44px. Layout only (element bounding boxes, no screenshots) was measured in headless Chromium at 320x568, 375x812, 390x844, 812x375 and 1280x800: the handle sits beside the pill at every size, is 44px high on touch and 36px on desktop, and the page has no horizontal scroll. The panel itself, the slide animation and a real phone have not been checked.

### 2. What the panel lists

Recommendation: only Strength, with its done count and rank from `treeSummaries`, and one button to open it. Football is the default and stays in the Areas switch.

### 3. Switching

The panel gets the same `switchToTree` callback as `TreeSwitch`, so the save-flush and the reload are shared, not copied. The button shows `aria-busy` while the reload is pending, as the pills do. Nothing animates on switch, because the page reloads.

### 4. Animation

Add a slide-out helper next to `slideIn` in `areaSlide.ts`: the panel moves in from the right on open and back out on close, with the same duration and easing. Under reduced motion it appears and disappears at once. Add tests for both branches of `slideIn` and the new helper, and stub `matchMedia` and `element.animate`.

### 5. Focus, Escape and close

The panel is a modal dialog (`role="dialog"`, `aria-modal="true"`) with `.overlay`, so it uses `useModalFocus`. Focus lands on the Strength button when it opens. On close it goes back to the handle through a ref kept in `StrengthPanel`, because Safari does not focus a button on click and `document.activeElement` at mount would be `<body>`. Escape and a backdrop tap close it. Because it is a modal, Tab stays inside it while open.

### 6. Strings

A new `t.strengthPanel` block in `en.ts` and `es.ts` (handle label, panel title, close label, open button, busy label). The `en.test.ts` and `es.test.ts` key checks must pass.

### 7. Tests

- `StrengthPanel.test.tsx`: opens with focus on the button, Tab stays inside, Escape closes and restores focus, picking Strength calls `onSwitch` once, and the handle is hidden when there is one tree.
- `areaSlide.test.ts`: `slideIn` and the new helper do nothing under reduced motion and when the direction is 0.

### 8. Files

- New: `src/components/StrengthPanel.tsx`, `src/components/StrengthPanel.test.tsx`.
- Changed: `src/App.tsx` (only the `StrengthPanel` element and the `.area-row` wrapper; the open state lives in `StrengthPanel`, not in `App`), `src/nav.css` (panel and handle styles), `src/lib/areaSlide.ts` and its test, `src/i18n/en.ts`, `src/i18n/es.ts`.
- Not changed: `src/data/*`, `src/lib/activeTree.ts`, Supabase migrations. No data or migration work is expected.

## Order of work

One branch and one PR, owned by Enzo for the screens:

1. Slide helper and its tests (`areaSlide.ts`).
2. Strings in EN and ES.
3. Panel component, its tests, and the handle in `App.tsx`.

## Decisions for Stefan

1. Does the panel replace the Areas switch or sit beside it? Recommendation: sit beside it. Replacing it removes the only place both trees can be compared. Beside it means two ways to reach Strength, which is acceptable because both call the same switch.
2. Should the panel list only Strength? Recommendation: yes, see section 2.
3. Keep the reload on switch? Recommendation: yes. Changing the switch is out of scope for #107.

Relates to #18 and #106.
