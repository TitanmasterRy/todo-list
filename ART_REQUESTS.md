# Art requests (for an image generator)

The app's visuals today are emoji, CSS and hand-drawn SVG. That covers layout, animation and simple shapes, but not
illustrations, characters, textures or detailed icons. This file lists every piece of art that would make the site look
better, with exact file names and sizes, so an image generator can produce it and the files can drop straight in.

## How to deliver

- **Format:** `.webp` (quality ~85). Transparent background unless the entry says "opaque".
- **Where:** `public/art/<path>` exactly as named below (e.g. `public/art/casino/chip-25.webp`).
- **Register it:** add the path to `public/art/manifest.json` → `{ "files": ["casino/chip-25.webp", …] }`. The app only uses
  files listed there, and falls back to the current look for anything missing, so art can arrive a bit at a time.
- **Sizes** are the delivered pixel size (about 2× the on-screen size, for sharp phones). Keep files small: under 150 kB
  each, under 60 kB for icons.
- **Wiring:** the casino slots (§4) are wired up as part of the casino overhaul. Everything else gets wired once the files
  exist; hand the files back and they'll be connected.
- **Legal:** original art only. No logos, characters or item designs from existing games, shows or brands.

## Style guide (applies to everything)

- Friendly, polished, "premium mobile game" quality: soft lighting, gentle gradients, clean silhouettes readable at small
  sizes, subtle rim light, no text baked into images (the app adds text so it can be translated).
- Readable on both a dark background (`#0f1115`) and a light one (`#f6f7fb`): add a thin darker outline or soft shadow to
  icons and characters.
- The accent color is violet `#6c5ce7`; success green `#22c55e`; warning amber `#f59e0b`; danger red `#ef4444`.
- The app has 7 **theme packs**. When an entry says "per pack", make one version per pack in its mood:
  - **classic:** clean, friendly, neutral colors
  - **sleek:** minimal, glassy, monochrome with neon edges
  - **cute:** pastel, rounded, kawaii
  - **arcade:** pixel-art / 16-bit, saturated
  - **nature:** leafy, watercolor-ish greens and browns
  - **space:** deep blues and purples, glow, stars
  - **paper:** notebook doodles, pencil and ink on paper texture

---

## 1. App identity

| File | Size | Notes |
| --- | --- | --- |
| `app/icon.webp` | 1024×1024, opaque | App icon: a checkmark + open notebook motif, bold and simple, violet background. Also export 512 and 192 PNGs as `public/icons/icon-512.png` / `icon-192.png`. |
| `app/icon-maskable.webp` | 1024×1024, opaque | Same icon with the motif inside the central 60% safe zone. |
| `app/og-image.webp` | 1200×630, opaque | Link preview: the app on a phone and laptop, floating coins and a checklist, title space on the left. |
| `app/splash.webp` | 1290×2796, opaque | Phone splash: icon centered on a soft violet gradient. |

## 2. Onboarding and empty states

Spot illustrations (character-free or with a small generic student character; transparent).

| File | Size | Scene |
| --- | --- | --- |
| `empty/today-done.webp` | 640×480 | All done for today: relaxed student, checkmarks, sunset. |
| `empty/inbox-zero.webp` | 640×480 | An empty tray with a sparkle. |
| `empty/no-results.webp` | 640×480 | Magnifying glass over empty paper. |
| `empty/no-courses.webp` | 640×480 | A backpack with blank notebooks. |
| `empty/no-decks.webp` | 640×480 | A stack of blank flashcards. |
| `empty/offline.webp` | 640×480 | A cloud with a gentle "unplugged" cord. |
| `onboarding/welcome.webp`, `onboarding/quick-add.webp`, `onboarding/coins.webp`, `onboarding/sync.webp` | 800×600 each | Welcome tour pages: the app's idea, typing a task, earning coins from homework, devices syncing. |

## 3. Theme packs

| File | Size | Notes |
| --- | --- | --- |
| `themes/<pack>-bg-dark.webp`, `themes/<pack>-bg-light.webp` | 1920×1080, opaque, tileable edges preferred | Very subtle page backgrounds per pack (must stay behind text: low contrast). 14 files. |
| `themes/<pack>-preview.webp` | 480×300 | Theme picker thumbnail per pack. 7 files. |

## 4. Casino (wired as part of the casino overhaul)

