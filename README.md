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
npm run preview    # serve dist/ at http://localhost:4173/
```

Requires Node 22+. The app starts empty; use **Semester setup** (Courses view or the onboarding tour) to add your courses quickly.

## Deploying

One-click deploys for Vercel, Netlify, Render and Replit, plus Cloudflare Pages, Firebase, Surge and Docker (Fly.io, Railway, Koyeb): see **[DEPLOY.md](DEPLOY.md)**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/TitanmasterRy/todo-list)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/TitanmasterRy/todo-list)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/TitanmasterRy/todo-list)
[![Run on Replit](https://replit.com/badge/github/TitanmasterRy/todo-list)](https://replit.com/github/TitanmasterRy/todo-list)

### GitHub Pages

1. In the repository settings, under **Pages**, set **Source** to **GitHub Actions** (one time).
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes `dist/` to Pages. It can also be run by hand from the Actions tab (`workflow_dispatch`).
3. The site is served at `https://<owner>.github.io/<repo>/`. The workflow sets `GITHUB_PAGES=true`, so Vite's `base` becomes `/<repo>/` (derived from `GITHUB_REPOSITORY`; renaming the repo needs no code change). Every other host uses `/`. Set `VITE_BASE` to override (for example `/` for a user site or custom domain).

The app is a PWA: after the first visit it loads offline, and browsers offer **Install** (also available as a button in Settings). When a new version is deployed, an "Update available" toast offers a reload.

## AI helper (optional)

“Ask the tutor” and “Generate from notes” call the Anthropic API directly from your browser with a key you paste under **Settings → AI helper**. The key is stored only in localStorage and sent only to `api.anthropic.com`; you pay Anthropic for usage. Everything else in the app works without it.

## Accounts: sign up with email and password (optional)

