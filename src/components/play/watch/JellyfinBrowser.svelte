<script lang="ts">
  // Browse and play a Jellyfin / Emby server: sign in, Continue watching, Next up, libraries, search, shows →
  // seasons → episodes, and the player. Everything the server sends is shown as plain text.
  import { onDestroy, onMount } from 'svelte';
  import { toasts } from '../../../lib/toast.svelte';
  import { blockedOrigin } from '../../../lib/csp';
  import { isMixedContent } from '../../../lib/watch/embed';
  import { isPlayable, JellyfinClient, JellyfinError, type JfItem } from '../../../lib/watch/jellyfin';
  import { getToken, saveToken, watch } from '../../../lib/watch/state.svelte';
  import type { WatchSource } from '../../../lib/watch/sources';
  import EmbedFrame from './EmbedFrame.svelte';
  import JellyfinPlayer from './JellyfinPlayer.svelte';
  import ServerHelp from './ServerHelp.svelte';

  interface Props {
    source: WatchSource;
    /** may playback start now? (the homework rules; shows why not when it can't) */
    canStart: () => boolean;
    /** the rules stopped watching: close the player */
    halted: boolean;
    onactive: (on: boolean) => void;
    onback: () => void;
  }
  let { source, canStart, halted, onactive, onback }: Props = $props();

  type View =
    | { name: 'home' }
    | { name: 'folder'; id: string; title: string }
    | { name: 'series'; id: string; title: string }
    | { name: 'season'; seriesId: string; id: string; title: string }
    | { name: 'search'; q: string }
    | { name: 'item'; id: string }
    | { name: 'web' };

  const server = $derived(source.url);
  const mixed = $derived(typeof location !== 'undefined' && isMixedContent(source.url, location.protocol));
  const blocked = $derived(blockedOrigin(source.url) ?? '');
  const reachable = $derived(!mixed && !blocked);

  let client = $state<JellyfinClient | null>(null);
  let signedIn = $state(false);
  let checking = $state(true);
  let stack = $state<View[]>([{ name: 'home' }]);
  const view = $derived(stack[stack.length - 1]);

  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');

  // home rows
  let resume = $state<JfItem[]>([]);
  let nextUp = $state<JfItem[]>([]);
  let libraries = $state<JfItem[]>([]);
  // folder / search / series / season lists
  let list = $state<JfItem[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let searchText = $state('');
  // item page
  let current = $state<JfItem | null>(null);
  let playing = $state<{ item: JfItem; restart: boolean } | null>(null);

  function newClient(token = ''): JellyfinClient {
    return new JellyfinClient({ server: source.url, deviceId: watch.data.deviceId, token, userId: source.userId });
  }

  function explain(e: unknown): string {
    if (e instanceof JellyfinError) {
      if (e.kind === 'network')
        return `${e.message} Check the address and that the server is online. Browsers also need the server to allow requests from other sites (Jellyfin does by default; see WATCH.md if a proxy in front of it strips the CORS headers).`;
      return e.message;
    }
    return e instanceof Error ? e.message : String(e);
  }

  async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    error = '';
    try {
      return await fn();
    } catch (e) {
      if (e instanceof JellyfinError && e.kind === 'auth' && signedIn) {
        signedIn = false;
        void saveToken(source.id, '');
      }
      error = explain(e);
      return undefined;
    }
  }

  onMount(() => {
    void (async () => {
      if (reachable && source.userId) {
        const token = await getToken(source.id);
        if (token) {
          client = newClient(token);
          signedIn = true;
          await loadHome();
        }
      }
      checking = false;
    })();
  });

  async function signIn(e: SubmitEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    busy = true;
    const c = newClient();
    const auth = await guard(() => c.authenticate(username.trim(), password));
    busy = false;
    password = '';
    if (!auth) return;
    watch.update(source.id, { userId: auth.userId, userName: auth.userName });
    await saveToken(source.id, auth.token);
    client = c;
    signedIn = true;
    toasts.push({ message: `Signed in as ${auth.userName}`, kind: 'success', emoji: '📺' });
    await loadHome();
  }

  async function signOut() {
    const c = client;
    client = null;
    signedIn = false;
    playing = null;
    stack = [{ name: 'home' }];
    await saveToken(source.id, '');
    watch.update(source.id, { userId: undefined, userName: undefined });
    await c?.logout().catch(() => {});
  }

  async function loadHome() {
    const c = client;
    if (!c) return;
    loading = true;
    await guard(async () => {
      const [r, n, v] = await Promise.all([c.resume(), c.nextUp().catch(() => [] as JfItem[]), c.views()]);
      resume = r;
      nextUp = n;
      libraries = v;
    });
    loading = false;
  }

  async function show(v: View) {
    const c = client;
    playing = null;
    if (v.name !== 'home' && v.name !== 'web') {
      list = [];
      total = 0;
    }
    if (v.name === 'item') current = null;
    stack = [...stack, v];
    if (!c) return;
    loading = true;
    await guard(async () => {
      if (v.name === 'folder') {
        const r = await c.items({ parentId: v.id, limit: 60 });
        [list, total] = [r.items, r.total];
      } else if (v.name === 'search') {
        const r = await c.items({ search: v.q, recursive: true, types: ['Movie', 'Series', 'Episode', 'Video', 'MusicVideo'], limit: 60 });
        [list, total] = [r.items, r.total];
      } else if (v.name === 'series') {
        list = await c.seasons(v.id);
        total = list.length;
      } else if (v.name === 'season') {
        list = await c.episodes(v.seriesId, v.id);
        total = list.length;
      } else if (v.name === 'item') current = await c.item(v.id);
    });
    loading = false;
  }

  async function more() {
    const c = client;
    const v = view;
    if (!c || (v.name !== 'folder' && v.name !== 'search')) return;
    loading = true;
    await guard(async () => {
      const r =
        v.name === 'folder' ? await c.items({ parentId: v.id, start: list.length, limit: 60 }) : await c.items({ search: v.q, recursive: true, start: list.length, limit: 60 });
      list = [...list, ...r.items];
      total = r.total;
    });
    loading = false;
  }

  function back() {
    playing = null;
    if (stack.length > 1) stack = stack.slice(0, -1);
    else onback();
    if (view.name === 'home') void loadHome();
  }

  function open(it: JfItem) {
    if (isPlayable(it)) void show({ name: 'item', id: it.id });
    else if (it.type === 'Series') void show({ name: 'series', id: it.id, title: it.name });
    else if (it.type === 'Season') void show({ name: 'season', seriesId: it.seriesId, id: it.id, title: it.seriesName ? `${it.seriesName} · ${it.name}` : it.name });
    else void show({ name: 'folder', id: it.id, title: it.name });
  }

  function play(restart: boolean) {
    if (!current || !canStart()) return;
    playing = { item: current, restart };
  }

  // the player or the server's web app counts as watching (for the homework rules)
  let playerOn = $state(false);
  $effect(() => {
    onactive(playerOn || view.name === 'web');
  });
  $effect(() => {
    if (!halted) return;
    if (playing) playing = null;
    if (view.name === 'web') stack = stack.slice(0, -1);
  });
  onDestroy(() => onactive(false));
  function openWeb() {
    if (canStart()) void show({ name: 'web' });
  }

  function label(it: JfItem): string {
    if (it.type === 'Episode') {
      const se = it.parentIndexNumber !== null && it.indexNumber !== null ? `S${it.parentIndexNumber}:E${it.indexNumber} · ` : '';
      return `${se}${it.name}`;
    }
    return it.name;
  }
  function sub(it: JfItem): string {
    if (it.type === 'Episode') return it.seriesName;
    return [it.productionYear, it.type === 'CollectionFolder' ? it.collectionType : it.type].filter(Boolean).join(' · ');
  }
  const pct = (it: JfItem) => (it.runTimeSeconds > 0 ? Math.min(100, Math.round((it.positionSeconds / it.runTimeSeconds) * 100)) : 0);
  const mins = (s: number) => `${Math.round(s / 60)} min`;
  function imgError(e: Event) {
    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
  }
