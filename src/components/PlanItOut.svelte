<script lang="ts">
  // Task editor → Plan it out: split a big task into dated milestones, or space study sessions before an exam.
  import { store } from '../lib/store.svelte';
  import { examSessions, MILESTONE_TEMPLATES, planMilestones, templateForType, type MilestoneStep } from '../lib/plan';
  import { formatDayHeading } from '../lib/dates';
  import type { TaskType } from '../lib/types';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    taskId: string;
    title: string;
    dateKey: string;
    type: TaskType | '';
    /** The big task now waits on this milestone (the editor keeps its "Waiting on" list in step). */
    onchain: (lastId: string) => void;
  }
  let { taskId, title, dateKey, type, onchain }: Props = $props();

  const examLike = $derived(type === 'exam' || type === 'quiz');
  // follows the task type until you pick one yourself
  let pickedMode = $state<'milestones' | 'exam' | null>(null);
  const mode = $derived(pickedMode ?? (examLike ? 'exam' : 'milestones'));
  let pickedTemplate = $state<string | null>(null);
  const templateId = $derived(pickedTemplate ?? templateForType(type).id);
  let steps = $state<MilestoneStep[]>([]);
  let deckId = $state('');
  let sessionMin = $state('30');
  let open = $state(false);

  function loadTemplate(id: string) {
    const tpl = MILESTONE_TEMPLATES.find((x) => x.id === id);
    if (tpl) steps = tpl.steps.map((s) => ({ ...s }));
  }
  $effect(() => {
    if (open && !steps.length) loadTemplate(templateId);
  });

  const planned = $derived(dateKey ? planMilestones(steps, store.today, dateKey) : []);
  // the planned date for each row (blank rows are skipped by the planner)
  const rowDates = $derived.by(() => {
    let k = 0;
    return steps.map((s) => (s.title.trim() ? (planned[k++]?.dateKey ?? '') : ''));
  });
  const sessions = $derived(dateKey ? examSessions(store.today, dateKey) : []);
  const existing = $derived(store.tasks.filter((t) => t.parentId === taskId));
  const decks = $derived(store.decks);
  const shortTitle = $derived(title.trim().length > 40 ? title.trim().slice(0, 38) + '…' : title.trim());

  function addMilestones() {
    const made = store.addPlan(
      taskId,
      planned.map((p) => ({ ...p, title: `${p.title} · ${shortTitle}` })),
      { chain: true, label: t('plan.added', { count: planned.length }) },
    );
    if (made.length) onchain(made[made.length - 1].id);
    open = false;
  }
  function addSessions() {
    const deck = store.decks.find((d) => d.id === deckId);
    const min = Math.max(5, parseInt(sessionMin, 10) || 30);
    store.addPlan(
      taskId,
      sessions.map((d, i) => ({ title: t('plan.studyFor', { title: shortTitle, i: i + 1, n: sessions.length }), dateKey: d, estimateMin: min, deckId: deck?.id })),
      { label: t('plan.addedSessions', { count: sessions.length }) },
    );
    open = false;
  }
</script>

<details class="plan" bind:open>
  <summary>🪜 {t('plan.title')}{existing.length ? ` · ${t('plan.planned', { count: existing.length })}` : ''}</summary>
  {#if !dateKey}
    <p class="muted">{t('plan.needDate')}</p>
  {:else}
    <div class="seg" role="radiogroup" aria-label={t('plan.type')}>
      <button type="button" role="radio" aria-checked={mode === 'milestones'} class:on={mode === 'milestones'} onclick={() => (pickedMode = 'milestones')}
        >{t('plan.milestones')}</button
      >
      <button type="button" role="radio" aria-checked={mode === 'exam'} class:on={mode === 'exam'} onclick={() => (pickedMode = 'exam')}
        >{t('plan.exam')}{examLike ? ' ✓' : ''}</button
      >
    </div>
    {#if mode === 'milestones'}
      <p class="muted">{t('plan.help')}</p>
      <label class="row">
        <span>{t('plan.template')}</span>
        <select
          class="select"
          value={templateId}
          onchange={(e) => {
            pickedTemplate = e.currentTarget.value;
            loadTemplate(pickedTemplate);
          }}
          aria-label={t('plan.templateLabel')}
          >{#each MILESTONE_TEMPLATES as tpl (tpl.id)}<option value={tpl.id}>{tpl.label}</option>{/each}</select
        >
      </label>
      <ol class="steps">
        {#each steps as s, i (i)}
          <li>
            <input class="input" bind:value={s.title} aria-label={t('plan.step', { n: i + 1 })} />
            <span class="date">{rowDates[i] ? formatDayHeading(rowDates[i], store.now) : ''}</span>
            <button type="button" class="x" onclick={() => (steps = steps.filter((_, k) => k !== i))} aria-label={t('plan.removeStep', { n: i + 1 })}>×</button>
          </li>
        {/each}
      </ol>
      <div class="row">
        <button type="button" class="btn sm ghost" onclick={() => (steps = [...steps, { title: '', weight: 1, estimateMin: 30 }])}>{t('plan.addStep')}</button>
        <span class="grow"></span>
        <button type="button" class="btn sm primary" onclick={addMilestones} disabled={!planned.length}>{t('plan.addN', { count: planned.length })}</button>
      </div>
    {:else}
      <p class="muted">{t('plan.examHelp')}</p>
      <div class="row">
        <select class="select" bind:value={deckId} aria-label={t('plan.deck')}>
          <option value="">{t('plan.noDeck')}</option>
          {#each decks as d (d.id)}<option value={d.id}>🃏 {d.name}</option>{/each}
        </select>
        <label class="mins"><input class="input n" type="number" min="5" step="5" bind:value={sessionMin} aria-label={t('plan.minutes')} /> {t('plan.minEach')}</label>
      </div>
      {#if sessions.length}
        <ul class="sessions">
          {#each sessions as d (d)}<li>{formatDayHeading(d, store.now)}</li>{/each}
        </ul>
        <div class="row">
          <span class="grow"></span>
          <button type="button" class="btn sm primary" onclick={addSessions}>{t('plan.addSessions', { count: sessions.length })}</button>
        </div>
      {:else}
        <p class="muted">{t('plan.past')}</p>
      {/if}
    {/if}
  {/if}
</details>

<style>
  .plan {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm, 8px);
    padding: 8px 10px;
    margin: 4px 0 12px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    margin-top: 8px;
    background: var(--bg-sunken, var(--bg-elev));
    border-radius: 8px;
    padding: 2px;
  }
  .seg button {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .seg button.on {
    background: var(--bg-elev);
    color: var(--text);
    font-weight: 600;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
    font-size: 13px;
  }
  .row .select {
    width: auto;
  }
  .grow {
    flex: 1;
  }
  .steps {
    margin: 6px 0;
    padding-left: 22px;
    display: grid;
    gap: 4px;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .steps .input {
    flex: 1;
    padding: 4px 8px;
    font-size: 13px;
  }
  .date {
    font-size: 12px;
    color: var(--text-muted);
    min-width: 72px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .x {
    color: var(--text-muted);
    font-size: 16px;
    padding: 0 4px;
  }
  .sessions {
    margin: 6px 0;
    padding-left: 20px;
    font-size: 13px;
  }
  .mins {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }
  .n {
    width: 64px;
    padding: 4px 6px;
  }
</style>
