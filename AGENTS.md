# Notes for coding agents

Read this before changing the code, whether you're a person, a hosted assistant or a local model. Setting up a local model
with LM Studio is covered in [LOCAL_LLM.md](LOCAL_LLM.md).

## The project

- **Homework To-Do:** a static PWA with no server of its own. It's built with Svelte 5 (runes: `$state`, `$derived`,
  `$effect`, `$props`), Vite and TypeScript, and stores its data in IndexedDB through `idb`.
- **Store:** `src/lib/store.svelte.ts` plus method groups in `src/lib/store/*.svelte.ts`, merged with
  `Object.assign(Store.prototype, …)`.
- **Views** live in `src/views/`, **components** in `src/components/`, and **pure logic** in `src/lib/*.ts`, each with a
  `*.test.ts` next to it.
- **Text:** all UI text goes through `t('key')` from `src/lib/i18n/index.svelte`. Add every new key to both
  `src/lib/i18n/en.ts` and `src/lib/i18n/es.ts`. The Play area is English-only for now.
- **Security:**
  - The production build ships a Content-Security-Policy (`src/lib/csp.ts`). A new outside host must be added there,
    with a test.
  - Untrusted HTML runs only in the sandbox (`src/components/SandboxFrame.svelte`).
- **Arcade games** are single HTML files in `public/games/`, listed in `games.json`. `public/games/README.md` describes
  how games talk to the app: scores, saves and coin power-ups.

## Before every commit

```sh
npx prettier --write .                  # formatting (CI checks the whole tree)
npx eslint src tests scripts vite.config.ts
npx svelte-check --threshold warning    # 0 errors, 0 warnings
npx vitest run                          # unit tests
npx vite build && node scripts/check-size.mjs   # first-load JS must stay under 125 kB gzipped
npx playwright test                     # browser tests (needs `npx playwright install chromium` once)
```

CI runs the same checks, plus Lighthouse, on every pull request.

## Rules

- **Keep the first-load bundle small.** New screens and big features are lazy-loaded with `import()`, following the
  patterns in `src/App.svelte` and `src/views/PlayView.svelte`.
- **Don't change casino odds or payouts** without updating their tests. Coins come only from schoolwork; anything that
  gives coins needs a daily cap.
- **Keep the style.** Match the code around what you change: short comments that say why, no dead code, no
  `console.log`.
- **Tests:**
  - Add unit tests for logic and a Playwright test for new UI; `tests/e2e/helpers.ts` has `openApp()`, which fails on
    console errors.
  - Never skip or delete a test to get green.
- **Docs:** update `CHANGELOG.md` for user-facing changes. A new `## ` heading there opens the in-app patch notes on every
  device, so add one per release, not per commit.
- **Work on a branch and open a pull request.** Don't push to `main`: `main` deploys the live site.