</script>

{#snippet card(it: JfItem)}
  <button class="poster" onclick={() => open(it)} title={it.name}>
    <span class="art">
      {#if it.hasPrimaryImage && client}
        <img src={client.imageUrl(it)} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={imgError} />
      {:else}
        <span class="ph" aria-hidden="true">{it.type === 'Series' ? '📺' : it.type === 'CollectionFolder' || it.type === 'Folder' ? '📁' : '🎬'}</span>
      {/if}
      {#if pct(it) > 0 && !it.played}<span class="bar" style:width={`${pct(it)}%`}></span>{/if}
    </span>
    <span class="t">{label(it)}</span>
    {#if sub(it)}<span class="s">{sub(it)}</span>{/if}
  </button>
{/snippet}

<div class="jf">
  <div class="top">
    <button class="btn ghost sm" onclick={back}>← {stack.length > 1 ? 'Back' : 'All sources'}</button>
    <h2>{source.kind === 'emby' ? '🟢' : '🟣'} {source.name}</h2>
    <div class="grow"></div>
    {#if view.name !== 'web'}<button class="btn ghost sm" onclick={openWeb}>Open the server's own web app</button>{/if}
    <a class="btn ghost sm" href={`${server}/web/`} target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
    {#if signedIn}<button class="btn ghost sm" onclick={signOut}>Sign out{source.userName ? ` (${source.userName})` : ''}</button>{/if}
  </div>

  {#if view.name === 'web'}
    <EmbedFrame src={`${server}/web/`} title={`${source.name} web app`} tall />
  {:else if !reachable}
    <ServerHelp {server} {mixed} {blocked} />
    <button class="btn" onclick={openWeb}>Open the server's own web app</button>
  {:else if checking}
    <p class="muted">Connecting…</p>
  {:else if !signedIn}
    <form class="card signin" onsubmit={signIn}>
      <h3>Sign in to {source.kind === 'emby' ? 'Emby' : 'Jellyfin'}</h3>
      <p class="muted">Your password goes only to <code>{server}</code>. The app keeps just the sign-in token the server gives back, with your other keys on this device.</p>
      <label>Username <input class="input" autocomplete="username" bind:value={username} required /></label>
      <label>Password <input class="input" type="password" autocomplete="current-password" bind:value={password} /></label>
      <button class="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  {:else if view.name === 'home'}
    <form
      class="search"
      role="search"
      onsubmit={(e) => {
        e.preventDefault();
        if (searchText.trim()) void show({ name: 'search', q: searchText.trim() });
      }}
    >
      <input class="input" type="search" placeholder="Search movies and shows" aria-label="Search the server" bind:value={searchText} />
      <button class="btn" type="submit">Search</button>
    </form>
    {#if resume.length}
      <h3>Continue watching</h3>
      <div class="row">
        {#each resume as it (it.id)}{@render card(it)}{/each}
      </div>
    {/if}
    {#if nextUp.length}
      <h3>Next up</h3>
      <div class="row">
        {#each nextUp as it (it.id)}{@render card(it)}{/each}
      </div>
    {/if}
    <h3>Libraries</h3>
    {#if libraries.length}
      <div class="grid">
        {#each libraries as it (it.id)}{@render card(it)}{/each}
      </div>
    {:else if !loading}
      <p class="muted">No libraries to show.</p>
    {/if}
  {:else if view.name === 'item'}
    {#if current}
      <div class="item">
        {#if playing}
          {#key playing}
            <JellyfinPlayer
              client={client!}
              item={playing.item}
              restart={playing.restart}
              speed={watch.data.speed}
              onspeed={(s) => watch.setSpeed(s)}
              onactive={(on) => (playerOn = on)}
              onended={() => (playing = null)}
            />
          {/key}
        {/if}
        <h3 class="title">{label(current)}</h3>
        <p class="muted">
          {[current.seriesName, current.productionYear, current.runTimeSeconds ? mins(current.runTimeSeconds) : ''].filter(Boolean).join(' · ')}
        </p>
        {#if !playing}
          <div class="btns">
            {#if current.positionSeconds > 5}
              <button class="btn" onclick={() => play(false)}>▶ Resume from {mins(current.positionSeconds)}</button>
              <button class="btn ghost" onclick={() => play(true)}>Start over</button>
            {:else}
              <button class="btn" onclick={() => play(true)}>▶ Play</button>
            {/if}
          </div>
        {/if}
        {#if current.overview}<p class="overview">{current.overview}</p>{/if}
      </div>
    {/if}
  {:else}
    <h3>
      {view.name === 'search' ? `Results for “${view.q}”` : view.title}
    </h3>
    {#if view.name === 'season'}
      <ul class="eps">
        {#each list as it (it.id)}
          <li>
            <button class="ep" onclick={() => open(it)}>
              <span class="t">{label(it)}</span>
              {#if it.runTimeSeconds}<span class="s">{mins(it.runTimeSeconds)}{it.played ? ' · watched' : pct(it) ? ` · ${pct(it)}% watched` : ''}</span>{/if}
              {#if it.overview}<span class="o">{it.overview}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="grid">
        {#each list as it (it.id)}{@render card(it)}{/each}
      </div>
    {/if}
    {#if !loading && !list.length}<p class="muted">Nothing here.</p>{/if}
    {#if list.length < total && (view.name === 'folder' || view.name === 'search')}
      <button class="btn ghost" onclick={more} disabled={loading}>Load more</button>
    {/if}
  {/if}

  {#if loading}<p class="muted" aria-live="polite">Loading…</p>{/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</div>

<style>
  .jf {
    display: grid;
    gap: 10px;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .top h2 {
    font-size: 16px;
    margin: 0;
  }
  .grow {
    flex: 1;
  }
  h3 {
    font-size: 15px;
    margin: 8px 0 0;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .err {
    color: var(--danger, #e17055);
    font-size: 13px;
  }
  .signin {
    display: grid;
    gap: 8px;
    max-width: 420px;
  }
  .signin label {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .search {
    display: flex;
    gap: 8px;
  }
  .search .input {
    flex: 1;
  }
  .row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 140px;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
  }
  .poster {
    display: grid;
    gap: 4px;
    text-align: start;
    align-content: start;
    min-width: 0;
  }
  .art {
    position: relative;
    aspect-ratio: 2 / 3;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    display: grid;
    place-items: center;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ph {
    font-size: 34px;
  }
  .bar {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 4px;
    background: var(--accent);
  }
  .poster .t {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .poster .s,
  .ep .s {
    font-size: 12px;
    color: var(--text-muted);
  }
  .eps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .ep {
    display: grid;
    gap: 2px;
    width: 100%;
    text-align: start;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-elev);
  }
  .ep .t {
    font-weight: 600;
  }
  .ep .o {
    font-size: 12px;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .item {
    display: grid;
    gap: 8px;
  }
  .title {
    font-size: 18px;
  }
  .overview {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
    margin: 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