| File | Size | Notes |
| --- | --- | --- |
| `casino/table-felt.webp` | 1024×1024, opaque, **tileable** | Rich green felt with fine fibers. |
| `casino/card-back.webp` | 500×700, opaque | Original ornate card back, violet and gold. |
| `casino/chip-1.webp`, `chip-5`, `chip-25`, `chip-100`, `chip-500`, `chip-1000` | 256×256 | Top-down casino chips with edge stripes; white, red, green, black, purple, gold. No numbers (the app prints them). |
| `casino/lobby/<gameId>.webp` | 640×400, opaque | A tile illustration per casino game: slots, blackjack, roulette, video poker, baccarat, craps, hi-lo, plinko, keno, mines, dice, big six wheel, scratch cards, three card poker, let it ride, hold'em. (Game ids are listed in `public/art/README.md` once the overhaul lands.) |
| `casino/dealer-tess.webp`, `dealer-lou.webp`, `dealer-sam.webp` | 256×256 | Hold'em bot avatars: Tess (tight, calm, glasses), Lou (loose, grinning, loud shirt), Sam (steady, neutral). Friendly, not realistic. |
| `casino/slots/<symbolId>.webp` | 256×256 | Slot symbols, 6 per theme pack (42 in total). Today: classic 🍒🍋🔔🍀💎7️⃣, sleek ◆●▲■★✦, cute 🍓🧁🐱🐰🦄🌈, arcade 🍒👾🕹️💰👑🏆, nature 🍃🌻🍄🐝🦋🌳, space ☄️🌙🪐🛸🚀🌌, paper ✏️📎📐📓📜🖋️. Glossy, chunky, readable at 64 px. |
| `casino/scratch-foil.webp` | 800×500, opaque, tileable | Silver scratch-off foil with glitter. |
| `casino/roulette-wheel.webp` | 1024×1024 | Top-down wheel without numbers (the app draws them), wood and gold. |
| `casino/big-win.webp` | 1200×600 | Burst of gold coins and light rays for the Big Win banner (no text). |

## 5. Shop and rewards

| File | Size | Notes |
| --- | --- | --- |
| `shop/<itemId>.webp` | 256×256 | One icon per shop item: `chips-100`, `chips-550`, `chips-1200`, `voucher-1`, `voucher-5`, `freeze` (a frozen flame), `booster` (lightning bottle), trophies `trophy-dice`, `trophy-cards`, `trophy-crown`, `trophy-diamond`. |
| `frames/<frameId>.webp` | 512×512, transparent center | Avatar/level-card frames: `frame-gold`, `frame-neon`, `frame-leaf`, seasonal `frame-pumpkin`, `frame-frost`, `frame-ink`, `frame-sunny`. |
| `titles/<titleId>.webp` | 512×128 | Ribbon banners (no text) for titles: `title-scholar`, `title-night-owl`, `title-speedrunner`, `title-legend`, `title-spellcaster`, `title-cocoa`, `title-finalist`, `title-sunny`, `title-high-roller`. |
| `confetti/<id>.webp` | 128×128 sprite sheet 4×4 of 32 px pieces | Particles for `confetti-coins`, `confetti-hearts`, `confetti-stars`, `confetti-books`, `confetti-spooky`, `confetti-snow`, `confetti-beach`. |
| `currency/coin.webp`, `currency/chip.webp`, `currency/voucher.webp` | 128×128 | The three currencies, to replace 🪙 🎰 🎟️ in counters. |

## 6. Badges and levels

| File | Size | Notes |
| --- | --- | --- |
| `badges/<id>.webp` | 256×256 | Achievement medals: `first_task`, `tasks_10`, `tasks_100`, `tasks_1000`, `streak_3`, `streak_7`, `streak_30`, `streak_100`, `inbox_zero`, `ring_5`, `early_bird`, `night_owl`, `exam_slayer`, `marathon`, `aced_5`, `ahead_10`, `perfect_week`, `card_shark`, `lucky`, `synced`, `level_10`. Bronze → silver → gold → platinum for the 10/100/1000 and streak tiers. |
| `badges/locked.webp` | 256×256 | A greyed, padlocked medal. |
| `casino/ach/<id>.webp` | 256×256 | Casino achievements: `first-bet`, `natural`, `four-kind`, `royal`, `plinko-10`, `hilo-5`, `mines-10`, `straight-up`, `jackpot`, `regular`. |
| `levels/<n>.webp` | 256×256 | Emblems for the 11 level titles: 1 Freshman, 2 Note Taker, 3 Deadline Dodger, 4 Page Turner, 5 Problem Solver, 6 Study Machine, 7 Honor Roll, 8 Dean's List, 9 Scholar, 10 Valedictorian, 11 Legend. Increasingly ornate. |
| `collectibles/<id>.webp` | 256×256 | Collectible stickers: `c_rocket`, `c_crown`, `c_gem`, `c_fire`, `c_unicorn`, `c_bolt`, `c_cat`, `c_owl`, `c_dragon`, `c_trophy`, `c_alien`, `c_ghost`. |

