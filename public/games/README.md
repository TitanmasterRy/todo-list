# Arcade games

Everything in this folder is served at `/games/` and listed in the app's **Play → Arcade** tab. Players spend **vouchers** (bought with coins earned from homework) to play.

## Add a game (site admin)

1. **An HTML file:** put `my-game.html` in this folder. It can be a whole game in one file, or load scripts and assets from this folder or a CDN.
   **Or an embed link:** any `https://` URL that allows embedding (itch.io embed links, Scratch `…/embed`, your own hosted game).
2. Add an entry to `games.json`:
   ```json
   { "id": "my-game", "title": "My Game", "emoji": "🎯", "description": "One line about it.",
     "src": "my-game.html", "cost": 1, "minutes": 10, "theme": "arcade", "tags": ["puzzle"] }
   ```
   Use `"url": "https://…"` instead of `"src"` for an embed link.
3. Commit and deploy. Or point `VITE_ARCADE_MANIFEST` at a `games.json` hosted elsewhere to change games without redeploying.

| Field | Meaning |
| --- | --- |
| `id` | Letters, numbers, `-` and `_`. Unique. |
| `title`, `emoji`, `description` | Shown on the game card. |
| `src` | An `.html` file in this folder (no `..`, no absolute paths). |
| `url` | An `https://` embed link (instead of `src`). |
| `cost` | Vouchers per play (0–99, default 1; 0 = free). |
| `minutes` | Optional play time per voucher; the session ends when it runs out. |
| `theme` | Optional theme pack it matches: classic, sleek, cute, arcade, nature, space, paper. |
| `tags` | Optional labels. |

You can also try a game in the app first: **Settings → Arcade admin** lets you upload an HTML file or paste a link, preview it, and copy the `games.json` entry.

## Safety

Games run in a sandboxed iframe. Files from this folder and uploaded HTML run without `allow-same-origin`, so they can't read the app's tasks, keys or storage. Embed links run on their own site's origin.

## Talking to the app

A game can report a score, which the app keeps as that game's high score:

```js
parent.postMessage({ type: 'hwtodo:score', score: 1234 }, '*');
```

The app adds `?theme=<pack>&dark=0|1&accent=%23rrggbb` to `src` games so they can match the look, and `?words=a,b,c` with words from the player's notecards (the word search uses it).
