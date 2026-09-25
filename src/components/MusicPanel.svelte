<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import * as sp from '../lib/spotify.svelte';
  import { spotify, toEmbedUrl, type SpotifyPlaylist } from '../lib/spotify.svelte';

  let query = $state('');
  let results = $state<SpotifyPlaylist[]>([]);
  let mine = $state<SpotifyPlaylist[]>([]);
  let showMine = $state(false);
  let searching = $state(false);
  let linkDraft = $state('');
  let linkError = $state('');

  const clientId = $derived(store.settings.spotifyClientId?.trim() ?? '');
  const connected = $derived(spotify.status === 'connected');
  const track = $derived(spotify.playback?.track);
  const progress = $derived(track && track.durationMs ? Math.min(100, (track.progressMs / track.durationMs) * 100) : 0);
  const embed = $derived(store.settings.musicEmbedUrl ? toEmbedUrl(store.settings.musicEmbedUrl) : null);
  const embedHeight = $derived(embed?.provider === 'spotify' ? 152 : embed?.provider === 'apple' ? 175 : 200);
  const activeDevice = $derived(spotify.playback?.device?.id ?? spotify.devices.find((d) => d.isActive)?.id ?? '');

  onMount(() => {
    if (store.settings.spotifyRefreshToken) {
      sp.startPolling();
      void refreshDevices(true);
    }
    return () => sp.stopPolling();
  });
  $effect(() => {
    if (connected) sp.startPolling();
  });

  async function guard(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      toasts.push({ message: e instanceof Error ? e.message : String(e), kind: 'warn', emoji: '🎧', timeout: 5000 });
    }
  }
  const refreshDevices = (quiet = false) => (quiet ? sp.getDevices().catch(() => {}) : guard(() => sp.getDevices()));
  const connect = () => guard(() => sp.login(clientId));
  const toggle = () => guard(() => (spotify.playback?.isPlaying ? sp.pause() : sp.play()));
  const pickDevice = (e: Event) => {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (id) void guard(() => sp.transferPlayback(id, true));
  };
  const volume = (e: Event) => guard(() => sp.setVolume(Number((e.currentTarget as HTMLInputElement).value)));
  const playPlaylist = (uri: string) => guard(() => sp.play({ contextUri: uri, deviceId: activeDevice || undefined }));
  async function search(e?: Event) {
    e?.preventDefault();
    if (!query.trim()) return;
    searching = true;
    await guard(async () => (results = await sp.searchPlaylists(query)));
    searching = false;
  }
  async function toggleMine() {
    showMine = !showMine;
    if (showMine && !mine.length) await guard(async () => (mine = await sp.myPlaylists()));
  }
  function saveLink(e?: Event) {
    e?.preventDefault();
    const parsed = toEmbedUrl(linkDraft);
    if (!parsed) {
      linkError = 'Paste a Spotify, Apple Music, YouTube or SoundCloud share link.';
      return;
    }
    linkError = '';
    store.updateSettings({ musicEmbedUrl: linkDraft.trim() });
    linkDraft = '';
  }
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
</script>

