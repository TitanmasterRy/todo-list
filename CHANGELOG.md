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
