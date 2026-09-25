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
npm run lint       # ESLint
npm run format     # Prettier (CI runs format:check)
npm run e2e        # Playwright end-to-end + accessibility tests (npx playwright install chromium first)
npm run size       # first-load bundle budget (after a build)
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

“Ask the tutor” and “Generate from notes” call the Anthropic API directly from your browser with a key you paste under **Settings → AI helper**. The key is stored only in this browser (encrypted if you lock your keys) and sent only to `api.anthropic.com`; you pay Anthropic for usage. Everything else in the app works without it.

## Privacy and security

Local-first, no analytics, no server of its own: **[PRIVACY.md](PRIVACY.md)** lists what each optional feature sends where (also in **Settings → Privacy & security**). In the same section:

- **Lock my keys with a passphrase:** API keys and tokens are stored encrypted (AES-256-GCM, PBKDF2 key). The passphrase is asked once per session: at startup if a sync needs a key, otherwise the first time you use a feature that does.
- **End-to-end encrypt my synced copy:** Gist, Drive and account copies are encrypted in the browser with a sync passphrase, so those services only see ciphertext. Old plain copies still read; the next sync writes an encrypted one. Forgetting the passphrase means the synced copy can't be read (your devices keep their data).
- **Delete everything** (Settings → Data) also offers to delete the gist, the Drive file and the account's server copy, and reports each result.

The production build ships a Content-Security-Policy with no inline scripts (see DEPLOY.md).

## Accounts: sign up with email and password (optional)

