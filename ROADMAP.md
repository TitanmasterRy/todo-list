# Roadmap

Everything we could improve or add to Homework To-Do, grouped by area. Checked items have shipped; see `CHANGELOG.md` for details. Items marked 🔴 are bugs or risks found in the code and come first.

**Legend:** `[x]` done · `[ ]` not started · 🔴 fix first · 🪙 economy · 🎮 games

---

## 🔴 Fix first (found in the code)

- [x] **AI keys not working.** Thinking models (Claude Opus/Sonnet 5, Gemini 2.5, Qwen3) spent the tiny token budget on reasoning and returned nothing; OpenAI o-series rejected `max_tokens`; several built-in model ids were retired. Fixed budgets and parameters per provider, a key test that checks the live model list and switches away from retired models, and cleaned-up pasted keys.
- [x] **Undo could be undone by sync.** Undo restored the old `updatedAt`, so a synced copy of the edit won again. Undo and restore now stamp a fresh `updatedAt`.
- [x] **Sync skipped merges that only changed deletions or the wallet.** Change detection now covers every synced collection.

- [x] **Deleted tasks come back after sync.** `mergeBundles` unions both sides and nothing records a deletion, so a task deleted on one device reappears from the other. Record deletions as tombstones (`{ kind, id, deletedAt }`), merge them like edits, drop anything deleted after its last edit, prune tombstones after 60 days.
- [x] **Course edits can lose during sync.** Courses merge "local always wins" and have no `updatedAt`. Add `updatedAt` to courses and merge last-write-wins.
- [x] **CI only runs on pushes to `main`.** Add a `ci.yml` that runs tests, type check and build on every pull request and branch push.
- [x] **Heavy first load.** `SettingsView` imports `lib/ai` eagerly, pulling the AI SDK into the main bundle. Load AI code on demand.
- [x] **Code editor chunk is ~771 kB.** Load each CodeMirror language only when it's picked.
- [x] **Bundle building is copy-pasted in 6 places.** One `store.snapshotBundle()` used by export, sync, backup and import.

## 🧱 Code health

- [x] Split `store.svelte.ts` (1,000 lines) into tasks, courses, stats and sync pieces. Done: planning, courses/templates, notecards and imports live in `src/lib/store/`, attached to the same `store`.
- [x] Split `ToolsView.svelte` and `SettingsView.svelte` into one component per section. Done: `src/components/settings/*` and `src/components/tools/*`.
- [ ] Move the 2,600-line `studyhelp.ts` content into lazily loaded JSON/Markdown.
- [x] ESLint + Prettier + a pre-commit hook.
- [x] Playwright end-to-end tests: quick add, complete, undo, drag-to-reschedule, export/import, offline, shop purchase, a casino round.
- [ ] Component tests for `TaskItem`, `QuickAdd`, `TaskEditor`.
- [x] Schema version on IndexedDB with step-by-step upgrades (v3 adds the ledger and games stores).
- [x] Bundle-size budget in CI (`size-limit`).
- [ ] Lighthouse CI (performance, accessibility, PWA).
- [x] Dependabot or Renovate.
- [x] Remove the leftover "Clear demo data" code once old installs have moved on.
- [x] Tidy the README (duplicate "Old feed instructions", "Study help" listed twice).

## 🔐 Security and privacy

- [ ] Content-Security-Policy `<meta>` listing the hosts the app talks to.
- [ ] Optional passphrase encryption for API keys and tokens in localStorage.
- [ ] End-to-end encryption of the sync file (Gist / Drive).
- [ ] "Delete everything" that also removes the gist and the Drive file.
- [ ] A privacy page: what goes to which service.
- [ ] Lock the CORS relay Worker to your own site and rate-limit it.
- [x] Arcade games run in sandboxed iframes with no access to the app's storage.

## ♿ Accessibility

- [ ] Screen-reader pass (NVDA, VoiceOver) on completion, drag-and-drop, palette, casino tables.
- [x] Keyboard alternative to drag-and-drop ("move to day" with arrows).
- [x] axe checks in the Playwright tests.
- [x] Contrast audit of all theme packs in light and dark.
- [x] High-contrast theme and a dyslexia-friendly font option.
- [x] Separate toggles for confetti/particles and sounds.

## 🌍 Reach

