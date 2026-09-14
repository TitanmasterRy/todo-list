# Homework To-Do

A static, installable to-do app built for homework first and usable for anything. No backend: everything lives in your browser (IndexedDB), with JSON export/import and optional GitHub Gist sync. Completing a task is supposed to feel great, so the completion animation, sounds, streaks, XP and confetti are the point, not decoration. All of it can be muted, reduced, or hidden in Settings.

**Stack:** Vite · Svelte 5 · TypeScript · plain CSS variables · `idb` · `vite-plugin-pwa` · Vitest.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: data layer, parser, gamification, recurrence, backup merge, markdown
npm run check      # svelte-check (type errors)
npm run build      # type check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173/todo-list/
```

Requires Node 22+. The app starts empty; use **Semester setup** (Courses view or the onboarding tour) to add your courses quickly.

## Deploying to GitHub Pages

1. In the repository settings, under **Pages**, set **Source** to **GitHub Actions** (one time).
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` to Pages. It can also be run by hand from the Actions tab (`workflow_dispatch`).
3. The site is served at `https://<owner>.github.io/<repo>/`. Vite's `base` is derived from the repository name in CI (`GITHUB_REPOSITORY`), so renaming the repo needs no code change. Set `VITE_BASE` to override (for example `/` for a user site or custom domain).

The app is a PWA: after the first visit it loads offline, and browsers offer **Install** (also available as a button in Settings). When a new version is deployed, an "Update available" toast offers a reload.

## Setting up Gist sync (optional)

Gist sync keeps your data in a **private GitHub Gist** so it follows you across devices. It is off until you add a token.

1. Create a [personal access token](https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do) with only the `gist` scope. A classic token works; a fine-grained token needs Gists read/write.
2. Open **Settings → Sync**, paste the token, click **Connect**. The app verifies the token, creates a private gist named `homework-todo.json` on the first sync, and stores the gist id.
3. Do the same on another device with the same token. The existing gist is found from the stored id; on a fresh device the first sync creates a new gist, so paste the gist id from Settings on the first device if you want them to share one (it's shown as a link under Sync). The simplest path: export a backup on device A, import it on device B, then connect B with the same token.

How it syncs: on load and 2 seconds after any change (debounced). Merging is last-write-wins per task using `updatedAt`; courses, templates and day notes merge by id; stats keep the higher XP and the maximum completions per day. A conflict notice appears only if the same task was edited on two devices within the same second. The token is stored only in this browser's localStorage and is sent only to `api.github.com`. **Disconnect** removes it.

## Keyboard shortcuts

Press `?` in the app for the sheet.

| Key | Action |
| --- | --- |
| `n` | New task (focus quick add) |
| `/` | Search (Inbox) |
| `Ctrl/⌘ K` | Command palette |
| `Ctrl/⌘ Z` | Undo last action |
| `1` – `6` | Today, Upcoming, Courses, Inbox, Focus, Stats |
| `?` | Shortcut sheet |
| `Esc` | Close dialog / clear selection |
| `j` / `k` (or arrows) | Move selection down / up |
| `Enter` / `e` | Open / edit selected task |
| `Space` | Complete selected task (in Focus: start/pause timer) |
| `s` | Snooze menu |
| `x` | Toggle bulk selection |
| `f` | Focus on selected task |
| `Delete` | Delete selected task |
| Shift + click | Select a range |

### Quick add syntax

`Read ch 4 tomorrow 8pm #calc !high ~45m`

- Dates: `today`, `tomorrow`, `mon` / `monday`, `next fri`, `in 3 days`, `in 2 weeks`, `9/21`, `sep 21`, `21 sep`, `2026-10-02`
- Times: `8pm`, `8:30pm`, `at 14:00`, `noon`, `midnight` (a time without a date means today, or tomorrow if it already passed)
- `#word` matches a course name first (exact, then prefix), otherwise becomes a tag
- `!low` `!high` `!urgent` (also `!p1`–`!p4`), `~30m` `~2h` `~1h30m` for estimates
- `every day`, `every mon wed`, `every 3 days`, `weekdays`, `weekly`
- `@templatename` creates a task from a saved template (save one from the task editor)
- `type:exam` (also `reading`, `project`, `quiz`, `homework`, `other`)

## Project layout

```
src/lib/         types, storage (IndexedDB), store, dates, parser, recurrence, gamification, backup, gist sync, sounds
src/components/  task item, checkbox, quick add, editor, sortable list, toasts, feedback layer, palette, dialogs
src/views/       Today, Upcoming, Courses, Inbox, Focus, Stats, Settings
public/sounds/   sounds are synthesized with WebAudio; drop files here to swap in samples
```

See `DECISIONS.md` for judgment calls and `CHANGELOG.md` for what landed in each phase.
