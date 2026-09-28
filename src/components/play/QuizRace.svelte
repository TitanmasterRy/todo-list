<script lang="ts">
  // Quiz race: timed multiple choice against the ghost of your best run on this deck or quiz set.
  // The ghost lane replays when that run got each answer right; beat it and your run becomes the new ghost.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';
  import { formatTime, type Choice } from '../../lib/studygames';
  import { beats, gapText, ghostProgress, loadGhosts, recordRun, saveGhosts, type Ghost, type RaceQuestion } from '../../lib/quizrace';

  interface Props {
    title: string;
    raceKey: string; // "deck:<id>" or "quiz:<id>"
    make: () => RaceQuestion[];
    onexit: () => void;
  }
  let { title, raceKey, make, onexit }: Props = $props();

  let questions = $state<RaceQuestion[]>(untrack(() => make()));
  let ghost = $state<Ghost | undefined>(untrack(() => loadGhosts()[raceKey]));
  let qi = $state(0);
  let picked = $state<string | null>(null);
  let feedback = $state('');
  let hits = $state<number[]>([]);
  let startedAt = $state(Date.now());
  let now = $state(Date.now());
  let endedAt = $state(0);
  let saved = $state(false);
  let won = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const n = $derived(questions.length);
  const q = $derived(questions[qi]);
  const elapsed = $derived((endedAt || now) - startedAt);
  const ghostNow = $derived(Math.min(n, ghostProgress(ghost, elapsed)));
  const pct = (x: number) => (n ? (x / n) * 100 : 0);

  onMount(() => {
    const tick = setInterval(() => {
      if (!endedAt) now = Date.now();
    }, 100);
    return () => clearInterval(tick);
  });

  function choose(ch: Choice) {
    if (picked || endedAt || !q) return;
    picked = ch.id;
    if (ch.correct) {
      hits = [...hits, Date.now() - startedAt];
      feedback = 'Right!';
      playSound('pop');
    } else {
      feedback = `It was “${q.choices.find((c) => c.correct)?.text ?? ''}”.`;
      playSound('undo');
    }
    timer = setTimeout(next, ch.correct ? 450 : 1300);
  }
  function next() {
    picked = null;
    feedback = '';
    if (qi + 1 < n) qi++;
    else finish();
  }
  function finish() {
    endedAt = Date.now();
    const run: Ghost = { hits: [...hits], total: endedAt - startedAt, n, at: new Date().toISOString() };
    won = beats(run, ghost);
    const r = recordRun(loadGhosts(), raceKey, run);
    saved = r.saved;
    if (saved) saveGhosts(r.ghosts);
    if (won && ghost) toasts.push({ message: `You beat your ghost on ${title}`, detail: `${run.hits.length}/${n} in ${formatTime(run.total)}`, kind: 'success', emoji: '🏁' });
  }
  function again() {
    clearTimeout(timer);
    questions = make();
    ghost = loadGhosts()[raceKey];
    qi = 0;
    picked = null;
    feedback = '';
    hits = [];
    startedAt = now = Date.now();
    endedAt = 0;
    saved = won = false;
  }
  function onKey(e: KeyboardEvent) {
    if (endedAt || picked || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const ch = /^[1-4]$/.test(e.key) ? q?.choices[Number(e.key) - 1] : undefined;
    if (ch) {
      e.preventDefault();
      choose(ch);
    }
  }
  // number keys pick answers here, not views
  $effect(() => {
    ui.captureKeys = !endedAt;
  });
  onDestroy(() => {
    ui.captureKeys = false;
    clearTimeout(timer);
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="bar">
  <button class="btn ghost sm" onclick={onexit}>← Decks</button>
  <h2>🏁 Quiz race · {title}</h2>
  <span class="grow"></span>
  {#if !endedAt}
    <span class="meta">Question {qi + 1}/{n}</span>
    <span class="clock" role="timer" aria-label="Time">⏱ {formatTime(elapsed)}</span>
  {/if}
</div>

<section class="card track" aria-label="Race">
  <div class="lane">
    <span class="who">You</span>
    <div class="road" role="progressbar" aria-label="You" aria-valuemin={0} aria-valuemax={n} aria-valuenow={hits.length}>
      <span class="fill you" style="width:{pct(hits.length)}%"></span>
      <span class="runner me" style="left:{pct(hits.length)}%" aria-hidden="true">🏃</span>
    </div>
    {#key hits.length}<span class="count bump">{hits.length}/{n}</span>{/key}
  </div>
  <div class="lane">
    <span class="who">Ghost</span>
    {#if ghost}
      <div class="road" role="progressbar" aria-label="Ghost" aria-valuemin={0} aria-valuemax={n} aria-valuenow={ghostNow}>
        <span class="fill ghost" style="width:{pct(ghostNow)}%"></span>
        <span class="runner gh" style="left:{pct(ghostNow)}%" aria-hidden="true">👻</span>
      </div>
      <span class="count">{ghostNow}/{n}</span>
    {:else}
      <span class="muted small none">No ghost yet. This run becomes your ghost.</span>
    {/if}
  </div>
  {#if ghost && !endedAt}
    <div class="muted small gap">{gapText(hits.length, ghostNow)} · your ghost got {ghost.hits.length}/{ghost.n} in {formatTime(ghost.total)}</div>
  {/if}
</section>

{#if endedAt}
  <section class="card end" aria-live="polite">
    <div class="big" aria-hidden="true">{!ghost ? '👻' : won ? '🏆' : '💨'}</div>
    <h3 class:gold-text={won}>{!ghost ? 'First run done: your ghost is saved' : won ? 'You beat your ghost!' : 'Your ghost wins this time'}</h3>
    <dl class="stats">
      <div>
        <dt>Right</dt>
        <dd>{hits.length}/{n}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{formatTime(elapsed)}</dd>
      </div>
      {#if ghost}
        <div>
          <dt>Ghost</dt>
          <dd>{ghost.hits.length}/{ghost.n} · {formatTime(ghost.total)}</dd>
        </div>
      {/if}
    </dl>
    <p class="muted">{saved && ghost ? 'This run is your new ghost.' : !saved ? 'Most right answers wins; a tie goes to the faster run.' : ''}</p>
    <div class="btns">
      <button class="btn primary" onclick={again}>Race again</button>
      <button class="btn" onclick={onexit}>Pick another deck</button>
    </div>
  </section>
{:else if q}
  <section class="card arena">
    <div class="q">
      {#if q.image}<img src={q.image} alt="" />{/if}
      <div class="qt" data-question>{q.prompt}</div>
    </div>
    <div class="choices">
      {#each q.choices as ch, i (ch.id)}
        <button class="choice" class:ok={!!picked && ch.correct} class:bad={picked === ch.id && !ch.correct} aria-disabled={!!picked} onclick={() => choose(ch)}>
          <span class="kbd">{i + 1}</span>
          {#if ch.image}<img src={ch.image} alt="" />{/if}
          <span class="ct">{ch.text || '(picture)'}</span>
        </button>
      {/each}
    </div>
    <div class="feedback" aria-live="polite">{feedback}</div>
  </section>
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
    font-weight: 800;
  }
  .grow {
    flex: 1;
  }
  .meta {
    font-size: 13px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .clock {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 16px;
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  /* the track: a dark asphalt card with lane lines, a chequered finish and glowing runners */
  .track {
    display: grid;
    gap: 10px;
    margin-bottom: 10px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elev)), var(--bg-elev));
  }
  .lane {
    display: grid;
    grid-template-columns: 52px 1fr 44px;
    gap: 10px;
    align-items: center;
  }
  .who {
    font-weight: 800;
    font-size: 13px;
  }
  .count {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 13px;
    text-align: right;
  }
  .none {
    grid-column: 2 / 4;
  }
  .road {
    position: relative;
    height: 18px;
    border-radius: 999px;
    background:
      repeating-linear-gradient(90deg, transparent 0 14px, color-mix(in srgb, var(--text) 22%, transparent) 14px 22px) 0 50% / 100% 2px no-repeat,
      linear-gradient(180deg, color-mix(in srgb, var(--text) 8%, var(--bg-elev-2)), var(--bg-elev-2));
    border: 1px solid var(--border);
    margin-right: 12px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.25);
  }
  .road::after {
    content: '';
    position: absolute;
    top: -1px;
    bottom: -1px;
    right: -1px;
    width: 10px;
    border-radius: 0 999px 999px 0;
    background:
      repeating-conic-gradient(color-mix(in srgb, var(--text) 85%, transparent) 0 25%, transparent 0 50%) 0 0 / 6px 6px,
      var(--bg-elev);
    opacity: 0.8;
  }
  .fill {
    position: relative;
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s var(--ease);
  }
  .fill.you {
    background: var(--grad-accent);
    box-shadow: 0 0 14px -2px color-mix(in srgb, var(--accent) 80%, transparent);
    overflow: hidden;
  }
  .fill.you::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2.2s linear infinite;
  }
  .fill.ghost {
    background: linear-gradient(90deg, color-mix(in srgb, var(--text-muted) 35%, transparent), color-mix(in srgb, var(--text-muted) 60%, transparent));
  }
  .runner {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -55%);
    font-size: 22px;
    line-height: 1;
    transition: left 0.3s var(--ease);
  }
  .runner.me {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 90%, transparent)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
    animation: run 0.5s ease-in-out infinite;
  }
  .runner.gh {
    opacity: 0.85;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--text-muted) 90%, transparent));
    animation: float 2.2s ease-in-out infinite;
  }
  .gap {
    text-align: center;
  }
  .small {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .arena {
    position: relative;
    display: grid;
    gap: 14px;
    overflow: hidden;
    background: radial-gradient(50% 45% at 50% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%), var(--bg-elev);
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .q {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 16px;
    border-radius: var(--radius);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, var(--bg-elev-2)), var(--bg-elev-2));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
    box-shadow: inset 0 1px 0 var(--sheen);
    text-align: center;
    animation: rise-in var(--dur-slow) var(--ease) both;
  }
  .q img,
  .choice img {
    max-width: 100%;
    max-height: 160px;
    border-radius: 8px;
  }
  .qt {
    font-size: 20px;
    font-weight: 700;
    white-space: pre-wrap;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }
  /* answers: cards that lift on hover, pop green when right and shake red when wrong */
  .choice {
    display: flex;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-elev);
    box-shadow: inset 0 1px 0 var(--sheen);
    font-size: 15px;
    transition:
      border-color var(--dur),
      background var(--dur),
      transform var(--dur) var(--spring),
      box-shadow var(--dur);
  }
  .choice:hover {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      var(--glow);
  }
  .choice .kbd {
    flex-shrink: 0;
  }
  .choice.ok {
    border-color: var(--success);
    background: color-mix(in srgb, var(--success) 18%, var(--bg-elev));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent);
    animation: bump 420ms var(--spring);
  }
  .choice.bad {
    border-color: var(--danger);
    background: color-mix(in srgb, var(--danger) 18%, var(--bg-elev));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 25%, transparent);
    animation: shake 0.45s var(--ease);
  }
  .ct {
    white-space: pre-wrap;
  }
  .feedback {
    min-height: 1.4em;
    font-weight: 700;
    text-align: center;
  }
  .end {
    position: relative;
    overflow: hidden;
    text-align: center;
    display: grid;
    gap: 8px;
    justify-items: center;
    background: radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--gold) 12%, transparent), transparent 70%), var(--bg-elev);
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .big {
    font-size: 56px;
    line-height: 1;
    filter: drop-shadow(0 10px 18px color-mix(in srgb, var(--accent) 45%, transparent));
    animation: float 3.2s ease-in-out infinite;
  }
  .end h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(90px, 1fr));
    gap: 8px;
    margin: 6px 0;
  }
  .stats div {
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    box-shadow: inset 0 1px 0 var(--sheen);
  }
  .stats dt {
    font-size: 12px;
    color: var(--text-muted);
  }
  .stats dd {
    margin: 0;
    font-weight: 800;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
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
  @keyframes run {
    0%,
    100% {
      transform: translate(-50%, -55%) rotate(-4deg);
    }
    50% {
      transform: translate(-50%, -65%) rotate(4deg);
    }
  }
</style>
