<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onDestroy } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import type { Card } from '../../lib/types';
  import { dueCards, mastery, parseCards, shuffle } from '../../lib/flashcards';
  import { aiAvailable, makeNotecards } from '../../lib/ai';
  import { playSound } from '../../lib/sounds';

  let deckId = $state<string | null>(null);
  let newDeckName = $state('');
  let newDeckCourse = $state('');
  let front = $state('');
  let back = $state('');
  let paste = $state('');
  let aiSource = $state('');
  let aiBusy = $state(false);
  let mode = $state<'edit' | 'study'>('edit');
  let queue = $state<Card[]>([]);
  let idx = $state(0);
  let flipped = $state(false);
  let correct = $state(0);
  let reviewed = $state(0);
  let sessionAll = $state(false);
  let finished = $state(false);

  const deck = $derived(store.decks.find((d) => d.id === deckId) ?? null);
  const cards = $derived(deck ? store.cards.filter((c) => c.deckId === deck.id) : []);
  const due = $derived(dueCards(cards, store.today));
  const decksInfo = $derived(
    store.decks.map((d) => {
      const cs = store.cards.filter((c) => c.deckId === d.id);
      return { deck: d, count: cs.length, due: dueCards(cs, store.today).length, mastery: mastery(cs) };
    }),
  );
  const current = $derived(queue[idx] ?? null);
  $effect(() => {
    ui.captureKeys = mode === 'study' && !finished;
  });
  onDestroy(() => (ui.captureKeys = false));

  function createDeck(e: Event) {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    const d = store.addDeck(newDeckName, newDeckCourse || undefined);
    deckId = d.id;
    newDeckName = '';
  }
  function addOne(e: Event) {
    e.preventDefault();
    if (!deck || !front.trim() || !back.trim()) return;
    store.addCards(deck.id, [{ front, back }]);
    front = '';
    back = '';
    playSound('tick');
  }
  function addPasted() {
    if (!deck) return;
    const items = parseCards(paste);
    const added = store.addCards(deck.id, items);
    toasts.push({
      message: added.length ? `Added ${added.length} cards` : 'No cards found',
      detail: added.length ? undefined : 'Use one card per line like "term :: definition" or "Q: … / A: …".',
      kind: added.length ? 'success' : 'warn',
    });
    if (added.length) paste = '';
  }
  async function generate() {
    if (!deck || !aiSource.trim()) return;
    aiBusy = true;
    try {
      const items = await makeNotecards(aiSource, 12);
      const added = store.addCards(deck.id, items);
      toasts.push({ message: `Generated ${added.length} cards`, kind: 'success', emoji: '✨' });
      aiSource = '';
    } catch (e) {
      toasts.push({ message: 'Could not generate cards', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      aiBusy = false;
    }
  }
  function startStudy(all = false) {
    const pool = all ? cards : due;
    if (!pool.length) return;
    queue = shuffle(pool, Date.now() % 100000);
    idx = 0;
    flipped = false;
    correct = 0;
    reviewed = 0;
    finished = false;
    sessionAll = all;
    mode = 'study';
  }
  function answer(ok: boolean) {
    if (!current) return;
    store.answerCard(current.id, ok);
    reviewed++;
    if (ok) {
      correct++;
      playSound('pop');
    } else playSound('undo');
    flipped = false;
    if (idx + 1 >= queue.length) {
      finished = true;
      store.finishStudySession(reviewed, correct, !sessionAll && correct === reviewed);
    } else idx++;
  }
  function renameDeck() {
    if (!deck) return;
    const n = prompt('Rename deck', deck.name);
    if (n?.trim()) store.updateDeck(deck.id, { name: n.trim() });
  }
  function onKey(e: KeyboardEvent) {
    if (mode !== 'study' || finished) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flipped = !flipped;
    } else if (flipped && (e.key === '1' || e.key === 'j')) {
      e.preventDefault();
      answer(false);
    } else if (flipped && (e.key === '2' || e.key === 'k')) {
      e.preventDefault();
      answer(true);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !deck}
  <section class="card">
    <h2>Notecards</h2>
    <p class="help">
      Make a deck per unit or course, add cards by typing, pasting, or generating from notes, then study with spaced repetition. Every correct answer earns XP; clearing all due
      cards earns a bonus.
    </p>
    <form class="newdeck" onsubmit={createDeck}>
      <input class="input" bind:value={newDeckName} placeholder="New deck, e.g. Chem unit 3 vocab" aria-label="Deck name" data-deck-name />
      <select class="select" bind:value={newDeckCourse} aria-label="Course">
        <option value="">No course</option>
        {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
      </select>
      <button class="btn primary" type="submit" disabled={!newDeckName.trim()}>Create</button>
    </form>
    {#if decksInfo.length}
      <ul class="decks">
        {#each decksInfo as d (d.deck.id)}
          <li>
            <button
              class="deck"
              onclick={() => {
                deckId = d.deck.id;
                mode = 'edit';
              }}
            >
              <span class="dot" style="background:{store.courseById(d.deck.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="name">{d.deck.name}</span>
              <span class="meta">{d.count} card{d.count === 1 ? '' : 's'}{d.due ? ` · ${d.due} due` : ''}</span>
              <span class="mastery"><span class="fill" style="width:{d.mastery * 100}%"></span></span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{:else if mode === 'study'}
  <section class="card study">
    <div class="head">
      <button class="btn ghost sm" onclick={() => (mode = 'edit')}>← {deck.name}</button>
      <span class="progress">{Math.min(idx + (finished ? 1 : 0), queue.length)}/{queue.length}</span>
    </div>
    {#if finished}
      <div class="done" in:fly={{ y: 10, duration: 250 }}>
        <div class="big">{correct === reviewed ? '🏆' : correct / Math.max(1, reviewed) >= 0.7 ? '🎉' : '💪'}</div>
        <h3>{correct} of {reviewed} right</h3>
        <p class="help">{correct === reviewed && !sessionAll ? 'Every due card cleared. Bonus XP!' : 'Missed cards come back today; the rest move up a box.'}</p>
        <div class="btns">
          <button class="btn primary" onclick={() => (mode = 'edit')}>Back to deck</button>
          {#if due.length}<button class="btn" onclick={() => startStudy(false)}>Study {due.length} due again</button>{/if}
        </div>
      </div>
    {:else if current}
      <button class="flashcard" class:flipped onclick={() => (flipped = !flipped)} aria-label={flipped ? 'Showing back' : 'Show back'}>
        <span class="face front"><span class="lbl">Front</span><span class="txt">{current.front}</span><span class="hint">tap or press space to flip</span></span>
        <span class="face back"><span class="lbl">Back</span><span class="txt">{current.back}</span></span>
      </button>
      <div class="answers" class:show={flipped}>
        <button class="btn danger" onclick={() => answer(false)} disabled={!flipped}>Again <span class="kbd">1</span></button>
        <button class="btn primary" onclick={() => answer(true)} disabled={!flipped}>Got it <span class="kbd">2</span></button>
      </div>
      <div class="box">Box {current.box} of 5</div>
    {/if}
  </section>
{:else}
  <section class="card">
    <div class="head">
      <button class="btn ghost sm" onclick={() => (deckId = null)}>← Decks</button>
      <h2 class="grow">{deck.name} <span class="muted">{cards.length} cards</span></h2>
      <button class="btn ghost sm" onclick={renameDeck}>Rename</button>
      <button
        class="btn ghost sm"
        onclick={() => {
          store.deleteDeck(deck.id);
          deckId = null;
        }}>Delete</button
      >
    </div>
    <div class="studybar">
      <button class="btn primary" onclick={() => startStudy(false)} disabled={!due.length}>Study {due.length} due</button>
      <button class="btn" onclick={() => startStudy(true)} disabled={!cards.length}>Study all</button>
      <span class="muted">Mastery {(mastery(cards) * 100).toFixed(0)}%</span>
    </div>
    <form class="addcard" onsubmit={addOne}>
      <input class="input" bind:value={front} placeholder="Front (term or question)" aria-label="Front" />
      <input class="input" bind:value={back} placeholder="Back (definition or answer)" aria-label="Back" />
      <button class="btn" type="submit" disabled={!front.trim() || !back.trim()}>Add</button>
    </form>
    <details class="more">
      <summary>Paste many at once</summary>
      <textarea class="textarea" bind:value={paste} placeholder={'mitosis :: cell division\nosmosis - diffusion of water\nQ: What is ATP?\nA: The cell’s energy currency'}
      ></textarea>
      <button class="btn sm" onclick={addPasted} disabled={!paste.trim()}>Add cards</button>
    </details>
    <details class="more">
      <summary>Generate from notes {aiAvailable() ? '✨' : '(needs an API key in Settings → AI helper)'}</summary>
      <textarea
        class="textarea"
        bind:value={aiSource}
        placeholder="Paste your notes, a chapter summary, or just a topic like “photosynthesis light reactions”"
        disabled={!aiAvailable()}
      ></textarea>
      <button class="btn sm" onclick={generate} disabled={!aiAvailable() || !aiSource.trim() || aiBusy}>{aiBusy ? 'Generating…' : 'Generate 12 cards'}</button>
    </details>
    {#if cards.length}
      <ul class="cards">
        {#each cards as c (c.id)}
          <li class="b{c.box}">
            <span class="f">{c.front}</span>
            <span class="bk">{c.back}</span>
            <span class="boxn" title="Leitner box">{c.box}</span>
            <button class="btn ghost sm icon" aria-label="Delete card" onclick={() => store.deleteCard(c.id)}>×</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="help">No cards yet. Add a few above.</p>
    {/if}
  </section>
{/if}

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 400;
  }
  .newdeck,
  .addcard {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .newdeck .input,
  .addcard .input {
    flex: 1;
    min-width: 160px;
  }
  .newdeck .select {
    width: auto;
  }
  .decks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .deck {
    width: 100%;
    display: grid;
    grid-template-columns: 12px 1fr auto;
    gap: 6px 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg-elev-2);
    text-align: left;
    color: var(--text);
  }
  .deck:hover {
    background: var(--bg-hover);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .name {
    font-weight: 600;
  }
  .meta {
    font-size: 12px;
    color: var(--text-muted);
  }
  .mastery {
    grid-column: 2 / 4;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .mastery .fill {
    display: block;
    height: 100%;
    background: var(--success);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    margin: 0;
  }
  .studybar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .more {
    margin: 8px 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .more .textarea {
    margin: 8px 0 6px;
    min-height: 70px;
  }
  .cards {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cards li {
    display: grid;
    grid-template-columns: 1fr 1fr auto auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--bg-elev-2);
    font-size: 13px;
    border-left: 3px solid var(--border);
  }
  .cards li.b3 {
    border-left-color: var(--warn);
  }
  .cards li.b4 {
    border-left-color: var(--info);
  }
  .cards li.b5 {
    border-left-color: var(--success);
  }
  .f {
    font-weight: 600;
  }
  .bk {
    color: var(--text-muted);
  }
  .boxn {
    font-size: 11px;
    color: var(--text-faint);
  }
  .progress {
    margin-left: auto;
    font-size: 13px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .flashcard {
    position: relative;
    display: block;
    width: 100%;
    height: 240px;
    perspective: 1000px;
    cursor: pointer;
    margin: 8px 0;
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    border-radius: 16px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    backface-visibility: hidden;
    transition: transform 400ms var(--ease);
    text-align: center;
  }
  .face.back {
    transform: rotateY(180deg);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg-elev-2));
    border-color: var(--accent);
  }
  .flipped .face.front {
    transform: rotateY(180deg);
  }
  .flipped .face.back {
    transform: rotateY(360deg);
  }
  .face .lbl {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
  }
  .face .txt {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--text);
  }
  .face .hint {
    font-size: 12px;
    color: var(--text-faint);
  }
  .answers {
    display: flex;
    gap: 10px;
    justify-content: center;
    opacity: 0.4;
    transition: opacity var(--dur);
  }
  .answers.show {
    opacity: 1;
  }
  .answers .btn {
    padding: 12px 22px;
    font-size: 15px;
  }
  .box {
    text-align: center;
    font-size: 12px;
    color: var(--text-faint);
    margin-top: 8px;
  }
  .done {
    text-align: center;
    padding: 20px 0;
  }
  .done .big {
    font-size: 44px;
  }
  .done h3 {
    margin: 4px 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 12px;
  }
  @media (max-width: 600px) {
    .cards li {
      grid-template-columns: 1fr auto auto;
    }
    .bk {
      grid-column: 1 / 4;
    }
  }
</style>
