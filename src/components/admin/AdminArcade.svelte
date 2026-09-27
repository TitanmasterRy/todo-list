<script lang="ts">
  // Admin → Arcade: add and preview games (ArcadeAdmin), then publish them to everyone in one click
  // (commits the HTML file and the games.json entry), or take a game off the site.
  import ArcadeAdmin from '../ArcadeAdmin.svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { manifestEntry } from '../../lib/arcade';
  import { removeFromManifest, upsertManifest } from '../../lib/admin';
  import { adminAuth } from '../../lib/adminAuth.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import type { ArcadeGame } from '../../lib/types';

  const MANIFEST = 'public/games/games.json';
  let busy = $state('');

  async function publish(g: ArcadeGame) {
    busy = g.id;
    try {
      if (g.html) await adminAuth.publish(`public/games/${g.id}.html`, g.html, `Arcade: add ${g.title} (${g.id}.html)`);
      const next = upsertManifest(await adminAuth.read(MANIFEST), manifestEntry(g) as Record<string, unknown> & { id: string });
      const url = await adminAuth.publish(MANIFEST, next, `Arcade: list ${g.title}`);
      toasts.push({ message: `Published “${g.title}”. It shows up for everyone after the redeploy.`, detail: url || undefined, kind: 'success', emoji: '🚀', timeout: 10000 });
    } catch (e) {
      toasts.push({ message: 'Publishing failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      busy = '';
    }
  }

  async function unpublish(g: ArcadeGame) {
    if (!confirm(`Take “${g.title}” off the site? (Its HTML file stays in the repo.)`)) return;
    busy = g.id;
    try {
      const cur = await adminAuth.read(MANIFEST);
      if (!cur) throw new Error(`${MANIFEST} isn't in the repo.`);
      const url = await adminAuth.publish(MANIFEST, removeFromManifest(cur, g.id), `Arcade: remove ${g.title}`);
      toasts.push({ message: `Removed “${g.title}” from the site`, detail: url || undefined, kind: 'success', timeout: 8000 });
    } catch (e) {
      toasts.push({ message: 'Couldn’t remove it', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      busy = '';
    }
  }
</script>

<ArcadeAdmin />

<section class="card">
  <h3>🚀 Publish to everyone</h3>
  {#if !adminAuth.canPublish}
    <p class="muted">Set up publishing in the Site tab first (a GitHub token for this repo). Until then, use “Copy games.json entry” above and commit the files yourself.</p>
  {/if}
  {#if arcade.localGames.length}
    <ul class="list">
      {#each arcade.localGames as g (g.id)}
        <li>
          <span class="grow">{g.emoji} {g.title} <span class="muted">· in this browser</span></span>
          <button class="btn sm primary" onclick={() => void publish(g)} disabled={!adminAuth.canPublish || !!busy}>{busy === g.id ? 'Publishing…' : 'Publish'}</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Games you add above appear here, ready to publish.</p>
  {/if}
  {#if arcade.siteGames.length}
    <h4>On the site now</h4>
    <ul class="list">
      {#each arcade.siteGames as g (g.id)}
        <li>
          <span class="grow">{g.emoji} {g.title} <span class="muted">· {g.cost} 🎟️</span></span>
          <button class="btn ghost sm" onclick={() => void unpublish(g)} disabled={!adminAuth.canPublish || !!busy}>{busy === g.id ? 'Removing…' : 'Take off the site'}</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    margin-top: 12px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  h4 {
    margin: 12px 0 4px;
    font-size: 13px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .grow {
    flex: 1;
  }
</style>