<section class="card music" aria-label="Music">
  <div class="head">
    <h2>🎧 Music</h2>
    {#if connected}
      <span class="who">{spotify.user?.name ?? 'Spotify'}{spotify.premium ? '' : ' · Free'}</span>
      <button class="btn ghost sm" onclick={() => sp.logout()}>Disconnect</button>
    {/if}
  </div>

  {#if clientId}
    {#if !connected}
      <div class="connect">
        <button class="btn primary" onclick={connect} disabled={spotify.status === 'connecting'}>
          {spotify.status === 'connecting' ? 'Connecting…' : 'Connect Spotify'}
        </button>
        <p class="hint">Create a free app at developer.spotify.com/dashboard, add this page's URL as a Redirect URI, paste the Client ID in Settings.</p>
        {#if spotify.error}<p class="err" role="alert">{spotify.error}</p>{/if}
      </div>
    {:else}
      {#if !spotify.premium}
        <p class="hint notice">Playback control needs Spotify Premium; the embedded player below still works.</p>
      {/if}
      <div class="now">
        {#if track?.image}<img class="art" src={track.image} alt="" />{:else}<div class="art blank">♪</div>{/if}
        <div class="meta">
          <div class="title" title={track?.name}>{track?.name ?? 'Nothing playing'}</div>
          <div class="sub">{track?.artists ?? (spotify.playback?.device ? `on ${spotify.playback.device.name}` : 'Open Spotify on a device, then pick it below.')}</div>
          {#if track}
            <div class="bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Track progress">
              <div class="fill" style:width="{progress}%"></div>
            </div>
            <div class="times"><span>{fmt(track.progressMs)}</span><span>{fmt(track.durationMs)}</span></div>
          {/if}
        </div>
      </div>
      <div class="controls">
        <button class="btn icon" aria-label="Previous track" onclick={() => guard(sp.previous)}>⏮</button>
        <button class="btn icon primary" aria-label={spotify.playback?.isPlaying ? 'Pause' : 'Play'} onclick={toggle}>{spotify.playback?.isPlaying ? '⏸' : '▶'}</button>
        <button class="btn icon" aria-label="Next track" onclick={() => guard(sp.next)}>⏭</button>
        <label class="vol"
          ><span aria-hidden="true">🔊</span><input type="range" min="0" max="100" value={spotify.playback?.device?.volume ?? 50} onchange={volume} aria-label="Volume" /></label
        >
      </div>
      <div class="devices">
        <select class="select" aria-label="Playback device" value={activeDevice} onchange={pickDevice}>
          <option value="" disabled>{spotify.devices.length ? 'Pick a device' : 'No devices — open Spotify somewhere'}</option>
          {#each spotify.devices as d (d.id)}<option value={d.id}>{d.name} · {d.type}</option>{/each}
        </select>
        <button class="btn icon" aria-label="Refresh devices" onclick={() => refreshDevices()}>↻</button>
      </div>
      <form class="search" onsubmit={search}>
        <input class="input" bind:value={query} placeholder="Focus playlists: lo-fi, study beats, piano…" aria-label="Search playlists" />
        <button class="btn sm" type="submit" disabled={searching}>{searching ? '…' : 'Search'}</button>
      </form>
      {#if results.length}
        <ul class="list">
          {#each results as p (p.id)}<li>
              {#if p.image}<img src={p.image} alt="" />{/if}<span class="n">{p.name}<small>{p.owner}</small></span><button class="btn sm" onclick={() => playPlaylist(p.uri)}
                >Play</button
              >
            </li>{/each}
        </ul>
      {/if}
      <button class="btn ghost sm" onclick={toggleMine} aria-expanded={showMine}>{showMine ? 'Hide' : 'My playlists'}</button>
      {#if showMine}
        <ul class="list">
          {#each mine as p (p.id)}<li>
              {#if p.image}<img src={p.image} alt="" />{/if}<span class="n">{p.name}<small>{p.owner}</small></span><button class="btn sm" onclick={() => playPlaylist(p.uri)}
                >Play</button
              >
            </li>{:else}<li class="hint">No playlists yet.</li>{/each}
        </ul>
      {/if}
    {/if}
    <hr />
  {/if}

  <div class="embed">
    {#if embed}
      <iframe title="Embedded music player" src={embed.src} height={embedHeight} allow="autoplay; encrypted-media; clipboard-write" loading="lazy"></iframe>
      <div class="embed-foot">
        <span class="hint">Plays in this tab, free.{clientId ? ' Spotify Connect controls whatever device is playing.' : ''}</span>
        <button class="btn ghost sm" onclick={() => store.updateSettings({ musicEmbedUrl: '' })}>Clear</button>
      </div>
    {:else}
      <form onsubmit={saveLink} class="search">
        <input class="input" bind:value={linkDraft} placeholder="Paste a Spotify / Apple Music / YouTube / SoundCloud link" aria-label="Music link" />
        <button class="btn sm" type="submit">Embed</button>
      </form>
      {#if linkError}<p class="err" role="alert">{linkError}</p>{/if}
      <p class="hint">The embed plays in this tab and is free.{clientId ? ' Spotify Connect above controls whatever device is playing.' : ''}</p>
    {/if}
  </div>
</section>

<style>
  .music {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
    flex: 1;
  }
  .who {
    font-size: 12px;
    color: var(--text-muted);
  }
  .hint {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
  }
  .notice {
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    color: var(--text);
  }
  .err {
    font-size: 12px;
    color: var(--danger);
    margin: 0;
  }
  .connect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .now {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .art {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    object-fit: cover;
    flex: none;
  }
  .art.blank {
    display: grid;
    place-items: center;
    background: var(--bg-elev-2);
    color: var(--text-faint);
    font-size: 22px;
  }
  .meta {
    min-width: 0;
    flex: 1;
  }
  .title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar {
    height: 4px;
    border-radius: 2px;
    background: var(--bg-elev-2);
    margin-top: 6px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 1s linear;
  }
  .times {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-faint);
    font-family: var(--mono);
    margin-top: 2px;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .vol {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    margin-left: 6px;
    min-width: 0;
  }
  .vol input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }
  .devices {
    display: flex;
    gap: 6px;
  }
  .devices .select {
    flex: 1;
    min-width: 0;
  }
  .search {
    display: flex;
    gap: 6px;
  }
  .search .input {
    flex: 1;
    min-width: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .list li:hover {
    background: var(--bg-hover);
  }
  .list img {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    object-fit: cover;
    flex: none;
  }
  .list .n {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .list small {
    color: var(--text-muted);
    font-size: 11px;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 2px 0;
    width: 100%;
  }
  .embed {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  iframe {
    width: 100%;
    border: 0;
    border-radius: 12px;
    background: var(--bg-elev-2);
  }
  .embed-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
</style>
