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

## Translations and regional formats

No i18n library: the app needs interpolation and plurals, which `Intl.PluralRules` covers, and i18next or svelte-i18n with a message-format parser would cost 30–40 kB of a first-load budget that had about 12 kB left. `src/lib/i18n/index.svelte.ts` is about a hundred lines.

- **Keys.** Flat, dotted keys grouped by screen (`today.dueToday`) in `en.ts`, the source of truth. `MessageKey` is `keyof typeof en`, so a mistyped key is a type error, and `es.ts` is typed `Record<MessageKey, Message>`, so a missing Spanish key is one too. A unit test checks that every translation keeps the English `{placeholders}`. At run time a missing key falls back to English with a warning in dev, for future languages that start partial.
- **Loading.** Every language file, English included, is its own chunk. With the whole app translated the English strings are about 42 kB gzipped (Spanish about 46 kB); the app already waits for IndexedDB before its first render, so `store.init()` loads the language alongside the data and nothing flashes, and the service worker caches the chunk after the first visit. None of it counts toward the first-load budget, which went down because English moved out of the components. If the startup wait ever matters, split each language into an everyday file and a Tools/Settings file loaded after the first render. Tests load English in a Vitest setup file.
- **Reactivity.** The current language is `$state`, and `t()` reads it, so a switch re-renders without a reload. Constant lists with labels (`VIEWS`, `PRIORITY_LABEL`, reminder presets, saved-list ideas, badges, level titles, accent colors, board columns, card ratings, attendance marks, milestone templates) use getters, which keeps their shape and every caller unchanged. Long data lists (element names, quiz subjects) are one message with `|` between the items. Sentences that wrap a bold or linked part use one message with a slot (`{day}`) that the component splits on, instead of translating fragments.
- **Dates.** English keeps the hand-written formats ("Tomorrow 8pm", "Oct 5", "3 days ago"), because `Intl` in English differs by region ("Sept", "5 Oct") and many tests assert these strings. Other languages go through `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` with the browser's region (Auto in `es-MX` formats as `es-MX`). The 12/24-hour and week-start settings still apply.
- **Spanish quick add.** The Spanish patterns turn on when the app is in Spanish, not always, because Spanish collides with English: `mar` is martes but also March, and numeric dates are day/month (`9/10` is 9 October; a "month" over 12 falls back to month/day, so `9/21` still works). Other choices: `a las 5` without a.m./p.m. reads 1–6 as the afternoon; `el próximo viernes` and `el viernes que viene` mean the coming Friday (never today), which is how most speakers use them, while `el viernes de la semana que viene` gives the Friday of next week like English `next fri`; `de la mañana` is a time (a.m.) and `por la mañana` is left alone, so only a bare `mañana` means tomorrow. `!alta`, `!baja`, `!media` and `!urgente` work in every language since they can't mean anything else, and course names match without accents (`#quimica` finds "Química").
- **Right to left.** There is no RTL language yet. `dir` follows the language (Arabic, Hebrew, Persian, Urdu…) or a Settings → Language switch for testing. The shell, sidebar, task rows, menus, modals, toasts and calendar use logical CSS properties (`inset-inline-start`, `margin-inline-start`, `border-inline-end`, `text-align: start`), and directional arrows carry a `.flip` class.
- **Not yet translated:** Stats, Tools, Schoology, Play and most Settings sections (see the roadmap).

## Card games, gifts, seasons and the Play worlds

