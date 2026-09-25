<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { undo } from '../lib/undo.svelte';
  import type { SoundPack, Theme } from '../lib/types';
  import { previewPack, playSound } from '../lib/sounds';
  import { backupFilename, downloadJSON, parseBundle } from '../lib/backup';
  import { sync, syncNow, checkToken, disconnect } from '../lib/gist.svelte';
  import { pwa, promptInstall } from '../lib/pwa.svelte';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { MAX_FREEZES, ACCENT_UNLOCKS, levelTitle, COLLECTIBLES } from '../lib/gamification';
  import { testKey, currentProvider, currentModel, listModels, setModel as setAiModel } from '../lib/ai';
  import { PROVIDERS, providerInfo, cleanKey } from '../lib/ai-providers';
  import AccountPanel from '../components/AccountPanel.svelte';
  import ArcadeAdmin from '../components/ArcadeAdmin.svelte';
  import '../components/casino/casino.css';
  import type { AiProvider } from '../lib/types';
  import ThemePicker from '../components/ThemePicker.svelte';
  import { notificationsSupported, requestNotifications } from '../lib/reminders';
  import { folderBackupSupported, chooseFolder, forgetFolder, folderName, requestPersistence, isPersisted, writeBackup } from '../lib/localBackup.svelte';
  let persisted = $state<boolean | null>(null);
  void isPersisted().then((v) => (persisted = v));
  let backupFolder = $state(folderName());
  async function pickFolder() {
    try {
      backupFolder = await chooseFolder();
      toasts.push({ message: `Backups will be written to “${backupFolder}”`, detail: 'A JSON copy is saved a few seconds after every change, plus one dated file per day.', kind: 'success', emoji: '💾' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toasts.push({ message: 'Could not use that folder', detail: String(e), kind: 'warn' });
    }
  }
  async function persistNow() {
    persisted = await requestPersistence();
    toasts.push({ message: persisted ? 'Storage marked persistent' : 'Browser declined persistence', detail: persisted ? 'The browser will not evict this app’s data under storage pressure.' : 'Install the app or use it more; browsers grant this to sites you use often. Folder backups still protect you.', kind: persisted ? 'success' : 'info' });
  }
  async function enableNotifications() {
    const ok = await requestNotifications();
    toasts.push({ message: ok ? 'Notifications on' : 'Notifications blocked', kind: ok ? 'success' : 'warn' });
    if (ok) set('notifyDueSoon', true);
  }
  const provider = $derived(currentProvider());
  const pInfo = $derived(providerInfo(provider));
  let providerKey = $state('');
  function setProvider(p: AiProvider) {
    store.updateSettings({ aiProvider: p });
    providerKey = '';
  }
  function saveKey() {
    const key = cleanKey(providerKey);
    if (!key) return;
    store.updateSettings({ aiKeys: { ...store.settings.aiKeys, [provider]: key }, ...(provider === 'anthropic' ? { aiApiKey: '' } : {}) });
    providerKey = '';
    void connectAI();
  }
  function removeKey() {
    const k = { ...store.settings.aiKeys };
    delete k[provider];
    store.updateSettings({ aiKeys: k, aiApiKey: provider === 'anthropic' ? '' : store.settings.aiApiKey });
  }
  function setModel(m: string) {
    setAiModel(provider, m);
  }
  /** Built-in models first, then any others the provider reported (live list, cached). */
  const modelOptions = $derived.by(() => {
    const builtIn = pInfo.models.map((m) => ({ id: m.id, label: `${m.label}${m.vision ? ' · vision' : ''}` }));
    const live = (store.settings.aiModelCache[provider] ?? []).map((x) => {
      const [id, free] = x.split('|');
      return { id, label: `${id}${free ? ' (free)' : ''}` };
    });
    const known = new Set(builtIn.map((m) => m.id));
    const liveIds = new Set(live.map((m) => m.id));
    // hide built-ins the provider says don't exist (retired models), once we have a live list
    const kept = live.length ? builtIn.filter((m) => liveIds.has(m.id)) : builtIn;
    const extra = live.filter((m) => !known.has(m.id)).sort((a, b) => a.id.localeCompare(b.id));
    const all = [...kept, ...extra];
    const cur = currentModel();
    if (!all.some((m) => m.id === cur)) all.unshift({ id: cur, label: `${cur} (current)` });
    return all;
  });
  let modelsBusy = $state(false);
  async function loadModels() {
    modelsBusy = true;
    try {
      const list = await listModels();
      toasts.push({ message: `${list.length} models available`, kind: 'success' });
    } catch (err) {
      toasts.push({ message: 'Could not load models', detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 9000 });
    } finally {
      modelsBusy = false;
    }
  }
  import { schoology, syncNow as syncSchoology } from '../lib/schoologySync.svelte';
  let aiBusy = $state(false);
  let schoologyUrl = $state(store.settings.schoologyFeedUrl);
  let schoologyProxy = $state(store.settings.schoologyProxy);
  async function connectAI() {
    aiBusy = true;
    try {
      const note = await testKey();
      toasts.push({ message: `${pInfo.name} connected`, detail: note || `Model: ${currentModel()}`, kind: 'success', emoji: '✨', timeout: note ? 8000 : 4000 });
    } catch (err) {
      toasts.push({ message: 'Check failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 9000 });
    } finally {
      aiBusy = false;
    }
  }

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
    downloadJSON(backupFilename(), store.snapshotBundle());
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
        const before = store.snapshotBundle();
        await store.loadBundle(bundle);
        undo.push({ label: `Imported ${bundle.tasks.length} tasks (replaced data)`, undo: () => void store.loadBundle(before) }, { kind: 'warn', timeout: 10000 });
      } else {
        const { mergeBundles } = await import('../lib/backup');
        const local = store.snapshotBundle();
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
    <h2>Theme pack</h2>
    <p class="help">Each pack changes colors, corners, the completion sound, the particles that fly out of the checkbox, and the confetti.</p>
    <ThemePicker />
  </section>

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
        {#each ACCENT_UNLOCKS as a}
          {@const locked = s.gamification && store.stats.level < a.level}
          <button class="sw" class:on={s.accent === a.color} class:locked style="background:{a.color}" role="radio" aria-checked={s.accent === a.color} aria-label="{a.name}{locked ? ` (unlocks at level ${a.level})` : ''}" title="{a.name}{locked ? ` · unlocks at level ${a.level}` : ''}" disabled={locked} onclick={() => set('accent', a.color)}>{locked ? '🔒' : ''}</button>
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
    <div class="row">
      <label for="wxp">Weekly XP goal</label>
      <input id="wxp" class="input num" type="number" min="50" step="50" value={s.weeklyXpGoal} onchange={(e) => set('weeklyXpGoal', Math.max(50, Number((e.target as HTMLInputElement).value) || 500))} />
    </div>
    <p class="help">Level {store.stats.level}: <strong>{levelTitle(store.stats.level)}</strong>. New accent colors unlock as you level up. Critical hits (5% chance, double XP), tiered early bonuses (up to ×1.5 for 3+ days early), grade XP for scores you enter, and notecard study XP all count.</p>
    <p class="help">
      Streak freezes: you earn one per 7-day streak (max {MAX_FREEZES} banked). A missed day uses one automatically instead of breaking your streak.
      You have <strong>{store.stats.streak.freezes}</strong> banked. Current streak {store.streak}, best {store.stats.streak.best}.
    </p>
  </section>

  <section class="card">
    <h2>Economy</h2>
    <div class="row">
      <label for="eco">Coins, shop and Play view</label>
      <input id="eco" type="checkbox" class="switch" checked={s.economyEnabled} onchange={(e) => set('economyEnabled', (e.target as HTMLInputElement).checked)} />
    </div>
    {#if s.economyEnabled}
      <div class="row">
        <label for="cas">Casino (play chips only)</label>
        <input id="cas" type="checkbox" class="switch" checked={s.casinoEnabled} onchange={(e) => set('casinoEnabled', (e.target as HTMLInputElement).checked)} />
      </div>
      {#if s.casinoEnabled}
        <div class="row">
          <label for="brk">Homework-break reminder after (minutes of casino play, 0 = off)</label>
          <input id="brk" class="input num" type="number" min="0" max="240" value={s.casinoBreakMin} onchange={(e) => set('casinoBreakMin', Math.max(0, Math.min(240, Number((e.target as HTMLInputElement).value) || 0)))} />
        </div>
      {/if}
      <div class="row">
        <label for="adm">Show arcade admin (add games)</label>
        <input id="adm" type="checkbox" class="switch" checked={s.arcadeAdmin} onchange={(e) => set('arcadeAdmin', (e.target as HTMLInputElement).checked)} />
      </div>
      <p class="help">Coins come only from schoolwork (tasks, the daily ring, streaks, grades, notecards, Pomodoros). There's no real money anywhere: nothing can be bought with cash, and chips never turn back into coins.</p>
    {/if}
  </section>

  {#if s.economyEnabled && s.arcadeAdmin}
    <ArcadeAdmin />
  {/if}

  <section class="card">
    <h2>Adding tasks</h2>
    <div class="row">
      <label for="autod">Auto-describe new tasks (plan, steps, estimate)</label>
      <input id="autod" type="checkbox" class="switch" checked={s.autoDescribe} onchange={(e) => set('autoDescribe', (e.target as HTMLInputElement).checked)} />
    </div>
    <p class="help">Works offline from the task title and course. Toggle it per task with the “auto plan” chip under quick add. Paste several lines into quick add to create one task per line; tap 🎤 to dictate.</p>
  </section>

  <section class="card">
    <h2>AI helper <span class="chip optional">optional</span></h2>
    <p class="help">Powers “Ask the tutor”, notecard generation, photo transcription and answer keys. Keys stay in this browser and go only to the provider you pick. <strong>Free options:</strong> Google Gemini and Groq have free tiers, OpenRouter has free models, and Ollama runs on your own computer.</p>
    <div class="providers" role="radiogroup" aria-label="AI provider">
      {#each PROVIDERS as p (p.id)}
        <button class="prov" class:on={provider === p.id} role="radio" aria-checked={provider === p.id} onclick={() => setProvider(p.id)}>
          <span class="pn">{p.name}</span>
          {#if p.free}<span class="free">free{p.needsKey ? ' tier' : ''}</span>{/if}
          {#if store.settings.aiKeys[p.id] || (p.id === 'anthropic' && s.aiApiKey)}<span class="ok">● key saved</span>{/if}
        </button>
      {/each}
    </div>
    <p class="help">{pInfo.note}{#if pInfo.keyUrl} <a href={pInfo.keyUrl} target="_blank" rel="noopener noreferrer">Get a key ↗</a>{/if}</p>
    {#if provider === 'custom' || provider === 'ollama'}
      <div class="row">
        <label for="aibase">Endpoint URL</label>
        <input id="aibase" class="input" value={s.aiBaseUrl || (provider === 'ollama' ? 'http://localhost:11434/v1' : '')} placeholder="https://host/v1" onchange={(e) => set('aiBaseUrl', (e.target as HTMLInputElement).value.trim())} />
      </div>
    {/if}
    <div class="row">
      <label for="aimodel">Model</label>
      {#if provider === 'custom'}
        <input id="aimodel" class="input" value={currentModel()} placeholder="model name" onchange={(e) => setModel((e.target as HTMLInputElement).value.trim())} />
      {:else}
        <span class="model-pick">
          <select id="aimodel" class="select" value={currentModel()} onchange={(e) => setModel((e.target as HTMLSelectElement).value)}>
            {#each modelOptions as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
          </select>
          <button class="btn ghost sm" onclick={() => void loadModels()} disabled={modelsBusy || (pInfo.needsKey && !store.settings.aiKeys[provider] && !(provider === 'anthropic' && s.aiApiKey))} title="Fetch the current model list from the provider">{modelsBusy ? '…' : '↻ Load models'}</button>
        </span>
      {/if}
    </div>
    {#if pInfo.needsKey}
      {#if store.settings.aiKeys[provider] || (provider === 'anthropic' && s.aiApiKey)}
        <div class="btns">
          <span class="status ok">Key saved</span>
          <button class="btn sm" onclick={() => void connectAI()} disabled={aiBusy}>{aiBusy ? 'Testing…' : 'Test'}</button>
          <button class="btn danger sm" onclick={removeKey}>Remove key</button>
        </div>
      {:else}
        <form class="btns" onsubmit={(e) => { e.preventDefault(); saveKey(); }}>
          <input class="input" type="password" bind:value={providerKey} placeholder="Paste API key" aria-label="API key" autocomplete="off" />
          <button class="btn primary" type="submit" disabled={aiBusy || !providerKey.trim()}>{aiBusy ? 'Checking…' : 'Save and test'}</button>
        </form>
      {/if}
    {:else}
      <div class="btns"><button class="btn sm" onclick={() => void connectAI()} disabled={aiBusy}>{aiBusy ? 'Testing…' : 'Test connection'}</button></div>
    {/if}
  </section>

  <section class="card">
    <h2>Notifications</h2>
    {#if !notificationsSupported()}
      <p class="help">This browser doesn’t support notifications.</p>
    {:else}
      <div class="row">
        <label for="ndue">Remind me before timed deadlines</label>
        <input id="ndue" type="checkbox" class="switch" checked={s.notifyDueSoon} onchange={(e) => { const on = (e.target as HTMLInputElement).checked; if (on) void enableNotifications(); else set('notifyDueSoon', false); }} />
      </div>
      <div class="row">
        <label for="nlead">Lead time (minutes)</label>
        <input id="nlead" class="input num" type="number" min="5" max="1440" value={s.notifyLeadMin} onchange={(e) => set('notifyLeadMin', Math.max(5, Number((e.target as HTMLInputElement).value) || 60))} />
      </div>
      <div class="row">
        <label for="ndig">Morning digest (what’s due today, after 7 am)</label>
        <input id="ndig" type="checkbox" class="switch" checked={s.notifyMorningDigest} onchange={(e) => { const on = (e.target as HTMLInputElement).checked; set('notifyMorningDigest', on); if (on) void enableNotifications(); }} />
      </div>
      <p class="help">Notifications fire while the app is open or installed and running in the background tab.</p>
    {/if}
  </section>

  <section class="card">
    <h2>Music &amp; accounts</h2>
    <div class="row">
      <label for="spid">Spotify Client ID</label>
      <input id="spid" class="input" value={s.spotifyClientId} placeholder="from developer.spotify.com/dashboard" onchange={(e) => set('spotifyClientId', (e.target as HTMLInputElement).value.trim())} />
    </div>
    <p class="help">Create a free app at developer.spotify.com/dashboard, add <code>{typeof location !== 'undefined' ? location.origin + location.pathname : ''}</code> as a Redirect URI, paste the Client ID, then connect from Focus → Music. Playback control (devices, play/pause) needs Spotify Premium; the embedded player works for everyone.</p>
    <div class="row">
      <label for="gcid">Google Client ID</label>
      <input id="gcid" class="input" value={s.googleClientId} placeholder="….apps.googleusercontent.com" onchange={(e) => set('googleClientId', (e.target as HTMLInputElement).value.trim())} />
    </div>
    <p class="help">Enables Gmail scanning, Google Classroom import, Google Calendar push and Drive sync (sign in on any device to sync). Setup is in Tools → Google.</p>
  </section>

  <section class="card">
    <h2>Schoology sync <span class="chip optional">optional</span></h2>
    <p class="help">Mode: <strong>{s.schoologyMode === 'api' ? 'API sign-in (assignments + grades)' : 'calendar feed (assignments)'}</strong>, syncing every {s.schoologyIntervalMin} min. Full setup (API key sign-in, proxy, manual import) lives in the <button class="link" onclick={() => store.go('schoology')}>Schoology view</button>.</p>
    <form class="btns" onsubmit={(e) => { e.preventDefault(); store.updateSettings({ schoologyFeedUrl: schoologyUrl.trim(), schoologyProxy: schoologyProxy.trim() }); if (schoologyUrl.trim()) void syncSchoology(); }}>
      <input class="input" bind:value={schoologyUrl} placeholder="https://app.schoology.com/calendar/feed/ical/…/schoology.ics" aria-label="Schoology feed URL" />
      <input class="input" bind:value={schoologyProxy} placeholder="CORS proxy prefix (optional)" aria-label="CORS proxy" />
      <button class="btn primary" type="submit">Save</button>
    </form>
    {#if s.schoologyFeedUrl}
      <div class="row"><span>Status</span><span class="status {schoology.status}">{schoology.status === 'error' ? `Error: ${schoology.lastError}` : schoology.status}{#if s.lastSchoologySync}<span class="muted"> · last {new Date(s.lastSchoologySync).toLocaleString()}</span>{/if}</span></div>
      <div class="row">
        <label for="sauto">Create courses for new class names</label>
        <input id="sauto" type="checkbox" class="switch" checked={s.schoologyAutoCreateCourses} onchange={(e) => set('schoologyAutoCreateCourses', (e.target as HTMLInputElement).checked)} />
      </div>
      <div class="btns">
        <button class="btn" onclick={() => void syncSchoology()}>Sync now</button>
        <button class="btn danger" onclick={() => { set('schoologyFeedUrl', ''); schoologyUrl = ''; }}>Disconnect</button>
        {#if s.schoologyIgnored.length}<button class="btn ghost sm" onclick={() => set('schoologyIgnored', [])}>Forget {s.schoologyIgnored.length} deleted assignment{s.schoologyIgnored.length > 1 ? 's' : ''}</button>{/if}
      </div>
    {/if}
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

  <AccountPanel />

  <section class="card">
    <h2>GitHub Gist sync <span class="chip optional">optional</span></h2>
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
    <h3 class="sub">Never lose data</h3>
    <div class="row">
      <span>Persistent storage {persisted === null ? '' : persisted ? '· granted' : '· not yet'}</span>
      <button class="btn sm" onclick={persistNow} disabled={persisted === true}>Ask the browser to keep my data</button>
    </div>
    {#if folderBackupSupported()}
      <div class="row">
        <span>Auto-backup to a folder{backupFolder ? ` · ${backupFolder}` : ''}{s.lastLocalBackupAt ? ` · last ${new Date(s.lastLocalBackupAt).toLocaleTimeString()}` : ''}</span>
        <span class="btns">
          <button class="btn sm" onclick={pickFolder}>{backupFolder ? 'Change folder' : 'Choose folder'}</button>
          {#if backupFolder}<button class="btn ghost sm" onclick={() => void writeBackup()}>Back up now</button><button class="btn ghost sm" onclick={() => { void forgetFolder(); backupFolder = null; }}>Stop</button>{/if}
        </span>
      </div>
      <p class="help">Writes <code>homework-todo-backup.json</code> (and a dated copy each day) into a folder on this device a few seconds after every change. Works in Chrome and Edge; pick a folder that syncs to the cloud (Drive, iCloud, OneDrive) for off-device safety.</p>
    {:else}
      <p class="help">Folder auto-backup needs Chrome or Edge on desktop. On this browser, use Download backup, Gist sync, or Google Drive sync.</p>
    {/if}
    <div class="row">
      <span>Offline copy of the app</span>
      <a class="btn sm" href="./lite/index.html" download="homework-todo-offline.html">Download offline version</a>
    </div>
    <p class="help">A single HTML file you can keep on a USB stick or your desktop. It runs from a double-click with no internet: tasks, courses, notecards, calculator, timers and stats work; sync, AI and Schoology need the online app. Its data lives in that browser profile separately from the online app, so export/import to move between them.</p>
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
    <h2>Trash <span class="muted">{store.trash.length}</span></h2>
    <p class="help">Deleted tasks stay here for 30 days. Deletions also sync, so a task deleted on one device is removed on the others.</p>
    {#if store.trash.length}
      <ul class="trash">
        {#each store.trash.slice(0, 50) as t (t.id)}
          <li>
            <span class="t-title">{t.task.title}</span>
            <span class="muted">{new Date(t.deletedAt).toLocaleDateString()}</span>
            <button class="btn sm" onclick={() => store.restoreFromTrash(t.id)}>Restore</button>
          </li>
        {/each}
      </ul>
      <div class="btns"><button class="btn ghost sm" onclick={() => store.emptyTrash()}>Empty trash</button></div>
    {:else}
      <p class="muted">Nothing here.</p>
    {/if}
  </section>

  {#if s.collection.length}
    <section class="card">
      <h2>Collection <span class="muted">{s.collection.length}/{COLLECTIBLES.length}</span></h2>
      <p class="help">Mystery rewards from closing your daily ring.</p>
      <div class="collection">
        {#each COLLECTIBLES as c (c.id)}
          <span class="coll" class:on={s.collection.includes(c.id)} title={s.collection.includes(c.id) ? c.name : '???'}>{s.collection.includes(c.id) ? c.emoji : '❔'}</span>
        {/each}
      </div>
    </section>
  {/if}

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
  .model-pick {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }
  .model-pick .select {
    max-width: 260px;
  }
  .trash {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    max-height: 260px;
    overflow: auto;
  }
  .trash li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .t-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .sw.locked {
    opacity: 0.35;
    font-size: 11px;
    cursor: not-allowed;
  }
  .link {
    color: var(--accent);
    font-weight: 500;
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
  .sub {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 4px;
  }
  .providers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
  }
  .prov {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-size: 13px;
    color: var(--text);
    min-width: 120px;
    text-align: left;
  }
  .prov.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .pn {
    font-weight: 600;
  }
  .free {
    font-size: 11px;
    color: var(--success);
    font-weight: 600;
  }
  .ok {
    font-size: 11px;
    color: var(--text-muted);
  }
  .collection {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .coll {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 22px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    opacity: 0.5;
  }
  .coll.on {
    opacity: 1;
    border-color: var(--warn);
  }
  .row .input:not(.num) {
    max-width: 320px;
  }
</style>
