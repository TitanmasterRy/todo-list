<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  // Eat-the-frog morning prompt, end-of-day recap, weekly review prompt (Sunday), backup reminder.
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { store, byDueThenOrder } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { formatMinutes, dueKey } from '../lib/dates';
  import { backupFilename, downloadJSON } from '../lib/backup';
  import { whatsNewAction } from '../lib/whatsnew';
  import { t as tr } from '../lib/i18n/index.svelte';
  const loadReview = () => import('./WeeklyReview.svelte');
  const loadSetup = () => import('./SemesterSetup.svelte');
  const loadWhatsNew = () => import('./WhatsNew.svelte');

  let note = $state('');

  onMount(() => {
    const hour = new Date().getHours();
    const s = store.settings;
    // What's new after an update (once per changelog heading; skipped on a fresh install)
    const wn = whatsNewAction(__CHANGELOG_HEAD__, s.lastSeenChangelog);
    if (wn !== 'none') store.updateSettings({ lastSeenChangelog: __CHANGELOG_HEAD__ });
    if (wn === 'show')
      setTimeout(
        () =>
          toasts.push({
            message: tr('prompt.updated'),
            detail: __CHANGELOG_HEAD__,
            kind: 'info',
            emoji: '✨',
            timeout: 10000,
            action: { label: tr('prompt.whatsNew'), onClick: () => (ui.whatsNew = true) },
          }),
        2000,
      );
    // Frog prompt: first open of the day, morning-ish, and there is something to pick.
    if (s.lastFrogPromptDate !== store.today && hour < 14 && store.todayTasks.length >= 2 && !store.frogTask) {
      store.updateSettings({ lastFrogPromptDate: store.today });
      setTimeout(() => (ui.frogPrompt = true), 800);
    } else if (s.lastRecapDate !== store.today && hour >= 18) {
      store.updateSettings({ lastRecapDate: store.today });
      setTimeout(() => (ui.recap = true), 800);
    }
    // Weekly review prompt on Sundays (once per week).
    const dow = new Date().getDay();
    if (dow === 0 && s.lastWeeklyReviewDate !== store.today) {
      store.updateSettings({ lastWeeklyReviewDate: store.today });
      setTimeout(
        () =>
          toasts.push({
            message: tr('prompt.sunday'),
            kind: 'info',
            emoji: '📋',
            timeout: 10000,
            action: { label: tr('prompt.review'), onClick: () => (ui.weeklyReview = true) },
          }),
        3000,
      );
    }
    // Backup reminder if no export in 14 days.
    const last = s.lastExportAt ? new Date(s.lastExportAt).getTime() : 0;
    const remind = s.lastBackupReminderAt ? new Date(s.lastBackupReminderAt).getTime() : 0;
    const days = 14 * 86400000;
    if (Date.now() - last > days && Date.now() - remind > days && store.tasks.length > 3) {
      store.updateSettings({ lastBackupReminderAt: new Date().toISOString() });
      setTimeout(
        () =>
          toasts.push({
            message: last ? tr('prompt.noBackup') : tr('prompt.backUp'),
            detail: tr('prompt.backupDetail'),
            kind: 'warn',
            emoji: '💾',
            timeout: 12000,
            action: {
              label: tr('prompt.download'),
              onClick: () => {
                downloadJSON(backupFilename(), store.snapshotBundle());
                store.updateSettings({ lastExportAt: new Date().toISOString() });
              },
            },
          }),
        5000,
      );
    }
  });

  const frogChoices = $derived([...store.todayTasks].sort((a, b) => (b.estimateMin ?? 0) - (a.estimateMin ?? 0) || byDueThenOrder(a, b)).slice(0, 6));
  const doneToday = $derived(store.tasks.filter((t) => t.completedAt && dueKey(t.completedAt) === store.today));
  const openLeft = $derived(store.todayTasks.length);

  function pickFrog(id: string) {
    store.setFrog(id);
    ui.frogPrompt = false;
    toasts.push({ message: tr('prompt.frogPicked'), detail: tr('prompt.frogPickedDetail'), kind: 'success', emoji: '🐸' });
  }
  function saveRecap() {
    if (note.trim()) store.saveDayNote(store.today, note.trim());
    ui.recap = false;
    note = '';
  }
