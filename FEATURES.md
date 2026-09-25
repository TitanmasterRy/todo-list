# What's built: feature checklist

Everything added since the roadmap was written, by area, with where to find it in the app. It's all on the branch
`claude/happy-ptolemy-idw81c` (not merged into `main` yet). The full plan, including what's still open, is in
[ROADMAP.md](ROADMAP.md); release notes are in [CHANGELOG.md](CHANGELOG.md).

## ✅ Tasks and planning

- [x] Quick add with natural language (dates, times, `#tags`, `!priority`, `~30m` estimates, repeats, `@templates`)
- [x] Voice input that turns speech into quick-add syntax (🎤 in quick add)
- [x] "Waiting on" dependencies; blocked tasks are dimmed and can be hidden
- [x] Per-task reminders (minutes before, night before, morning of, a set time)
- [x] Timer per task, time spent vs. estimate, and an "estimates are usually off by X%" note
- [x] More repeat options (every n weeks, monthly, "2nd Tuesday") and "Skip this one"
- [x] Saved lists / smart filters in the sidebar (Inbox → ☆ Save as list)
- [x] What should I do now? (Today → 🧭, or `w`)
- [x] Month calendar (Upcoming → Month)
- [x] Plan it out: milestones working back from the due date, or spaced exam-prep sessions (task editor)
- [x] Plan my week: spreads work over days by estimate and time per day (Tools → Plan my week)
- [x] Course boards: To do / Doing / Done (course page → Board)
- [x] Files on tasks: photos, PDFs and documents (task editor → Files)
- [x] Printable weekly planner (Upcoming → 🖨️ Print week)
- [x] Break mode that pauses your streak during school breaks (Settings → Goals)
- [x] Keyboard rescheduling with `[` / `]`

## ✅ School

- [x] Timetable: bell schedules, A/B or day 1–4 rotations, classes with rooms, special days (Tools → Timetable)
- [x] "Now: Chemistry, 18 min left · Next: Lunch" on Today
- [x] "Next class" as a due date (task editor)
- [x] Attendance: present / late / absent / excused, with rates and a catch-up task when absent
- [x] Grades: weighted calculator, trend chart, what-if scores, letter scales per course (Tools → Grade calculator)
- [x] Syllabus box: paste a syllabus or snap a photo of the board → dated tasks and breaks (Tools → Syllabus box)
- [x] Transcript with GPA; PowerSchool import

## ✅ Study

- [x] Notecards with smarter review timing (FSRS), Again/Hard/Good/Easy, picture and fill-in-the-blank cards
- [x] Anki `.apkg` import and Anki export; Quizlet paste
- [x] LaTeX math in notes and notecards (`$x^2$`, `$$…$$`)
- [x] Practice tests from Quiz maker sets, with review, "Explain my mistake" (AI), and scores over time (Tools → Practice test)
- [x] Periodic table with electron configurations, molar mass calculator and element notecards (Tools → Compute)
- [x] Essay tools, citation generator (DOI/ISBN lookup), unit converter
- [x] Book reader for PDFs; share a PDF into the app to open it there

## ✅ Games, coins and rewards

- [x] Coins earned only from schoolwork; item shop, deal of the day, daily quests, cosmetics (Play → Shop)
- [x] Casino with play chips (no real money): 13 games, achievements, parent PIN and daily time limit (Play → Casino)
- [x] Arcade with vouchers: built-in games plus games the site admin adds as an HTML file or link (Play → Arcade)
- [x] Arcade games: Breakout, Sudoku, Hangman, Lights Out, Typing defense, Solitaire, Invaders, Lunar lander, Paper-plane glider, and the originals
- [x] Study games from your decks: Boss battle, Match rush, Crossword, Quiz race (Play → Study games)
- [x] Star map: a star for every day you finished something (Play → Star map)

## ✅ Sharing and social (no server needed)

- [x] Study room: a Pomodoro room anyone can join by link (Focus → 👥 Study room)
- [x] Friends by share code: compare streaks and weekly XP only (Stats → Friends)
- [x] Class mode: teachers publish an assignment list; students subscribe (Tools → Connect → Class mode)
- [x] Share my week: a stats image with no task titles (Stats → 📸 Share my week)

## ✅ Sync, accounts and imports

- [x] Sign up / sign in with email and password to sync (Settings → Account; needs a free Supabase project)
- [x] Gist and Google Drive sync; deletions sync (trash keeps tasks 30 days)
- [x] Field-level merge: edits to different fields on two devices both survive
- [x] End-to-end encrypted sync copy with a sync passphrase
- [x] Schoology and Canvas assignment feeds (Tools → Connect)
- [x] Imports: CSV (this app, Todoist, spreadsheets), Google Tasks (Takeout), Anki; exports: CSV, Markdown, calendar (.ics), JSON backup
- [x] Share files and links into the installed app from other apps
- [x] Browser extension: add the page you're on as a task (`extension/`)

## ✅ AI (optional, bring your own key)

- [x] Keys work across providers (Anthropic, OpenAI, Gemini, Groq, OpenRouter, Ollama, custom) with live model lists
- [x] Auto plans for tasks, notecards from notes, quiz generation, scan-paper transcription, syllabus reading
- [x] Usage meter per provider with an optional monthly request limit (Settings → AI helper)

## ✅ Privacy and security

- [x] Lock API keys and tokens with a passphrase (Settings → Privacy & security)
- [x] Content-Security-Policy; uploaded games and code previews run in a sandbox
- [x] Delete everything, including the gist, Drive file and account copy
- [x] "What goes where" privacy page (also PRIVACY.md)
- [x] CORS relay locked to your site and rate-limited

## ✅ Notifications and the installed app

- [x] Reminders through the service worker (work on Android; tapping opens the task)
- [x] Today's count on the app icon; background morning digest on installed Chrome/Edge apps
- [x] Works offline; one-file offline version (Settings → Data)
- [x] "What's new" after updates

## ✅ Languages and accessibility

- [x] Spanish (Settings → Language), including Spanish dates in quick add
- [x] Dates and numbers in your region's format; right-to-left layout support
- [x] High contrast, reading fonts, text size, confetti toggle, reduced motion; contrast checked in every theme

## ✅ Deploying and code health

- [x] One-click deploy configs: Vercel, Netlify, Render, Replit, Cloudflare Pages, Firebase, Docker/Fly.io, GitHub Pages (DEPLOY.md)
- [x] Lint, formatting, type checks, 600+ unit tests and ~100 browser tests (with accessibility checks) in CI
- [x] First-load size budget (currently ~113 kB of 125 kB)

## ⏳ Still open (highlights)

- [ ] Translating the remaining screens (Stats, Tools, Play, most Settings sections) and adding a right-to-left language
- [ ] Microsoft Teams and Microsoft To Do (no feeds; would need a Microsoft Graph app)
- [ ] True push reminders (needs a server), phone widgets and a Capacitor app
- [ ] Swipe gestures, virtual scrolling for very long lists, per-task edit history
- [ ] More casino games (Three Card Poker, Hold'em vs. bots), a virtual pet, a garden, seasonal events
