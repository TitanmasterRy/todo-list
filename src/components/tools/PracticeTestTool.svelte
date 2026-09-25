<script lang="ts">
  // Tools → Practice test: take a Quiz maker set like a real test (all questions on one page, optional time limit),
  // see what you missed with explanations, turn misses into notecards, and watch your scores over time.
  import { onDestroy } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { correctText, loadQuizSets, type Question, type QuizSet } from '../../lib/quizmaker';
  import { addAttempt, answered, gradeTest, loadAttempts, pointsOf, summaryOf, testable, type Attempt, type Graded, type Response } from '../../lib/practicetest';
  import { formatTime } from '../../lib/studygames';

  const sets = loadQuizSets().filter((s) => testable(s).length);
  let attempts = $state(loadAttempts());
  let setId = $state<string | null>(ui.practiceSet && sets.some((s) => s.id === ui.practiceSet) ? ui.practiceSet : null);
  ui.practiceSet = null;
  let phase = $state<'pick' | 'test' | 'done'>('pick');
  let questions = $state<Question[]>([]);
  let responses = $state<Record<string, Response>>({});
  let overrides = $state<Record<string, boolean>>({});
  let shuffle = $state(false);
  let limitMin = $state('');
  let startedAt = $state(0);
  let now = $state(Date.now());
  let graded = $state<Graded | null>(null);
  let tick: ReturnType<typeof setInterval> | undefined;
  onDestroy(() => clearInterval(tick));

  const set = $derived(sets.find((s) => s.id === setId) ?? null);
  const limitMs = $derived(Math.max(0, parseFloat(limitMin) || 0) * 60_000);
  const elapsed = $derived(startedAt ? now - startedAt : 0);
  const left = $derived(limitMs ? Math.max(0, limitMs - elapsed) : 0);
  const unanswered = $derived(questions.filter((q) => !answered(q, responses[q.id])).length);

  function start(s: QuizSet, only?: string[]) {
    setId = s.id;
    let qs = testable(s).filter((q) => !only || only.includes(q.id));
    if (shuffle) qs = [...qs].sort(() => Math.random() - 0.5);
    questions = qs;
    responses = {};
    overrides = {};
    graded = null;
    startedAt = Date.now();
    now = startedAt;
    phase = 'test';
    clearInterval(tick);
    tick = setInterval(() => {
      now = Date.now();
      if (limitMs && now - startedAt >= limitMs) submit(true);
    }, 500);
  }

  function submit(timeUp = false) {
    if (phase !== 'test') return;
    if (!timeUp && unanswered && !confirm(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} blank. Hand it in anyway?`)) return;
    clearInterval(tick);
    graded = gradeTest(questions, responses, overrides);
    const a: Attempt = {
      at: new Date().toISOString(),
      pct: graded.pct,
      earned: graded.earned,
      total: graded.total,
      ms: Date.now() - startedAt,
      missed: graded.results.filter((r) => !r.correct).map((r) => r.id),
    };
    attempts = addAttempt(attempts, setId!, a);
    phase = 'done';
    if (timeUp) toasts.push({ message: 'Time’s up', detail: 'Your test was handed in.', kind: 'info', emoji: '⏰' });
  }

  // counting a short answer as right after the fact updates the grade and the saved attempt
  function override(q: Question, right: boolean) {
    overrides = { ...overrides, [q.id]: right };
    graded = gradeTest(questions, responses, overrides);
    const list = [...(attempts[setId!] ?? [])];
    const last = list.pop();
    if (last)
      attempts = addAttempt({ ...attempts, [setId!]: list }, setId!, {
        ...last,
        pct: graded.pct,
        earned: graded.earned,
        missed: graded.results.filter((r) => !r.correct).map((r) => r.id),
      });
  }

  function missedToCards() {
    if (!set || !graded) return;
    const missed = questions.filter((q) => graded!.results.find((r) => r.id === q.id && !r.correct));
    const name = `${set.title} — missed`;
    const deck = store.decks.find((d) => d.name === name) ?? store.addDeck(name);
    const added = store.addCards(
      deck.id,
      missed.map((q) => ({ front: q.prompt, back: correctText(q) + (q.explanation ? `\n${q.explanation}` : '') })),
    );
    toasts.push({
      message: `Added ${added.length} notecard${added.length === 1 ? '' : 's'} to “${deck.name}”`,
      kind: 'success',
      emoji: '🃏',
      action: { label: 'Study', onClick: () => ((ui.openDeck = deck.id), (ui.toolsTab = 'notecards')) },
    });
  }

  function toggle(q: Question, i: number) {
    const cur = (responses[q.id] as number[] | undefined) ?? [];
    responses[q.id] = q.correct.length > 1 ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i];
  }
  const resultOf = (id: string) => graded?.results.find((r) => r.id === id);
  const shown = (q: Question, r: Response) => (typeof r === 'string' ? r || '—' : r?.length ? r.map((i) => q.options[i]).join(', ') : '—');
  const history = $derived(setId ? (attempts[setId] ?? []) : []);
</script>

<section class="card">
  {#if phase === 'pick'}
    <h2>📝 Practice test</h2>
    <p class="help">Take a Quiz maker set like a real test, then review what you missed. Scores are kept on this device so you can see yourself improve.</p>
    {#if !sets.length}
      <p class="muted">No quiz sets yet. Make one in <button class="link" onclick={() => (ui.toolsTab = 'quiz')}>Quiz maker</button> (by hand or with AI), then come back.</p>
    {:else}
      <div class="opts">
        <label class="chk"><input type="checkbox" bind:checked={shuffle} /> Shuffle questions</label>
        <label class="chk"
          >Time limit <input class="input n" type="number" min="0" step="5" bind:value={limitMin} placeholder="none" aria-label="Time limit in minutes" /> min</label
        >
      </div>
      <ul class="sets">
        {#each sets as s (s.id)}
          {@const sum = summaryOf(attempts[s.id])}
          <li class:picked={s.id === setId}>
            <div class="info">
              <strong>{s.title}</strong>
              <span class="muted">{testable(s).length} questions · {s.subject}{sum.count ? ` · ${sum.count} attempt${sum.count === 1 ? '' : 's'}` : ''}</span>
            </div>
            {#if sum.count}<span class="score">last {sum.last}% · best {sum.best}%</span>{/if}
            <button class="btn sm primary" onclick={() => start(s)}>Start</button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else if phase === 'test' && set}
    <div class="bar">
      <h2>{set.title}</h2>
      <span class="grow"></span>
      <span class="clock" class:low={limitMs && left < 60_000} role="timer" aria-live="off">{limitMs ? `⏳ ${formatTime(left)} left` : `⏱ ${formatTime(elapsed)}`}</span>
    </div>
    <ol class="qs">
      {#each questions as q, i (q.id)}
        <li class="q" aria-labelledby="pq-{q.id}">
          <p id="pq-{q.id}" class="prompt"><span class="num">{i + 1}.</span> {q.prompt} <span class="pts">({pointsOf(q)} pt{pointsOf(q) === 1 ? '' : 's'})</span></p>
          {#if q.type === 'short' || q.type === 'fill'}
            <input
              class="input"
              value={(responses[q.id] as string) ?? ''}
              oninput={(e) => (responses[q.id] = e.currentTarget.value)}
              aria-label="Answer to question {i + 1}"
              autocomplete="off"
            />
          {:else}
            <div class="choices" role={q.correct.length > 1 ? 'group' : 'radiogroup'} aria-labelledby="pq-{q.id}">
              {#each q.options as o, k (k)}
                {@const on = ((responses[q.id] as number[] | undefined) ?? []).includes(k)}
                <label class="choice" class:on
                  ><input type={q.correct.length > 1 ? 'checkbox' : 'radio'} name="pq-{q.id}" checked={on} onchange={() => toggle(q, k)} />
                  {o}</label
                >
              {/each}
              {#if q.correct.length > 1}<span class="muted">Pick all that apply.</span>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <div class="bar">
      <span class="muted">{questions.length - unanswered} of {questions.length} answered</span>
      <span class="grow"></span>
      <button class="btn ghost" onclick={() => (clearInterval(tick), (phase = 'pick'))}>Quit</button>
      <button class="btn primary" onclick={() => submit()}>Hand it in</button>
    </div>
  {:else if phase === 'done' && set && graded}
    <div class="result" role="status">
      <div class="big">{graded.pct}%</div>
      <div>
        <strong>{set.title}</strong>
        <div class="muted">{graded.earned} of {graded.total} points · {formatTime(history[history.length - 1]?.ms ?? 0)}</div>
      </div>
    </div>
    {#if history.length > 1}
      <figure class="hist" aria-label="Scores over your last {Math.min(10, history.length)} attempts">
        {#each history.slice(-10) as a, i (a.at)}
          <div class="col" title="{new Date(a.at).toLocaleDateString()}: {a.pct}%">
            <span class="v">{a.pct}</span>
            <span class="b" class:last={i === Math.min(10, history.length) - 1} style="height:{Math.max(4, a.pct)}%"></span>
          </div>
        {/each}
      </figure>
    {/if}
    <ol class="qs review">
      {#each questions as q, i (q.id)}
        {@const r = resultOf(q.id)}
        <li class="q" class:right={r?.correct} class:wrong={!r?.correct}>
          <p class="prompt"><span class="num">{r?.correct ? '✓' : '✗'} {i + 1}.</span> {q.prompt}</p>
          <p class="ans">Your answer: <strong>{shown(q, responses[q.id])}</strong></p>
          {#if !r?.correct}<p class="ans">Correct: <strong>{correctText(q)}</strong></p>{/if}
          {#if q.explanation}<p class="muted">{q.explanation}</p>{/if}
          {#if (q.type === 'short' || q.type === 'fill') && answered(q, responses[q.id])}
            <button class="link small" onclick={() => override(q, !r?.correct)}>{r?.correct ? 'Actually, count it wrong' : 'My answer means the same: count it right'}</button>
          {/if}
        </li>
      {/each}
    </ol>
    <div class="bar">
      <button class="btn ghost" onclick={() => (phase = 'pick')}>All tests</button>
      <span class="grow"></span>
      {#if graded.results.some((x) => !x.correct)}
        <button class="btn" onclick={missedToCards}>🃏 Missed → notecards</button>
        <button
          class="btn"
          onclick={() =>
            start(
              set!,
              graded!.results.filter((x) => !x.correct).map((x) => x.id),
            )}>Retake missed</button
        >
      {/if}
      <button class="btn primary" onclick={() => start(set!)}>Retake</button>
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0;
  }
  .link {
    color: var(--accent-text);
    padding: 0;
    font-size: inherit;
  }
  .link.small {
    font-size: 12px;
  }
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin: 8px 0;
    font-size: 13px;
  }
  .chk {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .n {
    width: 70px;
    padding: 4px 6px;
  }
  .sets {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .sets li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .sets li.picked {
    border-color: var(--accent);
  }
  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .score {
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 8px 0;
  }
  .bar h2 {
    margin: 0;
  }
  .grow {
    flex: 1;
  }
  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .clock.low {
    color: var(--danger-text);
  }
  .qs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .q {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .q.right {
    border-inline-start: 4px solid var(--success, #22c55e);
  }
  .q.wrong {
    border-inline-start: 4px solid var(--danger, #e5484d);
  }
  .prompt {
    margin: 0 0 8px;
    font-weight: 600;
  }
  .num {
    color: var(--text-muted);
    margin-inline-end: 4px;
  }
  .pts {
    font-weight: 400;
    font-size: 12px;
    color: var(--text-muted);
  }
  .choices {
    display: grid;
    gap: 4px;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
  }
  .choice.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .ans {
    margin: 2px 0;
    font-size: 14px;
  }
  .result {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 10px;
  }
  .big {
    font-size: 40px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .hist {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 90px;
    margin: 0 0 12px;
    padding: 0 0 2px;
    border-bottom: 1px solid var(--border);
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    width: 24px;
  }
  .v {
    font-size: 10px;
    color: var(--text-muted);
  }
  .b {
    width: 18px;
    background: color-mix(in srgb, var(--accent) 45%, transparent);
    border-radius: 4px 4px 0 0;
  }
  .b.last {
    background: var(--accent);
  }
</style>