- [ ] Translations (strings in per-language files), starting with Spanish, including the quick-add date parser.
- [ ] Format dates and numbers with `Intl` for the user's region.
- [ ] Right-to-left layout support.

## ✅ Core to-do features

- [x] Task dependencies ("Outline" before "Draft essay"), blocked tasks dimmed.
- [x] Auto-split big projects into dated milestones working back from the due date. (Task editor → Plan it out.)
- [x] Per-task reminders ("30 min before", "the night before").
- [x] Attachments on tasks (photo of the worksheet, a PDF) stored in IndexedDB. (Files stay on the device; names sync.)
- [x] Saved filters / smart lists ("Exams in the next 14 days").
- [x] Kanban board (To do / Doing / Done) per course or project. (Course page → Board.)
- [x] Month calendar view next to Upcoming.
- [x] Time tracking per task vs. estimate, with a personal "estimates are usually off by X%" note.
- [x] "What should I do now?" auto-priority from due date, weight and estimate.
- [x] Recurrence exceptions (skip one) and "every 2nd Tuesday".
- [x] Trash can: deleted tasks kept 30 days and restorable (built on the tombstones).

## 🎓 School features

- [ ] Canvas and Microsoft Teams Assignments integrations.
- [x] Class timetable (periods, rooms) with "what's next" on Today. (Tools → Timetable; also "Next class" as a due date.)
- [x] Bell schedule and A/B day rotations.
- [x] Exam prep plans: spaced study sessions leading to an exam, tied to a notecard deck. (Plan it out → Exam prep, with a Study button per session.)
- [x] Grade trend charts per course with what-if scenarios. (Tools → Grade calculator → Trend / What if.)
- [x] Per-class letter-grade scales. (Presets or a custom scale per course.)
- [x] Attendance tracking. (Mark classes on Today or in Tools → Timetable → Attendance; absent offers a catch-up task.)
- [x] Syllabus box that extracts due dates (AI optional). (Tools → Syllabus box; breaks become Break mode days.)
- [ ] Group projects: share a task list by link.
- [x] Summer / break mode that pauses streaks. (Settings → Break mode.)

## 🧠 Study tools

- [x] SM-2 / FSRS scheduling for notecards. (FSRS v4.5, with Again/Hard/Good/Easy.)
- [x] Image and cloze (fill-in-the-blank) notecards.
- [x] Anki `.apkg` and Quizlet import/export. (Anki `.apkg` import and text export; Quizlet exports paste straight into the deck importer.)
- [ ] Practice-test mode that plays quizzes in the app, with scores over time.
- [ ] Shared study-room timer by link.
- [x] Citation generator (MLA/APA/Chicago) from URL, ISBN or DOI.
- [x] Essay tools: word/page counter, outline template, readability.
- [x] Unit converter.
- [ ] Periodic table.
- [ ] LaTeX math in notes and notecards (KaTeX).

## 🤖 AI (optional, bring your own key)

- [ ] "Plan my week" across days using estimates and daily capacity.
- [ ] AI subtask breakdown.
- [ ] Photo of the board / syllabus → tasks with dates.
- [ ] "Explain my mistake" from a graded test → notecards.
- [ ] AI cost meter per provider with a monthly cap.
- [ ] Fully offline AI with an in-browser model (WebLLM).

---

## 🪙 Economy: Coins

A soft currency earned only by doing schoolwork. No real money, ever: nothing in the app can be bought with cash, and nothing can be cashed out.

- [x] **Coins (🪙)** earned for: completing tasks (≈ XP ÷ 5, min 1), closing the daily ring, streak milestones, first grade entered on a task, notecard study sessions, finished Pomodoros.
- [x] **Wallet** in the new **Play** view (`9`): balances for Coins, Chips and Vouchers, plus full history.
- [x] **Ledger-based and sync-safe.** Every earn and spend is an append-only entry with its own id, so Gist/Drive sync merges wallets from two devices without double counting or resurrecting spent coins.
- [x] Undoing a completion reverses the coins it paid.
- [x] Economy on/off switch in Settings (off hides the Play view entirely).
- [x] Weekly coin summary in the weekly review.
- [ ] Coin rain animation on big payouts.
- [x] Parent/teacher mode: a PIN-locked setting to cap casino time or turn it off.