- **Texas Hold'em is fixed-limit.** No-limit would need bet sizing (for you and the bots) and lets a single hand swing a whole buy-in; fixed-limit keeps each decision to fold, call or raise and each hand small. Blinds 5/10, bets 10 before the turn and 20 after, four bets a round. The bots estimate equity by Monte Carlo from their own cards and the board only (a test checks that other hands don't change their choice), compare it with the pot odds, raise when it's well above a fair share, and bluff now and then; three styles (tight, loose, steady) shift those thresholds. You buy in from your chips and cash out when you leave the table or the casino; chips left at a table when the page closes are returned on the next visit, minus what was already in the pot. A 5% rake (max one big bet) on pots that see a flop keeps it a casino game rather than a chip printer.
- **Three Card Poker and Let It Ride** use standard rules and paytables (Pair Plus 40/30/6/4/1, Ante bonus 5/4/1, Let It Ride 1000/200/50/11/8/5/3/2/1). Tests check the evaluators against the textbook frequencies of all 2,598,960 five-card and 22,100 three-card hands, the exact Pair Plus return, and simulated returns with the documented strategies.
- **Seasonal events** are yearly local-date windows (Halloween Oct 15–Nov 1, finals Dec 1–14 and May 15–Jun 10, winter holidays Dec 15–Jan 5, summer Jun 15–Aug 31) that never overlap. Limited items can only be bought inside their window and stay owned afterwards. Event quests count schoolwork over the whole window and pay coins once per quest per event (ledger ref `event:<season>:<start>:<quest>`), so they fit the "coins only from schoolwork" rule.
- **Gifts** have no server and no signature: a gift code is a random id plus an item id. The sender's ledger gets `item:<id> −1` (`gift:sent`), the receiver's `+1` (`gift:received`) keyed by the gift id, which blocks a second redemption on that device and on every device that syncs the same ledger. A copied code could still be redeemed by someone else first, like a gift card, so gifts are limited to cosmetics bought with coins (never currency, boosts or casino prizes), 3 sent and 3 redeemed a day, and the UI says so.
- **Friend cards version 2** (`HWF2.`) add two opt-in extras for Play → Leaderboards: the chip balance and up to 8 best arcade scores (deck-specific study-game scores stay private). Nothing is added unless a toggle is on, and a card without extras is still written as `HWF1.` so friends on an older version can read it; a v1 code never carries extras.
- **Pet, garden and dungeon are computed, not stored.** The pet's fullness and happiness are replayed from its feedings (coin spends with reason `pet:<food>` in the ledger), pats and finished tasks, so it's the same on every synced device and it can't die, only get sleepy or sad. The garden and dungeon are pure maps of your tasks (garden: every four completions grow a plant, in the course's color; dungeon: courses are floors, tasks rooms in a snake path). The pet's name and look, pats, and the focus companion choice are per-device conveniences in localStorage.
- **Coin rain** fires on a casino payout of 10× the bet or more and on level-ups. It loads on first use and is skipped when reduced motion (the app setting or the OS) is on or confetti is off.

## Watch (Play → 📺 Watch)

