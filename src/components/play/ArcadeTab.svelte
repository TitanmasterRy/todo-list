<script lang="ts">
  import { onMount } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { ui } from '../../lib/ui.svelte';
  import type { ArcadeGame } from '../../lib/types';
  import GamePlayer from './GamePlayer.svelte';

  let playing = $state<ArcadeGame | null>(null);
  let adding = $state(false);
  const loadAddGame = () => import('./AddGame.svelte');

  async function remove(g: ArcadeGame) {
    if (!confirm(`Remove “${g.title}” from your arcade?`)) return;
    await arcade.removeLocal(g.id);
  }
  onMount(() => void arcade.load());

  const list = $derived.by(() => {
    const pack = store.settings.themePack;
    const g = [...arcade.games];
    // games matching the current theme pack first
    return g.sort((a, b) => Number(b.theme === pack) - Number(a.theme === pack));
  });

  function play(g: ArcadeGame) {
    if (g.cost > 0 && !economy.spendVouchers(g.id, g.cost)) {
      toasts.push({ message: `Needs ${g.cost} voucher${g.cost > 1 ? 's' : ''}`, detail: 'Buy vouchers in the Shop with coins.', kind: 'warn', emoji: '🎟️' });
      return;
    }
    playing = g;
  }
  function extend(): boolean {
    if (!playing) return false;
    if (playing.cost > 0 && !economy.spendVouchers(playing.id, playing.cost)) {
      toasts.push({ message: 'Out of vouchers', kind: 'warn', emoji: '🎟️' });
      return false;
    }
    return true;
  }
</script>

<div class="bar">
  <span class="muted">Games you add live in this browser.</span>
  <button class="btn sm" onclick={() => (adding = true)}>➕ Add a game</button>
</div>
{#if adding}
  {#await loadAddGame() then m}<m.default onclose={() => (adding = false)} />{/await}
{/if}

{#if arcade.loading && !arcade.loaded}
  <p class="muted">Loading games…</p>
{:else if !list.length}
  <div class="card">
    <p>No arcade games yet.</p>
    <p class="muted">Add one with ➕ Add a game (an HTML or JavaScript file, a .zip, or a link).</p>
  </div>
{:else}
  <div class="games stagger">
    {#each list as g, i (g.id + (g.local ? ':l' : ''))}
      <div class="card game lift" class:match={g.theme === store.settings.themePack} style="--hue:{(i * 47 + 200) % 360}">
        <div class="e">{g.emoji ?? '🎮'}</div>
        <div class="info">
          <div class="n">
            {g.title}{#if g.local}<span class="chip">local</span>{/if}
          </div>
          {#if g.description}<div class="d">{g.description}</div>{/if}
          <div class="meta">
            {g.cost ? `${g.cost} 🎟️` : 'Free'}{g.minutes ? ` · ${g.minutes} min` : ''}{g.theme ? ` · ${g.theme}` : ''}{arcade.scores[g.id]
              ? ` · 🏆 ${arcade.scores[g.id].toLocaleString()}`
              : ''}
          </div>
        </div>
        {#if g.local}<button class="btn ghost sm icon" aria-label="Remove {g.title}" title="Remove" onclick={() => void remove(g)}>🗑️</button>{/if}
        <button class="btn primary sm" onclick={() => play(g)} disabled={g.cost > economy.wallet.vouchers}>Play</button>
      </div>
    {/each}
  </div>
{/if}
{#if arcade.errors.length && ui.adminUnlocked}
  <div class="card errs">
    <strong>games.json problems</strong>
    <ul>
      {#each arcade.errors as e, i (i)}<li>{e}</li>{/each}
    </ul>
  </div>
{/if}
<p class="muted">Vouchers: {economy.wallet.vouchers}. Buy more in the Shop. Games run in a sandbox and can't see your tasks or data.</p>

{#if playing}
  <GamePlayer game={playing} onclose={() => (playing = null)} onextend={extend} />
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .games {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }
  .game {
    position: relative;
    display: grid;
    grid-template-columns: 52px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    overflow: hidden;
    background: radial-gradient(60% 100% at 0% 50%, hsl(var(--hue) 90% 60% / 0.18), transparent 70%), var(--bg-elev);
  }
  .game.match {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .game.match::after {
    content: '✦ matches your theme';
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-text);
    letter-spacing: 0.04em;
  }
  .e {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    font-size: 30px;
    border-radius: 14px;
    background: linear-gradient(135deg, hsl(var(--hue) 80% 60% / 0.35), hsl(calc(var(--hue) + 40) 80% 60% / 0.2));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
    filter: drop-shadow(0 4px 8px hsl(var(--hue) 90% 50% / 0.4));
    transition: transform var(--dur-slow) var(--spring);
  }
  .game:hover .e {
    transform: scale(1.12) rotate(-6deg);
  }
  .n {
    font-weight: 800;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .d,
  .meta {
    font-size: 12px;
    color: var(--text-muted);
  }
  .errs {
    margin-top: 10px;
    font-size: 13px;
    color: var(--danger-text);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 12px;
  }
</style>
