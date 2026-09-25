# Changelog

## Roadmap pass 6: languages, sharing, practice tests, Canvas, smarter sync

- **Languages:** Spanish (Settings → Language, or Auto), including Spanish dates in quick add ("leer capítulo 3 mañana a las 5 !alta"); dates and numbers follow your region; right-to-left layout support.
- **Smarter sync:** tasks remember when each field changed, so edits to different fields on two devices both survive.
- **Practice tests** (Tools → Practice test): take Quiz maker sets like a real test, review, turn misses into notecards, and track scores over time.
- **Periodic table** (Tools → Compute) with electron configurations, a molar mass calculator and element notecards.
- **Photo of the board → tasks** in the Syllabus box (AI vision, or on-device text recognition).
- **Canvas** calendar feed sync (Tools → Connect → Canvas).
- **Share into the app:** share a PDF, photo or document to the installed app → Book reader or a new task with it attached.
- **Share my week** (Stats): a square image of your week's numbers (never task titles).
- **Voice:** the quick-add mic understands "add read chapter four for tomorrow at five p.m., high priority".
- **Browser extension** (`extension/`): add the page you're on as a task.
- **Study rooms, friends and class mode** (no server needed): a Pomodoro room anyone can join by link, friend codes that compare streaks and weekly XP, and teacher class lists students can subscribe to.

## Roadmap pass 5: timetable, attendance, grades, syllabus box, privacy and security, more study games

- **Timetable** (Tools → Timetable): bell schedules (regular, early release, one per weekday), A/B or day 1–4 rotation counted over school days, classes with rooms and teachers, and special days. Today shows the class that's on now, the minutes left and what's next; the task editor can set a due date to "Next class".
- **Attendance:** mark classes present, late, absent or excused on Today or for the last two weeks, with per-class rates. Marking absent offers a catch-up task.
- **Grades:** a trend chart per course, what-if scores for work that isn't graded yet, and letter scales per course (+/−, 10-point, 7-point, pass/fail or custom).
- **Plan my week** (Tools): spreads the next week's work over days by estimate and the time you have each day (earliest deadline first, after whatever it waits on), then pins each task to its day.
- **Syllabus box** (Tools → Syllabus box): paste a syllabus and it finds the dates, titles and types (and breaks), ready to add as tasks. AI is optional.
- **Math:** LaTeX in task notes, notecards and boss battle (`$x^2$`, `$$…$$`), rendered by KaTeX, which loads only when there's math ("$5" stays money).
- **Study games:** a crossword built from a deck, and Quiz race against the ghost of your best run. **Star map** (Play) lights a star for every day you finished something.
- **Lock my keys** (Settings → Privacy & security): API keys and tokens are stored encrypted with a passphrase you enter once per session.
- **End-to-end encrypted sync:** with a sync passphrase, the Gist, Google Drive and account copies (and backups, if you like) are encrypted in your browser before upload.
- **Delete everything** (Settings → Data) lists what will go and can also delete the gist, the Drive file and your account's server copy.
- **What goes where:** a plain-language list of what each optional feature sends to which service (also in PRIVACY.md).
- **Content-Security-Policy** on the site; uploaded games and code previews run in a separate sandbox page. The Schoology relay can be locked to your own site and rate-limited.

## Roadmap pass 4: plan it out, attachments, course boards, background reminders, more games

- **Plan it out** (task editor): split a big task into dated milestones working back from the due date, each waiting on the one before; or space exam study sessions before a test, linked to a notecard deck so each session has a Study button.
- **Attachments:** photos, PDFs and documents on tasks, kept on this device (big photos are shrunk). The file names sync, so other devices show "on another device".
- **Course boards:** a List / Board switch on each course page with To do / Doing / Done columns.
- **Break mode:** add school breaks in Settings; days inside them don't count against your streak, and Today shows that you're on break.
- **Notifications:** reminders go through the service worker (so they work on Android, and clicking one opens the task), today's count shows on the app icon, and the installed app gets a morning digest and badge in the background.
- **Printable weekly planner** (Upcoming → Print week): one landscape page with each day's tasks and blank lines.
- **What's new** after an update, from this changelog.
- **Arcade:** Solitaire (Klondike, draw 1 or 3, undo), Invaders, Lunar lander and a Flappy-style paper-plane glider.
- **Study games** (Play → Study games): Boss battle (multiple choice from your deck against a three-phase boss) and Match rush (match terms to definitions against the clock).
- **Code health:** Settings and Tools are split into one component per section.

