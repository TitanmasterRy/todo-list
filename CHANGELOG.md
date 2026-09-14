# Changelog

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
