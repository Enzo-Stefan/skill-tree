# hapi skill

Learn a hobby the way you level up in a game. Each skill has a drill, a clear test and a tip. Pass the test, unlock the next skill.

The first tree is football: 32 skills across Ball Control, Passing, Dribbling, Shooting, Defending and Fitness.

## Run it

```bash
npm install
npm run dev     # open the link it prints
npm test        # checks the trees and the progress rules
npm run build   # production build in dist/
```

## How the code is split

```
src/
  types.ts          The contract. Both sides agree before changing it.
  data/             Tree content (football.ts) and the list of trees
  lib/progress.ts   Rules: what is locked, ranks, player levels, saving, validation
  components/       What you see: tree, skill panel, header
  App.tsx           Wires the rules to the screen
  index.css         Styles
```

## Who owns what

**Content and logic (Stefan):** `src/data/`, `src/lib/`, `src/types.ts`

- Improve the football tree. Test the drills with teammates and fix numbers that are too easy or too hard.
- Add a second tree so the app supports more than one hobby.
- Add a tree picker to the data layer (which tree is active, progress per tree).
- Later: accounts and cloud saving, so progress follows you across devices.

**Interface and launch (partner):** `src/components/`, `src/App.tsx`, `src/index.css`

- Make the tree work well on phones (pinch to zoom, or a vertical layout).
- Animations when a skill unlocks or the rank changes.
- A "share my tree" image people can post.
- Deploy to Vercel or GitHub Pages so anyone can open a link.

Each of you works mostly in your own folders, so you rarely edit the same file. If you need to change `types.ts`, say so in the pull request.

## Workflow

1. Never push straight to `main`.
2. Make a branch per task: `git checkout -b add-guitar-tree`.
3. Push it and open a pull request.
4. The other person reviews and merges. GitHub runs the tests and build on every pull request.
5. Pull `main` before starting new work: `git pull origin main`.

## Adding a new tree

1. Copy `src/data/football.ts` to a new file and change the content.
2. Add it to the list in `src/data/index.ts`.
3. Run `npm test`. It catches duplicate ids and skills that point to missing skills.

## Accounts (Google sign-in)

Accounts use Supabase. Without the two keys below the app runs exactly as before and the Sign in button is hidden.

1. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. In Vercel, add the same two variables for Production and Preview, then redeploy (Vite reads them at build time).
3. In Supabase, turn on the Google provider and add the production URL and the preview-link pattern under Authentication, URL Configuration.

The shared client is `src/auth/client.ts` and the sign-in state is `useAuth()` in `src/auth/useAuth.ts`.
