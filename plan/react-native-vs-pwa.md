# React Native (Expo) vs. staying an installable PWA

Issue #128, item 5. Evaluation only, nothing is built.

## Recommendation

Stay on the PWA for now. It already installs, works offline (see below) and ships on merge. Revisit a native app only when we have a feature the web cannot do well (reliable push on iOS for non-installed users, widgets, health data) or when store presence becomes a growth goal. If we do go native, use Expo and budget about 10 to 14 weeks for two people.

## What we have today

- React 19 + Vite, `vite-plugin-pwa` with a precached shell. About 7,900 lines of logic in `src/lib` and the data in `src/data`, plus 34 screen/component files in `src/components`.
- Offline: the app shell, trees, routines and test mode are bundled in the JS and precached. Checked in real Chrome with the network cut: the shell, a skill panel and the Training tab open. Videos are never cached; the panel says so.
- Supabase for cloud sync and Google sign-in (redirect flow with `window.location.origin`).

## Effort (two people, honest)

| Piece | Weeks |
|---|---|
| Expo project, navigation, theming, fonts, icons, splash | 1 |
| Rebuild ~34 screens/dialogs in React Native (tree view with pan/zoom or SVG, bottom sheet, test mode, charts, share image) | 4 to 6 |
| Storage layer: swap `localStorage` for AsyncStorage/MMKV (async API changes every hook that reads it) | 1 to 1.5 |
| Auth: native Google sign-in (`expo-auth-session` or Google Sign-In module) wired to Supabase, deep links, delete account | 1 to 1.5 |
| Notifications, ICS/file export and sharing via native modules | 1 |
| Offline sync QA on real devices, Android and iOS differences | 1 to 2 |
| Store setup: accounts, privacy forms, screenshots, review rounds, fixes | 1 to 2 |
| **Total** | **10 to 14** |

Both of us would also stop shipping web features for most of that time unless we keep two UIs in parallel, which doubles every later change. Estimates are mine, not measured; the screen rebuild is the biggest unknown.

## Reuse

Reusable almost as is (pure TypeScript, no DOM): `src/lib` rules (progress, XP, streak, plan, sync, results, challenge), `src/data` trees and routines, `src/i18n` strings, `src/types.ts`, and the Supabase client and queries. This is the valuable part, and a monorepo or shared package keeps it in one place.

Not reusable:
- React DOM components and all CSS (`index.css`, `nav.css`, `tree.css`): every screen is rewritten with React Native views and StyleSheet.
- `localStorage` use (14 files) and anything touching `window`, `document`, `navigator.onLine`, Blob downloads and the Web Share API.
- The Google sign-in redirect flow (`signInWithOAuth` with `redirectTo: window.location.origin`): native needs a deep-link or native sign-in flow.
- The service worker and web manifest: replaced by the app bundle and the OS install.
- Share image (canvas) and the ICS download: need native equivalents (`react-native-view-shot`, `expo-sharing`, `expo-file-system`).

## Store costs and review

- Apple Developer Program: 99 USD per year (confirmed on Apple's enrollment help pages). Fee waivers exist for some nonprofits, schools and governments.
- Google Play: one-time 25 USD registration. I only found this in secondary sources, not on Google's own page in my search, so please check it in Play Console before relying on it.
- Both stores take a commission only if we sell things in the app; we do not today. I did not research the commission rules and did not confirm current prices in other currencies.
- Review: Apple reviews every build and every update (often a day or two, longer when rejected). A "web app in a wrapper" with no native value can be rejected under Apple's minimum functionality guideline (4.2), which is another reason the native app would need real native features. Google reviews too, and new personal developer accounts may have extra testing requirements before production release; check the current rule. Both need a privacy policy (we have `privacy.html`) and data-safety forms, and account deletion in-app (we have it).

## Push notifications

- PWA: web push works on Android Chrome. On iOS it works only after the user adds the app to the Home Screen, from iOS 16.4. Many players will not install it, so reminders would reach only part of them. We would also need our own push server (VAPID keys, a function that sends), which does not exist yet.
- Expo: `expo-notifications` plus Expo's push service works for every installed user on both platforms, and permission prompts are standard. Needs Apple push credentials (covered by the paid developer account) and a Firebase project for Android.
- Local reminders (for example "train today") can be scheduled on the device in native without a server at all. This is the single clearest native advantage for a habit app.

## Offline

PWA is already good: shell, trees, routines, test mode and the weekly plan work with no signal, state is in `localStorage` and syncs when signed in. Limits: iOS can clear site storage for apps not used for a while, and videos need internet in both options.
Native stores the app itself on the device, so it is slightly more durable, but we would still have to rebuild the offline sync queue on top of AsyncStorage. No big offline win for us.

## Update speed

- PWA: a merge to main deploys, the service worker picks up the new version on next visit (`autoUpdate`). Hours, no gatekeeper.
- Native: store review for binaries, usually a day or two, sometimes more. Expo's over-the-air updates (EAS Update) can ship JS-only fixes without review, but not native changes, and cost extra at scale.

## Decision guide

Stay PWA while: the game loop is the product, we are two people, shipping weekly matters, and reminders are a nice to have.
Go Expo when: reminders or widgets drive retention, we want a store listing for trust or discovery, or we see iOS users unable or unwilling to install the PWA.
Cheaper middle step first: make the install prompt clearer (especially iOS "Add to Home Screen" help), add web push for Android, and measure how many players install. A Capacitor wrapper around the existing build is a possible 2 to 3 week shortcut to a store listing, but it brings the Apple 4.2 risk above and I did not evaluate it deeply.

## What I could not confirm

Current Google Play fee on Google's own page, store commission details, new-account testing rules on Play, and exact Apple review times. All effort numbers are estimates.
