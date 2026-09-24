# Roadmap

Everything we could improve or add to Homework To-Do, grouped by area. Checked items have shipped; see `CHANGELOG.md` for details. Items marked 🔴 are bugs or risks found in the code and come first.

**Legend:** `[x]` done · `[ ]` not started · 🔴 fix first · 🪙 economy · 🎮 games

---

## 🔴 Fix first (found in the code)

- [ ] **Deleted tasks come back after sync.** `mergeBundles` unions both sides and nothing records a deletion, so a task deleted on one device reappears from the other. Record deletions as tombstones (`{ kind, id, deletedAt }`), merge them like edits, drop anything deleted after its last edit, prune tombstones after 60 days.
- [ ] **Course edits can lose during sync.** Courses merge "local always wins" and have no `updatedAt`. Add `updatedAt` to courses and merge last-write-wins.
- [ ] **CI only runs on pushes to `main`.** Add a `ci.yml` that runs tests, type check and build on every pull request and branch push.
- [ ] **Heavy first load.** `SettingsView` imports `lib/ai` eagerly, pulling the AI SDK into the main bundle. Load AI code on demand.
- [ ] **Code editor chunk is ~771 kB.** Load each CodeMirror language only when it's picked.
- [ ] **Bundle building is copy-pasted in 6 places.** One `store.snapshotBundle()` used by export, sync, backup and import.

## 🧱 Code health

- [ ] Split `store.svelte.ts` (1,000 lines) into tasks, courses, stats and sync pieces.
- [ ] Split `ToolsView.svelte` and `SettingsView.svelte` into one component per section.
- [ ] Move the 2,600-line `studyhelp.ts` content into lazily loaded JSON/Markdown.
- [ ] ESLint + Prettier + a pre-commit hook.
- [ ] Playwright end-to-end tests: quick add, complete, undo, drag-to-reschedule, export/import, offline, shop purchase, a casino round.
- [ ] Component tests for `TaskItem`, `QuickAdd`, `TaskEditor`.
- [ ] Schema version on IndexedDB with step-by-step upgrades (v3 adds the ledger and games stores).
- [ ] Bundle-size budget in CI (`size-limit`).
- [ ] Lighthouse CI (performance, accessibility, PWA).
- [ ] Dependabot or Renovate.
- [ ] Remove the leftover "Clear demo data" code once old installs have moved on.
- [ ] Tidy the README (duplicate "Old feed instructions", "Study help" listed twice).

## 🔐 Security and privacy

- [ ] Content-Security-Policy `<meta>` listing the hosts the app talks to.
- [ ] Optional passphrase encryption for API keys and tokens in localStorage.
- [ ] End-to-end encryption of the sync file (Gist / Drive).
- [ ] "Delete everything" that also removes the gist and the Drive file.
- [ ] A privacy page: what goes to which service.
- [ ] Lock the CORS relay Worker to your own site and rate-limit it.
- [ ] Arcade games run in sandboxed iframes with no access to the app's storage.

## ♿ Accessibility

- [ ] Screen-reader pass (NVDA, VoiceOver) on completion, drag-and-drop, palette, casino tables.
- [ ] Keyboard alternative to drag-and-drop ("move to day" with arrows).
- [ ] axe checks in the Playwright tests.
- [ ] Contrast audit of all theme packs in light and dark.
- [ ] High-contrast theme and a dyslexia-friendly font option.
- [ ] Separate toggles for confetti/particles and sounds.

## 🌍 Reach

- [ ] Translations (strings in per-language files), starting with Spanish, including the quick-add date parser.
- [ ] Format dates and numbers with `Intl` for the user's region.
- [ ] Right-to-left layout support.

## ✅ Core to-do features

- [ ] Task dependencies ("Outline" before "Draft essay"), blocked tasks dimmed.
- [ ] Auto-split big projects into dated milestones working back from the due date.
- [ ] Per-task reminders ("30 min before", "the night before").
- [ ] Attachments on tasks (photo of the worksheet, a PDF) stored in IndexedDB.
- [ ] Saved filters / smart lists ("Exams in the next 14 days").
- [ ] Kanban board (To do / Doing / Done) per course or project.
- [ ] Month calendar view next to Upcoming.
- [ ] Time tracking per task vs. estimate, with a personal "estimates are usually off by X%" note.
- [ ] "What should I do now?" auto-priority from due date, weight and estimate.
- [ ] Recurrence exceptions (skip one) and "every 2nd Tuesday".
- [ ] Trash can: deleted tasks kept 30 days and restorable (built on the tombstones).

## 🎓 School features