## 🛍️ Item shop

- [x] **Shop** tab in Play: spend Coins on:
  - [x] Casino chip packs (100 / 550 / 1,200 chips)
  - [x] Arcade vouchers (1 / 5)
  - [x] Streak freeze (consumable, respects the 2-freeze cap)
  - [x] Coin booster (next 3 tasks pay double coins)
  - [x] Cosmetic titles shown on Stats
  - [x] Profile frames around the level badge
  - [x] Extra confetti styles
- [x] **Prize counter**: spend Chips on casino-only trophies (chips never convert back to coins).
- [x] Owned items and trophies shown in an **Inventory** grid.
- [x] Daily rotating "deal of the day" at a discount.
- [ ] Limited seasonal items (Halloween, finals week, summer).
- [ ] Gift items to a friend with a code.

## 🎰 Casino (play chips only)

Chips are bought with Coins in the shop and can't be turned back into Coins, so the casino can't inflate the economy. Every game uses a fair `crypto.getRandomValues` RNG and shows its house edge.

- [x] **Slots**: 3 reels, symbols change with the theme pack, paytable shown.
- [x] **Blackjack**: hit, stand, double, dealer stands on soft 17, blackjack pays 3:2.
- [x] **Roulette** (European, single zero): straight numbers, red/black, odd/even, low/high, dozens, columns.
- [x] **Video poker** (Jacks or Better, 9/6 paytable): hold and draw.
- [x] **Baccarat**: Player / Banker (5% commission) / Tie with full third-card rules.
- [x] **Craps**: Pass line and Field bets with point rounds.
- [x] **Hi-Lo**: guess higher or lower, cash out any time.
- [x] **Plinko**: 12 rows, low/medium/high risk.
- [x] **Keno**: pick 1–10 of 40, 10 balls drawn.
- [x] **Mines**: 5×5 grid, choose mine count, cash out between picks.
- [x] **Dice**: roll over/under a target you set, payout scales with odds.
- [x] **Big Six wheel**: 54 segments, bet on 1/2/5/10/20/joker.
- [x] **Scratch cards**: match three.
- [x] **Daily chip bonus** when you close your ring.
- [x] **Homework break reminder** after 20 minutes of casino play (configurable), plus a session stats bar (played, won, net).
- [ ] Three Card Poker and Let It Ride.
- [ ] Texas Hold'em vs. bots.
- [x] Casino achievements (first blackjack, royal flush, 10× Plinko).
- [ ] Chip leaderboard between friends (opt-in).

## 🕹️ Arcade: vouchers and admin-added games

- [x] **Vouchers** bought with Coins; each play of an arcade game costs the voucher price set for that game.
- [x] **Site admin adds games** without touching app code:
  - drop an `.html` file in `public/games/` and list it in `public/games/games.json`, **or**
  - list an embed link (itch.io, Scratch, any https URL) in the same manifest.
  - Fields: `id`, `title`, `emoji`, `description`, `src` or `url`, `cost` (vouchers), `minutes` (optional time per voucher), `theme`, `tags`.
- [x] **Optional remote manifest** via `VITE_ARCADE_MANIFEST` so you can change games without redeploying.
- [x] **In-app admin panel** (Settings → Arcade admin): upload an HTML file or paste a link, preview it, set the cost, and export the `games.json` entry to commit.
- [x] Games run in **sandboxed iframes** (no access to your tasks, keys or storage).
- [x] **Score bridge**: a game can `postMessage({ type: 'hwtodo:score', score })`; the app keeps a per-game high score table.
- [x] Voucher timer: when `minutes` is set the session ends when time is up.
- [ ] Per-game leaderboards across friends.

## 🎮 Theme games (built in, one per theme pack)

Each ships as a standalone HTML file in `public/games/`, so they double as examples for admins.

