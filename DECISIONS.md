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

The spec asked for a seeded demo dataset on first run. At the owner's request the seed was removed, so the app starts empty. The "Clear demo data" button that stayed behind for browsers that loaded the earliest build has since been removed.

## Schoology integration

The Schoology REST API requires OAuth 1.0a request signing with per-user consumer keys and does not send CORS headers, so a static GitHub Pages site cannot call it. The integration uses the personal iCal calendar feed instead, which every Schoology user can enable. Direct browser fetches of that feed are also blocked by CORS, so the app supports three paths: a user-deployed Cloudflare Worker proxy (source in `docs/cors-proxy-worker.js`, restricted to Schoology feeds), manual upload of the `.ics` file, or pasting its contents. Completion state is not part of the feed, so "complete" means completed in this app.

## AI helper

Optional and off by default. Calls go straight from the browser to the Anthropic API with the user's own key (`dangerouslyAllowBrowser` in the official SDK), the same trust model as the Gist token. Default model is Claude Opus 5. Auto-descriptions do not use the AI by default; a deterministic heuristic covers them offline.

## Critical hits

A 5% chance of double XP on completion is intentional variable reward. It is counted for the Lucky badge and can be turned off with the gamification switch.

## Grade XP is awarded once per task

Entering a score the first time pays XP (`gradedXpAt` marks it). Editing the score later does not pay again, so a student cannot farm XP by retyping grades.

## Schoology "simple sign-in"

Schoology offers no OAuth sign-in for third-party web apps. The closest thing is the per-user API key/secret on `app.schoology.com/api`, so "sign in" is pasting those once. The app signs requests with OAuth 1.0a (HMAC-SHA1 via WebCrypto) in the browser and sends them through the user's own Cloudflare Worker relay because `api.schoology.com` sends no CORS headers. Some schools disable student API access; the calendar-feed mode remains for them.

## Google as the optional account system

Rather than building a backend with accounts, "sign in to sync" is Google sign-in (Google Identity Services, implicit token flow) with the data file in Drive's hidden app folder. It needs the user's own OAuth client ID because the project cannot ship one; the setup panel walks through creating it.

## Spotify and Apple Music

Spotify supports PKCE from a static site, so full Connect control (including device transfer) is implemented; Spotify limits playback control to Premium accounts. Apple Music's MusicKit requires a paid developer token, so Apple Music (and YouTube, SoundCloud) use their embedded players instead.

## PowerSchool

There is no student-facing PowerSchool API, and scraping the portal through a relay would require sending the student's password through it. The import reads a saved or pasted Grades and Attendance page instead.

## Offline single-file build

`npm run build:lite` inlines the whole app into `dist/lite/index.html` (served at `/lite/index.html`, and offered as a download in Settings). It runs from `file://`, stores data in that browser profile's IndexedDB, and skips the service worker, Gist/Google/Schoology sync and AI calls that need the network.

## Quiz exports

Game platforms have no public write APIs for third parties, so exports match each platform's official import format: Quizlet's paste importer (tab / newline), Blooket's and Gimkit's spreadsheet importers (CSV), Kahoot's spreadsheet template, and IMS QTI 1.2 for Schoology (also accepted by Canvas, Moodle and Blackboard).

## Deletions sync as tombstones

Deleting used to remove the record outright, so a merge with another device's copy brought it back. Deletions now leave a small tombstone (`kind`, `id`, `deletedAt`) that syncs with everything else; an item is dropped when its tombstone is newer than its last edit, so restoring (which stamps a fresh `updatedAt`) wins over an older deletion. Tombstones are forgotten after 60 days, and task tombstones carry a snapshot for 30 days, which is what the Trash shows.

## Base path

GitHub Pages serves project sites from `/<repo>/`; every other host serves from `/`. The default is now `/`, and the Pages workflow opts into `/<repo>/` with `GITHUB_PAGES=true`. Local `npm run preview` therefore serves at `/`.

## Accounts use Supabase

"Make an account with an email and password" needs a server that stores password hashes, sends confirmation and reset emails, and rate-limits sign-ins. A static site can't do that, and a hand-rolled Worker would have to reimplement all of it (and couldn't send email without another service). Supabase's free tier provides it, and row-level security keeps each user's row private, so the public anon key can ship in the bundle. The site admin sets it up once (`docs/supabase.sql`, two build variables). Writes are conditional on a `version` column so two devices syncing at the same moment re-merge instead of overwriting. Settings and API keys are not part of the synced bundle.

