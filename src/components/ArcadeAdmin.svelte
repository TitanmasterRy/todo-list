<script lang="ts">
  // Settings → Arcade admin: add games to this browser (upload an HTML file or paste a link), preview them,
  // and copy the games.json entry to publish them for everyone.
  import { onMount } from 'svelte';
  import { arcade } from '../lib/arcade.svelte';
  import { manifestEntry, slugify, THEME_PACKS, validateGame } from '../lib/arcade';
  import { toasts } from '../lib/toast.svelte';
  import type { ArcadeGame, ThemePack } from '../lib/types';
  import GamePlayer from './play/GamePlayer.svelte';

  let kind = $state<'file' | 'url'>('file');
  let title = $state('');
  let emoji = $state('🎮');
  let description = $state('');
  let url = $state('');
  let html = $state('');
  let fileName = $state('');
  let cost = $state(1);
  let minutes = $state(0);
  let theme = $state<ThemePack | ''>('');
  let error = $state('');
  let preview = $state<ArcadeGame | null>(null);
  onMount(() => void arcade.load());

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      error = 'That file is over 5 MB. Put big games in public/games/ instead.';
      return;
    }
    html = await f.text();
    fileName = f.name;
    if (!title) title = f.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
  }

  function build(): ArcadeGame | null {
    error = '';
    const id = slugify(title);
    const raw = {
      id,
      title,
      emoji,
      description: description || undefined,
      cost,
      minutes: minutes || undefined,
      theme: theme || undefined,
      ...(kind === 'url' ? { url } : { html }),
    };
    const { game, error: err } = validateGame(raw);
    if (!game) {
      error = err ?? 'Check the fields.';
      return null;
    }
    if (kind === 'file' && !html) {
      error = 'Choose an HTML file.';
      return null;
    }
    return { ...game, html: kind === 'file' ? html : undefined, local: true };
  }

  async function save() {
    const g = build();
    if (!g) return;
    await arcade.saveLocal(g);
    toasts.push({ message: `Added “${g.title}” to this browser's arcade`, kind: 'success', emoji: '🕹️' });
    title = description = url = html = fileName = '';
    emoji = '🎮';
  }

  async function copyEntry(g: ArcadeGame) {
    const text = JSON.stringify(manifestEntry(g), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({
        message: 'Copied games.json entry',
        detail: g.url ? 'Paste it into public/games/games.json.' : `Paste it into public/games/games.json and save the file as public/games/${g.id}.html.`,
        kind: 'success',
        timeout: 8000,
      });
    } catch {
      prompt('Copy this entry into public/games/games.json', text);
    }
  }

  function download(g: ArcadeGame) {
    if (!g.html) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([g.html], { type: 'text/html' }));
    a.download = `${g.id}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
</script>

<section class="card">
  <h2>Arcade admin</h2>
  <p class="help">
    <strong>For everyone on your site:</strong> put game files in <code>public/games/</code> and list them in <code>public/games/games.json</code>, then redeploy (see
    <code>public/games/README.md</code>).
    <strong>Try one here first:</strong> games you add below live only in this browser. Preview, then copy the entry to publish.
  </p>

  <div class="form">
    <div class="cz-seg seg">
      <button class:on={kind === 'file'} onclick={() => (kind = 'file')}>HTML file</button>
      <button class:on={kind === 'url'} onclick={() => (kind = 'url')}>Embed link</button>
    </div>
    {#if kind === 'file'}
      <label class="file"><input type="file" accept=".html,.htm,text/html" onchange={onFile} /> {fileName || 'Choose a single-file HTML game…'}</label>
    {:else}
      <input class="input" bind:value={url} placeholder="https://… (itch.io embed, Scratch …/embed, your own game)" aria-label="Game link" />
    {/if}
    <div class="grid">
      <input class="input" bind:value={title} placeholder="Title" aria-label="Title" />
      <input class="input em" bind:value={emoji} aria-label="Emoji" maxlength="4" />
      <label>Cost <input class="input num" type="number" min="0" max="99" bind:value={cost} /> 🎟️</label>
      <label>Minutes <input class="input num" type="number" min="0" max="240" bind:value={minutes} /></label>
      <select class="select" bind:value={theme} aria-label="Theme"
        ><option value="">Any theme</option>{#each THEME_PACKS as t (t)}<option value={t}>{t}</option>{/each}</select
      >
    </div>
    <input class="input" bind:value={description} placeholder="One-line description (optional)" aria-label="Description" />
    {#if error}<p class="err">{error}</p>{/if}
    <div class="btns">
      <button
        class="btn"
        onclick={() => {
          const g = build();
          if (g) preview = g;
        }}>Preview</button
      >
      <button class="btn primary" onclick={() => void save()}>Add to this browser</button>
    </div>
  </div>

  {#if arcade.localGames.length}
    <h3>Added in this browser</h3>
    <ul class="list">
      {#each arcade.localGames as g (g.id)}
        <li>
          <span class="grow">{g.emoji} {g.title} <span class="muted">· {g.cost} 🎟️{g.url ? ' · link' : ' · file'}</span></span>
          <button class="btn ghost sm" onclick={() => (preview = g)}>Preview</button>
          <button class="btn ghost sm" onclick={() => void copyEntry(g)}>Copy games.json entry</button>
          {#if g.html}<button class="btn ghost sm" onclick={() => download(g)}>Download .html</button>{/if}
          <button class="btn ghost sm" onclick={() => void arcade.removeLocal(g.id)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  <h3>On this site <span class="muted">({arcade.siteGames.length} from {arcade.manifestUrl()})</span></h3>
  {#if arcade.errors.length}<ul class="err">
      {#each arcade.errors as e, i (i)}<li>{e}</li>{/each}
    </ul>{/if}
  <ul class="list">
    {#each arcade.siteGames as g (g.id)}
      <li>
        <span class="grow">{g.emoji} {g.title} <span class="muted">· {g.cost} 🎟️{g.minutes ? ` · ${g.minutes} min` : ''}</span></span><button
          class="btn ghost sm"
          onclick={() => (preview = g)}>Preview</button
        >
      </li>
    {/each}
  </ul>
  <button class="btn ghost sm" onclick={() => void arcade.load(true)}>Reload games.json</button>
</section>

{#if preview}
  <GamePlayer game={preview} preview onclose={() => (preview = null)} />
{/if}

<style>
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
  }
  h3 {
    font-size: 14px;
    margin: 16px 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .form {
    display: grid;
    gap: 8px;
    margin-top: 8px;
  }
  .seg {
    justify-self: start;
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .grid .input:first-child {
    flex: 1;
    min-width: 180px;
  }
  .em {
    width: 56px;
    text-align: center;
  }
  .num {
    width: 64px;
  }
  .grid label {
    display: flex;
    gap: 4px;
    align-items: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .file {
    font-size: 13px;
    color: var(--text-muted);
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
    margin: 4px 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .list {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .list li {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
</style>