## Roadmap pass 3: task planning, smarter notecards, store split

- **Tasks:** "waiting on" dependencies (blocked tasks are dimmed and can be hidden), per-task reminders (minutes before, the night before, the morning of, or a set time), a start/stop timer with tracked time next to the estimate and an "estimates are usually off by X%" note, repeat every n weeks / monthly / "2nd Tuesday", and "Skip this one" for a single occurrence.
- **Saved lists:** save any Inbox filter as a sidebar list, with presets like "Exams in the next 14 days"; new due-window, priority and waiting filters.
- **Notecards:** FSRS scheduling with Again/Hard/Good/Easy and next-interval previews, picture cards, fill-in-the-blank cards (`{{c1::answer}}`), Anki `.apkg` import and Anki text export.
- **Code health:** `store.svelte.ts` is split into method groups under `src/lib/store/` (planning, courses and templates, notecards, imports) with the same `store.method(...)` API.

## Roadmap pass 2: quality, accessibility, planning, study tools, quests, more games

- **Quality:** ESLint + Prettier, Playwright end-to-end tests against the production build (offline, phone layout, shop/casino/arcade, tools, economy), axe accessibility checks on every view in light and dark, a unit-tested contrast audit of every theme pack, first-load bundle budget, Dependabot. Less-used views and editor languages load on demand (first load 199 → ~114 kB gzipped).
- **Fixes found by the new checks:** calendar export didn't escape semicolons; faint text, accent buttons and signal colors failed contrast in several themes; list semantics; the deal of the day switched items after you bought it.
- **Accessibility:** `[`/`]` move tasks by day, high contrast, reading fonts, text size, confetti toggle.
- **Planning:** What should I do now?, month calendar, CSV/Markdown export, CSV import (Todoist and spreadsheets).
- **Study tools:** essay tools, citation generator (DOI/ISBN lookup), unit converter.
- **Economy:** daily quests, deal of the day, casino achievements, parent PIN and daily casino time limit, coins in the weekly review.
- **Arcade:** Breakout, Sudoku, Hangman, Lights Out and Typing defense.

## Roadmap pass 1: sync fixes, deploy anywhere, AI fix, accounts, economy

- **Sync:** deletions are recorded as tombstones and sync to other devices (no more resurrected tasks); Trash keeps deleted tasks 30 days; courses merge last-write-wins; undo and restore stamp a fresh `updatedAt`; change detection covers every synced collection.
- **Accounts:** sign up and sign in with email and password (Supabase), forgot/change password, version-checked sync.
- **AI:** keys work again across providers (token budgets for thinking models, OpenAI reasoning-model parameters, live model list with automatic replacement of retired models, cleaned-up keys). The Anthropic SDK loads on demand.
- **Deploy:** Vercel, Netlify, Render, Replit, Cloudflare Pages, Firebase, Surge and Docker (Fly.io, Railway, Koyeb) configs, `DEPLOY.md`, one-click buttons; base path defaults to `/` off GitHub Pages; CI runs on pull requests.
- **Economy:** coins from schoolwork, shop, wallet history, cosmetics.
- **Casino:** 13 play-chip games with tested payout tables and a homework-break reminder.
- **Arcade:** vouchers, admin-managed `games.json`, in-app admin panel, sandboxed player, high scores, 7 built-in theme games.
- PWA home-screen shortcuts; `ROADMAP.md` with everything still to do.

## Phase 1 — Scaffold, data layer, Today view

- Vite + Svelte 5 + TypeScript scaffold, plain CSS with variables, system font stack
- GitHub Pages workflow (`.github/workflows/deploy.yml`) building on push to `main`; Vite `base` derived from repo name
- Data model (`src/lib/types.ts`), IndexedDB storage via `idb` with localStorage for settings
- Reactive store (`src/lib/store.svelte.ts`) with add / edit / complete / delete / snooze / reorder / bulk operations and undo hooks
- Date helpers, recurrence engine, gamification math (XP, levels, streak, combo, badges) with Vitest coverage
- Quick-add natural-language parser with tests
- Today view: overdue / due today / pinned sections, workload bar, goal ring, roll-overdue button, drag-and-drop list
- Task item with animated checkbox, chips, inline subtasks, snooze menu; full task editor modal
- Demo dataset seeded on first run
- PWA manifest and icons