**Settings → Account → Create account.** Type an email and a password (8+ characters) and your tasks, courses, notecards, stats and coins sync to every device you sign in on. Forgot your password? Use the link under the sign-in form. Accounts run on a free Supabase project the site admin sets up once: see [DEPLOY.md → Accounts](DEPLOY.md#accounts-email--password-sync).

## Setting up Gist sync (optional)

Gist sync keeps your data in a **private GitHub Gist** so it follows you across devices. It is off until you add a token.

1. Create a [personal access token](https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do) with only the `gist` scope. A classic token works; a fine-grained token needs Gists read/write.
2. Open **Settings → Sync**, paste the token, click **Connect**. The app verifies the token, creates a private gist named `homework-todo.json` on the first sync, and stores the gist id.
3. Do the same on another device with the same token. The existing gist is found from the stored id; on a fresh device the first sync creates a new gist, so paste the gist id from Settings on the first device if you want them to share one (it's shown as a link under Sync). The simplest path: export a backup on device A, import it on device B, then connect B with the same token.

How it syncs: on load and 2 seconds after any change (debounced). Merging is last-write-wins per task using `updatedAt`; courses, templates and day notes merge by id; stats keep the higher XP and the maximum completions per day. A conflict notice appears only if the same task was edited on two devices within the same second. The token is stored only in this browser's localStorage and is sent only to `api.github.com`. **Disconnect** removes it.

## Schoology sync

Two ways to connect, both in the **Schoology** view (`8`):

- **Sign in with API key (assignments + grades).** Schoology has no “Sign in with Schoology” for outside apps, but every user has a personal API key and secret at `app.schoology.com/api`. Paste them once; the app signs each request itself (OAuth 1.0a, in the browser) and syncs every course, assignment, due date and grade on load and every N minutes. Grades fill in scores (and pay grade XP) and course final grades.
- **Calendar feed (assignments only).** Enable the iCal feed in Schoology's calendar and paste its URL.

Schoology blocks browsers on other sites from reading either, so both need a tiny relay you own: `docs/cors-proxy-worker.js` deploys as a free Cloudflare Worker in about two minutes and only forwards to schoology.com. Without it, the feed can still be uploaded or pasted by hand.

Courses are matched by name (set **Name in Schoology** on a course to pin a match) or created automatically. Assignments with no description get an auto-generated plan and steps. Completing them here earns XP like any task; deleting one keeps it from coming back.

## Google: Gmail, Classroom, Calendar, Drive sync

Tools → Google. Create a free Google Cloud OAuth client ID (the panel walks through it), paste it in Settings, and sign in. Then: scan Gmail for assignment emails and add them as tasks with due dates; import Google Classroom coursework (done items arrive completed); push due dates to Google Calendar; and turn on **Drive sync**, which stores your data in Google Drive's app folder so signing in on another device pulls it in. This is the optional account system.

## Other integrations

- **Spotify:** Focus → Music. With a free Spotify app client ID (Settings), connect once and control playback, pick the **device** (phone, laptop, speaker), search focus playlists. Playback control needs Premium. Any Spotify, Apple Music, YouTube or SoundCloud link also plays in an embedded player, no login.
- **PowerSchool:** Tools → Grades → PowerSchool import. Students get no API, so upload or paste your saved Grades and Attendance page; grades flow into the transcript.
- **Scan paper:** Tools → Study → Scan paper. Photograph or upload worksheets and notes. AI transcription keeps headings, numbering, tables and math; free on-device OCR (Tesseract) gives plain text. Copy it, make an answer key, a study sheet, or notecards.

## AI providers

Settings → AI helper. Pick a provider and paste its key (stored only in your browser):

| Provider | Cost | Reads photos |
| --- | --- | --- |
| Google Gemini | free tier | yes |
| Groq | free tier | yes (Llama 4 Scout) |
| OpenRouter | free models available | yes |
| Ollama | free, runs on your computer | yes (vision models) |
| Anthropic Claude | paid | yes |
| OpenAI | paid | yes |
| Custom OpenAI-compatible endpoint | depends | depends |

## Adding tasks quickly

- Quick add parses natural language (below). New tasks get an **auto plan**: a short description, 2–5 steps, an estimate and a type inferred from the title and course. Toggle it per task with the “auto plan” chip, or globally in Settings.
- **Paste several lines** into quick add to create one task per line.
- Tap **🎤** to dictate (browsers with speech recognition).
- On a phone, the **+** button jumps to quick add; installed as a PWA the app also appears in the system **Share** sheet, so sharing text from any app prefills a task.

## Dopamine

XP for completing tasks scales with priority, subtasks, estimate, and how early you finish (same day ×1.1, 1–2 days ×1.25, 3+ days ×1.5), with a combo multiplier for back-to-back completions, a 5% **critical hit** for double XP, and double XP on the day's frog. Entering a **score** on a graded task pays grade XP (an A+ triggers confetti). Notecard study sessions pay XP too. Levels have titles (Freshman → Valedictorian) and unlock accent colors; 21 badges; streaks with freezes; daily ring confetti.

## Themes

Settings → Theme pack: Classic, Sleek, Cute, Arcade, Nature, Space, Paper. Each pack changes colors and corners, the completion sound pack, the particles that burst from the checkbox (hearts and stars, pixels, leaves, starfield…) and the confetti.

## Offline and never losing data

- The site is a PWA and works offline after the first visit.
- **Download offline version** (Settings → Data) saves a single HTML file that runs from a double-click with no internet: tasks, courses, notecards, calculators, timers and stats work; sync, AI and Schoology need the online app.
- **Persistent storage** asks the browser never to evict the app's data.
- **Auto-backup to a folder** (Chrome/Edge) writes a JSON copy a few seconds after every change into a folder you choose, plus one dated file per day.
- Gist sync and Google Drive sync keep copies off-device.

## Tools

The **Tools** view (`7`) is grouped into Plan, Grades, Study, Compute and Connect:

- **Notecards:** decks per course, cards typed, pasted (`term :: definition`, `Q:/A:`), or generated from notes with the optional AI helper; study with Leitner spaced repetition (boxes 1–5) and earn XP.
- **Study help:** worked examples, textbook-style explanations, links to the matching free OpenStax textbook, and 22 built-in reference sheets (algebra, trig, calculus, statistics, physics, chemistry, biology, essays, MLA/APA, study skills, units, programming, languages) plus an optional **Ask the tutor** box powered by your own Anthropic API key.
- **Calculator:** scientific calculator with functions, factorials, percent, degrees/radians, history and `ans`.
- **Graphing:** plot up to six `y = f(x)` functions, hover to trace, drag to pan, scroll to zoom.
- **Transcript:** courses by term with credits, grade, letter and GPA points; term and cumulative GPA; CSV export and print-to-PDF.
- **Quiz maker:** build question sets by hand, from an AI prompt (subject, topic, count, difficulty, question types, student or teacher mode), from pasted text, from your notes, or from a notecard deck. Export to Quizlet (paste), Blooket, Gimkit and Kahoot (CSV), a printable worksheet with answer key, notecards, or a **QTI zip that imports into Schoology tests and quizzes** (also Canvas, Moodle, Blackboard).
- **Book reader:** add PDFs (textbooks, readings) to a local library, read with page memory, bookmarks and highlights; select text to copy, make a notecard, or ask the AI to explain. Free OpenStax textbooks are linked from Study help.
- **Code editor:** CodeMirror with JavaScript, Python (runs in the browser via Pyodide), HTML/CSS live preview, Java and C++ editing; snippets saved locally.
- **Timer:** presets (25/5, 50/10, 90/20, 15/3), a custom-minutes timer and a stopwatch that logs work time.

- **Plan my day:** set how many minutes of homework you can do per day, see today's committed time against it and the load for the next 7 days, and pull upcoming tasks into Today without moving their deadlines ("Auto-fill free time" does it for you).
- **Grades:** weighted grade calculator per course. Give tasks a weight % and a score %, see your current average and letter, the possible final range, and what you need on the remaining work to hit a target. Upcoming exams and quizzes show a countdown.
- **Reading time:** pages (or words) × pace → minutes and pomodoros, then create the reading task with the estimate filled in.
- **Calendar export:** download an `.ics` of due dates for Google, Apple, or Outlook calendars; exams get a one-day-before reminder.

## Keyboard shortcuts

Press `?` in the app for the sheet.

| Key | Action |
| --- | --- |
| `n` | New task (focus quick add) |
| `/` | Search (Inbox) |
| `Ctrl/⌘ K` | Command palette |
| `Ctrl/⌘ Z` | Undo last action |
| `1` – `9` | Today, Upcoming, Courses, Inbox, Focus, Stats, Tools, Schoology, Play |
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
src/views/       Today, Upcoming, Courses, Inbox, Focus, Stats, Tools, Schoology, Play, Settings
src/lib/casino/  casino game rules (slots, blackjack, roulette, poker, baccarat, craps, quick games)
public/games/    built-in arcade games + games.json manifest (add your own here)
public/sounds/   sounds are synthesized with WebAudio; drop files here to swap in samples
```

See `DECISIONS.md` for judgment calls and `CHANGELOG.md` for what landed in each phase.
