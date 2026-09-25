# Privacy

Homework To-Do is local-first. It is a static site with no server of its own, no accounts of its own, no analytics, no ads, no trackers and no cookies. Your data stays in your browser unless you switch on one of the optional features below, and each of those talks directly from your browser to the service you chose. The same summary is in the app under **Settings → Privacy & security → What goes where**.

## On this device

| What | Where |
| --- | --- |
| Tasks, courses, templates, notecards, day notes, stats, coins/chips, deletions (tombstones), attachments | IndexedDB (`homework-todo`) |
| Settings, API keys and tokens | localStorage (`homework-todo:settings`). With **Lock my keys** on, keys and tokens are blanked there and kept encrypted in `homework-todo:vault` instead. |
| Account session (only if you sign in) | localStorage (`homework-todo:auth`), managed by the Supabase client |
| Tool drafts, arcade scores, reminder bookkeeping, UI choices | localStorage (`homework-todo:*`) |
| Study room you're in, friends list and your friend-card name, class lists you follow or publish | localStorage (`homework-todo:study-room`, `:friends`, `:friend-profile`, `:class-subs`, `:class-published`); not part of the synced data |
| Google and Spotify access tokens | memory only (gone when the tab closes); the Spotify refresh token is stored like the other keys |
| The app itself (for offline use) | the service worker cache |

Attachments never leave the device: only their names sync. **Settings → Data → Delete everything** removes all of the above (and, if you tick them, the synced copies listed below).

## Optional features and what they send

| Feature | Sent to | What is sent |
| --- | --- | --- |
| GitHub Gist sync | `api.github.com` (and `gist.githubusercontent.com` for large files) | Your data bundle (tasks, courses, templates, notecards, day notes, stats, coins ledger, deletions) into a private gist, with your personal access token. |
| Google Drive sync | `www.googleapis.com` | The same bundle, into the app's private app-data folder in your Drive. |
| Account (email and password) | the site's Supabase project (`*.supabase.co`, or the URL the site admin set) | Your email and password to Supabase Auth, and the same bundle into one database row that only your account can read (row-level security). Settings and keys are never part of it. |
| Google sign-in | `accounts.google.com` (Google Identity Services script) | The standard OAuth sign-in. The Client ID is the only Google setting stored. |
| Gmail scan | `gmail.googleapis.com` | Your search query; the app reads the subject, sender, date and preview line of matching emails (read-only scope). |
| Google Classroom | `classroom.googleapis.com` | Read-only requests for your courses, coursework and your own submissions. |
| Google Calendar push | `www.googleapis.com` | One event per dated task you push: title, course, notes, link and due time. |
| AI helper | the provider you pick: `api.anthropic.com`, `generativelanguage.googleapis.com` (Gemini), `api.groq.com`, `openrouter.ai`, `api.openai.com`, your own endpoint, or Ollama on `localhost` | The prompt for the feature you used (a question, notes or text you paste, a task title, photos you scan) and your own API key. Nothing is sent until you use an AI feature. OpenRouter also receives the site's address as the referrer, as it asks. |
| Schoology | your school's `*.schoology.com` / `api.schoology.com`, directly or through the relay you deploy (`docs/cors-proxy-worker.js`) | The calendar feed request (its URL contains a private token), or API requests signed in the browser with OAuth 1.0a (the consumer key and a signature are sent; the secret is not). The relay sees these requests on their way through. |
| Spotify | `accounts.spotify.com`, `api.spotify.com` | PKCE sign-in, playback commands, your playlists. |
| Music embeds | `open.spotify.com`, `www.youtube.com`, `w.soundcloud.com`, `embed.music.apple.com` | Loaded as embedded players; those sites may set their own cookies. |
| Citation lookup | `api.crossref.org` (DOI), `openlibrary.org` (ISBN) | The DOI or ISBN you look up. |
| Python in the Code tool, on-device OCR | `cdn.jsdelivr.net` | Downloads of the Pyodide and Tesseract engines and data on first use. Your code and photos stay on the device. |
| Java / C++ in the Code tool | `onecompiler.com` | Only a link that opens in a new tab; nothing is sent automatically. |
| Arcade | this site; embed-link games load from their own sites | Games run in sandboxed frames that can't read your data. |
| Study room link | nobody (you send the link yourself) | The link holds the room's name, start time and timer lengths, in the part after `#`, which browsers don't send to the web host. |
| Study room "Show who's in" (only with an account) | the site's Supabase project (Realtime) | The name you type, to the others in the same room while you're in it. Nothing is stored. |
| Friend code | nobody (you send the code yourself) | Your chosen name and emoji, streak, best streak, this week's XP, level and when the code was made. |
| Live friend card (only with an account, off until you turn it on) | the site's Supabase project (`friend_cards` table) | The same card, in one row under a random id. Anyone with the id (your friends, from your code) can read that row; only your account can change it. Turning it off deletes it. Friends' live cards are read by their ids only. |
| Class mode: subscribe | the host of the class list link (usually `gist.githubusercontent.com`) | A plain request for the file (no cookies, no referrer). Nothing about you or your tasks is sent back. |
| Class mode: publish as a gist | `api.github.com`, with your Gist token | A **public** gist with the course name, your teacher name if you typed one, and each assignment's title, due date, type, notes (if ticked) and link. Never grades, completion, time spent or stats. |

## Social features share only what they say

Study rooms, friend codes and class lists were built to work without a server, so nothing is shared unless you send a link or code yourself:

- **Study room links** carry the room, not you. Nobody can see who opened a link unless everyone in the room turns on "Show who's in" with an account.
- **Friend codes** carry only your name, emoji, streak, best streak, this week's XP (and which week), level and the time you made the code (plus a random id so a fresh code replaces the old one, and the live-card id if that's on). No tasks, courses, grades, coins, badges or anything else. Your friends list stays on this device.
- **Class lists** a teacher publishes contain only the course name and color, an optional teacher name, and each assignment's title, due date, type, notes and link. Students' devices only download them; subscribing sends nothing back. Everything in a downloaded list is checked (size, types, lengths, http(s) links only) and shown as plain text or the app's own safe markdown.

## Encryption

- **Lock my keys with a passphrase** (Settings → Privacy & security): API keys, tokens, the Schoology feed link and the sync passphrase are encrypted with AES-256-GCM using a key derived from your passphrase (PBKDF2-SHA-256, 600,000 iterations, random salt). The passphrase is asked once per session and the derived key is kept in memory only. Forgetting it means adding the keys again; your data is not affected.
- **End-to-end encrypt my synced copy**: the Gist, Drive and account copies are encrypted in the browser with your sync passphrase (same algorithms) before upload, so GitHub, Google and the Supabase project only store ciphertext. If you forget the sync passphrase, the synced copy can't be read by anyone; the data on your devices is not affected. Encrypted backups (Settings → Data) use the same format.

See `DECISIONS.md` ("Key lock and end-to-end sync encryption") for the details and limits.

## Security

The production page ships a Content-Security-Policy that only allows connections to the services above and forbids inline scripts (see `src/lib/csp.ts`). Uploaded arcade games and the Code tool's HTML preview run in sandboxed frames with an opaque origin.
