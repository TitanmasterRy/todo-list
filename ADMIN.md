# Admin panel

A hidden panel for the site owner. It isn't linked anywhere in the app.

## Opening it

Any of these opens the passphrase prompt:

- **Keyboard:** <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>
- **Address:** add `?admin` to the site's address, e.g. `https://you.github.io/todo-list/?admin`
- **Phone:** Settings → Help, tap the version line (e.g. "Pass 7 …") 7 times quickly

The first time on a device you choose an admin passphrase (8+ characters). After that it asks for the passphrase every time the
app is reloaded. Five wrong tries lock the prompt for a few minutes, and the lock gets longer each time.

### One passphrase on every device (recommended)

1. Open the panel → **🔐 Security** → type your passphrase in "Passphrase to hash" → **Make VITE_ADMIN_HASH**.
2. Copy the `pbkdf2$…` line. It's a salted hash, safe to store; it can't be turned back into the passphrase.
3. GitHub Pages: repository **Settings → Secrets and variables → Actions → Variables → New variable**, name `VITE_ADMIN_HASH`,
   value the hash. Other hosts: set the same build environment variable (see [DEPLOY.md](DEPLOY.md)).
4. Redeploy. Now every device uses that passphrase, and nobody can set their own on a fresh device.

## Tabs

| Tab | What it does |
| --- | --- |
| 📊 Overview | Counts of everything stored on this device, storage used, build, service worker, sync status, AI use this month, site switches, errors this session. |
| 🪙 Economy | Give or take coins, chips and vouchers (with a note), give any shop item or unlock them all, set XP, streak, best streak and freezes, and browse or undo any ledger entry. Every change is a ledger entry with reason `admin`. |
| 📣 Site | The announcement banner and feature switches everyone sees (`public/site.json`), and your GitHub publishing settings. |
| 🕹️ Arcade | Add a game (HTML file or embed link), preview it, then **Publish** it to everyone in one click, or take a game off the site. |
| 🗄️ Data | Browse, search, edit, export and delete raw records in IndexedDB (tasks, courses, cards, ledger, …) and localStorage. Reload the app afterwards. |
| 🛠️ Debug | This session's error log (downloadable), a test notification, service-worker update/cache/unregister, and resets for testing (welcome tour, What's new, AI meter, high scores, sent reminders). |
| 🔐 Security | Change the passphrase, make a `VITE_ADMIN_HASH`, and what the panel does and doesn't protect. |

## Publishing to everyone

The app has no server, so site-wide changes are files in the repository. The Site and Arcade tabs can commit them for you:

1. Create a **fine-grained personal access token** on GitHub (Settings → Developer settings → Personal access tokens →
   Fine-grained tokens): repository access **only this repository**, permission **Contents: Read and write**, and an expiry date.
2. Admin panel → **📣 Site** → Publishing: owner, repo and branch (filled in automatically on GitHub Pages), paste the token,
   **Save**, then **Test**.
3. **🚀 Publish to the site** commits `public/site.json`; **Publish** in the Arcade tab commits the game's HTML file and its
   `public/games/games.json` entry. The deploy workflow rebuilds the site, and everyone gets the change within a couple of minutes.

The token is encrypted with your admin passphrase and stored only on this device (it's never synced or included in backups).
Anyone who has the token can change your site, so keep it private, give it an expiry date, and revoke it on GitHub if a
device is lost.

Without a token, **Copy JSON** gives you the file to commit by hand.

### site.json

```json
{
  "announcement": { "id": "a1", "text": "Finals week: good luck!", "level": "party", "link": "https://…", "until": "2026-12-20" },
  "flags": { "casino": false }
}
```

- `level`: `info`, `warn` or `party`. A new text gets a new `id`, so it shows again even to people who closed the last one.
- `until`: the last day it shows.
- `flags`: `casino`, `arcade`, `shop`, `ai`. Missing means on; `false` hides the feature for everyone (people's coins and data are kept).

The app fetches `site.json` fresh on each start (with the last copy kept for offline use).

## What it can and can't do

The whole app runs in the browser, so the panel only changes **this browser's** data, and someone who knows the browser's
developer tools could change their own data without it too. The passphrase keeps the panel away from casual users; the
GitHub token is what actually protects your site.