- [ ] Canvas and Microsoft Teams Assignments integrations.
- [ ] Class timetable (periods, rooms) with "what's next" on Today.
- [ ] Bell schedule and A/B day rotations.
- [ ] Exam prep plans: spaced study sessions leading to an exam, tied to a notecard deck.
- [ ] Grade trend charts per course with what-if scenarios.
- [ ] Per-class letter-grade scales.
- [ ] Attendance tracking.
- [ ] Syllabus box that extracts due dates (AI optional).
- [ ] Group projects: share a task list by link.
- [ ] Summer / break mode that pauses streaks.

## 🧠 Study tools

- [ ] SM-2 / FSRS scheduling for notecards.
- [ ] Image and cloze (fill-in-the-blank) notecards.
- [ ] Anki `.apkg` and Quizlet import/export.
- [ ] Practice-test mode that plays quizzes in the app, with scores over time.
- [ ] Shared study-room timer by link.
- [ ] Citation generator (MLA/APA/Chicago) from URL, ISBN or DOI.
- [ ] Essay tools: word/page counter, outline template, readability.
- [ ] Unit converter and periodic table.
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

- [ ] **Coins (🪙)** earned for: completing tasks (≈ XP ÷ 5, min 1), closing the daily ring, streak milestones, first grade entered on a task, notecard study sessions, finished Pomodoros.
- [ ] **Wallet** in the new **Play** view (`9`): balances for Coins, Chips and Vouchers, plus full history.
- [ ] **Ledger-based and sync-safe.** Every earn and spend is an append-only entry with its own id, so Gist/Drive sync merges wallets from two devices without double counting or resurrecting spent coins.
- [ ] Undoing a completion reverses the coins it paid.
- [ ] Economy on/off switch in Settings (off hides the Play view entirely).
- [ ] Weekly coin summary in the weekly review.
- [ ] Coin rain animation on big payouts.
- [ ] Parent/teacher mode: a PIN-locked setting to cap casino time or turn it off.

## 🛍️ Item shop

- [ ] **Shop** tab in Play: spend Coins on:
  - [ ] Casino chip packs (100 / 550 / 1,200 chips)
  - [ ] Arcade vouchers (1 / 5)
  - [ ] Streak freeze (consumable, respects the 2-freeze cap)
  - [ ] XP booster (next task ×2)
  - [ ] Cosmetic titles shown on Stats
  - [ ] Profile frames around the level badge
  - [ ] Extra confetti styles
- [ ] **Prize counter**: spend Chips on casino-only trophies (chips never convert back to coins).
- [ ] Owned items and trophies shown in an **Inventory** grid.
- [ ] Daily rotating "deal of the day" at a discount.
- [ ] Limited seasonal items (Halloween, finals week, summer).
- [ ] Gift items to a friend with a code.

## 🎰 Casino (play chips only)

Chips are bought with Coins in the shop and can't be turned back into Coins, so the casino can't inflate the economy. Every game uses a fair `crypto.getRandomValues` RNG and shows its house edge.

- [ ] **Slots**: 3 reels, symbols change with the theme pack, paytable shown.
- [ ] **Blackjack**: hit, stand, double, dealer stands on soft 17, blackjack pays 3:2.
- [ ] **Roulette** (European, single zero): straight numbers, red/black, odd/even, low/high, dozens, columns.
- [ ] **Video poker** (Jacks or Better, 9/6 paytable): hold and draw.
- [ ] **Baccarat**: Player / Banker (5% commission) / Tie with full third-card rules.
- [ ] **Craps**: Pass line and Field bets with point rounds.
- [ ] **Hi-Lo**: guess higher or lower, cash out any time.
- [ ] **Plinko**: 12 rows, low/medium/high risk.
- [ ] **Keno**: pick 1–10 of 40, 10 balls drawn.
- [ ] **Mines**: 5×5 grid, choose mine count, cash out between picks.
- [ ] **Dice**: roll over/under a target you set, payout scales with odds.
- [ ] **Big Six wheel**: 54 segments, bet on 1/2/5/10/20/joker.
- [ ] **Scratch cards**: match three.
- [ ] **Daily chip bonus** when you close your ring.
- [ ] **Homework break reminder** after 20 minutes of casino play (configurable), plus a session stats bar (played, won, net).
- [ ] Three Card Poker and Let It Ride.
- [ ] Texas Hold'em vs. bots.
- [ ] Casino achievements (first blackjack, royal flush, 10× Plinko).
- [ ] Chip leaderboard between friends (opt-in).

## 🕹️ Arcade: vouchers and admin-added games

- [ ] **Vouchers** bought with Coins; each play of an arcade game costs the voucher price set for that game.
- [ ] **Site admin adds games** without touching app code:
  - drop an `.html` file in `public/games/` and list it in `public/games/games.json`, **or**
  - list an embed link (itch.io, Scratch, any https URL) in the same manifest.
  - Fields: `id`, `title`, `emoji`, `description`, `src` or `url`, `cost` (vouchers), `minutes` (optional time per voucher), `theme`, `tags`.
