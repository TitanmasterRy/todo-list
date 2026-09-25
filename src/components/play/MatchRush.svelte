<script lang="ts">
  // Match rush: click (or drag) a term onto its definition. Rounds of up to six cards until the deck runs out; misses add time.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { buildRound, formatTime, isMatch, matchRounds, MISS_PENALTY_MS } from '../../lib/studygames';
  import type { Card, Deck } from '../../lib/types';

  interface Props {
    deck: Deck;
    cards: Card[];
    onexit: () => void;
  }
  let { deck, cards, onexit }: Props = $props();

  let rounds = $state(untrack(() => matchRounds(cards)));
  let ri = $state(0);
  let round = $state(untrack(() => buildRound(rounds[0])));
  let doneTerms = $state<string[]>([]);
  let doneDefs = $state<string[]>([]);
  let selTerm = $state<string | null>(null);
  let selDef = $state<string | null>(null);
  let wrong = $state<string[]>([]); // "t:id" / "d:id" tiles flashing red
  let misses = $state(0);
  let matched = $state(0);
  let startedAt = $state(Date.now());
  let now = $state(Date.now());
  let endedAt = $state(0);
  let status = $state('');
  let newBest = $state(false);
  let drag = $state<{ id: string; x0: number; y0: number; dx: number; dy: number; moved: boolean } | null>(null);
  let hoverDef = $state<string | null>(null);
  let suppressClick = false;
  let timers: ReturnType<typeof setTimeout>[] = [];

  const key = $derived(`match:${deck.id}`);
  const elapsed = $derived((endedAt || now) - startedAt + misses * MISS_PENALTY_MS);
  const best = $derived(arcade.times[key]);

  onMount(() => {
    const tick = setInterval(() => {
      if (!endedAt) now = Date.now();
    }, 100);
    return () => clearInterval(tick);
  });
  onDestroy(() => timers.forEach(clearTimeout));

  function tryMatch(termId: string, defId: string) {
    const t = round.terms.find((x) => x.id === termId);
    const d = round.defs.find((x) => x.id === defId);
    selTerm = selDef = null;
    if (!t || !d || doneTerms.includes(t.id) || doneDefs.includes(d.id)) return;
    if (isMatch(t, d)) {
      doneTerms = [...doneTerms, t.id];
      doneDefs = [...doneDefs, d.id];
      matched++;
      status = `Matched: ${t.text || 'picture'}`;
      playSound('pop');
      if (doneTerms.length === round.terms.length) timers.push(setTimeout(nextRound, 350));
    } else {
      misses++;
      wrong = [`t:${t.id}`, `d:${d.id}`];
      status = `Not a match (+${MISS_PENALTY_MS / 1000} s)`;
      playSound('undo');
      timers.push(setTimeout(() => (wrong = []), 500));
    }
  }
  function nextRound() {
    if (ri + 1 < rounds.length) {
      ri++;
      round = buildRound(rounds[ri]);
      doneTerms = [];
      doneDefs = [];
      status = `Round ${ri + 1} of ${rounds.length}`;
      return;
    }
    endedAt = Date.now();
    const total = endedAt - startedAt + misses * MISS_PENALTY_MS;
    newBest = arcade.recordTime(key, total);
    status = '';
    if (newBest) toasts.push({ message: `New best Match rush time on ${deck.name}`, detail: formatTime(total), kind: 'success', emoji: '⚡' });
  }
  function restart() {
    timers.forEach(clearTimeout);
    rounds = matchRounds(cards);
    ri = 0;
    round = buildRound(rounds[0]);
    doneTerms = [];
    doneDefs = [];
    misses = matched = 0;
    selTerm = selDef = null;
    startedAt = now = Date.now();
    endedAt = 0;
    newBest = false;
    status = '';
  }
  function clickTerm(id: string) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (doneTerms.includes(id)) return;
    if (selDef) tryMatch(id, selDef);
    else selTerm = selTerm === id ? null : id;
  }
  function clickDef(id: string) {
    if (doneDefs.includes(id)) return;
    if (selTerm) tryMatch(selTerm, id);
    else selDef = selDef === id ? null : id;
  }
  // drag a term onto a definition (pointer events, so it works with touch too)
  const defUnder = (x: number, y: number) =>
    document
      .elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-def]'))
      .find((el) => !!el)?.dataset.def ?? null;
  function down(e: PointerEvent, id: string) {
    suppressClick = false;
    if (doneTerms.includes(id) || e.button > 0) return;
    drag = { id, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) > 8) drag.moved = true;
    if (drag.moved) hoverDef = defUnder(e.clientX, e.clientY);
  }
  function up(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    hoverDef = null;
    if (!d.moved) return;
    suppressClick = true;
    const target = e.type === 'pointerup' ? defUnder(e.clientX, e.clientY) : null;
    if (target) tryMatch(d.id, target);
  }