**Settings → Account → Create account.** Type an email and a password (8+ characters) and your tasks, courses, notecards, stats and coins sync to every device you sign in on. Forgot your password? Use the link under the sign-in form. Accounts run on a free Supabase project the site admin sets up once: see [DEPLOY.md → Accounts](DEPLOY.md#accounts-email--password-sync).

## Setting up Gist sync (optional)

Gist sync keeps your data in a **private GitHub Gist** so it follows you across devices. It is off until you add a token.

1. Create a [personal access token](https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do) with only the `gist` scope. A classic token works; a fine-grained token needs Gists read/write.
2. Open **Settings → Sync**, paste the token, click **Connect**. The app verifies the token, creates a private gist named `homework-todo.json` on the first sync, and stores the gist id.
3. Do the same on another device with the same token. The existing gist is found from the stored id; on a fresh device the first sync creates a new gist, so paste the gist id from Settings on the first device if you want them to share one (it's shown as a link under Sync). The simplest path: export a backup on device A, import it on device B, then connect B with the same token.

How it syncs: on load and 2 seconds after any change (debounced). Merging is last-write-wins per task using `updatedAt`; courses, templates and day notes merge by id; stats keep the higher XP and the maximum completions per day. A conflict notice appears only if the same task was edited on two devices within the same second. The token is stored only in this browser (encrypted if you lock your keys) and is sent only to `api.github.com`. **Disconnect** removes it. Turn on end-to-end encryption (Settings → Privacy & security) and the gist only ever holds an encrypted copy.

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
- **Canvas:** Tools → Connect → Canvas. Paste your Canvas Calendar Feed link; assignments sync every 30 minutes into matching courses, with a link back to Canvas. Goes through the same CORS relay as Schoology (see DEPLOY.md).
- **Browser extension:** `extension/` adds the page you're on (or a link or selected text) as a task: toolbar button, right-click menu or Alt+Shift+H. Load it unpacked, or `npm run pack:extension` for the stores.
- **Scan paper:** Tools → Study → Scan paper. Photograph or upload worksheets and notes. AI transcription keeps headings, numbering, tables and math; free on-device OCR (Tesseract) gives plain text. Copy it, make an answer key, a study sheet, or notecards.

## Study rooms, friends and class mode (no server needed)

- **Study room** (Focus → 👥 Study room): create a shared Pomodoro (focus, break, long break every N rounds, optional number of rounds, start now or in a few minutes) and send the link. Anyone who opens it joins: the link holds the room's name, start time and lengths, and every device works out the same phase and time left from its own clock, so it needs no server and works offline. It chimes (and notifies, when the tab is in the background) at every change and counts a pomodoro for each focus round you were there for. The app can't see who else joined; with an account on a site that has one, **Show who's in** shares the name you type with the others in the room over Supabase Realtime (nothing is stored).
- **Friends** (Stats → Friends): swap friend codes (or links) to compare streaks and this week's XP on a small leaderboard. A code holds only your name, emoji, streak, best streak, this week's XP, level and when you made it; the list shows how old each card is and nudges you to swap fresh ones. With an account, **Keep my card live** stores just that card in one row under a random id, so friends see it update.
- **Class mode** (Tools → Connect → Class mode): a teacher picks a course and publishes its assignments (title, due date, type, notes if ticked, link; never grades or stats) as a `.json` class list, an `.ics` calendar, or, with a Gist token, a public gist that **Update** re-publishes. Students paste the link (or open the app link the teacher shares) and press **Subscribe**: the course is created if needed and the assignments arrive like Schoology's, refreshed each time the app opens. Unsubscribe keeps or removes the open ones. Gist links always work; other hosts must allow cross-site reads (CORS) and be allowed by the site's security policy (`VITE_CSP_CONNECT`), or students can import the downloaded file.

Friends, subscriptions and rooms are kept on this device (localStorage), not in the synced data; the tasks a class list adds sync like any other task.

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

## Planning

- **What should I do now?** (`w`, or the 🧭 button on Today) picks the best next task from deadlines, priority, grade weight, exams coming up, your frog, repeat snoozes and the time you have left, shows why, and starts it in Focus.
- **Upcoming → Month** shows a calendar of due dates with course colors. Arrow keys move between days; pick a day to see its tasks and add to it.
- **Keyboard rescheduling:** select a task (`j`/`k`) and press `[` or `]` to move it a day earlier or later.
- **Plan it out** (task editor) splits a big task into dated milestones working back from the due date, each waiting on the one before, or spaces exam study sessions before a test with a Study button that opens the linked notecard deck.
- **Course boards:** switch a course page to **Board** for To do / Doing / Done columns (drag cards or use the arrow buttons).
- **Files on tasks:** attach photos, PDFs and documents in the task editor. Files stay on the device (big photos are shrunk); other devices see the names.
- **Break mode** (Settings → Goals) pauses your streak during school breaks.
- **Print week** (Upcoming) prints a one-page weekly planner, or saves it as a PDF.
- **Timetable** (Tools → Timetable): bell schedules, A/B or day 1–4 rotations, classes with rooms, and days off. Today shows what's on now and what's next, the task editor offers "Next class" as a due date, and you can track attendance.
- **Syllabus box** (Tools → Syllabus box): paste a syllabus and add its dated work (and breaks) in one go.
- **Grades:** per-course trend charts, "what if" scores and custom letter scales (Tools → Grade calculator).
- **Export and import:** Settings → Data exports CSV (for spreadsheets) and Markdown (checklists by course), and imports CSV from this app, Todoist or any spreadsheet with a title column.

## Accessibility

Settings → Appearance: high-contrast mode, reading fonts (Atkinson Hyperlegible, Lexend, OpenDyslexic, bundled so they work offline), text size up to 140%, reduced motion, and a separate switch for confetti and sparkle bursts. Every view is checked with axe in light and dark mode on each pull request, and every theme pack passes WCAG AA text contrast.

## Adding tasks quickly

- Quick add parses natural language (below). New tasks get an **auto plan**: a short description, 2–5 steps, an estimate and a type inferred from the title and course. Toggle it per task with the “auto plan” chip, or globally in Settings.
- **Paste several lines** into quick add to create one task per line.
- Tap **🎤** to dictate (browsers with speech recognition). Speech becomes quick-add syntax: "add read chapter four for tomorrow at three thirty p.m., high priority, it takes forty five minutes" → `read chapter 4 tomorrow at 3:30pm !high ~45m`.
- On a phone, the **+** button jumps to quick add; installed as a PWA the app also appears in the system **Share** sheet, so sharing text from any app prefills a task, and sharing a file (a PDF, a photo of a worksheet) offers to open it in the Book reader or attach it to a new task.

## Dopamine

XP for completing tasks scales with priority, subtasks, estimate, and how early you finish (same day ×1.1, 1–2 days ×1.25, 3+ days ×1.5), with a combo multiplier for back-to-back completions, a 5% **critical hit** for double XP, and double XP on the day's frog. Entering a **score** on a graded task pays grade XP (an A+ triggers confetti). Notecard study sessions pay XP too. Levels have titles (Freshman → Valedictorian) and unlock accent colors; 21 badges; streaks with freezes; daily ring confetti.

## Coins, shop, casino and arcade

The **Play** view (`9`) turns schoolwork into a currency. Everything here is play money: nothing can be bought with cash, and nothing can be cashed out. Turn it all off (or just the casino) in **Settings → Economy**.

- **Coins 🪙** come only from schoolwork: finishing tasks (about XP ÷ 5), closing the daily ring, streak milestones, the first grade entered on a task, notecard study sessions, Pomodoros and level-ups. Undoing a completion takes its coins back.
- **Shop:** chip packs for the casino, arcade vouchers, streak freezes, a coin booster, and cosmetics (titles next to your level, level-card frames, confetti styles). The **prize counter** sells casino trophies for chips.
- **Casino 🎰:** Slots (symbols follow your theme pack), Blackjack, Roulette, Video poker, Baccarat, Craps, Hi-Lo, Plinko, Keno, Mines, Dice, Big Six and Scratch cards. Chips are bought with coins and never turn back into coins. Each game shows its odds, and a homework-break reminder pops up after 20 minutes (configurable). Closing your daily ring also gives 100 free chips.
- **Arcade 🕹️:** spend vouchers on games. Sixteen are built in: Minesweeper, 2048, Memory match, Snake, Leaf catcher, Asteroids, Word search, Breakout, Sudoku, Hangman, Lights Out, Typing defense, Solitaire, Invaders, Lunar lander and Paper-plane glider (the word games use words from your notecards). **Site admins add more** by putting an HTML file in `public/games/` or an embed link in `public/games/games.json` (see [`public/games/README.md`](public/games/README.md)), or try them first in **Settings → Arcade admin**. Games run in a sandbox that can't see your data, and can report high scores.
- **Study games 🧠:** free games built on your notecard decks. **Boss battle** asks each card as four-choice multiple choice (right answers hit the boss, wrong ones cost hearts, three boss phases); **Match rush** has you match terms to definitions against the clock and keeps your best time per deck; **Crossword** builds a printable crossword from a deck's short answers (check/reveal letters, best time per deck); **Quiz race** runs ten quick multiple-choice questions from a deck or a Quiz maker set against the ghost of your best run. They don't change when cards are due.
- **Star map 🌌:** every day you finished a task lights a star in a year or semester sky, and days in a row join into constellations (with a text summary and a month table).
- **Daily quests:** three small goals a day (finish 3 tasks, clear an overdue task, do a Pomodoro…) with coins to claim and a bonus for all three. The shop also has a **deal of the day** at 30% off, and the casino has **achievements** that pay chips.
- **Parent lock:** Settings → Economy → set a PIN to lock the casino switch, reminders and an optional **daily casino time limit**. It lives in this browser: a speed bump, not a security system.
- The wallet is a ledger of entries, so it syncs through your account, Gist or Drive without double-counting.

## Themes

Settings → Theme pack: Classic, Sleek, Cute, Arcade, Nature, Space, Paper. Each pack changes colors and corners, the completion sound pack, the particles that burst from the checkbox (hearts and stars, pixels, leaves, starfield…) and the confetti.

## Offline and never losing data

- The site is a PWA and works offline after the first visit.
- **Download offline version** (Settings → Data) saves a single HTML file that runs from a double-click with no internet: tasks, courses, notecards, calculators, timers and stats work; sync, AI and Schoology need the online app.
- **Persistent storage** asks the browser never to evict the app's data.
- **Auto-backup to a folder** (Chrome/Edge) writes a JSON copy a few seconds after every change into a folder you choose, plus one dated file per day.
- Gist sync and Google Drive sync keep copies off-device. When two devices edit the same task, each field keeps its newest change, so a due date moved on your phone and notes added on your laptop both survive.
- **Notifications** go through the service worker, the installed app's icon shows today's count, and installed Chrome/Edge apps get a morning digest in the background (periodic sync). Exact-time reminders need the app open.

## Tools

The **Tools** view (`7`) is grouped into Plan, Grades, Study, Compute and Connect:

- **Notecards:** decks per course, cards typed, pasted (`term :: definition`, `Q:/A:`), or generated from notes with the optional AI helper; study with Leitner spaced repetition (boxes 1–5) and earn XP.
- **Study help:** worked examples, textbook-style explanations, links to the matching free OpenStax textbook, and 22 built-in reference sheets (algebra, trig, calculus, statistics, physics, chemistry, biology, essays, MLA/APA, study skills, units, programming, languages) plus an optional **Ask the tutor** box powered by your own Anthropic API key.
- **Essay tools:** word, character, sentence and page counts, reading and speaking time, readability grade, most-used and filler words, long and passive sentences, and a word goal.
- **Citations:** MLA 9, APA 7 and Chicago for web pages, articles and books; paste a DOI or ISBN to fill it in; copy a sorted works-cited list with italics.
- **Unit converter:** length, mass, volume, temperature, time, speed, area, energy, pressure and data.
- **Calculator:** scientific calculator with functions, factorials, percent, degrees/radians, history and `ans`.
- **Graphing:** plot up to six `y = f(x)` functions, hover to trace, drag to pan, scroll to zoom.
- **Transcript:** courses by term with credits, grade, letter and GPA points; term and cumulative GPA; CSV export and print-to-PDF.
- **Quiz maker:** build question sets by hand, from an AI prompt (subject, topic, count, difficulty, question types, student or teacher mode), from pasted text, from your notes, or from a notecard deck. Export to Quizlet (paste), Blooket, Gimkit and Kahoot (CSV), a printable worksheet with answer key, notecards, or a **QTI zip that imports into Schoology tests and quizzes** (also Canvas, Moodle, Blackboard).
- **Book reader:** add PDFs (textbooks, readings) to a local library, read with page memory, bookmarks and highlights; select text to copy, make a notecard, or ask the AI to explain. Free OpenStax textbooks are linked from Study help.
- **Practice test:** take a Quiz maker set like a real test (optional time limit and shuffle), get it graded (short answers forgive small typos), review explanations, turn misses into notecards, and see your scores over time.
- **Periodic table:** all 118 elements colored by block, a highlight for any category, details with electron configuration, a molar mass calculator with % composition, and notecards for any group of elements.
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
| `w` | What should I do now? (best next task and why) |
| `[` / `]` | Move selected task a day earlier / later |
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
src/lib/store/   store method groups (planning, courses and templates, notecards, imports) merged into the store
src/lib/social/  study rooms, friends and class mode on this device (lazy; lib/studyroom.ts, friends.ts, classlist.ts hold the pure logic)
src/components/  task item, checkbox, quick add, editor, sortable list, toasts, feedback layer, palette, dialogs (social/: study room, friends, class mode)
src/views/       Today, Upcoming, Courses, Inbox, Focus, Stats, Tools, Schoology, Play, Settings
src/lib/casino/  casino game rules (slots, blackjack, roulette, poker, baccarat, craps, quick games)
public/games/    built-in arcade games + games.json manifest (add your own here)
public/sounds/   sounds are synthesized with WebAudio; drop files here to swap in samples
```

See `DECISIONS.md` for judgment calls and `CHANGELOG.md` for what landed in each phase.
