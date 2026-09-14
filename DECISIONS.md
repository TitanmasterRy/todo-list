# Decisions

Deviations from the spec and judgment calls made while building. Each entry says what the spec asked for, what was done, and why.

## Repository name and Vite `base`

The spec says to set Vite `base` to the repo name. The repository is `todo-list` and the project is "Homework To-Do". No tool in this environment can rename a GitHub repository, so the repo was not renamed. Instead, `vite.config.ts` derives `base` from `GITHUB_REPOSITORY` in the Pages workflow (`/<repo>/`) and falls back to `/todo-list/` for local production builds. Renaming the repo on GitHub therefore needs no code change. `VITE_BASE` overrides both.

## Deploy branch

The workflow deploys on push to `main`. This session was required to push to a feature branch (`claude/festive-bardeen-4p9vaq`), so `main` must be created from it (or the branch merged) before the first deploy. The workflow also has `workflow_dispatch` so it can be run by hand.

## Sounds

Sound packs are synthesized with WebAudio (`src/lib/sounds.ts`) instead of bundled files. `public/sounds/` exists per the repo layout but holds only a README. This keeps the bundle small and avoids licensing questions.

## "No date" tasks in Today

The spec says Today shows "no date tasks you dragged in". A task with no due date that is dragged into Today gets a `pinnedDay` field (the day key) rather than a due date, so it stays a no-date task tomorrow. Snoozing or rescheduling clears the pin.

## Reopening a completed task

Reopening decrements the day's completion count and total, but does not claw back XP, streak, or badges. Undoing a completion (toast or Ctrl+Z) does restore the exact previous stats snapshot. This keeps undo honest without making reopen punitive.

## Recurrence anchor

The next instance of a recurring task is the first occurrence strictly after the later of its due day and today, so an overdue daily task completed today yields tomorrow, not a stack of missed days.

## "next <weekday>"

`next fri` means Friday of next week (relative to the configured week start). A bare `fri` means the coming Friday, including today if today is Friday.

## Streak freezes

A freeze is credited once per 7-day milestone (7, 14, 21, …), max 2 banked. When a streak is broken with more missed days than banked freezes, the banked freezes are consumed and the streak resets to 1 on the next completion.

## Gist sync conflict rule

Last-write-wins per task by `updatedAt`. The "conflict notice" fires only when the local and remote `updatedAt` for the same task differ but fall within the same second, as the spec requires.

## Focus restore after dialogs

Every dialog traps Tab focus and, on close, returns focus to the element that had it before. If the quick-add box was focused when a dialog opened (it autofocuses on desktop), focus goes back there, so single-key shortcuts like `1`–`6` are typed into the box until you press `Esc`. This follows the WAI-ARIA dialog pattern and was kept over the alternative of dropping focus on the body.

## Gist sync on a second device

The gist id is stored in localStorage next to the token, so a brand-new device with the same token creates a second gist rather than guessing which existing gist to use. The README documents the export/import-then-connect path. Searching the user's gists for a matching filename was rejected because it would silently pick up an unrelated gist with the same name.

## Icons

The manifest icons are an SVG plus 192/512 PNGs rendered from it. There is no separate maskable PNG; the maskable entry is the SVG with generous padding.

## Weekly review "biggest wins"

XP per task is not stored, so wins are ranked by a proxy: base XP for the priority plus estimate minutes / 10 plus 2 per subtask.

## No demo dataset

The spec asked for a seeded demo dataset on first run. At the owner's request the seed was removed, so the app starts empty. The "Clear demo data" button remains in Settings and the command palette, shown only when `demo_`-prefixed records exist, so browsers that loaded the earlier build can still remove them.

## Schoology integration

The Schoology REST API requires OAuth 1.0a request signing with per-user consumer keys and does not send CORS headers, so a static GitHub Pages site cannot call it. The integration uses the personal iCal calendar feed instead, which every Schoology user can enable. Direct browser fetches of that feed are also blocked by CORS, so the app supports three paths: a user-deployed Cloudflare Worker proxy (source in `docs/cors-proxy-worker.js`, restricted to Schoology feeds), manual upload of the `.ics` file, or pasting its contents. Completion state is not part of the feed, so "complete" means completed in this app.

## AI helper

Optional and off by default. Calls go straight from the browser to the Anthropic API with the user's own key (`dangerouslyAllowBrowser` in the official SDK), the same trust model as the Gist token. Default model is Claude Opus 5. Auto-descriptions do not use the AI by default; a deterministic heuristic covers them offline.

## Critical hits

A 5% chance of double XP on completion is intentional variable reward. It is counted for the Lucky badge and can be turned off with the gamification switch.

## Grade XP is awarded once per task

Entering a score the first time pays XP (`gradedXpAt` marks it). Editing the score later does not pay again, so a student cannot farm XP by retyping grades.