</script>

<div class="bar">
  <button class="btn ghost sm" onclick={onexit}>← Decks</button>
  <h2>⚡ Match rush · {deck.name}</h2>
  <span class="grow"></span>
  {#if !endedAt}
    <span class="meta">Round {ri + 1}/{rounds.length} · Misses {misses}</span>
    <span class="clock" role="timer" aria-label="Time">⏱ {formatTime(elapsed)}</span>
  {/if}
</div>

{#if endedAt}
  <section class="card end">
    <div class="big" aria-hidden="true">⚡</div>
    <h3>All {matched} matched in {formatTime(elapsed)}</h3>
    <p class="muted">
      {misses} miss{misses === 1 ? '' : 'es'} (+{(misses * MISS_PENALTY_MS) / 1000} s) · {newBest
        ? 'New best for this deck!'
        : best !== undefined
          ? `Best: ${formatTime(best)}`
          : ''}
    </p>
    <div class="btns">
      <button class="btn primary" onclick={restart}>Play again</button>
      <button class="btn" onclick={onexit}>Pick another deck</button>
    </div>
  </section>
{:else}
  <p class="muted help">
    Pick a term, then its definition (or drag the term onto it). Each miss adds {MISS_PENALTY_MS / 1000} seconds.{best !== undefined ? ` Best: ${formatTime(best)}.` : ''}
  </p>
  <div class="board">
    <div class="col" role="group" aria-label="Terms">
      {#each round.terms as t (t.id)}
        {@const done = doneTerms.includes(t.id)}
        <button
          class="tile term"
          class:sel={selTerm === t.id}
          class:done
          class:wrong={wrong.includes(`t:${t.id}`)}
          class:dragging={drag?.id === t.id && drag.moved}
          style={drag?.id === t.id && drag.moved ? `transform: translate(${drag.dx}px, ${drag.dy}px)` : ''}
          aria-pressed={selTerm === t.id}
          disabled={done}
          data-term={t.id}
          onclick={() => clickTerm(t.id)}
          onpointerdown={(e) => down(e, t.id)}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
        >
          {#if t.image}<img src={t.image} alt="" />{/if}<span>{t.text}</span>{#if done}<span class="tick" aria-hidden="true">✓</span>{/if}
        </button>
      {/each}
    </div>
    <div class="col" role="group" aria-label="Definitions">
      {#each round.defs as d (d.id)}
        {@const done = doneDefs.includes(d.id)}
        <button
          class="tile def"
          class:sel={selDef === d.id}
          class:done
          class:hover={hoverDef === d.id}
          class:wrong={wrong.includes(`d:${d.id}`)}
          aria-pressed={selDef === d.id}
          disabled={done}
          data-def={d.id}
          onclick={() => clickDef(d.id)}
        >
          {#if d.image}<img src={d.image} alt="" />{/if}<span>{d.text}</span>{#if done}<span class="tick" aria-hidden="true">✓</span>{/if}
        </button>
      {/each}
    </div>
  </div>
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
  .board {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 10px;
  }
  .col {
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .tile {
    display: flex;
    gap: 8px;
    align-items: center;
    text-align: left;
    padding: 12px;
    min-height: 52px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-elev);
    font-size: 14px;
    white-space: pre-wrap;
    transition:
      border-color var(--dur),
      background var(--dur);
  }
  .term {
    font-weight: 700;
    touch-action: none;
    cursor: grab;
  }
  .tile:not(:disabled):hover,
  .tile.hover {
    border-color: var(--accent);
  }
  .tile.sel {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-elev));
  }
  .tile.wrong {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 16%, var(--bg-elev));
  }
  .tile.done {
    border-style: dashed;
    background: color-mix(in srgb, var(--success) 10%, var(--bg-elev));
    color: var(--text-muted);
    cursor: default;
  }
  .tile.dragging {
    position: relative;
    z-index: 5;
    cursor: grabbing;
    box-shadow: var(--shadow, 0 8px 20px rgba(0, 0, 0, 0.25));
    transition: none;
  }
  .tile img {
    max-height: 60px;
    max-width: 90px;
    border-radius: 6px;
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
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .muted {
    color: var(--text-muted);
  }
</style>
