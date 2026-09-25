<script lang="ts">
  // Crossword from a notecard deck: type in the grid (arrows move, Tab jumps to the next clue, click a square twice to turn),
  // check or reveal letters, and beat your best time. Printable as a blank puzzle.
  import { onMount, untrack } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { formatTime } from '../../lib/studygames';
  import { cellNumbers, crosswordEntries, generateCrossword, isSolved, REVEAL_PENALTY_MS, wordAt, wordCells, type Dir, type PlacedWord } from '../../lib/crossword';
  import type { Card, Deck } from '../../lib/types';

  interface Props {
    deck: Deck;
    cards: Card[];
    onexit: () => void;
  }
  let { deck, cards, onexit }: Props = $props();

  const entries = $derived(crosswordEntries(cards));
  const newSeed = () => Math.floor(Math.random() * 2 ** 31);
  let seed = $state(newSeed());
  const cw = $derived(generateCrossword(entries, seed));
  const blank = () => cw.cells.map((row) => row.map(() => ''));
  let fill = $state<string[][]>(untrack(blank));
  let revealed = $state<string[]>([]); // "r,c" squares shown by Reveal letter
  let wrong = $state<string[]>([]); // squares Check found wrong (cleared when retyped)
  let cur = $state(untrack(() => ({ r: cw.words[0]?.row ?? 0, c: cw.words[0]?.col ?? 0 })));
  let dir = $state<Dir>('across');
  let startedAt = $state(Date.now());
  let now = $state(Date.now());
  let endedAt = $state(0);
  let gaveUp = $state(false);
  let newBest = $state(false);
  let status = $state('');
  let refs: HTMLInputElement[] = $state([]);
  let pressedCurrent = false;

  const key = $derived(`crossword:${deck.id}`);
  const best = $derived(arcade.times[key]);
  const elapsed = $derived((endedAt || now) - startedAt + revealed.length * REVEAL_PENALTY_MS);
  const nums = $derived(cellNumbers(cw));
  const other = (d: Dir): Dir => (d === 'across' ? 'down' : 'across');
  const word = $derived(wordAt(cw, cur.r, cur.c, dir) ?? wordAt(cw, cur.r, cur.c, other(dir)));
  const inWord = $derived(new Set((word ? wordCells(word) : []).map(([r, c]) => `${r},${c}`)));
  const across = $derived(cw.words.filter((w) => w.dir === 'across'));
  const down = $derived(cw.words.filter((w) => w.dir === 'down'));
  const order = $derived([...across, ...down]); // Tab order: across clues, then down
  const solved = $derived(new Set(cw.words.filter((w) => isSolved(w, fill)).map((w) => `${w.num}${w.dir}`)));
  const playable = $derived(cw.words.length >= 3);

  onMount(() => {
    const tick = setInterval(() => {
      if (!endedAt) now = Date.now();
    }, 100);
    return () => clearInterval(tick);
  });

  function cellLabel(r: number, c: number): string {
    return (['across', 'down'] as Dir[])
      .map((d) => wordAt(cw, r, c, d))
      .filter((w): w is PlacedWord => !!w)
      .map((w) => `${w.num} ${w.dir}, letter ${wordCells(w).findIndex(([rr, cc]) => rr === r && cc === c) + 1} of ${w.answer.length}`)
      .join('; ');
  }
  function focusCell(r: number, c: number) {
    cur = { r, c };
    if (!wordAt(cw, r, c, dir)) dir = other(dir);
    refs[r * cw.cols + c]?.focus();
  }
  function selectWord(w: PlacedWord) {
    dir = w.dir;
    const cells = wordCells(w);
    const [r, c] = cells.find(([rr, cc]) => !fill[rr][cc]) ?? cells[0];
    focusCell(r, c);
  }
  function afterChange() {
    const done = cw.cells.every((row, r) => row.every((ch, c) => !ch || fill[r][c] === ch));
    if (done && !endedAt) finish();
  }
  function setLetter(r: number, c: number, ch: string) {
    if (revealed.includes(`${r},${c}`)) return;
    fill[r][c] = ch;
    wrong = wrong.filter((k) => k !== `${r},${c}`);
    if (ch && word && isSolved(word, fill)) {
      status = `${word.num} ${word.dir} done`;
      playSound('pop');
    }
  }
  function type(ch: string) {
    const { r, c } = cur;
    setLetter(r, c, ch);
    if (word) {
      const cells = wordCells(word);
      const i = cells.findIndex(([rr, cc]) => rr === r && cc === c);
      if (i >= 0 && i < cells.length - 1) focusCell(...cells[i + 1]);
    }
    afterChange();
  }
  function back() {
    const { r, c } = cur;
    if (fill[r][c] && !revealed.includes(`${r},${c}`)) return setLetter(r, c, '');
    if (!word) return;
    const cells = wordCells(word);
    const i = cells.findIndex(([rr, cc]) => rr === r && cc === c);
    if (i > 0) {
      focusCell(...cells[i - 1]);
      setLetter(...cells[i - 1], '');
    }
  }
  /** Arrow keys: turn to that direction first, then move to the next letter square that way (hopping gaps). */
  function arrow(dr: number, dc: number) {
    const axis: Dir = dc ? 'across' : 'down';
    if (word?.dir !== axis && wordAt(cw, cur.r, cur.c, axis)) {
      dir = axis;
      return;
    }
    for (let r = cur.r + dr, c = cur.c + dc; r >= 0 && c >= 0 && r < cw.rows && c < cw.cols; r += dr, c += dc) {
      if (cw.cells[r][c]) {
        dir = wordAt(cw, r, c, axis) ? axis : dir;
        return focusCell(r, c);
      }
    }
  }
  function jump(delta: number): boolean {
    const i = word ? order.indexOf(word) : -1;
    const next = order[i + delta];
    if (!next) return false;
    selectWord(next);
    return true;
  }
  function toggle() {
    if (wordAt(cw, cur.r, cur.c, other(word?.dir ?? dir))) dir = other(word?.dir ?? dir);
  }
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || endedAt) return;
    if (/^[a-z]$/i.test(e.key)) type(e.key.toUpperCase());
    else if (e.key === 'ArrowLeft') arrow(0, -1);
    else if (e.key === 'ArrowRight') arrow(0, 1);
    else if (e.key === 'ArrowUp') arrow(-1, 0);
    else if (e.key === 'ArrowDown') arrow(1, 0);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Delete') setLetter(cur.r, cur.c, '');
    else if (e.key === 'Enter' || e.key === ' ') toggle();
    else if (e.key === 'Tab') {
      // past the last clue, Tab leaves the grid as usual
      if (!jump(e.shiftKey ? -1 : 1)) return;
    } else return;
    e.preventDefault();
  }
  // phones' on-screen keyboards often skip keydown, so take the letter from the input event too
  function onInput(e: Event, r: number, c: number) {
    const el = e.currentTarget as HTMLInputElement;
    const letters = el.value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if ((e as InputEvent).inputType?.startsWith('delete')) back();
    else if (letters) {
      cur = { r, c };
      type(letters.at(-1)!);
    }
    el.value = fill[r][c];
  }
  function onFocus(r: number, c: number) {
    cur = { r, c };
    if (!wordAt(cw, r, c, dir)) dir = other(dir);
  }
  function check() {
    wrong = cw.cells.flatMap((row, r) => row.flatMap((ch, c) => (ch && fill[r][c] && fill[r][c] !== ch ? [`${r},${c}`] : [])));
    const empty = cw.cells.flat().filter((ch, i) => ch && !fill[Math.floor(i / cw.cols)][i % cw.cols]).length;
    status = wrong.length ? `${wrong.length} wrong letter${wrong.length === 1 ? '' : 's'} marked` : `No mistakes so far${empty ? ` · ${empty} to go` : ''}`;
    refs[cur.r * cw.cols + cur.c]?.focus();
  }
  function revealLetter() {
    const { r, c } = cur;
    const ch = cw.cells[r][c];
    if (!ch || fill[r][c] === ch) return refs[r * cw.cols + c]?.focus();
    fill[r][c] = ch;
    revealed = [...revealed, `${r},${c}`];
    wrong = wrong.filter((k) => k !== `${r},${c}`);
    status = `Revealed ${ch} (+${REVEAL_PENALTY_MS / 1000} s)`;
    refs[r * cw.cols + c]?.focus();
    afterChange();
  }
  function revealAll() {
    gaveUp = true;
    fill = cw.cells.map((row) => row.map((ch) => ch ?? ''));
    finish();
  }
  function finish() {
    endedAt = Date.now();
    status = '';
    if (gaveUp) return;
    const total = endedAt - startedAt + revealed.length * REVEAL_PENALTY_MS;
    newBest = arcade.recordTime(key, total);
    playSound('pop');
    if (newBest) toasts.push({ message: `New best crossword time on ${deck.name}`, detail: formatTime(total), kind: 'success', emoji: '🧩' });
  }
  function restart() {
    seed = newSeed();
    fill = blank();
    revealed = [];
    wrong = [];
    cur = { r: cw.words[0]?.row ?? 0, c: cw.words[0]?.col ?? 0 };
    dir = 'across';
    startedAt = now = Date.now();
    endedAt = 0;
    gaveUp = newBest = false;
    status = '';
  }
