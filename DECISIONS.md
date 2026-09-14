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
