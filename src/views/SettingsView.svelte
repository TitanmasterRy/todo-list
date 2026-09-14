<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { undo } from '../lib/undo.svelte';
  import type { SoundPack, Theme } from '../lib/types';
  import { ACCENT_COLORS } from '../lib/colors';
  import { previewPack, playSound } from '../lib/sounds';
  import { buildBundle, backupFilename, downloadJSON, parseBundle } from '../lib/backup';
  import { sync, syncNow, checkToken, disconnect } from '../lib/gist.svelte';
  import { pwa, promptInstall } from '../lib/pwa.svelte';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { MAX_FREEZES } from '../lib/gamification';

  const s = $derived(store.settings);
  let token = $state('');
  let tokenLogin = $state('');
  let tokenBusy = $state(false);
  let resetStep = $state(0);
  let fileInput: HTMLInputElement | undefined = $state();
  let importMode = $state<'replace' | 'merge'>('merge');

  function set<K extends keyof typeof s>(key: K, value: (typeof s)[K]) {
    store.updateSettings({ [key]: value } as Partial<typeof s>);
    if (key.startsWith('pomodoro')) pomodoro.syncSettings();
  }

  function exportNow() {
    downloadJSON(backupFilename(), buildBundle({ tasks: store.tasks, courses: store.courses, templates: store.templates, stats: store.stats, dayNotes: store.dayNotes }));
    set('lastExportAt', new Date().toISOString());
    toasts.push({ message: 'Backup downloaded', kind: 'success', emoji: '💾' });
  }

  async function importFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = parseBundle(JSON.parse(text));
      if (importMode === 'replace') {
        const before = buildBundle({ tasks: $state.snapshot(store.tasks), courses: $state.snapshot(store.courses), templates: $state.snapshot(store.templates), stats: $state.snapshot(store.stats), dayNotes: $state.snapshot(store.dayNotes) });
        await store.loadBundle(bundle);
        undo.push({ label: `Imported ${bundle.tasks.length} tasks (replaced data)`, undo: () => void store.loadBundle(before) }, { kind: 'warn', timeout: 10000 });
      } else {
        const { mergeBundles } = await import('../lib/backup');
        const local = buildBundle({ tasks: $state.snapshot(store.tasks), courses: $state.snapshot(store.courses), templates: $state.snapshot(store.templates), stats: $state.snapshot(store.stats), dayNotes: $state.snapshot(store.dayNotes) });
        const { merged } = mergeBundles(local, bundle);
        await store.loadBundle(merged);
        undo.push({ label: `Merged ${bundle.tasks.length} tasks from file`, undo: () => void store.loadBundle(local) }, { timeout: 10000 });
      }
      if (bundle.settings) store.updateSettings({ ...bundle.settings, gistToken: store.settings.gistToken, gistId: store.settings.gistId });
    } catch (err) {
      toasts.push({ message: 'Import failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      if (fileInput) fileInput.value = '';
    }
  }

  async function connectGist() {
    if (!token.trim()) return;
    tokenBusy = true;
    try {
      tokenLogin = await checkToken(token.trim());
      store.updateSettings({ gistToken: token.trim() });
      token = '';
      await syncNow({ pull: true });
      toasts.push({ message: `Gist sync on for ${tokenLogin}`, kind: 'success', emoji: '☁️' });
    } catch (err) {
      toasts.push({ message: 'Could not connect', detail: err instanceof Error ? err.message : String(err), kind: 'warn' });
    } finally {
      tokenBusy = false;
    }
  }

  async function resetAll() {
    if (resetStep < 2) {
      resetStep++;
      setTimeout(() => (resetStep = 0), 6000);
      return;
    }
    await store.resetAll();
    resetStep = 0;
    toasts.push({ message: 'All data erased', kind: 'warn' });
    store.go('today');
  }

  async function archiveNow() {
    await store.archiveOldCompleted();
    toasts.push({ message: 'Old completed tasks archived', detail: 'They still count for stats and the heatmap.', kind: 'success' });
  }

  const archivedCount = $derived(store.tasks.filter((t) => t.archived).length);
</script>

<div class="page">
  <header class="page-head"><h1>Settings</h1></header>

  <section class="card">
    <h2>Appearance</h2>
    <div class="row">
      <label for="theme">Theme</label>
      <select id="theme" class="select" value={s.theme} onchange={(e) => set('theme', (e.target as HTMLSelectElement).value as Theme)}>
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </div>
    <div class="row">
      <span id="accent-l">Accent</span>
      <div class="swatches" role="radiogroup" aria-labelledby="accent-l">
        {#each ACCENT_COLORS as c}
          <button class="sw" class:on={s.accent === c} style="background:{c}" role="radio" aria-checked={s.accent === c} aria-label={c} onclick={() => set('accent', c)}></button>
        {/each}
        <input type="color" value={s.accent} onchange={(e) => set('accent', (e.target as HTMLInputElement).value)} aria-label="Custom accent" class="custom" />
      </div>
    </div>
    <div class="row">
      <label for="motion">Reduced motion</label>
      <input id="motion" type="checkbox" class="switch" checked={s.reducedMotion} onchange={(e) => set('reducedMotion', (e.target as HTMLInputElement).checked)} />
    </div>
    <div class="row">
      <label for="tf">Time format</label>
      <select id="tf" class="select" value={s.timeFormat} onchange={(e) => set('timeFormat', (e.target as HTMLSelectElement).value as '12h' | '24h')}>
        <option value="12h">12-hour (8pm)</option>
        <option value="24h">24-hour (20:00)</option>
      </select>
    </div>
    <div class="row">
      <label for="ws">Week starts on</label>
      <select id="ws" class="select" value={String(s.weekStart)} onchange={(e) => set('weekStart', Number((e.target as HTMLSelectElement).value) as 0 | 1)}>
        <option value="1">Monday</option>
        <option value="0">Sunday</option>
      </select>
    </div>
  </section>

  <section class="card">
    <h2>Sounds</h2>
    <div class="row">
      <label for="snd">Sounds</label>
      <input id="snd" type="checkbox" class="switch" checked={s.soundsEnabled} onchange={(e) => { set('soundsEnabled', (e.target as HTMLInputElement).checked); if ((e.target as HTMLInputElement).checked) playSound('pop'); }} />
    </div>
    <div class="row">
      <span id="pack-l">Sound pack</span>
      <div class="packs" role="radiogroup" aria-labelledby="pack-l">
        {#each ['soft', 'click', 'arcade'] as p}
          <button class="btn sm" class:primary={s.soundPack === p} role="radio" aria-checked={s.soundPack === p} onclick={() => { set('soundPack', p as SoundPack); previewPack(p as SoundPack); }}>{p}</button>
        {/each}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Goals and timer</h2>
    <div class="row">
      <label for="goal">Daily goal (tasks)</label>
      <input id="goal" class="input num" type="number" min="1" max="20" value={s.dailyGoal} onchange={(e) => set('dailyGoal', Math.max(1, Math.min(20, Number((e.target as HTMLInputElement).value) || 3)))} />
    </div>
    <div class="row">
      <label for="pw">Pomodoro focus (min)</label>
      <input id="pw" class="input num" type="number" min="1" max="120" value={s.pomodoroWorkMin} onchange={(e) => set('pomodoroWorkMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 25))} />
    </div>
    <div class="row">
      <label for="pb">Short break (min)</label>
      <input id="pb" class="input num" type="number" min="1" max="60" value={s.pomodoroBreakMin} onchange={(e) => set('pomodoroBreakMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 5))} />
    </div>
    <div class="row">
      <label for="pl">Long break (min)</label>
      <input id="pl" class="input num" type="number" min="1" max="90" value={s.pomodoroLongBreakMin} onchange={(e) => set('pomodoroLongBreakMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 15))} />
    </div>
  </section>

  <section class="card">
    <h2>Gamification</h2>
    <div class="row">
      <label for="gam">XP, streaks, badges, confetti</label>
      <input id="gam" type="checkbox" class="switch" checked={s.gamification} onchange={(e) => set('gamification', (e.target as HTMLInputElement).checked)} />
    </div>
    <p class="help">
      Streak freezes: you earn one per 7-day streak (max {MAX_FREEZES} banked). A missed day uses one automatically instead of breaking your streak.
      You have <strong>{store.stats.streak.freezes}</strong> banked. Current streak {store.streak}, best {store.stats.streak.best}.
    </p>
  </section>

  <section class="card">
    <h2>Templates <span class="muted">{store.templates.length}</span></h2>
    {#if !store.templates.length}
      <p class="help">Save any task as a template from the task editor, then type <code>@name</code> in quick add.</p>
    {/if}
    <ul class="list">
      {#each store.templates as t (t.id)}
        <li>
          <span class="mono">@{t.name}</span>
          <span class="muted grow">{t.task.title}{t.task.subtasks.length ? ` · ${t.task.subtasks.length} subtasks` : ''}</span>
          <button class="btn ghost sm" onclick={() => { store.addTask({ title: t.task.title, notes: t.task.notes, courseId: t.task.courseId, tags: [...t.task.tags], priority: t.task.priority, estimateMin: t.task.estimateMin, type: t.task.type, weight: t.task.weight, subtasks: [...t.task.subtasks], templateId: t.id }); store.go('inbox'); }}>Use</button>
          <button class="btn ghost sm" onclick={() => store.deleteTemplate(t.id)}>Delete</button>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card">
    <h2>Sync <span class="chip optional">optional</span></h2>
    <p class="help">
      Keep your data in a <strong>private GitHub Gist</strong> so it follows you across devices. Create a
      <a href="https://github.com/settings/tokens/new?scopes=gist&description=Homework%20To-Do" target="_blank" rel="noopener noreferrer">personal access token</a>
      with only the <code>gist</code> scope. The token is stored only in this browser’s localStorage and sent only to api.github.com.
    </p>
    {#if s.gistToken}
      <div class="row">
        <span>Status</span>
        <span class="status {sync.status}">
          {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? `Error: ${sync.lastError}` : sync.status === 'ok' ? 'Up to date' : sync.pending ? 'Changes pending' : 'Connected'}
          {#if s.lastSyncAt}<span class="muted"> · last {new Date(s.lastSyncAt).toLocaleString()}</span>{/if}
        </span>
      </div>
      <div class="row">
        <span>Gist</span>
        {#if s.gistId}<a href="https://gist.github.com/{s.gistId}" target="_blank" rel="noopener noreferrer" class="mono">{s.gistId.slice(0, 10)}…</a>{:else}<span class="muted">created on first sync</span>{/if}
      </div>
      <div class="btns">
        <button class="btn" onclick={() => void syncNow({ pull: true })} disabled={sync.status === 'syncing'}>Sync now</button>
        <button class="btn danger" onclick={disconnect}>Disconnect</button>
      </div>
    {:else}
      <form class="btns" onsubmit={(e) => { e.preventDefault(); void connectGist(); }}>
        <input class="input" type="password" bind:value={token} placeholder="ghp_… token with gist scope" aria-label="GitHub token" autocomplete="off" />
        <button class="btn primary" type="submit" disabled={tokenBusy || !token.trim()}>{tokenBusy ? 'Connecting…' : 'Connect'}</button>
      </form>
    {/if}
  </section>

  <section class="card">
    <h2>Data</h2>
    <div class="btns">
      <button class="btn primary" onclick={exportNow}>Download backup</button>
      <button class="btn" onclick={() => fileInput?.click()}>Import JSON…</button>
      <select class="select" bind:value={importMode} aria-label="Import mode">
        <option value="merge">Import: merge (newest wins)</option>
        <option value="replace">Import: replace everything</option>
      </select>
      <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importFile} class="visually-hidden" aria-label="Import file" />
    </div>
    <p class="help">Last export: {s.lastExportAt ? new Date(s.lastExportAt).toLocaleString() : 'never'}. You’ll get a reminder after 14 days without one.</p>
    <div class="row">
      <label for="arch">Archive completed older than (days, 0 = never)</label>
      <input id="arch" class="input num" type="number" min="0" max="3650" value={s.archiveAfterDays} onchange={(e) => set('archiveAfterDays', Math.max(0, Number((e.target as HTMLInputElement).value) || 0))} />
    </div>
    <div class="btns">
      <button class="btn" onclick={archiveNow} disabled={!s.archiveAfterDays}>Archive now</button>
      <span class="muted">{archivedCount} archived (kept for stats)</span>
    </div>
    {#if store.hasDemoData()}
      <div class="btns"><button class="btn" onclick={() => void store.clearDemoData()}>Clear demo data</button></div>
    {/if}
    {#if pwa.installEvent && !pwa.installed}
      <div class="btns"><button class="btn" onclick={() => void promptInstall()}>📱 Install app</button></div>
    {/if}
    <div class="btns danger-zone">
      <button class="btn danger" onclick={resetAll}>
        {resetStep === 0 ? 'Reset all data…' : resetStep === 1 ? 'Really? Click again to confirm' : 'Last chance: erase everything'}
      </button>
      {#if resetStep > 0}<button class="btn ghost sm" onclick={() => (resetStep = 0)}>Cancel</button>{/if}
    </div>
  </section>

  <section class="card">
    <h2>Help</h2>
    <div class="btns">
      <button class="btn" onclick={() => (ui.shortcuts = true)}>Keyboard shortcuts <span class="kbd">?</span></button>
      <button class="btn" onclick={() => store.updateSettings({ onboarded: false })}>Show welcome tour</button>
    </div>
  </section>
</div>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .row label,
  .row > span:first-child {
    color: var(--text);
  }
  .select,
  .input.num {
    width: auto;
    min-width: 90px;
  }
  .input.num {
    width: 90px;
  }
  .switch {
    width: 40px;
    height: 22px;
    appearance: none;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background var(--dur);
    flex-shrink: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--dur) var(--spring);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
  }
  .swatches {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .sw {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
  }
  .sw.on {
    border-color: var(--text);
    transform: scale(1.15);
  }
  .custom {
    width: 24px;
    height: 24px;
    border: none;
    padding: 0;
    background: none;
  }
  .packs {
    display: flex;
    gap: 4px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .help code,
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .btns .input {
    flex: 1;
    min-width: 200px;
  }
  .status.ok {
    color: var(--success);
  }
  .status.error {
    color: var(--danger);
  }
  .chip.optional {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .danger-zone {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
</style>
