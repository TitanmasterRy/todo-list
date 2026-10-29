<script lang="ts">
  // Play → 🎮 Stream: play games from the home PC (Apollo, through MoonlightWeb and our gateway; see STREAM.md).
  // Sign-in is a password plus a TOTP code; the first sign-in sets the code up. The Watch tab's homework rules don't
  // apply here.
  import { onDestroy, onMount } from 'svelte';
  import { t, type MessageKey } from '../../../lib/i18n/index.svelte';
  import { downloadText } from '../../../lib/download';
  import { StreamError, type GatewayClient, type Health, type StreamApp, type StreamSession, type StreamTransport, type Enrollment } from '../../../lib/stream/api';
  import { STEP_LABEL, browserProbes, runConnectionTest, type StepResult, type Verdict } from '../../../lib/stream/conntest';
  import { MAX_H, MAX_W, measureRefreshRate, nativeSize, streamRequest, suggestBitrate } from '../../../lib/stream/display';
  import { supportsWebCodecs } from '../../../lib/stream/video';
  import { STREAM_SERVER, gatewayClient, streamSettings } from '../../../lib/stream/state.svelte';
  import StreamPlayer from './StreamPlayer.svelte';

  type View = 'boot' | 'signin' | 'enroll' | 'apps' | 'play';
  type Prompt = { kind: 'running'; app: StreamApp; running: StreamApp | null; runningId: number } | { kind: 'active'; app: StreamApp; id: string };

  let view = $state<View>('boot');
  let api = $state<GatewayClient | null>(null);
  let health = $state<Health | null>(null);
  let apps = $state<StreamApp[]>([]);
  let art = $state<Record<number, string>>({});
  let busy = $state(false);
  let error = $state('');
  let notice = $state<{ text: string; retryWs?: StreamApp } | null>(null);
  let prompt = $state<Prompt | null>(null);
  let session = $state<StreamSession | null>(null);
  let playing = $state<StreamApp | null>(null);

  // sign-in and enrollment
  let password = $state('');
  let code = $state('');
  let enrollment = $state<Enrollment | null>(null);
  let savedCodes = $state(false);

  // connection test
  let steps = $state<StepResult[]>([]);
  let verdict = $state<Verdict | null>(null);
  let testing = $state(false);
  let showTest = $state(false);
  let showSettings = $state(false);

  const screenSize = nativeSize(screen.width, screen.height, devicePixelRatio);
  let rate = $state(60);
  const prefs = $derived(streamSettings.prefs);
  const request = $derived(streamRequest(prefs, screenSize, rate));

  onMount(async () => {
    void measureRefreshRate().then((r) => (rate = r));
    try {
      api = await gatewayClient();
    } catch {
      view = 'signin';
      return;
    }
    void api
      .health()
      .then((h) => (health = h))
      .catch(() => (health = null));
    if (!api.signedIn) {
      view = 'signin';
      return;
    }
    await loadApps();
  });

  onDestroy(() => Object.values(art).forEach((u) => URL.revokeObjectURL(u)));

  function explain(e: unknown): string {
    if (!(e instanceof StreamError)) return t('stream.err.generic');
    if (e.kind === 'network') return t('stream.err.network');
    if (e.kind === 'locked') return t('stream.err.locked', { min: Math.max(1, Math.ceil(Number(e.data.retryAfter ?? 900) / 60)) });
    if (e.code === 'unlinked') return t('stream.err.unlinked');
    if (e.code === 'no_host') return t('stream.err.noHost');
    if (e.code === 'host_busy') return t('stream.err.hostBusy');
    if (e.code === 'start_failed') return t('stream.err.startFailed');
    if (e.status === 503) return t('stream.err.notConfigured');
    if (e.kind === 'auth') return t('stream.err.auth');
    return t('stream.err.generic');
  }

  async function loadApps() {
    if (!api) return;
    busy = true;
    error = '';
    try {
      apps = await api.apps();
      view = 'apps';
      for (const a of apps) {
        if (!a.art || art[a.id]) continue;
        api
          .art(a.art)
          .then((b) => (art = { ...art, [a.id]: URL.createObjectURL(b) }))
          .catch(() => {});
      }
    } catch (e) {
      if (e instanceof StreamError && e.kind === 'auth') view = 'signin';
      else {
        view = 'apps';
        error = explain(e);
      }
    } finally {
      busy = false;
    }
  }

  async function signIn(e: SubmitEvent) {
    e.preventDefault();
    if (!api) return;
    busy = true;
    error = '';
    try {
      await api.login(password, code.trim());
      password = '';
      code = '';
      await loadApps();
    } catch (err) {
      if (err instanceof StreamError && err.code === 'enroll_required') {
        view = 'enroll';
        code = '';
      } else error = err instanceof StreamError && err.kind === 'auth' ? t('stream.err.badLogin') : explain(err);
    } finally {
      busy = false;
    }
  }

  async function startEnroll() {
    if (!api) return;
    busy = true;
    error = '';
    try {
      enrollment = await api.enroll(password);
    } catch (e) {
      error = e instanceof StreamError && e.status === 410 ? t('stream.err.enrolled') : e instanceof StreamError && e.kind === 'auth' ? t('stream.err.badLogin') : explain(e);
      if (e instanceof StreamError && (e.status === 410 || e.kind === 'auth')) view = 'signin';
    } finally {
      busy = false;
    }
  }

  const qrSrc = $derived(enrollment ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrSvg)}` : '');
  const manualKey = $derived(enrollment ? (new URL(enrollment.otpauthUri).searchParams.get('secret') ?? '').replace(/(.{4})/g, '$1 ').trim() : '');

  async function copyCodes() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.backupCodes.join('\n'));
      notice = { text: t('stream.copied') };
    } catch {
      /* the codes are on screen */
    }
  }

  async function signOut() {
    try {
      await api?.logout();
    } catch {
      /* signed out on this device anyway */
    }
    apps = [];
    view = 'signin';
  }

  async function test(): Promise<Verdict | null> {
    if (!api) return null;
    testing = true;
    showTest = true;
    steps = [];
    try {
      const r = await runConnectionTest(STREAM_SERVER, browserProbes(api), (s) => (steps = s));
      steps = r.steps;
      verdict = r.verdict;
      return r.verdict;
    } finally {
      testing = false;
    }
  }

  async function launch(app: StreamApp, opts: { quitRunning?: boolean; transport?: StreamTransport } = {}) {
    if (!api || busy) return;
    prompt = null;
    notice = null;
    error = '';
    busy = true;
    try {
      // the connection test runs once per visit, before the first stream
      const v = verdict ?? (await test());
      const transport: StreamTransport = opts.transport ?? (prefs.transport === 'auto' ? (v?.transport ?? 'webrtc') : prefs.transport);
      if (prefs.transport === 'auto' && !opts.transport && v && !v.transport) {
        error = t(v.message);
        return;
      }
      if (!supportsWebCodecs()) {
        error = t('stream.err.noWebCodecs');
        return;
      }
      session = await api.startSession({ appId: app.id, ...request, transport, quitRunning: opts.quitRunning });
      playing = app;
      view = 'play';
    } catch (e) {
      if (e instanceof StreamError && e.code === 'app_running') {
        const runningId = Number(e.data.runningAppId) || 0;
        prompt = { kind: 'running', app, runningId, running: apps.find((a) => a.id === runningId) ?? null };
      } else if (e instanceof StreamError && e.code === 'stream_active') {
        prompt = { kind: 'active', app, id: String(e.data.id ?? '') };
      } else if (e instanceof StreamError && e.kind === 'auth') {
        view = 'signin';
        error = t('stream.err.auth');
      } else error = explain(e);
    } finally {
      busy = false;
    }
  }

  async function endOtherAndStart(p: Extract<Prompt, { kind: 'active' }>) {
    await api?.endSession(p.id, false);
    await launch(p.app);
  }

  function onEnd(why: MessageKey | null, failed?: StreamTransport) {
    const app = playing;
    session = null;
    playing = null;
    view = 'apps';
    if (why) notice = { text: t(why), retryWs: failed === 'webrtc' && app ? app : undefined };
  }

  function onRestart() {
    const app = playing;
    session = null;
    view = 'apps';
    if (app) void launch(app);
  }

  function onSignedOut() {
    session = null;
    playing = null;
    apps = [];
    view = 'signin';
    notice = { text: t('stream.signedOutEverywhere') };
  }

  const hostLine = $derived.by((): { text: string; tone: string } | null => {
    if (!health) return null;
    if (health.mw === 'unlinked') return { text: t('stream.host.unlinked'), tone: 'warn' };
    if (health.mw === 'down') return { text: t('stream.host.bridgeDown'), tone: 'bad' };
    return health.host === 'online' ? { text: t('stream.host.online'), tone: 'ok' } : { text: t('stream.host.offline'), tone: 'bad' };
  });

  const icon = (ok: boolean | null) => (ok === null ? '–' : ok ? '✅' : '❌');
</script>

<div class="stream">
  {#if view === 'play' && session && api && playing}
    {#key session.id}
      <StreamPlayer {api} {session} appName={playing.name} onend={onEnd} onrestart={onRestart} onsignedout={onSignedOut} />
    {/key}
  {:else}
    <div class="bar">
      <h2>🎮 {t('stream.title')}</h2>
      {#if hostLine}<span class="pill {hostLine.tone}" data-host-status>{hostLine.text}</span>{/if}
      <div class="grow"></div>
      {#if view === 'apps'}
        <button class="btn ghost sm" onclick={() => (showSettings = !showSettings)} aria-expanded={showSettings}>⚙️ {t('stream.settings')}</button>
      {/if}
      <button class="btn ghost sm" onclick={test} disabled={testing || !api} aria-expanded={showTest}>🩺 {t('stream.test')}</button>
    </div>

    {#if notice}
      <div class="card note" role="status">
        <span>{notice.text}</span>
        {#if notice.retryWs}{@const app = notice.retryWs}<button class="btn sm" onclick={() => launch(app, { transport: 'ws' })}>{t('stream.tryWs')}</button>{/if}
        <button class="btn ghost sm" onclick={() => (notice = null)} aria-label={t('stream.dismiss')}>✕</button>
      </div>
    {/if}
    {#if error}<div class="card note bad" role="alert">{error}</div>{/if}

    {#if showTest}
      <section class="card test" aria-label={t('stream.test')} data-conn-test>
        <ul>
          {#each steps as s (s.id)}
            <li>
              <span aria-hidden="true">{icon(s.ok)}</span> <strong>{t(STEP_LABEL[s.id])}</strong>{#if s.detail}: {t(s.detail, s.params)}{/if}
            </li>
          {/each}
        </ul>
        {#if testing}<p class="muted" role="status">{t('stream.testing')}</p>{/if}
        {#if verdict && !testing}<p class="verdict {verdict.tone}" data-verdict>{t(verdict.message)}</p>{/if}
      </section>
    {/if}

    {#if view === 'boot'}
      <p class="muted" role="status">{t('stream.loading')}</p>
    {:else if view === 'signin'}
      <form class="card form" onsubmit={signIn}>
        <h3>{t('stream.signInTitle')}</h3>
        <p class="muted">{t('stream.signInBlurb')}</p>
        <label>{t('stream.password')} <input class="input" type="password" autocomplete="current-password" required bind:value={password} /></label>
        <label
          >{t('stream.code')}
          <input class="input" autocomplete="one-time-code" inputmode="text" maxlength="11" placeholder="123456" bind:value={code} />
          <small class="muted">{t('stream.codeHint')}</small>
        </label>
        <button class="btn" type="submit" disabled={busy || !api}>{busy ? t('stream.signingIn') : t('stream.signIn')}</button>
      </form>
    {:else if view === 'enroll'}
      <div class="card form" data-enroll>
        <h3>{t('stream.enrollTitle')}</h3>
        {#if !enrollment}
          <p>{t('stream.enrollBlurb')}</p>
          <button class="btn" onclick={startEnroll} disabled={busy} aria-busy={busy}>{busy ? t('stream.enrollWorking') : t('stream.enrollStart')}</button>
        {:else}
          <ol class="steps">
            <li>
              {t('stream.enrollScan')}
              <img class="qr" src={qrSrc} alt={t('stream.qrAlt')} width="220" height="220" />
              <small class="muted">{t('stream.enrollManual')} <code>{manualKey}</code></small>
            </li>
            <li>
              {t('stream.enrollCodes')}
              <ul class="codes" data-backup-codes>
                {#each enrollment.backupCodes as c (c)}<li><code>{c}</code></li>{/each}
              </ul>
              <div class="row">
                <button class="btn ghost sm" onclick={copyCodes}>{t('stream.copyCodes')}</button>
                <button class="btn ghost sm" onclick={() => downloadText('stream-backup-codes.txt', `${t('stream.codesFile')}\n\n${enrollment!.backupCodes.join('\n')}\n`)}
                  >{t('stream.downloadCodes')}</button
                >
              </div>
              <label class="check"><input type="checkbox" bind:checked={savedCodes} /> {t('stream.savedCodes')}</label>
            </li>
            <li>
              <form class="row" onsubmit={signIn}>
                <label>{t('stream.enrollConfirm')} <input class="input" autocomplete="one-time-code" inputmode="numeric" maxlength="6" required bind:value={code} /></label>
                <button class="btn" type="submit" disabled={busy || !savedCodes}>{t('stream.finish')}</button>
              </form>
            </li>
          </ol>
        {/if}
      </div>
    {:else if view === 'apps'}
      {#if showSettings}
        <section class="card form settings" aria-label={t('stream.settings')}>
          <fieldset>
            <legend>{t('stream.resolution')}</legend>
            <label class="check"
              ><input type="radio" name="size" checked={prefs.size === 'native'} onchange={() => streamSettings.update({ size: 'native' })} />
              {t('stream.thisScreen', { w: screenSize.width, h: screenSize.height })}</label
            >
            <label class="check"
              ><input type="radio" name="size" checked={prefs.size === 'custom'} onchange={() => streamSettings.update({ size: 'custom' })} /> {t('stream.custom')}</label
            >
            {#if prefs.size === 'custom'}
              <div class="row">
                <label
                  >{t('stream.width')}
                  <input
                    class="input"
                    type="number"
                    min="320"
                    max={MAX_W}
                    step="2"
                    value={prefs.width}
                    onchange={(e) => streamSettings.update({ width: Number(e.currentTarget.value) })}
                  /></label
                >
                <label
                  >{t('stream.height')}
                  <input
                    class="input"
                    type="number"
                    min="240"
                    max={MAX_H}
                    step="2"
                    value={prefs.height}
                    onchange={(e) => streamSettings.update({ height: Number(e.currentTarget.value) })}
                  /></label
                >
              </div>
            {/if}
          </fieldset>
          <label
            >{t('stream.fps')}
            <select class="input" value={String(prefs.fps)} onchange={(e) => streamSettings.update({ fps: Number(e.currentTarget.value) })}>
              <option value="0">{t('stream.fpsAuto', { hz: rate })}</option>
              {#each [30, 60, 90, 120, 144, 165, 240] as f (f)}<option value={String(f)}>{f}</option>{/each}
            </select>
          </label>
          <label
            >{t('stream.bitrate')}
            <select class="input" value={String(prefs.bitrate)} onchange={(e) => streamSettings.update({ bitrate: Number(e.currentTarget.value) })}>
              <option value="0">{t('stream.bitrateAuto', { mbps: Math.round(suggestBitrate(request.width, request.height, request.fps) / 1000) })}</option>
              {#each [5, 10, 20, 30, 50, 80, 120] as m (m)}<option value={String(m * 1000)}>{m} Mbps</option>{/each}
            </select>
          </label>
          <label
            >{t('stream.transport')}
            <select class="input" value={prefs.transport} onchange={(e) => streamSettings.update({ transport: e.currentTarget.value as 'auto' | 'webrtc' | 'ws' })}>
              <option value="auto">{t('stream.transportAuto')}</option>
              <option value="webrtc">{t('stream.transportWebrtc')}</option>
              <option value="ws">{t('stream.transportWs')}</option>
            </select>
          </label>
          <label class="check"
            ><input type="checkbox" checked={prefs.stats} onchange={(e) => streamSettings.update({ stats: e.currentTarget.checked })} /> {t('stream.showStats')}</label
          >
          <p class="muted">{t('stream.willAsk', { w: request.width, h: request.height, fps: request.fps, mbps: Math.round(request.bitrate / 1000) })}</p>
        </section>
      {/if}

      {#if prompt?.kind === 'running'}
        {@const p = prompt}
        <div class="card note" role="alertdialog" aria-label={t('stream.runningTitle')}>
          <span>{p.running ? t('stream.runningNamed', { app: p.running.name }) : t('stream.running')}</span>
          {#if p.running}{@const r = p.running}<button class="btn sm" onclick={() => launch(r)}>{t('stream.resume', { app: r.name })}</button>{/if}
          <button class="btn ghost sm" onclick={() => launch(p.app, { quitRunning: true })}>{t('stream.quitAndStart', { app: p.app.name })}</button>
          <button class="btn ghost sm" onclick={() => (prompt = null)}>{t('stream.cancel')}</button>
        </div>
      {:else if prompt?.kind === 'active'}
        {@const p = prompt}
        <div class="card note" role="alertdialog" aria-label={t('stream.activeTitle')}>
          <span>{t('stream.active')}</span>
          <button class="btn sm" onclick={() => endOtherAndStart(p)}>{t('stream.endAndStart')}</button>
          <button class="btn ghost sm" onclick={() => (prompt = null)}>{t('stream.cancel')}</button>
        </div>
      {/if}

      {#if apps.length}
        <ul class="apps">
          {#each apps as a (a.id)}
            <li class="card app">
              <button class="open" onclick={() => launch(a)} disabled={busy} aria-label={t('stream.start', { app: a.name })}>
                {#if art[a.id]}<img src={art[a.id]} alt="" />{:else}<span class="ph" aria-hidden="true">🎮</span>{/if}
                <span class="name">{a.name}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if busy}<p class="muted" role="status">{t('stream.starting')}</p>{/if}
      {:else if !busy && !error}
        <p class="muted">{t('stream.noApps')}</p>
      {/if}

      <div class="row foot">
        <button class="btn ghost sm" onclick={signOut}>{t('stream.signOut')}</button>
        <button
          class="btn ghost sm"
          onclick={async () => {
            if (!confirm(t('stream.revokeConfirm'))) return;
            try {
              await api?.revokeAll();
            } finally {
              onSignedOut();
            }
          }}>{t('stream.signOutEverywhere')}</button
        >
        <div class="grow"></div>
        <a class="btn ghost sm" href="https://play.geforcenow.com/" target="_blank" rel="noopener noreferrer">{t('stream.gfn')} ↗</a>
      </div>
    {/if}
  {/if}
</div>

<style>
  .stream {
    display: grid;
    gap: 12px;
  }
  .bar,
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .bar h2,
  h3 {
    font-size: 16px;
    margin: 0;
  }
  .grow {
    flex: 1;
  }
  .pill {
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--bg-elev);
  }
  .pill.ok,
  .verdict.ok {
    color: var(--success, #2e7d32);
  }
  .pill.warn,
  .verdict.warn {
    color: var(--warning, #a15c00);
  }
  .pill.bad,
  .verdict.bad,
  .note.bad {
    color: var(--danger, #c62828);
  }
  .note {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 14px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .form {
    display: grid;
    gap: 10px;
    max-width: 520px;
  }
  .form label {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .form label.check {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .settings fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .settings legend {
    font-size: 13px;
    margin-bottom: 4px;
  }
  .test ul {
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .verdict {
    margin: 0;
    font-weight: 600;
  }
  .steps {
    display: grid;
    gap: 14px;
    padding-inline-start: 20px;
    margin: 0;
  }
  .steps > li {
    display: grid;
    gap: 6px;
  }
  .qr {
    background: #fff;
    padding: 8px;
    border-radius: 8px;
    width: 220px;
    height: 220px;
  }
  .codes {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: 4px 18px;
    margin: 0;
    padding: 0;
  }
  .apps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
  .app {
    padding: 0;
    overflow: hidden;
  }
  .open {
    display: grid;
    width: 100%;
    gap: 6px;
    padding: 0 0 10px;
    text-align: center;
  }
  .open img,
  .ph {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    background: var(--bg-elev);
  }
  .ph {
    display: grid;
    place-items: center;
    font-size: 42px;
  }
  .name {
    font-weight: 600;
    font-size: 14px;
    padding: 0 8px;
    overflow-wrap: anywhere;
  }
  .foot {
    margin-top: 4px;
  }
</style>