- **Own servers and links only.** Jellyfin and Emby get a native browser because their API is open and allows cross-origin requests by default; Plex and everything else is its own web app in a frame. DRM services (Netflix, Hulu, Disney+) refuse framing and can't be played outside their apps, so they're out of scope, and the app ships no channel lists or site lists.
- **connect-src stays closed.** `media-src` and `frame-src` allow any `https:`, which is enough for `<video>` and embeds, but the Jellyfin API and hls.js segment downloads are fetches. Opening `connect-src` to every host would undo the point of the policy (it limits where injected code could send data), so the site owner lists servers in `VITE_MEDIA_SERVERS`. The tab checks the page's policy before signing in and shows the exact origin to add, instead of failing with a network error.
- **Tokens with the other keys.** A server sign-in is one `watchTokens` secret (a JSON map of source id → token), so it's covered by Lock my keys and never leaves the device, without a new storage mechanism. The source list itself is plain localStorage (`homework-todo:watch`, versioned); it holds no secrets.
- **Direct play or HLS.** The browser is asked (`canPlayType`) about the container and codecs the server reports; anything unsure (MKV, HEVC, AC-3…) is converted by the server to H.264/AAC HLS, played by hls.js loaded on demand from jsDelivr (Safari plays HLS itself). Playback start, progress every 10 s and stop are reported so resume points follow the user.
- **Frames.** `sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"` is what video players need; it's safe only because the frame is another origin, so pages from the app's own origin are refused. No referrer is sent, except the origin to YouTube, Vimeo, Twitch and Dailymotion (YouTube's player errors without one). Whether a site refuses framing can't be detected cross-origin, so a hint and "Open in a new tab" appear after 5 seconds.
- **Homework rules** reuse the casino's pieces: settings behind the parent PIN, minutes per day counted while something plays and the page is visible, and a once-per-sitting break reminder. Voucher minutes are a balance that carries over, so a voucher is never lost at midnight.

- **Auto plan.** The steps, plan and tip for new tasks come from `auto.*` messages, so English output is byte-for-byte what it was. In Spanish the title is folded (no accents) and common Spanish words are mapped to the English keywords the parsers already know (“págs.” → “pp.”, “examen” → “exam”, “del 1 al 20” → “1 to 20”), and Spanish course names pick the subject tip; English titles are never rewritten.
- **Not yet translated:** Play (see the roadmap). A unit test lists the handful of Spanish values that are the same as English on purpose (brand names, “Normal”, “Canvas”), so a value copied without translating fails the build.

## Visual overhaul: the design system

The overhaul is a token layer in `src/app.css` rather than a component library: `--accent-2` (a companion hue), `--grad-accent`, `--grad-gold`, `--glow`, layered shadows (`--shadow-sm/--shadow/--shadow-lg`), `--glass`, `--sheen`, and a shared motion vocabulary (`rise-in`, `bump`, `sheen`, `shimmer`, `glow-pulse`, `float`, `wiggle`, `shake`). `--accent-2` is derived from the accent with CSS relative color (`oklch(from var(--accent) …)`) inside `@supports`, with a fixed fallback, so every theme pack and custom accent gets matching gradients without a JavaScript color step. The ambient background is a single fixed `body::before` with three radial gradients, kept under about 20% accent so text on the page background keeps its contrast; high contrast mode hides it. Decorative motion is CSS only, so the existing reduced-motion rule (which zeroes animation and transition durations) covers all of it, and the contrast test's `:root` blocks were left in place, so the audited palettes did not change. Arcade games are standalone HTML, so each carries its own styles and juice inline (no shared file) to keep the sandbox's no-external-files property.


## Stream (Play → 🎮 Stream)

Research done on 2026-10-28 against MoonlightWeb (`linckosz/moonlight-web`) at tag `v0.4.0`: `docs/wiki/05`, `06` and `08`, `docs/design/pairing-signature.md`, `SignalingServer.cpp`, `AuthRoutes.cpp`, `Session.cpp`, `StreamRelay.cpp`, `MediaTrackRelay.cpp`, `InputMessageCodec.h` and the launch route in `main.cpp`. The site's client is our own code written from these notes; nothing was copied (MoonlightWeb is GPL-3.0 and this repository has no licence). Writing it ourselves turned out to be well under twice the work of porting, because the site needs only one transport and none of MoonlightWeb's HDR, enhancer, pacing or share machinery.

**What MoonlightWeb (MW) actually does**

- **Auth.** `POST /api/auth/validate {pin, remember, public_key, machine_name}` sets `mw_session` (`HttpOnly; Secure; SameSite=Strict`, 90-day sliding TTL when `remember` is true, 8 h idle and never persisted when false). `public_key` is the base64 SPKI (DER) of a P-256 key; the reply carries `pairing_key: "bound" | "rejected"`, `host_public_key` (base64 SPKI) and `host_id` (base64url SHA-256 of that SPKI). The key is stored inside the session, so revoking the session revokes the key. Every `/api` request is screened on `Sec-Fetch-Site`/`Origin` (absent on both means a non-browser client, allowed), JSON bodies need `Content-Type: application/json`, and the `Host` header must be a private address or the request loses its session privileges; `10.250.50.10:8443` qualifies.
- **MW-BIND-v1** (on the signaling WebSocket, `/ws`). MW is the offerer and holds its offer until the client's `{type:"hello", key_id, nonce}` (15 s timeout). The offer arrives as `{type:"sdp", sdp, protocol:"MW-BIND-v1", host_id, nonce, sig}`, where `sig` is a raw r‖s ECDSA-P256/SHA-256 signature by the host key over `L("MW-BIND-v1|host") L(host_id) L(key_id) L(nonceB) L(fpH)`. The answer must be `{type:"sdp", sdp, sig}` with `sig` over `L("MW-BIND-v1|browser") L(host_id) L(nonceH) L(fpH) L(fpB)`, where `L(x)` is a 4-byte big-endian length followed by the bytes, the nonces are the raw bytes behind the base64, and `fp` is the single `a=fingerprint:sha-256` value of each SDP in upper-case hex with colons (all fingerprint lines must agree and be sha-256). Anything missing or wrong closes the socket with 1008 "pairing verification failed" before any DTLS state exists. A `hello` with another key id than the session's is refused the same way.
- **Launch.** `POST /api/hosts/:id/start` with `appId`, `stream_height`, `stream_aspect` ("W:H": the width is `height × W/H`, so sending the exact pixel ratio gives the exact width), `stream_fps`, `stream_bitrate` (kbps), `video_codec`, `transport_mode`, `client_uniqueid` (hex, ≤ 32). It answers `{transport, transport_chain, transport_index, signalingUrl | wsUrl, videoCodec, …}`, or `409 {code:"app_running", runningAppId}` on Apollo when another app runs. `POST /quit {client_uniqueid, quit_app?}` is a *disconnect* on Apollo (the app keeps running) unless `quit_app` is true; `POST /stop-session` cancels every stream on the host and closes the app. `GET /api/hosts` lists hosts (`uuid`, `name`, `state: online|offline`, `pairState`), `GET /api/hosts/:id/apps` lists `{id, name, boxArt}`, `GET /api/hosts/:id/appasset?appid=` is the PNG.
- **Transports.** `webrtc-media-udp` sends RTP H.264 video and Opus audio (`stereo=1`) tracks plus one JSON `input` DataChannel (`negotiated: true, id: 1`); `webrtc-dc-*` fragments video into DataChannel messages for WebCodecs; the `-tcp` variants only add MW's own ICE-TCP candidates. `wss` is MW's `StreamRelay` on `/ws/stream`: one WebSocket, binary `[0x01][flags][Annex-B access unit]` for video (flag bit 0 = keyframe) and `[0x02][0x00][Opus packet]` for audio, JSON input as text messages; it exists only when the client is not on MW's rendezvous, which the gateway isn't. The in-band "fallback-ws" switch on the signaling socket is dead in worker mode (the worker always runs in auto mode), so `wss` is the only WebSocket transport.
- **Input** is JSON on the `input` channel: `keydown`/`keyup {keyCode (Windows VK), code, shiftKey, ctrlKey, altKey, metaKey}`, `mousemove {dx, dy}` (relative) or `{x, y, referenceWidth, referenceHeight}` (absolute), `mousedown`/`mouseup {button: 1 left, 2 middle, 3 right, 4 back, 5 forward}`, `mousewheel`/`mousehwheel {delta}` in 120ths of a notch (integers), `gamepadconnect {index, mask, ctype, rumble}`, `gamepad {index, mask, buttons, lt, rt, lx, ly, rx, ry}` (GameStream button flags, sticks −32768…32767 with up positive), `gamepaddisconnect`, `inputstate` (held-key heartbeat for MW's dead-man switch), `requestidr`, `ping {seq, ts}` → `pong`. MW pushes `stats`, `session-ended`, `host-ended`, `takeover`, `revoked` on the same channel.
- **ICE.** On every signaling connection MW first sends `{type:"ice-config", iceServers: [], iceTimeoutMs}` (empty in LAN-only mode) and gathers only host candidates; the gateway is on a private network, so MW treats it as a LAN client (8 s ICE timeout) and offers `10.250.50.10:48550`. The gateway must not send `X-Forwarded-For` to MW, or MW plans for the internet instead.
- **Admin key.** Only 🏠 writes need `X-MW-Admin-Key`. Everything the gateway uses is 🔑 (`validate`, `hosts`, `apps`, `appasset`, `start`, `quit`, `stop-session`, `logout`), so it never needs admin rights.

**Gateway design (confirmed).** The gateway is MW's one "browser": one remembered `mw_session`, its own P-256 pairing key and a fixed `client_uniqueid`, all in `/data/state.json` (0600). It performs MW-BIND-v1 itself: it sends the hello, **verifies the host's signature with the pinned `host_public_key` before the offer goes anywhere**, strips the binding fields, and forwards a plain offer to the real browser; when the browser's answer comes back, it extracts the browser's fingerprint, signs it with the gateway key and forwards the signed answer. The browser therefore holds the DTLS session straight with MW (through TURN), and the gateway never sees media on the WebRTC path. The browser can't check MW's signature itself (it has no MW key), so its trust in the offer comes from the gateway's TLS certificate and its own sign-in; that is the same trust it already gives the site. MW's `ice-config` is replaced with our TURN servers (fresh REST credentials per message); offer, answer and candidates are otherwise passed through. MW's HTTPS certificate is pinned by SHA-256: the gateway opens the TLS socket itself, compares the leaf fingerprint in constant time and only then sends HTTP or the WebSocket handshake over it, so a wrong certificate never receives the cookie.

**Transport: `webrtc-dc-udp`** (changed from `webrtc-media-udp` after the first homelab test). The first choice was `webrtc-media-udp`, because the browser would decode H.264 into a plain `<video>` with no client code. On the real stack it gave video but **no audio**: the browser never got the Opus track, and MoonlightWeb's own page on the same transport failed on the audio section with Chrome's "Failed to setup RTCP mux". Reading libdatachannel at the commit MoonlightWeb v0.4.0 pins (`ca9a141f`) showed a normal offer (every section in the BUNDLE group, each with `a=rtcp-mux`), so the cause wasn't found from the source. `webrtc-dc-udp` sends audio through the same Opus RTP track code (MoonlightWeb's docs: "DataChannelRelay and MediaTrackRelay are identical here"), and it is the mode the homelab already saw play sound. It is also MoonlightWeb's default and measured 35–45 ms faster click-to-photon in their benches. On this mode, video arrives as chunks on a negotiated `video` DataChannel (id 0, ordered, 500 ms lifetime) with a 17-byte header; `src/lib/stream/video.ts` puts them back together and decodes them with WebCodecs onto a canvas (the same decoder the WebSocket mode uses), and a lost chunk stops decoding and asks for a keyframe (`requestidr`). Audio is the RTP track in an `<audio>` element. Input is the `input` channel (id 2 on this transport, not 1). H.264 is still the only codec asked for: hardware decoders handle it everywhere, and NVENC's H.264 limit (4096 pixels wide) covers 2560×1600 and 2880×1800 laptops; the client caps the request at 4096×2304. The `-tcp` variant isn't needed: with `iceTransportPolicy: "relay"` the browser→TURN leg is chosen by the TURN URL (UDP 3478, TCP 3478 or TLS 5349), and the coturn→MW leg is always UDP.

**WebSocket fallback (443-only networks).** `POST /sessions` with `transport: "ws"` launches MW with `transport_mode: "wss"`; the browser opens `wss://play…/sessions/:id/media` and the gateway pipes it to MW's `/ws/stream` frame by frame. The client decodes video with WebCodecs (`VideoDecoder`, Annex-B H.264, codec string read from the SPS) onto a canvas and audio with WebCodecs `AudioDecoder` (Opus) scheduled on an `AudioContext` with a small (~80 ms) buffer. This is the worst latency path and is only used when the connection test says TURN is unreachable, or when the user picks it.

**Gateway ↔ browser contract.** Signaling: the browser opens `wss://play…/sessions/:id/signal` and its first message is `{type:"auth", ticket}` with the one-time ticket (60 s, single use) from `POST /sessions`; the bearer token is never in a URL. Every HTTP route and WebSocket upgrade checks `Origin` against `ALLOWED_ORIGIN`. Access tokens are HS256 JWTs (15 min) signed with `GATEWAY_SIGNING_KEY`; refresh tokens are random 32-byte values kept hashed on disk (12 h, rotated on every refresh, reuse of an old one revokes the whole family); a session family dies 12 h after sign-in whatever happens. `revoke-all` bumps a generation number that every access token carries, drops all refresh tokens, and ends any stream (MW `quit` with `quit_app: false`, then `stop-session`). TOTP is RFC 6238 (SHA-1, 6 digits, 30 s, ±1 step, a code can't be used twice); 10 single-use backup codes are stored as SHA-256. The QR is made by the gateway as an SVG and shown in an `<img>`, so the site needs no QR library. Login is limited per IP (5 failures → 15 min lockout, IP from the last `X-Forwarded-For` hop, i.e. exactly one trusted proxy) and globally (20 failures in 15 min → everyone waits 15 min).

**Client choices.** The refresh token is a secret slot (`streamToken`) with the other keys, so "Lock my keys" covers it; the access token lives in memory only. The requested size is the screen in device pixels (`screen.width × devicePixelRatio`, rounded to even numbers) and the refresh rate measured with `requestAnimationFrame`, both editable. Keyboard keys are sent by physical position (`KeyboardEvent.code` → Windows VK), like MW's "positional" mode, so games see real keys on any layout. The Stream tab ignores the Watch tab's homework rules (Settings → Economy), as asked.

### For the homelab session

- **Apollo's virtual display is not automatic.** Apollo (`src/process.cpp`) creates a SudoVDA display only for Headless Mode, an app with *Always create Virtual Display*, a paired client with *Always create virtual display*, a launch with `virtualDisplay=1` (Artemis only; MoonlightWeb sends the plain GameStream launch), or no active monitor. Turn it on for the MoonlightWeb client: Apollo web UI → PIN → paired clients → MoonlightWeb → *Always create virtual display*. The size and rate then come from MoonlightWeb's `mode=WxHxFPS`, which is what the browser asked for. If Apollo's app list has no *Virtual Display* entry, the SudoVDA driver isn't working.
- `play.levitica.duckdns.org` → `stream-gateway:8080` in NPM, **with WebSockets support on** (signaling and the WS fallback are WebSockets), and NPM must set `X-Forwarded-For` (it does by default). No access list or Authelia in front.
- coturn must be able to reach `10.250.50.10:48550/udp` from its relay address (the relayed address the browser gets must be routable to MW, e.g. coturn on the `stream` network or routing from its relay IP), with `allowed-peer-ip=10.250.50.10` despite any `denied-peer-ip` for private ranges. `TURN_SECRET` must equal coturn's `static-auth-secret`.
- MW's `transport_mode` setting doesn't matter: the gateway names the transport on every launch.
- First run: `docker exec -i stream-gateway node dist/cli.js hash-password` (reads the password on stdin, prints the argon2id hash for `GATEWAY_PASSWORD_HASH`), `openssl rand -base64 48` for `GATEWAY_SIGNING_KEY`, then after the container is up `docker exec -i stream-gateway node dist/cli.js link-mw` with a PIN from `moonlightweb --new-pin` on stdin. `MW_CERT_SHA256` is `openssl s_client -connect 10.250.50.10:8443 </dev/null 2>/dev/null | openssl x509 -noout -fingerprint -sha256` (with or without colons).

**Built (2026-10-28).** Notes from the implementation:

- **Content-Security-Policy.** `VITE_STREAM_SERVER` adds the gateway's `https://` and `wss://` origins to `connect-src` (`streamOrigins()` in `src/lib/csp.ts`); TURN URLs aren't covered by CSP. Nothing else needed opening: WebCodecs decoders, `AudioContext` and `RTCPeerConnection` aren't CSP-governed, a `MediaStream` in `audio.srcObject` isn't a fetch, the QR code is a `data:` image and box art a `blob:` image (both already in `img-src`). The Playwright suite runs against the production build with the policy on and fails on any violation, so the Stream spec checks this. No AudioWorklet or WebGPU was needed: both modes draw decoded frames to a 2D canvas, and the WebSocket mode schedules decoded audio with `AudioBufferSourceNode`s.
- **Connection test before launch.** It runs once per visit before the first stream and its verdict picks the transport when Connection is *Automatic*. The three relay probes run at the same time, so a network that blocks them all costs one 8-second timeout, not three.
- **Gateway state has one writer.** `link-mw` and `reset-totp` ask the running server over `127.0.0.1:8081` inside the container instead of editing `state.json` themselves, so a CLI write can't be overwritten by the server's next save.
- **Translations.** The Play area is otherwise English-only; the Stream tab's text is in `en.ts`/`es.ts` as asked, and `src/lib/stream/` returns message keys (connection-test steps and verdicts, end and failure reasons) instead of English text.
- **No Docker daemon in the build session**, so the image wasn't built here. The same steps (clean `npm ci`, `tsc`, `npm prune --omit=dev`, `node dist/server.js`, the CLI) were run by hand against a fake TLS MoonlightWeb with a pinned self-signed certificate: link, `/health`, and the origin check behave as documented.