- [ ] **Optional remote manifest** via `VITE_ARCADE_MANIFEST` so you can change games without redeploying.
- [ ] **In-app admin panel** (Settings → Arcade admin): upload an HTML file or paste a link, preview it, set the cost, and export the `games.json` entry to commit.
- [ ] Games run in **sandboxed iframes** (no access to your tasks, keys or storage).
- [ ] **Score bridge**: a game can `postMessage({ type: 'hwtodo:score', score })`; the app keeps a per-game high score table.
- [ ] Voucher timer: when `minutes` is set the session ends when time is up.
- [ ] Per-game leaderboards across friends.

## 🎮 Theme games (built in, one per theme pack)

Each ships as a standalone HTML file in `public/games/`, so they double as examples for admins.

- [ ] **Classic → Minesweeper**
- [ ] **Sleek → 2048**
- [ ] **Cute → Memory match** (animal pairs)
- [ ] **Arcade → Snake**
- [ ] **Nature → Leaf catcher** (catch falling leaves and fruit, dodge bugs)
- [ ] **Space → Asteroids**
- [ ] **Paper → Word search** (can use words from your notecards via `?words=`)
- [ ] Classic → Solitaire (Klondike)
- [ ] Sleek → Sudoku, Lights Out
- [ ] Cute → Virtual pet you feed with coins; bubble pop
- [ ] Arcade → Breakout, Space-invaders-lite, Flappy
- [ ] Nature → Garden that grows as you finish tasks; fishing
- [ ] Space → Lunar lander; star map you fill in with streak days
- [ ] Paper → Crossword and Hangman from your vocab decks; paper-plane glider

### Study-linked game ideas

- [ ] **Notecard boss battle**: each right answer hits the boss; wrong answers hurt you.
- [ ] **Quiz race**: race a ghost of your last score through a quiz.
- [ ] **Typing defense**: type vocab words to stop falling letters.
- [ ] **Match rush**: drag terms onto definitions against the clock.
- [ ] **Homework dungeon**: each completed task opens a room; courses are floors.

---

## 🚀 Deploy anywhere (free tiers)

- [ ] **GitHub Pages** (existing workflow).
- [ ] **Vercel**: `vercel.json`, one-click "Deploy" button.
- [ ] **Netlify**: `netlify.toml`, one-click button.
- [ ] **Render**: `render.yaml` static site blueprint.
- [ ] **Replit**: `.replit` + `replit.nix`, runs the dev server and deploys as a static site.
- [ ] **Cloudflare Pages**: build settings documented, `wrangler.toml` included.
- [ ] **Surge.sh** and **Firebase Hosting**: `npm run deploy:surge`, `firebase.json`.
- [ ] **Docker / any host** (Fly.io, Railway, Koyeb, a VPS): `Dockerfile` with nginx.
- [ ] `VITE_BASE` defaults to `/` everywhere except GitHub Pages, set automatically per host.
- [ ] `DEPLOY.md` with a step-by-step for each.

---

## 💡 More ideas

- [ ] Friends by share code: compare streaks and weekly XP only.
- [ ] Class mode for teachers: publish a read-only assignment list students can subscribe to.
- [ ] Daily quests ("finish 1 reading, 1 homework, 1 study session") paying bonus coins.
- [ ] Seasonal events with themed shop items and games.
- [ ] Focus-mode companions (a cat that sleeps while the timer runs).
- [ ] Widgets for the phone home screen (via Capacitor).
- [ ] Voice commands ("Hey, add read chapter four for tomorrow").
- [ ] Wearable timer (smartwatch notification when a Pomodoro ends).
- [ ] Printable weekly planner PDF.
- [ ] "Study buddy" matching within a class code.

## 📱 Platform and polish

- [ ] Home-screen shortcuts in the PWA manifest (New task, Today, Focus, Play).
- [ ] Background sync and push reminders.
- [ ] App icon badge with today's due count.
- [ ] Share files into the app (PDFs straight to the reader).
- [ ] Swipe to complete/snooze with haptics.
- [ ] Capacitor wrap for iOS/Android.
- [ ] Browser extension: add the current page as a task.
- [ ] Skeleton loading and virtual scrolling for large lists.
- [ ] "What's new" after updates, from the changelog.
- [ ] Shareable weekly review and stats cards.

## 🔄 Data and sync

- [ ] Field-level merge so two devices editing different fields both win.
- [ ] Dropbox / OneDrive / pick-a-file sync.
- [ ] Per-task edit history.
- [ ] Import from Todoist, Google Tasks, Microsoft To Do.
- [ ] CSV and Markdown export.
