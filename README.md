# Homework To-Do

A static, installable to-do app built for homework first and usable for anything. No backend: everything lives in your browser (IndexedDB), with JSON export/import and optional GitHub Gist sync. Completing a task is supposed to feel great.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: data layer, parser, gamification
npm run check      # svelte-check (type errors)
npm run build      # type check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173/todo-list/
```

Requires Node 22+.

## Deploying to GitHub Pages

1. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs tests, builds, and publishes `dist/` to Pages.
2. In the repository settings, under **Pages**, set **Source** to **GitHub Actions** (one-time).
3. The site is served at `https://<owner>.github.io/<repo>/`. Vite's `base` is derived from the repository name in CI, so renaming the repo needs no code change. Set `VITE_BASE` to override.

## Project layout

```
src/lib/         data model, storage, parser, gamification, recurrence, sync
src/components/  reusable UI (task item, quick add, editor, toasts, ...)
src/views/       Today, Upcoming, Courses, Inbox, Focus, Stats, Settings
public/sounds/   (sounds are synthesized with WebAudio; see README there)
```

See `DECISIONS.md` for judgment calls and `CHANGELOG.md` for what landed in each phase.
