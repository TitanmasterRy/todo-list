# Changelog

## Fix: old and already-finished assignments no longer come back in Focus and the games

- **One copy per assignment.** When two of your devices imported the same Schoology, Canvas or class-list assignment before they had synced, each made its own copy: you finished one, and the other stayed behind as an open, overdue task in Today, Focus and the Play games. Imported assignments now get the same id on every device, and copies you already have are folded into one (the finished one wins) the next time the app opens or syncs.
- **Deleted stays deleted.** An imported assignment you deleted on one device is no longer brought back by another device's feed.
- **Old assignments arrive done.** A school feed lists the whole year and can't say what you've turned in, so assignments more than 14 days past due now arrive already done (no XP or coins) instead of filling Today and Focus with old work. Reopen one if you still need to do it.
- A repeating copy of an imported assignment no longer counts as the assignment itself.

## Fuller backups and fair coins: your keys and game saves in the backup, a tamper-proof wallet, and a fix for finished tasks coming back

- **🔑 Keys and sign-ins in your backup, encrypted.** With a sync passphrase set (Settings → Privacy & security), **Download backup** also saves your AI keys, GitHub token, Schoology and Canvas links, Spotify sign-in, media-server sign-ins, sync passphrase and the account server you use, encrypted with that passphrase. Importing the file on another device asks for the backup's password once and puts them all back (or **Import without keys**). Without a sync passphrase, keys are never written into a backup.
- **🎮 Game progress comes along too:** the Orebelt factory, the zen garden, your pet, arcade high scores and best times, arcade game saves, Quiz Race ghosts, the Hold'em table and your focus companion are in every JSON and folder backup. Import with **replace** to restore them all; **merge** only fills in games you haven't played on this device.
- **🛡️ Anti-cheat for coins.** Every coin, chip and voucher entry now carries a seal. Entries added or changed outside the app (in a hand-edited backup, a synced copy or browser storage) don't count, and wait in the admin panel's **Tamper check** to be approved or discarded. The admin panel is the only place to give or take coins by hand.
- **No double rewards:** reopening a task from Done (or dragging it out of the board's Done column) and finishing it again puts it back on its first completion. It pays no XP, coins, streak, ring or quest progress a second time.
- **Fixed: finished tasks showing up again.** Completing a repeating task that was planned for today no longer puts its next occurrence straight back on Today, and Today's **Done today** list uses your own time zone.

## Sound overhaul: seven packs for every sound, one volume, a timer chime of your own, and Focus ambience

- **🔊 A rebuilt sound engine.** Every sound is still synthesized on the spot (no files), but now through one master bus with a **volume slider** and a limiter, so nothing clips and one setting rules everything, the casino and Orebelt included. Mobile browsers unlock audio on your first tap.
- **🎼 Seven packs, every sound.** Soft, click, arcade, bubble, chime, synth and paper are all in Settings → Sounds now, as tiles that play a preview when you pick them, and every pack covers the full vocabulary: complete, add, delete, snooze, undo, tick, tab, open, close, warning, coins, level-up, badge, goal reached, streak, timer start, break, timer end. New sounds play when you add a task, delete or snooze one, switch tabs, open a sheet, earn coins, hit a streak milestone, start the timer or a break, and when something goes wrong.
- **🎚️ What plays:** three switches for interface, rewards and timer sounds, a **Try them** board with every sound, and a **timer chime** that stays the same whatever the pack: the pack's own, a bell, beeps or a gong.
- **🎧 Focus ambience** (Focus, under the timer): rain, a fireplace, wind, waves, or brown, pink and white noise, generated live with its own volume and a slow fade. It can start and stop with the timer, and it plays even with interface sounds off.

## Mobile overhaul: a new tab bar, sheets for everything, and one-thumb task actions

- **📱 New phone navigation.** Four tabs (Today, Upcoming, Inbox, Courses) and a More button that opens a sheet with big tiles for Focus, Stats, Tools, Schoology, Play and Settings, plus your streak, level and ring at a glance. The More tab shows where you are.
- **➕ Quick add comes to your thumb.** On a phone the + button opens quick add in a bottom sheet with the keyboard up, instead of scrolling back to the top; it understands the same shortcuts, shows the same preview chips, and closes once the task is in.
- **⋯ One-thumb task actions.** Task rows lose the strip of tiny hover buttons on phones; a ⋯ opens an action sheet: Done, Start timer, Focus, Today's frog, Plan for today, Edit, Duplicate, Delete, and Snooze to tomorrow, the weekend, next week, a date, or skip the next repeat. Swiping a row still completes or snoozes it. Chips stay on one line and scroll sideways.
- **🧭 Settings has a jump row** on phones: tap a section name to scroll to it. The Focus mode strip, the Play tabs and the Tools groups scroll sideways with a fade instead of wrapping.
- **📲 Install bar:** on phones, a one-time bar above the tab bar offers to install the app once the browser allows it.
- **📱 Dialogs are bottom sheets on phones.** The task editor, course editor and the other dialogs now slide up full-width, scroll inside, and keep their Save / Cancel / Delete buttons pinned at the bottom, so you never scroll a long form to find them.
- **Toasts stay out of the way:** on a phone only the two newest show, narrower and to the left of the + button, so the list underneath stays usable and the × is never under the button.
- **Inbox filters fold away** behind a Filters button on phones (with a count of the active ones); the search box stays. Desktop is unchanged.
- **Overdue actions** (Roll all to today, Spread over the week) take their own line under the heading on phones instead of wrapping awkwardly.
- **Fingers, not mice:** icon buttons are 40 px on touch screens, every field is at least 16 px so iPhones stop zooming into them, and keyboard hints (the `n` badge, “Space starts the timer”, `⌘↵`, “( / )”) don't show where there is no keyboard.
- **Installed-app polish:** the top of every screen respects the notch, the layout uses the dynamic viewport height so nothing hides under the browser bar, and the + button is a little smaller and closer to the corner. Quick add shows a shorter example on narrow screens.

## Roadmap pass 10: smooth celebrations, lite effects, the priority matrix and spreading overdue work

- **🎉 Confetti without the lag.** Finishing a task that closed the ring, a level-up or a streak milestone could stutter badly, above all on phones. The confetti now draws every piece from a pre-rendered sprite instead of laying out emoji text 180 times a frame, runs its physics on real elapsed time (a slow frame no longer slows the burst), caps the canvas resolution, scales the number of pieces to the screen, and holds the drifting background light still while it's in the air so the glass panels over it aren't re-blurred every frame. The level-up card no longer blurs the whole page behind it.
- **⚙️ Effects: Auto / Full / Lite** (Settings → Appearance). Lite keeps the look but drops what costs the most: the glass blur, the moving background, coin rain and most of the confetti. Auto picks Lite on phones that report little memory or few cores, on a data-saver connection, and for the rest of the session after a celebration visibly dropped frames.
- **📳 Vibration** (Settings → Sounds): a short buzz when you finish a task, swipe a row, close the ring or level up. Phones only, on by default, one switch to turn it off.
- **🧭 Priority matrix** (Tools → Plan → Priority matrix): every open task in four boxes by how soon it's due and how much it counts: Do first, Plan, Quick wins, Later. Important means a high priority, an exam, quiz or project, or anything worth 10% or more; urgent means due within two days (adjustable), today's frog, or pinned into today. The rows are the usual task rows, so completing, snoozing and editing work in place.
- **🗓️ Spread over the week** (Today → Overdue, and the command palette): instead of rolling every overdue task onto today, hand them out over the next five days, most important first, inside the planner's daily capacity (and the per-weekday capacity from Plan my week). One Undo puts them back.

## Roadmap pass 9: the zen garden, the Tree of Wisdom and Orebelt 2

- **🪴 Zen garden** (Play → Garden), after the classic one: 32 terracotta pots on a patio under a picket fence, with the sky following the real time of day. Every finished task drops a care pack (a seed packet in the course's color, a bag of fertilizer, tree food, and bug spray every third task). Plant a seed and the sprout asks for water, fertilizer, bug spray or music in a thought bubble; meet the need and it dances, drops a coin to tap (up to 30 a day) and grows a size per bag until it's a full-grown flower with a face. Six kinds of flower, shiny plants that pay double, a golden watering can, a phonograph, a wheelbarrow that retires full-grown plants to the meadow, and Stinky the snail, who collects coins for an hour per bar of chocolate. Supplies also come from a garden shop paid in coins; the garden is saved on this device.
- **🌳 Tree of Wisdom** (Play → Garden → Tree of Wisdom): feed it a foot at a time and it shares a line of study wisdom. Its leaves take the colors of the courses that fed it, it changes with the season and the time of day, and it picks up residents and decorations as it grows: a bird, a swing, a birdhouse, lanterns, a treehouse, fruit, fireflies, an owl, the cloud tops, the moon, a hammock.
- **🏭 Orebelt 2** (Play → Factory), a massive update:
  - **Logistics:** storage crates that buffer 500 of an item and loaders that pull parts back out of stock onto belts, plus per-belt item filters, so a line can be fed from what you've already made (milestone Logistics).
  - **A bigger map:** 32×18 in four sectors. Survey East Ridge, South Flats and Far Marsh with parts and insight to reach new nodes, bauxite and uranium.
  - **Tiers 6 and 7:** aluminium (blender, alumina, sheets, heat sinks, fused frames), nuclear power on uranium rods, radio units, Belt Mk6, three new alt recipes to research, and two more Launch Tower phases: Orbital Station and Deep Space Probe.
  - **Relaunch:** after the launch, start over for Star Charts and spend them on perks: faster machines, deeper drills, a head start, keeping research, extra shards per task, longer offline runs.
  - **Contracts:** three delivery contracts a day that pay shards and insight. **Achievements** on a new Records tab with lifetime numbers.
  - **Events:** dust storms, rich seams, grid surges and belt jams to clear; never while you're away.
  - **Homework:** closing your ring and streak milestones now power the factory too (a shard, insight and a boost).
  - **Look and feel:** parts visibly ride the belts, machines glow, bob and flicker by status, ground and node textures, an overload flicker, launch celebrations with a rising rocket, particle bursts, sparklines, a bottlenecks list, a lifetime card, a first-shift checklist, recipe cards with ratio hints, copy settings, upgrade-all belts, pause and resume all, and a set of factory sound effects.

## Roadmap pass 8: a new look, casino makeover, Orebelt factory, Crate Rush, Watch, Spanish everywhere, patch notes

- **✨ A new look for the whole app:** gradient accents with a companion hue derived from your accent color, layered shadows and glows, glass panels (tab bar, toasts, dialogs), an ambient color wash that drifts slowly behind everything, slim accent scrollbars, and pages and lists that rise in as they load.
- **Shell:** a gradient logo, a glowing active-page pill in the sidebar, a gold wallet pill that bounces when your coins change, an XP bar with a shimmer, a glass bottom tab bar on phones with a lit indicator, and a pulsing add button.
- **Tasks:** rows carry their course color as a glowing edge and lift on hover; checking one off sweeps the course color across the row, the checkbox fills with a gradient and sends out a ring; the streak flame glows; the daily ring is a gradient with a glow when closed; quick add lights up with a gradient border when focused.
- **Rewards:** toasts with a glowing color bar per kind and bouncing emoji; coin pops as gold pills; level-ups get rotating light rays, gradient numbers and confetti; badges arrive on a shining medal.
- **Play:** a hero header, glossy coin/chip/voucher tiles, pill tabs, lobby tiles with a colored glow and a sheen sweep per game, and a game player with a glowing header and a countdown that pulses when time is short.
- **Play worlds and study games:** the shop, wallet, quests, star map, pet, garden, dungeon, leaderboards, boss battle, match rush, quiz race and crossword all pick up the same language: gradient progress bars, hue-glow cards, gold owned/claimed states, bouncing numbers.
- **Arcade games:** all twenty built-in games got a modern arcade look with glowing frames, glossy HUD pills, gradient buttons, score pops, particle bursts and flashes on scoring and game over, in dark and light.
- Everything still respects reduced motion (the app setting or the OS), high contrast, and the WCAG contrast checks; the first-load CSS budget is unchanged.
- **🎰 Casino makeover:** every game got real tables, chips, cards and animation: felt tables with flying chips, dealt and flipped cards, spinning slot reels with near misses and big-win banners, a roulette ball that drops into its pocket, a ticking Big Six wheel, bouncing Plinko balls, 3D dice, exploding mines, a Keno globe, scratch-off foil you rub with your finger, a CRT video poker cabinet and a Hold'em table with the three bots. New lobby with illustrated tiles and synthesized sound effects.
- **🏭 Orebelt** (Play → Factory): a factory-building idle game. Mine ore, smelt and build parts through six tiers, route belts with throughput limits, run a power grid with overclocking, deliver to the Launch Tower, and keep producing while you're away. Finished homework gives shards, research and production boosts; coins buy a few daily supply drops.
- **📺 Watch** (Play → Watch): sign in to your Jellyfin or Emby server to browse and play with resume across devices, show Plex or any other site, play YouTube/Vimeo/Twitch links, direct video links and files from your device. Optional homework rules: finish your ring first, vouchers for watch time, a daily limit. See WATCH.md.
- **📦 Crate Rush** (Play → Arcade): a crate-opening clicker. Click and build income, open crates on a spinning reel, collect 104 procedurally drawn items with wear and patterns, trade up, upgrade, fill the collection book and rebirth. Coins buy a few power-ups.
- **Español** now covers Stats, Tools, Settings, Schoology and every message (Play is still English).
- **Patch notes** open by themselves after an update and show every update this device missed; they're always in Settings → Help.
- Guides for coding agents and local models (AGENTS.md, LOCAL_LLM.md).

## Roadmap pass 7: admin panel, new games and casino tables, group projects, coins in games

- **Hidden admin panel** (Ctrl+Alt+Shift+A, `?admin`, or tap the version in Settings → Help 7 times; see ADMIN.md): passphrase-protected; economy grants and undo, a site-wide announcement banner and feature switches, one-click publishing to GitHub, a data browser and debug tools.
- **Add your own games** (Play → Arcade → ➕ Add a game): drop an HTML or JavaScript file, a .zip or a folder, paste code, or paste a link (Scratch, CodePen, Replit and more become embeds). Games can now save progress and sell power-ups for coins.
- **New games:** Glow Grid (a gem block puzzle), Bubble pop and Fishing in the arcade; Three Card Poker, Let It Ride and Texas Hold'em against bots in the casino; a pet, a garden and a homework dungeon in Play; coin rain on big wins.
- **A casino that feels like one:** an illustrated lobby, felt tables with real chips that fly to the bet and back, dealt and flipped cards, spinning reels with near-miss teases, a roulette ball that drops into its pocket, a ticking Big Six flapper, bouncing Plinko balls, tumbling dice, scratch-off foil, big-win banners and new sound effects. Reduced motion keeps it all quick and still. Generated art can replace the drawn art later (public/art).
- **Chips → coins:** cash chips back at half value, up to 100 coins a day (Play → Wallet).
- **Seasonal events** with limited items and event quests, **gifts** for friends, and opt-in **leaderboards**.
- **Group projects:** select tasks → 🔗 Share makes a link; whoever opens it adds their own copy.
- **Tasks:** ✨ Break it down (AI steps, estimate and notes), swipe right to complete or left to snooze on phones, and an edit history in the task editor.
- **Focus companion:** a cat (or another friend) naps while you focus.
- Long lists load as you scroll, loading placeholders, and a Lighthouse check on every pull request.

## Roadmap pass 6: languages, sharing, practice tests, Canvas, smarter sync

- **Languages:** Spanish (Settings → Language, or Auto) across the whole app except Play, including Spanish dates in quick add ("leer capítulo 3 mañana a las 5 !alta") and Spanish auto plans for new tasks; dates and numbers follow your region; right-to-left layout support.
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
