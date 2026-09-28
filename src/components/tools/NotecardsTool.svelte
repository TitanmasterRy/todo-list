<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onDestroy } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import type { Card } from '../../lib/types';
  import { dueCards, mastery, parseCards, parseCloze, shuffle } from '../../lib/flashcards';
  import { formatInterval, preview, RATING_LABEL, type Rating } from '../../lib/fsrs';
  import { imageToDataUrl } from '../../lib/ai-providers';
  import { downloadText } from '../../lib/download';
  import { diffDays } from '../../lib/dates';
  import { uid } from '../../lib/id';
  import { aiAvailable, makeNotecards } from '../../lib/ai';
  import { playSound } from '../../lib/sounds';
  import { renderTextWithMath } from '../../lib/math.svelte';
  import { t } from '../../lib/i18n/index.svelte';

  let deckId = $state<string | null>(ui.openDeck);
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
  let frontImage = $state<string | undefined>();
  let backImage = $state<string | undefined>();
  let cloze = $state('');
  let importing = $state(false);
  let ankiInput: HTMLInputElement | undefined = $state();

  async function pickImage(e: Event, side: 'front' | 'back') {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      // shrink so decks stay small enough to sync
      const url = await imageToDataUrl(f, 800, 0.8);
      if (side === 'front') frontImage = url;
      else backImage = url;
    } catch {
      toasts.push({ message: t('cards.imageFailed'), kind: 'warn' });
    }
  }
  function addCloze() {
    if (!deck) return;
    const items = parseCloze(cloze);
    if (!items.length) {
      toasts.push({ message: t('cards.noBlanks'), detail: t('cards.noBlanksDetail'), kind: 'warn' });
      return;
    }
    const noteId = uid('note');
    const added = store.addCards(
      deck.id,
      items.map((i) => ({ ...i, noteId })),
    );
    toasts.push({ message: t('cards.addedCloze', { count: added.length }), kind: 'success' });
    cloze = '';
  }
  function exportAnki() {
    if (!deck) return;
    void import('../../lib/anki').then(({ toAnkiText }) => {
      downloadText(`${deck.name.replace(/[^\w\- ]+/g, '').trim() || 'deck'}-anki.txt`, toAnkiText(deck.name, cards), 'text/plain');
      toasts.push({ message: t('cards.exported'), detail: t('cards.exportedDetail'), kind: 'success' });
    });
  }
  async function importAnki(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    importing = true;
    try {
      const anki = await import('../../lib/anki');
      if (/\.(apkg|colpkg)$/i.test(f.name)) {
        const decks = await anki.importApkg(new Uint8Array(await f.arrayBuffer()));
        let total = 0;
        let lastId: string | null = null;
        for (const d of decks) {
          const target = decks.length === 1 && deck ? deck : store.addDeck(d.name);
          total += store.addCards(target.id, d.cards).length;
          lastId = target.id;
        }
        if (lastId) deckId = lastId;
        toasts.push({ message: t('cards.imported', { count: total }) + (decks.length > 1 ? t('cards.intoDecks', { n: decks.length }) : ''), kind: 'success', emoji: '📥' });
      } else {
        const items = anki.fromAnkiText(await f.text());
        const target = deck ?? store.addDeck(f.name.replace(/\.[^.]+$/, ''));
        const added = store.addCards(target.id, items);
        deckId = target.id;
        toasts.push({ message: t('cards.imported', { count: added.length }), kind: added.length ? 'success' : 'warn', emoji: '📥' });
      }
    } catch (err) {
      toasts.push({ message: t('cards.importFailed'), detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 9000 });
    } finally {
      importing = false;
    }
  }

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
  const intervals = $derived(current ? preview(current, store.today) : null);
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
    if (!deck || !(front.trim() || frontImage) || !(back.trim() || backImage)) return;
    store.addCards(deck.id, [{ front, back, frontImage, backImage }]);
    front = '';
    back = '';
    frontImage = backImage = undefined;
    playSound('tick');
  }
  function addPasted() {
    if (!deck) return;
    const items = parseCards(paste);
    const added = store.addCards(deck.id, items);
    toasts.push({
      message: added.length ? t('cards.added', { count: added.length }) : t('cards.none'),
      detail: added.length ? undefined : t('cards.noneDetail'),
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
      toasts.push({ message: t('cards.generated', { count: added.length }), kind: 'success', emoji: '✨' });
      aiSource = '';
    } catch (e) {
      toasts.push({ message: t('cards.genFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      aiBusy = false;
    }
  }
  // opened from a study-session task: jump straight into the deck (everything if nothing is due yet)
  $effect(() => {
    if (!ui.openDeck || deck?.id !== ui.openDeck) return;
    ui.openDeck = null;
    if (cards.length) startStudy(!due.length);
  });
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
  function answer(rating: Rating) {
    if (!current) return;
    const ok = rating >= 2;
    store.answerCard(current.id, rating);
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
    const n = prompt(t('cards.rename'), deck.name);
    if (n?.trim()) store.updateDeck(deck.id, { name: n.trim() });
  }
  function onKey(e: KeyboardEvent) {
    if (mode !== 'study' || finished) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flipped = !flipped;
    } else if (flipped && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      answer(Number(e.key) as Rating);
    } else if (flipped && (e.key === 'j' || e.key === 'k')) {
      e.preventDefault();
      answer(e.key === 'j' ? 1 : 3);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !deck}
  <section class="card">
    <h2>{t('tools.notecards')}</h2>
    <p class="help">
      {t('cards.help')}
    </p>
    <form class="newdeck" onsubmit={createDeck}>
      <input class="input" bind:value={newDeckName} placeholder={t('cards.newDeckPh')} aria-label={t('cards.deckName')} data-deck-name />
      <select class="select" bind:value={newDeckCourse} aria-label={t('inbox.course')}>
        <option value="">{t('inbox.noCourse')}</option>
        {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ?? ''} {c.name}</option>{/each}
      </select>
      <button class="btn primary" type="submit" disabled={!newDeckName.trim()}>{t('cards.create')}</button>
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
              <span class="meta">{t('cards.count', { count: d.count })}{d.due ? ` · ${t('cards.due', { n: d.due })}` : ''}</span>
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
        <h3>{t('cards.right', { n: correct, total: reviewed })}</h3>
        <p class="help">
          {correct === reviewed && !sessionAll ? t('cards.cleared') : t('cards.scheduled')}
        </p>
        <div class="btns">
          <button class="btn primary" onclick={() => (mode = 'edit')}>{t('cards.backToDeck')}</button>
          {#if due.length}<button class="btn" onclick={() => startStudy(false)}>{t('cards.again', { n: due.length })}</button>{/if}
        </div>
      </div>
    {:else if current}
      <button class="flashcard" class:flipped onclick={() => (flipped = !flipped)} aria-label={flipped ? t('cards.showingBack') : t('cards.showBack')}>
        <span class="face front"
          ><span class="lbl">{t('cards.front')}</span>{#if current.frontImage}<img class="cimg" src={current.frontImage} alt="" />{/if}<span class="txt"
            >{@html renderTextWithMath(current.front)}</span
          ><span class="hint">{t('cards.flipHint')}</span></span
        >
        <span class="face back"
          ><span class="lbl">{t('cards.back')}</span>{#if current.backImage}<img class="cimg" src={current.backImage} alt="" />{/if}<span class="txt"
            >{@html renderTextWithMath(current.back)}</span
          ></span
        >
      </button>
      <div class="answers" class:show={flipped}>
        {#each [1, 2, 3, 4] as const as r (r)}
          <button class="btn" class:danger={r === 1} class:primary={r === 3} onclick={() => answer(r)} disabled={!flipped}
            >{RATING_LABEL[r]} <span class="iv">{intervals ? formatInterval(intervals[r]) : ''}</span> <span class="kbd">{r}</span></button
          >
        {/each}
      </div>
      <div class="box">{current.reps ? t('cards.reviewed', { reps: current.reps, count: current.lapses }) : t('cards.newCard')}</div>
    {/if}
  </section>
{:else}
  <section class="card">
    <div class="head">
      <button class="btn ghost sm" onclick={() => (deckId = null)}>← {t('cards.decks')}</button>
      <h2 class="grow">{deck.name} <span class="muted">{t('cards.count', { count: cards.length })}</span></h2>
      <button class="btn ghost sm" onclick={renameDeck}>{t('cards.renameBtn')}</button>
      <button
        class="btn ghost sm"
        onclick={() => {
          store.deleteDeck(deck.id);
          deckId = null;
        }}>{t('common.delete')}</button
      >
    </div>
    <div class="studybar">
      <button class="btn primary" onclick={() => startStudy(false)} disabled={!due.length}>{t('cards.studyDue', { n: due.length })}</button>
      <button class="btn" onclick={() => startStudy(true)} disabled={!cards.length}>{t('cards.studyAll')}</button>
      <span class="muted">{t('cards.mastery', { pct: (mastery(cards) * 100).toFixed(0) })}</span>
    </div>
    <form class="addcard" onsubmit={addOne}>
      <input class="input" bind:value={front} placeholder={t('cards.frontPh')} aria-label={t('cards.front')} />
      <label class="imgpick" title={t('cards.frontPic')}
        >{frontImage ? '🖼️✓' : '🖼️'}<input type="file" accept="image/*" onchange={(e) => pickImage(e, 'front')} aria-label={t('cards.frontImage')} /></label
      >
      <input class="input" bind:value={back} placeholder={t('cards.backPh')} aria-label={t('cards.back')} />
      <label class="imgpick" title={t('cards.backPic')}
        >{backImage ? '🖼️✓' : '🖼️'}<input type="file" accept="image/*" onchange={(e) => pickImage(e, 'back')} aria-label={t('cards.backImage')} /></label
      >
      <button class="btn" type="submit" disabled={!(front.trim() || frontImage) || !(back.trim() || backImage)}>{t('common.add')}</button>
    </form>
    <details class="more">
      <summary>{t('cards.cloze')}</summary>
      <p class="help">{t('cards.clozeHelp')} <code>The {'{{c1::nucleus}}'} holds {'{{c2::DNA}}'}.</code></p>
      <textarea class="textarea" bind:value={cloze} placeholder={'The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell.'}></textarea>
      <button class="btn sm" onclick={addCloze} disabled={!cloze.trim()}>{t('cards.addBlanks')}</button>
    </details>
    <details class="more">
      <summary>Anki</summary>
      <div class="btns">
        <button class="btn sm" onclick={() => ankiInput?.click()} disabled={importing}>{importing ? t('cards.importing') : t('cards.import')}</button>
        <button class="btn sm" onclick={exportAnki} disabled={!cards.length}>{t('cards.export')}</button>
        <input type="file" accept=".apkg,.colpkg,.txt,.tsv,.csv" bind:this={ankiInput} onchange={importAnki} class="visually-hidden" aria-label={t('cards.ankiFile')} />
      </div>
      <p class="help">
        {t('cards.ankiHelp')}
      </p>
    </details>
    <details class="more">
      <summary>{t('cards.paste')}</summary>
      <textarea class="textarea" bind:value={paste} placeholder={t('cards.pastePh')}></textarea>
      <button class="btn sm" onclick={addPasted} disabled={!paste.trim()}>{t('cards.addCards')}</button>
    </details>
    <details class="more">
      <summary>{t('cards.generate')} {aiAvailable() ? '✨' : t('cards.needsKey')}</summary>
      <textarea class="textarea" bind:value={aiSource} placeholder={t('cards.genPh')} disabled={!aiAvailable()}></textarea>
      <button class="btn sm" onclick={generate} disabled={!aiAvailable() || !aiSource.trim() || aiBusy}>{aiBusy ? t('cards.generating') : t('cards.gen12')}</button>
    </details>
    {#if cards.length}
      <ul class="cards">
        {#each cards as c (c.id)}
          <li class="b{c.box}">
            <span class="f">{@html renderTextWithMath(c.front)}</span>
            <span class="bk">{@html renderTextWithMath(c.back)}</span>
            <span class="boxn" title={c.reps ? t('cards.next', { date: c.due }) : t('cards.newTitle')}
              >{c.reps ? formatInterval(Math.max(0, diffDays(store.today, c.due))) : t('cards.new')}</span
            >
            <button class="btn ghost sm icon" aria-label={t('cards.delete')} onclick={() => store.deleteCard(c.id)}>×</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="help">{t('cards.empty')}</p>
    {/if}
  </section>
{/if}

<style>
  .cimg {
    max-width: 100%;
    max-height: 180px;
    border-radius: 8px;
    object-fit: contain;
  }
  .iv {
    font-size: 11px;
    opacity: 0.8;
  }
  .imgpick {
    position: relative;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  .imgpick input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
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