## 7. Play areas

| File | Size | Notes |
| --- | --- | --- |
| `arcade/<gameId>.webp` | 640×400, opaque | Arcade tile covers: `snake`, `2048`, `memory`, `minesweeper`, `catcher`, `asteroids`, `wordsearch`, `breakout`, `sudoku`, `hangman`, `lightsout`, `typing`, `solitaire`, `invaders`, `lander`, `glider`, `bubbles`, `fishing`, `glowgrid`, plus the case clicker and factory once they land. |
| `pet/<look>-<mood>.webp` | 512×512 | The virtual pet: looks `kitten`, `bunny`, `chick`, `frog`, `blob` × moods `happy`, `content`, `hungry`, `sleepy`, `sad`, `eating` (30 files). Same character across moods. |
| `pet/food/<id>.webp` | 128×128 | `kibble`, `apple`, `fish`, `cupcake`. |
| `garden/<plant>-<stage>.webp` | 256×384 | 6 plant kinds (tulip, sunflower, fern, cactus, rose, bonsai) × stages `sprout`, `bud`, `bloom` (18 files); the app tints by course color, so draw them in neutral/white petals. |
| `garden/bed.webp` | 1200×400, opaque | The garden bed / soil strip background. |
| `dungeon/room-<type>.webp` | 256×256 | Room tiles: `locked`, `open`, `boss` (exam), `library` (reading), `forge` (project), `quiz`, `stairs`. |
| `dungeon/floor.webp` | 512×512, opaque, tileable | Stone floor. |
| `companion/<kind>-<state>.webp` | 384×384 | Focus companions `cat`, `puppy`, `fox`, `owl`, `bunny` × `nap`, `play`, `wait` (15 files). |
| `starmap/sky.webp` | 1920×1080, opaque | Deep night sky with a faint nebula (the app draws the stars). |
| `events/<season>.webp` | 1600×400 | Seasonal banners: `halloween`, `winter`, `finals`, `summer`. |

## 8. Study games

| File | Size | Notes |
| --- | --- | --- |
| `study/boss-<n>.webp` | 512×512 | 6 boss monsters for Boss battle (school-themed: the Homework Hydra, Pop Quiz Golem, Deadline Dragon, Essay Wraith, Formula Kraken, Final Exam Titan), cute-menacing. |
| `study/boss-hit.webp` | 512×512 | Impact flash sprite. |
| `study/quizrace-track.webp` | 1600×300, opaque | Race track for Quiz race. |

## 9. Factory game (after it lands)

Isometric or top-down, one consistent industrial style (orange/grey/teal, hazard stripes).

| File | Size | Notes |
| --- | --- | --- |
| `factory/building-<id>.webp` | 256×256 | miner (Mk1–3), smelter, foundry, constructor, assembler, manufacturer, refinery, generators (biomass, coal, fuel), storage, launch tower. |
| `factory/item-<id>.webp` | 128×128 | Every resource and part (ores, ingots, plates, rods, screws, wire, cable, concrete, steel, rotors, motors, circuit boards, computers, plastic, rubber, fuel…). The final list is in `src/lib/factory/` once merged. |
| `factory/node-<ore>.webp` | 256×256 | Ore node deposits. |
| `factory/belt.webp` | 256×64, tileable | Conveyor belt segment. |
| `factory/ground.webp` | 1024×1024, opaque, tileable | Alien grassland ground tile. |

## 10. Case clicker (after it lands)

| File | Size | Notes |
| --- | --- | --- |
| `cases/case-<id>.webp` | 512×384 | Crate designs, one per case (list in the game file once merged). |
| `cases/item-<id>.webp` | 512×384 | Optional hero art for rare items (the game draws procedural skins for the rest). |

## 11. Watch (after it lands)

| File | Size | Notes |
| --- | --- | --- |
| `watch/poster-fallback.webp` | 400×600, opaque | Poster placeholder for items without artwork. |
| `watch/source-<kind>.webp` | 256×256 | Source icons: generic media server, embed link, video file, direct stream. (Don't copy Jellyfin/Plex/YouTube logos; the app shows their names.) |

---

## What code already covers (no art needed)

Layout, animation, particles, confetti physics, coin rain, reels, card flips, charts, the periodic table, the timetable,
maps, and the procedural gems in Glow Grid are all code. Art above replaces placeholders and adds character; the app works
without any of it.