## Phase 2 — Feel: completion animation, sounds, undo

- Checkbox spring fill, left-to-right strike-through, particle burst, task slides out after a short linger
- Three WebAudio sound packs (soft / click / arcade), muted by default with a one-time enable prompt
- XP toast with Undo button and escalating combo visuals; level-up overlay; badge unlock card; full-screen confetti when the daily ring closes (once per day)
- Undo stack with toasts for add / complete / delete / edit / snooze and `Ctrl+Z`

## Phase 3 — Dates, snooze, Upcoming, recurrence

- Upcoming view: next 14 days grouped by day, then by week; empty-day toggle; per-group workload and exam/quiz counts
- Drag between days (and onto "No date") to reschedule; drag handle based pointer drag-and-drop with a single global drop handler
- Snooze menu on every task: Tomorrow, This weekend, Next week, Pick date; increments `deferredCount`
- Overdue section with "Roll all overdue to today"
- Recurring tasks spawn the next instance on completion without touching history

## Phase 4 — Courses, tags, subtasks, priorities, estimates, parser

- Courses view: one column per course with workload (sum of estimates) and due-this-week count; per-course page with quick add scoped to the course and a completed list
- Course editor (name, color, emoji, archive, delete with undo) and archived list
- Inbox / All view with search and filters: status, course, tag, type, date range, sort
- Quick-add parser wired to every list view with live preview chips (dates, times, `#course`/`#tag`, `!priority`, `~estimate`, recurrence, `@template`, `type:`)
- Subtasks as an inline checklist on the task row; priorities, estimates, types and weights on the editor and as chips

## Phase 5 — Streak, ring, XP, combo, heatmap, Stats

- Stats view: streak with best and banked freezes, level/XP progress, today ring, last-7-days sparkline
- GitHub-style year heatmap with hover counts
- "Due this week by course" summary bars
- Badge grid with locked/unlocked states

## Phase 6 — Keyboard, command palette, search, bulk select, drag-and-drop

- Full keyboard shortcuts: `n` `/` `j` `k` `Enter` `Space` `e` `s` `x` `f` `Del` `Esc` `Ctrl+K` `Ctrl+Z` `1–6` `?`, with a shortcut sheet
- Command palette: jump to views and courses, create course, toggles (sounds, gamification, reduced motion, theme), weekly review, recap, frog, roll overdue, export, bulk select, open a task by name
- Bulk select (checkbox mode, `x`, or shift-click ranges) with move course, reschedule, tag, priority, delete
- Search from Inbox with `/` plus filters
- Backup module (bundle build, JSON download, import validation, last-write-wins merge) with tests

## Phase 7 — Focus mode, Pomodoro, templates, eat-the-frog, recap

- Focus view: one task big with notes (safe markdown), subtasks, complete / snooze / edit / next; task picker
- Pomodoro timer (25/5/15 by default, configurable) that keeps running across views, records sessions for stats and the Marathon badge, tab-title countdown, optional notifications
- Templates: save any task with subtasks from the editor, create with `@name` in quick add (with suggestions)
- Eat the frog: morning prompt on first open, frog pinned to the top of Today, double XP
- End-of-day recap after 6 pm with tasks done, XP, streak status and a one-line note saved to the day
- Sunday weekly review prompt and 14-day backup reminder toasts

## Phase 8 — Export/import, PWA, Gist sync

- Settings view: theme, accent, sounds + pack, reduced motion, daily goal, Pomodoro lengths, week start, time format, gamification switch, streak freeze info, templates, Gist sync, export/import (merge or replace, both undoable), archive old completed tasks, clear demo data, install button, reset all data (triple click confirm)
- Service worker via `vite-plugin-pwa` (offline-first precache, update toast), install prompt capture
- Optional Gist sync: token with gist scope stored only in localStorage, private gist created on first sync, sync on load and 2 s after changes, last-write-wins per task with same-second conflict notice, resync when back online

## Phase 9 — Badges, weekly review, homework summaries, semester setup

