<script lang="ts">
  // Play → Watch: the user's own media servers (Jellyfin / Emby with a native browser; Plex or any other server's
  // web app in a frame), embeddable video links, direct video files and videos on this device. Streaming services
  // with DRM (Netflix, Hulu, Disney+…) refuse to be embedded and aren't supported. Optional homework rules
  // (vouchers, ring first, daily limit, study-break reminder) come from Settings → Economy.
  import { onDestroy } from 'svelte';
  import { store } from '../../../lib/store.svelte';
  import { economy } from '../../../lib/economy.svelte';
  import { toasts } from '../../../lib/toast.svelte';
  import { blockedOrigin } from '../../../lib/csp';
  import { httpUrl, isMixedContent, toPlayable, type EmbedProvider } from '../../../lib/watch/embed';
  import { breakDue, buyWatchTime, countsTime, describeRules, tickWatch, watchGate } from '../../../lib/watch/limits';
  import { hostLabel, normalizeServer, type SourceKind, type WatchSource } from '../../../lib/watch/sources';
  import { ringClosedToday, saveUsage, watch, watchRules, watchUsage } from '../../../lib/watch/state.svelte';
  import EmbedFrame from './EmbedFrame.svelte';
  import JellyfinBrowser from './JellyfinBrowser.svelte';
  import VideoPlayer from './VideoPlayer.svelte';

  type Target =
    | { kind: 'iframe'; src: string; provider: EmbedProvider; title: string; openUrl: string; tall: boolean }
    | { kind: 'video'; src: string; hls: boolean; title: string; posKey: string; local: boolean };
  type Screen = { name: 'list' } | { name: 'add' } | { name: 'server'; id: string } | { name: 'play'; target: Target };

  let screen = $state<Screen>({ name: 'list' });

  // ---------- homework rules ----------
  const rules = $derived(watchRules());
  const usage = $derived(watchUsage());
  const gate = $derived(watchGate(rules, usage, store.today, ringClosedToday()));
  const ruleLines = $derived(describeRules(rules, usage, store.today));
  let sittingMs = 0;
  let minuteMs = 0;
  let reminded = false;
  let last = Date.now();
  const clock = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(now - last, 30_000);
    last = now;
    if (!active || document.visibilityState !== 'visible') return;
    sittingMs += dt;
    minuteMs += dt;
    const r = watchRules();
    if (breakDue(r, sittingMs, reminded)) {
      reminded = true;
      toasts.push({
        message: `You've watched for ${r.breakMin} minutes`,
        detail: 'Time for a study break? Your show will be right here.',
        kind: 'warn',
        emoji: '⏰',
        timeout: 15000,
        action: { label: 'Back to Today', onClick: () => store.go('today') },
      });
    }
    while (minuteMs >= 60_000) {
      minuteMs -= 60_000;
      if (countsTime(r)) saveUsage(tickWatch(r, watchUsage(), store.today));
    }
  }, 5_000);
  onDestroy(() => clearInterval(clock));

  const frameOpen = $derived(screen.name === 'play' && screen.target.kind === 'iframe');
  let videoPlaying = $state(false);
  let serverPlaying = $state(false);
  /** a player is showing something (video playing, or a frame open) */
  const active = $derived(frameOpen || videoPlaying || serverPlaying);
  // the rules ran out while watching: stop
  const halted = $derived(!gate.ok);
  $effect(() => {
    if (halted && screen.name === 'play') {
      closePlayer();
      toasts.push({ message: whyNot(), kind: 'warn', emoji: '⏸️' });
    }
  });

  function whyNot(): string {
    if (gate.ok) return '';
    if (gate.reason === 'ring') return "Finish today's ring first, then watch.";
    if (gate.reason === 'limit') return `Watch time is up for today (${rules.dailyLimitMin} min).`;
    return `Watching costs a voucher (1 🎟️ = ${rules.voucherMin} min).`;
  }

  function canStart(): boolean {
    if (gate.ok) return true;
    toasts.push({ message: whyNot(), kind: 'warn', emoji: '🔒' });
    return false;
  }

  function buyTime() {
    if (!economy.spendWatchVoucher()) {
      toasts.push({ message: 'No vouchers left', detail: 'Buy arcade vouchers in the Shop with coins from homework.', kind: 'warn', emoji: '🎟️' });
      return;
    }
    saveUsage(buyWatchTime(rules, usage));
    toasts.push({ message: `+${rules.voucherMin} minutes of watch time`, kind: 'success', emoji: '🎟️' });
  }

  // ---------- opening things ----------
  let localUrl = '';
  function closePlayer() {
    if (localUrl) URL.revokeObjectURL(localUrl);
    localUrl = '';
    videoPlaying = false;
    screen = { name: 'list' };
  }

  function targetFor(s: WatchSource): Target | null {
    if (s.kind === 'web') return { kind: 'iframe', src: s.url, provider: 'web', title: s.name, openUrl: s.url, tall: true };
    const p = toPlayable(s.url, location.hostname);
    if (!p) return null;
    if (s.kind === 'direct' || p.kind === 'video') {
      const hls = p.kind === 'video' ? p.hls : /\.m3u8$/i.test(httpUrl(s.url)?.pathname ?? '');
      return { kind: 'video', src: s.url, hls, title: s.name, posKey: s.id, local: false };
    }
    return { kind: 'iframe', src: p.src, provider: p.provider, title: s.name, openUrl: s.url, tall: false };
  }

  function openSource(s: WatchSource) {
    if (s.kind === 'jellyfin' || s.kind === 'emby') {
      screen = { name: 'server', id: s.id };
      return;
    }
    const t = targetFor(s);
    if (!t) return void toasts.push({ message: "That link can't be opened", kind: 'warn' });
    if (!canStart()) return;
    screen = { name: 'play', target: t };
  }

  let fileInput = $state<HTMLInputElement>();
  function pickFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f || !canStart()) return;
    if (localUrl) URL.revokeObjectURL(localUrl);
    localUrl = URL.createObjectURL(f);
    screen = { name: 'play', target: { kind: 'video', src: localUrl, hls: false, title: f.name, posKey: '', local: true } };
  }

  // HLS through hls.js fetches the playlist and segments, so its host must be allowed; Safari plays HLS itself
  const hlsBlocked = $derived.by(() => {
    if (screen.name !== 'play' || screen.target.kind !== 'video' || !screen.target.hls) return '';
    const native = document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';
    return native ? '' : (blockedOrigin(screen.target.src) ?? '');
  });
  const mixedTarget = $derived(screen.name === 'play' && screen.target.kind === 'video' && !screen.target.local && isMixedContent(screen.target.src, location.protocol));

  let lastPosSave = 0;
  function onVideoTime(key: string, t: number, d: number, paused: boolean) {
    if (!key) return;
    if (paused || Date.now() - lastPosSave > 5000) {
      lastPosSave = Date.now();
      watch.setPosition(key, t, d);
    }
  }

  // ---------- adding a source ----------
  const KINDS: { id: SourceKind; icon: string; name: string; blurb: string; placeholder: string }[] = [
    { id: 'jellyfin', icon: '🟣', name: 'Jellyfin', blurb: 'Sign in and browse your libraries here', placeholder: 'https://jellyfin.example.com' },
    { id: 'emby', icon: '🟢', name: 'Emby', blurb: 'Same as Jellyfin', placeholder: 'https://emby.example.com' },
    { id: 'web', icon: '🌐', name: 'Plex or another server / site', blurb: "Shows the site's own web app", placeholder: 'https://app.plex.tv/desktop' },
    { id: 'embed', icon: '🔗', name: 'Video link', blurb: 'YouTube, Vimeo, Twitch, Dailymotion, Archive.org, Google Drive, any embed link', placeholder: 'https://youtu.be/…' },
    { id: 'direct', icon: '🎞️', name: 'Video file URL', blurb: '.mp4, .webm, .m3u8 (and .mkv when the browser can)', placeholder: 'https://example.com/video.mp4' },
  ];
  const icon = (k: SourceKind) => KINDS.find((x) => x.id === k)?.icon ?? '📺';
  let addKind = $state<SourceKind>('jellyfin');
  let addName = $state('');
  let addUrl = $state('');
  const addMeta = $derived(KINDS.find((k) => k.id === addKind)!);
  const preview = $derived.by(() => {
    if (!addUrl.trim()) return '';
    if (typeof location !== 'undefined' && isMixedContent(addUrl, location.protocol))
      return 'Heads up: this site is https, so browsers block http:// addresses (except in a new tab). Give the server https, or see WATCH.md for other options.';
    if (addKind === 'jellyfin' || addKind === 'emby') return normalizeServer(addUrl) ? '' : 'Enter the server address, like https://jellyfin.example.com';
    const p = toPlayable(addUrl, typeof location === 'undefined' ? 'localhost' : location.hostname);
    if (!p) return 'That doesn’t look like an http(s) link.';
    if (addKind === 'embed')
      return p.kind === 'iframe'
        ? p.provider === 'web'
          ? 'Will be shown as a web page.'
          : `Will play with the ${p.provider} player: ${p.src}`
        : 'That’s a video file: it will use the built-in player.';
    if (addKind === 'direct' && p.kind !== 'video') return 'No video file extension: the built-in player will try it anyway.';
    return '';
  });

  function addSource(e: SubmitEvent) {
    e.preventDefault();
    const url = addKind === 'jellyfin' || addKind === 'emby' ? normalizeServer(addUrl) : httpUrl(addUrl)?.href;
    if (!url) return void toasts.push({ message: 'Enter a valid http(s) address', kind: 'warn' });
    const src = watch.add({ kind: addKind, name: addName.trim().slice(0, 80) || hostLabel(url), url });
    addName = addUrl = '';
    if (src.kind === 'jellyfin' || src.kind === 'emby') screen = { name: 'server', id: src.id };
    else screen = { name: 'list' };
  }

  let confirmRemove = $state('');
  function remove(s: WatchSource) {
    if (confirmRemove !== s.id) {
      confirmRemove = s.id;
      return;
    }
    confirmRemove = '';
    watch.remove(s.id);
  }

  const serverSource = $derived(screen.name === 'server' ? watch.data.sources.find((s) => s.id === (screen as { id: string }).id) : undefined);
