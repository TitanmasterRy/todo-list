# Arcade games

Everything in this folder is served at `/games/` and listed in the app's **Play → Arcade** tab. Players spend **vouchers** (bought with coins earned from homework) to play.

## Add a game to your own arcade (anyone)

**Play → Arcade → ➕ Add a game.** Drop in an `.html` file, a `.js` file, a `.zip` of a web game, several files or a whole
folder; or paste HTML/JavaScript; or paste a link (Scratch, CodePen, JSFiddle, Replit and Khan Academy links become their embed
versions). Scripts, styles, pictures and sounds next to the page are packed into one file so the game works offline. Pasted
JavaScript gets a full-screen `<canvas id="game">`. Games added this way live in that browser; with a parent PIN set, adding one
asks for it. The site admin can then publish any of them to everyone from the admin panel.

### Coins for power-ups

A game can sell power-ups for coins: post `{ type: 'hwtodo:buy', id, label, cost }` (cost 1–50) to `parent`; the player
confirms in the app, and the game gets `{ type: 'hwtodo:bought', id }` or `{ type: 'hwtodo:denied', id, reason }`. Post
`{ type: 'hwtodo:hello' }` at startup to receive `{ type: 'hwtodo:wallet', coins }` (it's also sent after each purchase).
At most 200 coins per sitting.

## Add a game for everyone (site admin)

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

You can also try a game in the app first: the hidden **admin panel** (see [ADMIN.md](../../ADMIN.md)) lets you upload an HTML file or paste a link, preview it, and publish it (or copy the `games.json` entry).

## Safety

Games run in a sandboxed iframe. Files from this folder and uploaded HTML run without `allow-same-origin`, so they can't read the app's tasks, keys or storage. Embed links run on their own site's origin.

## Talking to the app

A game can report a score, which the app keeps as that game's high score:

```js
parent.postMessage({ type: 'hwtodo:score', score: 1234 }, '*');
```

The app adds `?theme=<pack>&dark=0|1&accent=%23rrggbb` to `src` games so they can match the look, and `?words=a,b,c` with words from the player's notecards (the word search uses it).
