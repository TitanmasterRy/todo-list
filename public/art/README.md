# Art slots

Drop generated images into this folder and list them in `manifest.json`; the app swaps them in for its drawn
(CSS/SVG) art automatically. Anything not listed keeps the drawn version, so a partial set is fine.

```json
{ "files": ["casino/card-back.webp", "casino/chip-25.webp"] }
```

Paths are relative to `public/art/`. The manifest is fetched fresh (not precached); images are cached by the service
worker the first time they load. Use WebP (quality 80–90). Keep each file small (most under 60 kB, the lobby tiles
under 90 kB). Everything is original art: no real casino brands, logos or trademarked characters.

Shared style: premium casino look, rich but friendly (a homework app for students), warm gold trim (#e7b84a), deep
felt greens, crimson and midnight blue, soft studio lighting, crisp edges, no text unless noted.

## Casino

| Slot                                  | Used for                                                                                              | Size (px)        | Transparency                        | Notes                                                                                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `casino/table-felt.webp`              | The felt on every table (tiled under a vignette and the gold/wood rail)                               | 512×512          | Opaque                              | Must tile seamlessly. Subtle green woven felt with gentle noise; no pattern, logo or light falloff (the vignette is added on top). It is used for the blue, red and purple tables too, so keep it low-contrast. |
| `casino/card-back.webp`               | Back of every playing card                                                                            | 250×350 (5:7)    | Opaque                              | Symmetric under 180° rotation. Fill the whole image; the app adds the white border and rounded corners.                                                                                                      |
| `casino/chip-1.webp`                  | 1 chip (white/blue)                                                                                   | 256×256          | Transparent outside the chip        | Chip seen straight from above, centered, filling the square. **Leave the center inlay blank**: the app prints the value on it. Edge stripes in the chip's colors.                                          |
| `casino/chip-5.webp`                  | 5 chip (red); also the 10 chip, tinted blue by the app                                                | 256×256          | Transparent                         | As above. Red base with white edge stripes.                                                                                                                                                                  |
| `casino/chip-25.webp`                 | 25 chip (green)                                                                                       | 256×256          | Transparent                         | As above.                                                                                                                                                                                                   |
| `casino/chip-100.webp`                | 100 chip (black)                                                                                      | 256×256          | Transparent                         | As above, cream stripes.                                                                                                                                                                                    |
| `casino/chip-500.webp`                | 500 chip (purple)                                                                                     | 256×256          | Transparent                         | As above, gold stripes.                                                                                                                                                                                     |
| `casino/chip-1000.webp`               | 1K chip (orange/gold)                                                                                 | 256×256          | Transparent                         | As above, black stripes.                                                                                                                                                                                    |
| `casino/lobby/<gameId>.webp`          | Lobby tile art, and the small icon next to the game's title                                           | 640×400 (16:10)  | Opaque                              | One per game: `blackjack`, `roulette`, `baccarat`, `craps`, `videopoker`, `threecard`, `letitride`, `holdem`, `hilo`, `slots`, `wheel`, `plinko`, `keno`, `mines`, `dice`, `scratch`. Keep the subject centered (tiles crop slightly and zoom on hover); no game name text. |
| `casino/dealer-tess.webp`             | Tess the owl: Blackjack dealer, Hold'em player                                                        | 256×256          | Opaque or transparent (shown round) | Friendly original owl character in a dealer's vest/bow tie, head and shoulders, facing the viewer. Shown in a circle: keep the face inside the middle 80%.                                                  |
| `casino/dealer-lou.webp`              | Lou the fox: Baccarat and Let It Ride dealer, Hold'em player                                          | 256×256          | As above                            | Sly but kind original fox with a green dealer visor.                                                                                                                                                        |
| `casino/dealer-sam.webp`              | Sam the bear: Three Card Poker dealer, Hold'em player                                                 | 256×256          | As above                            | Calm original bear with a blue bow tie.                                                                                                                                                                     |
| `casino/slots/<symbolId>.webp`        | Slot reel symbols and the slots paytable                                                              | 256×256          | Transparent                         | One object, centered, about 80% of the square, soft drop shadow baked in or none (the app adds one). Ids per theme pack below.                                                                             |
| `casino/scratch-foil.webp`            | The silver scratch-off layer on scratch cards (painted over the drawn foil)                           | 256×256          | Opaque                              | Must tile seamlessly. Metallic silver foil with fine sparkle; no text.                                                                                                                                      |
| `casino/roulette-wheel.webp`          | The spinning roulette wheel face (the ball is drawn on top)                                           | 1024×1024        | Transparent outside the wheel       | Top-down European wheel: pocket **0 centered at 12 o'clock**, pockets clockwise in the standard order 0-32-15-19-4-21-2-25-17-34-6-27-13-36-11-30-8-23-10-5-24-16-33-1-20-14-31-9-22-18-29-7-28-12-35-3-26. Wheel fills the square; the pocket ring sits between about 56% and 77% of the radius (the ball settles at 66%), with a plain ball track from 78% to 100% where the ball orbits. |
| `casino/big-win.webp`                 | Banner behind the payout on big wins (10× the stake and up)                                           | 960×360          | Transparent                         | A celebratory gold ribbon/burst with room in the center-bottom for the number the app draws below it. May include the words "BIG WIN".                                                                     |

### Slot symbol ids

Same order as the reels' symbols (most common first); the last one is the top prize. Ids shared between packs share art.

| Theme pack | Ids                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------- |
| classic    | `cherry`, `lemon`, `bell`, `clover`, `diamond`, `seven`                                  |
| sleek      | `sleek-diamond`, `sleek-circle`, `sleek-triangle`, `sleek-square`, `sleek-star`, `sleek-sparkle` |
| cute       | `strawberry`, `cupcake`, `cat`, `bunny`, `unicorn`, `rainbow`                            |
| arcade     | `cherry`, `alien`, `joystick`, `money-bag`, `crown`, `trophy`                            |
| nature     | `leaf`, `sunflower`, `mushroom`, `bee`, `butterfly`, `tree`                              |
| space      | `comet`, `moon`, `planet`, `ufo`, `rocket`, `galaxy`                                     |
| paper      | `pencil`, `paperclip`, `ruler`, `notebook`, `scroll`, `pen`                              |