</script>

<div class="bar">
  <button class="btn ghost sm" onclick={onexit}>← Decks</button>
  <h2>🧩 Crossword · {deck.name}</h2>
  <span class="grow"></span>
  {#if !endedAt && playable}
    <span class="meta">{solved.size}/{cw.words.length} words</span>
    <span class="clock" role="timer" aria-label="Time">⏱ {formatTime(elapsed)}</span>
  {/if}
</div>

{#if endedAt}
  <section class="card end" aria-live="polite">
    <div class="big" aria-hidden="true">{gaveUp ? '📖' : '🧩'}</div>
    <h3>{gaveUp ? 'All answers revealed' : `Solved in ${formatTime(elapsed)}`}</h3>
    <p class="muted">
      {cw.words.length} words{revealed.length && !gaveUp ? ` · ${revealed.length} revealed (+${(revealed.length * REVEAL_PENALTY_MS) / 1000} s)` : ''} · {gaveUp
        ? 'Solve it yourself next time to set a best time.'
        : newBest
          ? 'New best for this deck!'
          : best !== undefined
            ? `Best: ${formatTime(best)}`
            : ''}
    </p>
    <ul class="answers">
      {#each order as w (`${w.num}${w.dir}`)}
        <li><strong>{w.num} {w.dir}</strong> {w.answer} <span class="muted">· {w.clue}</span></li>
      {/each}
    </ul>
    <div class="btns">
      <button class="btn primary" onclick={restart}>New crossword</button>
      <button class="btn" onclick={onexit}>Pick another deck</button>
    </div>
  </section>
{:else if !playable}
  <div class="card note">
    <p>These answers don't share enough letters to cross each other. Try another layout, or add more cards to the deck.</p>
    <button class="btn primary sm" onclick={restart}>🔀 Try another layout</button>
  </div>
{:else}
  <p class="muted help">
    Type to fill in. Arrows move, Tab jumps to the next clue, click a square again (or press Enter) to switch across/down. Each revealed letter adds {REVEAL_PENALTY_MS / 1000} seconds.{best !==
    undefined
      ? ` Best: ${formatTime(best)}.`
      : ''}
  </p>
  <div class="tools">
    <button class="btn sm" onclick={check}>✔ Check</button>
    <button class="btn sm" onclick={revealLetter}>Reveal letter</button>
    <button class="btn sm" onclick={revealAll}>Reveal all</button>
    <button class="btn sm ghost" onclick={restart}>🔀 New layout</button>
    <button class="btn sm ghost" onclick={() => window.print()}>🖨 Print</button>
  </div>

  <div id="cw-sheet">
    <h2 class="print-only">{deck.name} crossword</h2>
    <div class="current" id="cw-clue" aria-live="polite">
      {#if word}<strong>{word.num} {word.dir}</strong> {word.clue} <span class="muted">({word.answer.length})</span>{/if}
    </div>
    <div class="layout">
      <div class="grid" role="group" aria-label="Crossword grid" aria-describedby="cw-clue" style="--cols:{cw.cols}">
        {#each cw.cells as row, r (r)}
          {#each row as ch, c (c)}
            {#if ch}
              {@const k = `${r},${c}`}
              <div class="sq" class:hl={inWord.has(k)} class:cur={cur.r === r && cur.c === c} class:wrong={wrong.includes(k)} class:shown={revealed.includes(k)}>
                {#if nums.has(k)}<span class="num" aria-hidden="true">{nums.get(k)}</span>{/if}
                <input
                  bind:this={refs[r * cw.cols + c]}
                  value={fill[r][c]}
                  tabindex={cur.r === r && cur.c === c ? 0 : -1}
                  aria-label={cellLabel(r, c)}
                  aria-invalid={wrong.includes(k) || undefined}
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  data-r={r}
                  data-c={c}
                  onkeydown={onKey}
                  oninput={(e) => onInput(e, r, c)}
                  onfocus={() => onFocus(r, c)}
                  onpointerdown={(e) => (pressedCurrent = cur.r === r && cur.c === c && document.activeElement === e.currentTarget)}
                  onclick={() => pressedCurrent && toggle()}
                />
              </div>
            {:else}
              <div class="sq block" aria-hidden="true"></div>
            {/if}
          {/each}
        {/each}
      </div>
      <div class="clues">
        {#each [{ title: 'Across', list: across }, { title: 'Down', list: down }] as group (group.title)}
          <section>
            <h3>{group.title}</h3>
            <ol>
              {#each group.list as w (`${w.num}${w.dir}`)}
                {@const id = `${w.num}${w.dir}`}
                <li>
                  <button class="clue" class:on={word === w} class:solved={solved.has(id)} aria-current={word === w ? 'true' : undefined} onclick={() => selectWord(w)}>
                    <span class="cn">{w.num}</span>
                    <span class="ct">{w.clue} <span class="muted">({w.answer.length})</span></span>
                    {#if solved.has(id)}<span class="tick" aria-hidden="true">✓</span><span class="visually-hidden">(solved)</span>{/if}
                  </button>
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      </div>
    </div>
  </div>
  {#if cw.skipped.length}
    <p class="muted small">{cw.skipped.length} card{cw.skipped.length === 1 ? '' : 's'} didn't fit this layout. 🔀 New layout shuffles them.</p>
  {/if}
  <div class="status" aria-live="polite">{status}</div>
{/if}

<style>
  .bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .bar h2 {
    font-size: 18px;
    margin: 0;
  }
  .grow {
    flex: 1;
  }
  .meta {
    font-size: 13px;
    color: var(--text-muted);
  }
  .clock {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 18px;
  }
  .help {
    margin: 0 0 10px;
    font-size: 13px;
  }
  .tools {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .current {
    min-height: 1.5em;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev-2);
    margin-bottom: 10px;
    font-size: 15px;
  }
  .layout {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .grid {
    --cell: min(34px, calc((100vw - 48px) / var(--cols)));
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell));
    grid-auto-rows: var(--cell);
    padding: 1px 0 0 1px;
    flex: none;
  }
  /* only letter squares are drawn (a freeform grid); the -1px margins collapse neighbouring borders into one line */
  .sq {
    position: relative;
    background: var(--bg-elev);
    border: 1px solid var(--border-strong);
    margin: -1px 0 0 -1px;
  }
  .sq.block {
    background: none;
    border-color: transparent;
  }
  .sq.hl {
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-elev));
  }
  .sq.cur {
    background: color-mix(in srgb, var(--accent) 38%, var(--bg-elev));
  }
  .sq.wrong input {
    color: var(--danger-text);
    text-decoration: line-through;
  }
  .sq.shown input {
    color: var(--accent-text);
  }
  .num {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: calc(var(--cell) * 0.3);
    line-height: 1;
    color: var(--text-muted);
    pointer-events: none;
  }
  .sq input {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    padding: calc(var(--cell) * 0.18) 0 0;
    text-align: center;
    text-transform: uppercase;
    font-weight: 700;
    font-size: calc(var(--cell) * 0.55);
    color: var(--text);
    caret-color: transparent;
    cursor: pointer;
    border-radius: 0;
  }
  .sq input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .clues {
    flex: 1 1 260px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    min-width: 0;
  }
  .clues h3 {
    font-size: 14px;
    margin: 0 0 6px;
  }
  .clues ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .clue {
    display: flex;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    border-left: 3px solid transparent;
  }
  .clue:hover {
    background: var(--bg-hover);
  }
  .clue.on {
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-elev));
    border-left-color: var(--accent);
  }
  .clue.solved .ct {
    color: var(--text-muted);
    text-decoration: line-through;
  }
  .cn {
    font-weight: 800;
    min-width: 1.6em;
  }
  .ct {
    white-space: pre-wrap;
  }
  .tick {
    margin-left: auto;
    color: var(--success-text);
    font-weight: 800;
  }
  .status {
    min-height: 1.4em;
    margin-top: 10px;
    font-weight: 600;
    text-align: center;
  }
  .small {
    font-size: 12px;
  }
  .note p {
    margin: 0 0 8px;
  }
  .end {
    text-align: center;
    display: grid;
    gap: 6px;
    justify-items: center;
  }
  .end h3 {
    margin: 0;
  }
  .big {
    font-size: 44px;
  }
  .answers {
    list-style: none;
    padding: 0;
    margin: 4px 0;
    text-align: left;
    font-size: 14px;
    display: grid;
    gap: 2px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .muted {
    color: var(--text-muted);
  }
  .print-only {
    display: none;
  }
  /* print a blank puzzle: only the sheet, empty numbered squares and the clues */
  @media print {
    :global(body:has(#cw-sheet) *) {
      visibility: hidden;
    }
    #cw-sheet,
    #cw-sheet :global(*) {
      visibility: visible;
    }
    #cw-sheet {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      color: #000;
    }
    .print-only {
      display: block;
      font-size: 20px;
      margin: 0 0 12px;
    }
    .current {
      display: none;
    }
    .grid {
      --cell: 28px;
    }
    .sq,
    .sq.hl,
    .sq.cur {
      background: #fff;
      border-color: #000;
    }
    .sq.block {
      border-color: transparent;
    }
    .sq input {
      color: transparent !important;
    }
    .num,
    .clue,
    .clues h3 {
      color: #000;
    }
    .clue.on {
      background: none;
      border-left-color: transparent;
    }
    .clue.solved .ct,
    .clue .muted {
      color: #000;
      text-decoration: none;
    }
    .tick {
      display: none;
    }
  }
</style>
