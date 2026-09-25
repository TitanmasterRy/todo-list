<script lang="ts">
  import { onMount } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import type { ArcadeGame } from '../../lib/types';
  import GamePlayer from './GamePlayer.svelte';

  let playing = $state<ArcadeGame | null>(null);
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

{#if arcade.loading && !arcade.loaded}
  <p class="muted">Loading games…</p>
{:else if !list.length}
  <div class="card">
    <p>No arcade games yet.</p>
    <p class="muted">Site admins add games by putting HTML files in <code>public/games/</code> and listing them in <code>games.json</code>, or from Settings → Arcade admin.</p>
  </div>
{:else}
  <div class="games">
    {#each list as g (g.id + (g.local ? ':l' : ''))}
      <div class="card game" class:match={g.theme === store.settings.themePack}>
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
        <button class="btn primary sm" onclick={() => play(g)} disabled={g.cost > economy.wallet.vouchers}>Play</button>
      </div>
    {/each}
  </div>
{/if}
{#if arcade.errors.length && store.settings.arcadeAdmin}
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
  .games {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px;
  }
  .game {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
  }
  .game.match {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .e {
    font-size: 30px;
    text-align: center;
  }
  .n {
    font-weight: 700;
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
    color: var(--danger);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 12px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
  }
</style>