</script>

{#if ui.frogPrompt}
  <div class="modal-backdrop" onclick={() => (ui.frogPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      use:focusTrap
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label={tr('prompt.frog')}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: 20, duration: 250 }}
    >
      <h2>🐸 {tr('prompt.frog')}</h2>
      <p class="muted">{tr('prompt.frogText')}</p>
      <ul class="choices">
        {#each frogChoices as t (t.id)}
          <li>
            <button onclick={() => pickFrog(t.id)}>
              <span class="dot" style="background:{store.courseById(t.courseId)?.color ?? 'var(--border-strong)'}"></span>
              <span class="grow">{t.title}</span>
              {#if t.estimateMin}<span class="muted">{formatMinutes(t.estimateMin)}</span>{/if}
            </button>
          </li>
        {/each}
        {#if !frogChoices.length}
          <li class="muted">{tr('prompt.frogNone')}</li>
        {/if}
      </ul>
      <div class="actions"><button class="btn" onclick={() => (ui.frogPrompt = false)}>{tr('prompt.notToday')}</button></div>
    </div>
  </div>
{/if}

{#if ui.recap}
  <div class="modal-backdrop" onclick={() => (ui.recap = false)} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      use:focusTrap
      class="modal recap"
      role="dialog"
      aria-modal="true"
      aria-label={tr('prompt.recapLabel')}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      in:fly={{ y: 20, duration: 250 }}
    >
      <h2>🌙 {tr('prompt.recap')}</h2>
      <div class="stats">
        <div><span class="big">{doneToday.length}</span><span class="lbl">{tr('prompt.done')}</span></div>
        {#if store.settings.gamification}
          <div><span class="big">{store.stats.xp}</span><span class="lbl">{tr('prompt.totalXp')}</span></div>
          <div>
            <span class="big">🔥 {store.streak}</span><span class="lbl"
              >{tr('prompt.streak')}{store.streak > 0 && store.stats.streak.lastDate === store.today
                ? ` · ${tr('prompt.kept')}`
                : store.streak > 0
                  ? ` · ${tr('prompt.atRisk')}`
                  : ''}</span
            >
          </div>
        {/if}
        <div><span class="big">{openLeft}</span><span class="lbl">{tr('prompt.left')}</span></div>
      </div>
      {#if doneToday.length}
        <ul class="done">
          {#each doneToday.slice(0, 8) as t (t.id)}<li>✓ {t.title}</li>{/each}
        </ul>
      {:else}
        <p class="muted">{tr('prompt.nothingDone')}</p>
      {/if}
      <label class="note">
        <span>{tr('prompt.wentWell')}</span>
        <input class="input" bind:value={note} placeholder={tr('prompt.notePh')} maxlength="200" onkeydown={(e) => e.key === 'Enter' && saveRecap()} />
      </label>
      <div class="actions">
        <button class="btn" onclick={() => (ui.recap = false)}>{tr('common.close')}</button>
        <button class="btn primary" onclick={saveRecap}>{tr('common.save')}</button>
      </div>
    </div>
  </div>
{/if}

{#if ui.weeklyReview}
  {#await loadReview() then m}<m.default />{/await}
{/if}
{#if ui.whatsNew}
  {#await loadWhatsNew() then m}<m.default />{/await}
{/if}
{#if ui.semesterSetup}
  {#await loadSetup() then m}<m.default />{/await}
{/if}

<style>
  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }
  .choices {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .choices button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    text-align: start;
    color: var(--text);
    font-size: 15px;
    border: 1px solid var(--border);
  }
  .choices button:hover {
    background: color-mix(in srgb, #22c55e 10%, var(--bg-elev));
    border-color: #22c55e;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .grow {
    flex: 1;
  }
  .stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0 12px;
  }
  .stats > div {
    flex: 1;
    min-width: 90px;
    background: var(--bg-elev-2);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .big {
    font-size: 24px;
    font-weight: 700;
  }
  .lbl {
    font-size: 12px;
    color: var(--text-muted);
  }
  .done {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
    font-size: 14px;
    color: var(--text-muted);
  }
  .note {
    display: block;
    margin-bottom: 8px;
  }
  .note span {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
</style>