- 14 badges with unlock animation (First Task … Marathon), shown in Stats
- Weekly review (Sunday prompt, command palette, Stats button): completed by course, biggest wins, stale tasks snoozed 3+ times with reschedule / no date / delete, next week's heaviest day chart
- Homework touches: workload bar in Today header, exam/quiz badges with days-until in Upcoming and task rows, due-this-week-by-course card in Stats
- Semester setup: create several courses at once with presets, colors, emojis, or a pasted list
- Three-step onboarding (welcome, quick-add syntax, daily goal + sounds) that can open semester setup

## Phase 10 — Polish

- Mobile layout: bottom tab bar, compact rows, full-width dialogs; desktop keeps the left sidebar
- Empty states on every list view; onboarding tour on first run (re-openable from Settings)
- Accessibility: focus trap and focus restore on all dialogs, focus rings, ARIA roles/labels on custom checkbox, ring, tabs, toolbars and combobox; OS `prefers-reduced-motion` honored in addition to the in-app switch
- Performance: derived lists only, single global drag handler, deferred confetti canvas, no external fonts
- README covers local dev, Pages deploy, Gist sync setup, and keyboard shortcuts

## Post-launch

- Removed the demo courses and tasks seeded on first run; the app now starts empty. "Clear demo data" stays available for browsers that already have them.
- Tools view (`7`, also in the mobile "More" tab): day planner with capacity bar and pull-forward, weighted grade calculator with target and exam countdown, reading-time calculator, calendar (.ics) export. Tasks gained an optional `score` field; the task editor has a Score % input.

## Schoology, dopamine, tools

- Schoology sync from the personal iCal feed (direct, via optional CORS proxy, or manual upload/paste), with a Schoology view split into Overdue / Due in 7 days / Later / Completed, course matching and auto-creation, and deleted-assignment memory
- Grade XP when a score is entered (tiered, weighted; A+ confetti), tiered early bonus (up to ×1.5), 5% critical hits, level titles, accent colors that unlock by level, weekly XP goal setting, 7 new badges
- Auto-descriptions: plan, steps, estimate and type inferred from the title and course (offline, deterministic); applied to quick add and synced assignments
- Quick add: multi-line paste creates one task per line, voice dictation, PWA share target, mobile + button
- Tools: notecards with Leitner spaced repetition and study XP, study help reference sheets (22 topics) with optional AI tutor, scientific calculator, graphing calculator, transcript with GPA and CSV/print
- Optional AI helper (Anthropic API key, browser-only) for tutoring, notecard generation
- Data: decks and cards stored in IndexedDB (schema v2), included in backups and Gist sync; `score`, `source`, `externalId`, `url` on tasks; `credits`, `term`, `finalGrade`, `schoologyName` on courses

## Integrations, themes, transcription, more tools

- AI providers: Anthropic, OpenAI, Google Gemini (free tier), Groq (free tier), OpenRouter (free models), Ollama (local), custom OpenAI-compatible endpoint; per-provider keys and models
- Scan paper: camera/upload/paste → AI transcription that keeps structure, or free on-device OCR; copy, answer key, study sheet, notecards, task
- Schoology API sign-in (key/secret, OAuth 1.0a signed in the browser via the proxy): assignments + grades + final grades, configurable auto-sync interval; calendar-feed mode kept
- Google: Gmail assignment scan, Classroom import, Calendar push, Drive app-folder sync (the optional account sync); GIS sign-in with your own client ID
- Spotify Connect (PKCE): now playing, controls, device picker, playlist search; embedded players for Spotify/Apple Music/YouTube/SoundCloud links
- Theme packs (Classic, Sleek, Cute, Arcade, Nature, Space, Paper) that swap colors, corners, sound pack, checkbox particles and confetti; four new sound packs
- Timer presets, custom-minutes timer, stopwatch with time logging; music panel in Focus
- Dopamine: power hour (×1.5, one hour a day), streak milestone celebrations, mystery collectible rewards for closing the ring, weekly XP tracking
- Quality of life: due-soon and morning-digest notifications, task duplicate (`d`), course filter chips in Today, “done by” finish-time estimate
- Offline: single-file downloadable build, persistent-storage request, auto-backup to a local folder (File System Access API)
- Tools: quiz maker (Quizlet/Blooket/Gimkit/Kahoot/worksheet/QTI for Schoology), PDF book reader with library, highlights and notecards, code editor with JS/Python/HTML runners, PowerSchool grades import, textbook-level study help with OpenStax links