- [x] **Classic → Minesweeper**
- [x] **Sleek → 2048**
- [x] **Cute → Memory match** (animal pairs)
- [x] **Arcade → Snake**
- [x] **Nature → Leaf catcher** (catch falling leaves and fruit, dodge bugs)
- [x] **Space → Asteroids**
- [x] **Paper → Word search** (can use words from your notecards via `?words=`)
- [x] Classic → Solitaire (Klondike: draw 1 or 3, drag or click, undo, Windows-style standard scoring)
- [x] Sleek → Sudoku; Classic → Lights Out
- [ ] Cute → Virtual pet you feed with coins; bubble pop
- [x] Arcade → Breakout
- [x] Arcade → Space-invaders-lite (Invaders); the Flappy-style game is the Paper paper-plane glider
- [ ] Nature → Garden that grows as you finish tasks; fishing
- [x] Space → Lunar lander (`lander.html`); star map you fill in with streak days (Play → Star map)
- [x] Paper → Hangman from your vocab decks
- [x] Paper → Crossword from your vocab (Play → Study games, printable); paper-plane glider (`glider.html`)

### Study-linked game ideas

- [x] **Notecard boss battle**: each right answer hits the boss; wrong answers hurt you. (Play → Study games)
- [x] **Quiz race**: race a ghost of your last score through a quiz. (Play → Study games, the ghost is your best run per deck or quiz set)
- [x] **Typing defense**: type vocab words to stop falling letters.
- [x] **Match rush**: drag terms onto definitions against the clock. (Play → Study games, best time per deck)
- [ ] **Homework dungeon**: each completed task opens a room; courses are floors.

---

## 🚀 Deploy anywhere (free tiers)

- [x] **GitHub Pages** (existing workflow).
- [x] **Vercel**: `vercel.json`, one-click "Deploy" button.
- [x] **Netlify**: `netlify.toml`, one-click button.
- [x] **Render**: `render.yaml` static site blueprint.
- [x] **Replit**: `.replit` + `replit.nix`, runs the dev server and deploys as a static site.
- [x] **Cloudflare Pages**: build settings documented, `wrangler.toml` included.
- [x] **Surge.sh** and **Firebase Hosting**: `npm run deploy:surge`, `firebase.json`.
- [x] **Docker / any host** (Fly.io, Railway, Koyeb, a VPS): `Dockerfile` with nginx.
- [x] `VITE_BASE` defaults to `/` everywhere except GitHub Pages, set automatically per host.
- [x] `DEPLOY.md` with a step-by-step for each.

---

## 💡 More ideas

- [ ] Friends by share code: compare streaks and weekly XP only.
- [ ] Class mode for teachers: publish a read-only assignment list students can subscribe to.
- [x] Daily quests ("finish 1 reading, 1 homework, 1 study session") paying bonus coins.
- [ ] Seasonal events with themed shop items and games.
- [ ] Focus-mode companions (a cat that sleeps while the timer runs).
- [ ] Widgets for the phone home screen (via Capacitor).
- [ ] Voice commands ("Hey, add read chapter four for tomorrow").
- [ ] Wearable timer (smartwatch notification when a Pomodoro ends).
- [x] Printable weekly planner PDF. (Upcoming → Print week; save as PDF from the print dialog.)
- [ ] "Study buddy" matching within a class code.

## 📱 Platform and polish

- [x] Home-screen shortcuts in the PWA manifest (New task, Today, Focus, Play).
- [ ] Background sync and push reminders. Partly done: notifications go through the service worker, and installed Chromium apps get a background morning digest and badge via periodic sync. True push needs a server.
- [x] App icon badge with today's due count.
- [ ] Share files into the app (PDFs straight to the reader).
- [ ] Swipe to complete/snooze with haptics.
- [ ] Capacitor wrap for iOS/Android.
- [ ] Browser extension: add the current page as a task.
- [ ] Skeleton loading and virtual scrolling for large lists.
- [x] "What's new" after updates, from the changelog.
- [ ] Shareable weekly review and stats cards.

## 🔄 Data and sync

- [x] **Accounts with email and password** (Supabase): sign up, sign in, email confirmation, forgot password, change password, delete the synced copy; version-checked writes so two devices can't overwrite each other.
- [ ] Optional end-to-end encryption of the account copy with a passphrase.
- [ ] Sign in with Google / Apple / GitHub (Supabase OAuth providers).

- [ ] Field-level merge so two devices editing different fields both win.
- [ ] Dropbox / OneDrive / pick-a-file sync.
- [ ] Per-task edit history.
- [x] Import from Todoist (and any CSV).
- [ ] Import from Google Tasks and Microsoft To Do.
- [x] CSV and Markdown export.