## AI requests and thinking models

Current Claude models (and Gemini 2.5, Qwen3, OpenAI o-series) reason before answering, and that reasoning counts against the output limit. The old limits (16 tokens for the key test, 2,048 for answers) left nothing for the answer, which looked like a broken key. Anthropic requests now allow 16,000 output tokens (you pay only for what's used) with `effort: low` for quick calls, OpenAI-compatible calls get per-provider minimums, and OpenAI reasoning models get `max_completion_tokens` without `temperature`. The key test lists the provider's live models first, so a retired model id is replaced automatically. Claude Opus 5 requests include server-side refusal fallbacks and retry without them if the key can't use that beta.

## Economy is a ledger

Stats merge by "highest XP wins", which would resurrect spent coins across devices. The wallet is instead an append-only list of entries with unique ids (earn, spend, reversal), so merging is a set union and balances are sums. Undo adds a reversal entry instead of deleting one, because deleted entries would come back from another device.

## Casino design

The casino uses play chips only. Chips are bought with coins earned from schoolwork and can't be converted back, so the casino can't inflate the economy or become a way to skip homework. Every game uses `crypto.getRandomValues`, shows its odds, and has a tested payout table (returns between 89% and 99.5%). A homework-break reminder fires after 20 minutes of play by default, and the whole casino can be switched off in Settings without affecting the rest of the economy.

## Arcade games and the sandbox

Admin-added games are arbitrary HTML, so they run in an iframe sandbox without `allow-same-origin`: files from `public/games/` and uploaded HTML get an opaque origin and can't read the app's IndexedDB, localStorage or keys (verified in the browser test). External embed links run on their own origin and keep `allow-same-origin` because many embeds need their own storage to load. Games talk to the app only through `postMessage` score reports. The site-wide list is `games.json` because a static site has no admin backend; the in-app admin panel stores trial games in that browser and exports the `games.json` entry.

## Key lock and end-to-end sync encryption

Both use WebCrypto only (no library): PBKDF2-HMAC-SHA-256 with a random 16-byte salt derives an AES-256-GCM key, and every message gets a fresh 12-byte IV (`src/lib/crypto.ts`). The roadmap asked for at least 310,000 iterations; the app uses 600,000 (OWASP's current figure for SHA-256) and refuses anything under 310,000 when reading, so a tampered file can't downgrade it. GCM authenticates, so a wrong passphrase fails cleanly instead of producing garbage, and that is how "wrong passphrase" is detected. Argon2 would resist GPUs better but isn't in WebCrypto; a WASM build would add weight to every page for a feature few people turn on.

**Key lock.** Each secret is its own "slot" (every AI provider's key separately) and is encrypted on its own in `homework-todo:vault`, next to a check value, while the settings copy has the secrets blanked. Encrypting slots separately lets a locked vault still remove a key (Disconnect) without the passphrase, and lets the UI show "key saved" without decrypting. The trade-off is that someone with the device can see *which* services are configured, not the keys. The derived key stays in memory, never in sessionStorage, so a reload asks again. Asking at every startup would be the simplest rule but is annoying for people who only use AI now and then, and asking only on use would let Gist or Schoology sync stop silently. So the app asks at startup only when something that runs in the background (Gist, Schoology, Spotify, or an encrypted sync) needs a locked key, and otherwise the first time a feature needs one; background work skips quietly while locked and resumes on unlock. All reads go through `secret()` / `hasSecret()` / `useSecret()` in `secrets.svelte.ts`. Not covered: the Supabase sign-in session, which its client library stores itself (`homework-todo:auth`); signing out removes it. The lock protects keys at rest (a shared computer, a copied browser profile), not against script running in the page.

**Sync encryption.** A separate sync passphrase (not the key-lock passphrase, which is per device) wraps the whole bundle in `{ "hwtodoEncrypted": 1, "kdf", "iter", "cipher", "salt", "iv", "data" }` before it goes to the Gist, Drive or the account row, and backups can use the same format. Plain copies from before still read, and the next write replaces them (the account sync also rewrites a copy whose format doesn't match what the device wants, even when the data is the same). A device that finds an encrypted copy it can't open reports it and stops pushing to that copy, so it can't overwrite the encrypted data with plain text; with encryption on, a locked passphrase blocks the upload instead of falling back to plain text. After a passphrase change, the old passphrase is kept in memory for the session so the old copy can be read once and rewritten. Derived keys are cached per salt for the session so the debounced pushes don't pay for PBKDF2 each time. No compression: the envelope is about a third larger than the JSON.

## Content-Security-Policy

The policy is a `<meta>` tag added at build time (`src/lib/csp.ts`), because the app is deployed to many static hosts with different header syntax, and a header would also cover the arcade game files. It has no `'unsafe-inline'` for scripts, which is what stops injected markup from running. It does allow `'unsafe-eval'`: the Code tool runs JavaScript with `new Function` in a blob: worker, which inherits the page's policy, and Pyodide needs it too. `img-src` and `frame-src` allow any `https:` because notecard pictures, album art and embed-link arcade games come from anywhere. Hosts only known at run time (a custom AI endpoint, a relay not on `*.workers.dev`) have to be added with `VITE_CSP_CONNECT`; the error message says so. `srcdoc` frames inherit the page's policy, so uploaded games and the HTML preview now load `public/sandbox.html` in the same sandbox (no `allow-same-origin`) and receive the HTML by `postMessage`; the page refuses to render unless its origin is opaque, so it can't be abused as a same-origin XSS gadget. The offline single-file build keeps `srcdoc` and has no policy.

## Delete everything

Remote copies are deleted first (the tokens are still there), one at a time, each with its own result; the local wipe runs regardless of their outcome, because a network error shouldn't leave data on a device the user wanted cleared. The account's login itself can't be deleted from the browser with the public anon key, so only its data row is removed and the dialog says so.


## Social features without a server

The roadmap's social items (study rooms, friends, class mode) would normally need a backend. The site has none, so each one was designed to work from links alone, with a server used only for the parts that truly need one, and only when the site already has an account project.

- **Study rooms** are a pure function of the link: `{name, start, work, break, long break, every N, rounds}` in a base64url code, and `phaseAt(room, now)` in `src/lib/studyroom.ts` gives every device the same phase, round and end time from its own clock. There's nothing to keep in sync, so it works offline; the cost is that it depends on device clocks (phones and laptops sync to network time, so they agree within a second or so) and a room can't be paused or changed after the link goes out (make a new room instead). Knowing who's in can't be done from a link, so the UI says so; with a signed-in account, "Show who's in" uses Supabase Realtime presence (an ephemeral channel, nothing stored). Codes live in the URL hash so they don't reach the web host's logs.
- **Friends** swap an unsigned snapshot card (`HWF1.` + base64url JSON: name, emoji, streak, best, this week's XP and which week, level, time). It's not signed because there's nothing to protect: someone can type a fake streak into a code as easily as tell you a fake number. Cards are validated like any untrusted input, older cards never replace newer ones, weekly XP counts only in the week it was earned, and old cards show their age with a nudge to swap fresh codes. Optional live cards use one `friend_cards` row per person under a random public id (a fresh one when live is turned on, so an old code can't be used to claim the row first); RLS lets only the owner write it, and reads go through a `security definer` function that returns rows by id only, so the table can't be enumerated with the public anon key. The friends list is per device and not part of the synced bundle, which keeps the bundle format (and its merge rules) unchanged.
- **Class mode** is a static file: a class list JSON (and an `.ics` for calendar apps) the teacher downloads, hosts, or publishes as a public gist with the existing Gist token (the raw URL without the revision always serves the latest). Gists serve raw files with CORS, which is why they're the recommended host; other hosts need CORS and a `VITE_CSP_CONNECT` entry, and the Schoology relay isn't reused because it's deliberately limited to `*.schoology.com`. Students' devices fetch the list on load and on demand and apply it through the same `diffAssignments` / `applySyncDiff` path as Schoology, with `source: 'class'` and external ids namespaced `class:<list>:<item>`, so edits the student makes (notes, completion, deletion) survive refreshes. Items the teacher removes aren't deleted from students' lists; the subscription shows how many are no longer listed, and unsubscribing can remove the open ones. The list is untrusted: size (512 kB, streamed), item count, string lengths, date formats, types and http(s)-only links are checked, and text is only ever rendered as text or the app's safe markdown. A teacher could put anything in a gist, so nothing in a class list can do more than a pasted task could.
- **Study buddy matching** was left as a follow-up (see ROADMAP): pairing students who don't already know each other needs a server that knows class membership, plus moderation.