</script>

<div class="watch">
  {#if !gate.ok}
    <div class="card note" role="status">
      {#if gate.reason === 'ring'}
        <strong>Finish today's ring first.</strong> Watching opens up once you've done today's goal ({store.completedToday}/{store.stats.dailyGoal || 3}).
        <button class="btn sm" onclick={() => store.go('today')}>Go to Today</button>
      {:else if gate.reason === 'limit'}
        <strong>Watch time is up for today.</strong> The daily limit ({rules.dailyLimitMin} min) was set in Settings → Economy. Come back tomorrow.
      {:else}
        <strong>Watching costs vouchers here:</strong> 1 🎟️ = {rules.voucherMin} minutes. You have {economy.wallet.vouchers} voucher{economy.wallet.vouchers === 1 ? '' : 's'}.
        <button class="btn sm" onclick={buyTime} disabled={economy.wallet.vouchers < 1}>Spend 1 🎟️ for {rules.voucherMin} min</button>
      {/if}
    </div>
  {:else if Number.isFinite(gate.minutesLeft) && gate.minutesLeft <= 5}
    <div class="card note" role="status">
      ⏳ {gate.minutesLeft} minute{gate.minutesLeft === 1 ? '' : 's'} of watch time left.
      {#if rules.voucherMin > 0 && economy.wallet.vouchers > 0}<button class="btn sm" onclick={buyTime}>Spend 1 🎟️ for {rules.voucherMin} more</button>{/if}
    </div>
  {/if}

  {#if screen.name === 'server' && serverSource}
    <JellyfinBrowser source={serverSource} {canStart} {halted} onactive={(on) => (serverPlaying = on)} onback={() => (screen = { name: 'list' })} />
  {:else if screen.name === 'play'}
    {@const t = screen.target}
    <div class="bar">
      <button class="btn ghost sm" onclick={closePlayer}>← All sources</button>
      <h2>{t.title}</h2>
    </div>
    {#if t.kind === 'iframe'}
      {#key t.src}<EmbedFrame src={t.src} title={t.title} provider={t.provider} openUrl={t.openUrl} tall={t.tall} />{/key}
    {:else if mixedTarget}
      <div class="card note">
        This video is on an <code>http://</code> address and this app is served over https, so the browser blocks it (mixed content). Serve the video over https, or run this app yourself
        on the same network over http. See WATCH.md.
      </div>
    {:else if hlsBlocked}
      <div class="card note">
        This stream is an HLS playlist, which this browser plays by downloading its pieces, and this site's security policy doesn't allow <code>{hlsBlocked}</code>. The site owner
        can add it to <code>VITE_MEDIA_SERVERS</code> (see WATCH.md). Safari plays these streams without that.
        <a class="btn ghost sm" href={t.src} target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
      </div>
    {:else}
      {#key t.src}
        <VideoPlayer
          src={t.src}
          hls={t.hls}
          title={t.title}
          startAt={t.posKey ? watch.position(t.posKey) : 0}
          speed={watch.data.speed}
          onspeed={(s) => watch.setSpeed(s)}
          onplaying={(on) => (videoPlaying = on)}
          ontime={(sec, d, p) => onVideoTime(t.posKey, sec, d, p)}
        />
      {/key}
      {#if t.local}<p class="muted">Playing from this device: nothing is uploaded, and it isn't saved in your list.</p>{/if}
    {/if}
  {:else if screen.name === 'add'}
    <div class="bar">
      <button class="btn ghost sm" onclick={() => (screen = { name: 'list' })}>← All sources</button>
      <h2>Add a source</h2>
    </div>
    <form class="card add" onsubmit={addSource}>
      <fieldset class="kinds">
        <legend>What is it?</legend>
        {#each KINDS as k (k.id)}
          <label class="kind" class:on={addKind === k.id}>
            <input type="radio" name="kind" value={k.id} bind:group={addKind} />
            <span class="ki">{k.icon}</span>
            <span><strong>{k.name}</strong><br /><small>{k.blurb}</small></span>
          </label>
        {/each}
      </fieldset>
      <label>
        {addKind === 'jellyfin' || addKind === 'emby' ? 'Server address' : 'Link'}
        <input class="input" type="url" inputmode="url" required placeholder={addMeta.placeholder} bind:value={addUrl} aria-label="Address" />
      </label>
      {#if preview}<p class="muted" aria-live="polite">{preview}</p>{/if}
      <label>Name (optional) <input class="input" maxlength="80" bind:value={addName} placeholder={addKind === 'web' ? 'Plex' : 'Living room server'} /></label>
      <button class="btn" type="submit">Add</button>
      <p class="muted">
        Saved on this device only. Use your own server or links you're allowed to watch. Netflix, Hulu, Disney+ and other DRM streaming services don't allow being shown inside
        other apps, so they won't work here.
      </p>
    </form>
  {:else}
    <div class="bar">
      <h2>📺 Watch</h2>
      <div class="grow"></div>
      <button class="btn" onclick={() => (screen = { name: 'add' })}>+ Add a source</button>
      <button class="btn ghost" onclick={() => fileInput?.click()}>▶ Play a file on this device</button>
      <input bind:this={fileInput} type="file" accept="video/*,.mkv,.m4v,.webm" hidden onchange={pickFile} aria-label="Video file" />
    </div>
    {#if ruleLines.length}
      <p class="muted">Rules: {ruleLines.join(' · ')} (Settings → Economy)</p>
    {/if}
    {#if watch.data.sources.length}
      <ul class="sources">
        {#each watch.data.sources as s (s.id)}
          <li class="card src">
            <button class="open" onclick={() => openSource(s)}>
              <span class="si" aria-hidden="true">{icon(s.kind)}</span>
              <span class="sn"><strong>{s.name}</strong><small>{hostLabel(s.url)}{s.userName ? ` · ${s.userName}` : ''}{watch.data.positions[s.id] ? ' · resume' : ''}</small></span
              >
            </button>
            <button class="btn ghost sm" onclick={() => remove(s)} aria-label={`Remove ${s.name}`}>{confirmRemove === s.id ? 'Remove?' : '✕'}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="card empty">
        <p>
          <strong>Watch your own shows here.</strong> Add your Jellyfin or Emby server to browse and play your libraries, Plex or another server's web app, a YouTube/Vimeo/Twitch link,
          or a video file.
        </p>
        <p class="muted">Setup help, including https for a home server, is in WATCH.md.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .watch {
    display: grid;
    gap: 12px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .bar h2 {
    font-size: 16px;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .grow {
    flex: 1;
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
  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px;
  }
  .src {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
  }
  .open {
    flex: 1;
    display: flex;
    gap: 10px;
    align-items: center;
    text-align: start;
    min-width: 0;
  }
  .si {
    font-size: 26px;
  }
  .sn {
    display: grid;
    min-width: 0;
  }
  .sn small {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .add {
    display: grid;
    gap: 10px;
    max-width: 640px;
  }
  .add > label {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .kinds {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 6px;
  }
  .kinds legend {
    font-size: 13px;
    margin-bottom: 6px;
  }
  .kind {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
  }
  .kind.on {
    border-color: var(--accent);
    background: var(--bg-elev);
  }
  .kind input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .kind:focus-within {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .ki {
    font-size: 20px;
  }
  .kind small {
    color: var(--text-muted);
  }
  .empty p {
    margin: 0 0 6px;
  }
</style>
