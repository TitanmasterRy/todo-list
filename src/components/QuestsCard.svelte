<script lang="ts">
  // Today's three daily quests with progress and a Claim button.
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
  import { ALL_DONE_BONUS } from '../lib/quests';

  interface Props {
    compact?: boolean;
  }
  let { compact = false }: Props = $props();
  const claimable = $derived(economy.quests.filter((q) => q.done && !q.claimed).length);
  const KEY = 'homework-todo:quests-open';
  let open = $state(
    (() => {
      try {
        return localStorage.getItem(KEY) !== '0';
      } catch {
        return true;
      }
    })(),
  );
  function toggle() {
    open = !open;
    try {
      localStorage.setItem(KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
</script>

{#if store.settings.economyEnabled && economy.quests.length}
  <section class="card quests" class:compact aria-label="Daily quests">
    <button class="head" onclick={toggle} aria-expanded={open}>
      <span class="t">🗺️ Daily quests</span>
      <span class="muted"
        >{economy.quests.filter((q) => q.claimed).length}/{economy.quests.length}{claimable ? ` · ${claimable} to claim` : ''}{economy.allQuestsClaimed ? ' · all done!' : ''}</span
      >
      <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
    {#if open}
      <ul>
        {#each economy.quests as q (q.id)}
          <li class:done={q.claimed}>
            <span class="e" aria-hidden="true">{q.emoji}</span>
            <span class="l">
              <span>{q.label}</span>
              <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={q.goal} aria-valuenow={q.progress} aria-label="{q.label} progress"
                ><span class="fill" style="width:{(q.progress / q.goal) * 100}%"></span></span
              >
            </span>
            {#if q.claimed}
              <span class="got">✓ {q.reward} 🪙</span>
            {:else if q.done}
              <button class="btn primary sm" onclick={() => economy.claimQuest(q)}>Claim {q.reward} 🪙</button>
            {:else}
              <span class="muted">{q.progress}/{q.goal} · {q.reward} 🪙</span>
            {/if}
          </li>
        {/each}
      </ul>
      {#if !economy.allQuestsClaimed}<p class="muted foot">Finish all three for a {ALL_DONE_BONUS}-coin bonus. New quests tomorrow.</p>{/if}
    {/if}
  </section>
{/if}

<style>
  .quests {
    margin-bottom: 14px;
    padding: 10px 14px;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    background: none;
    padding: 0;
    text-align: left;
  }
  .t {
    font-weight: 700;
  }
  .head .muted {
    flex: 1;
  }
  ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: 10px;
    align-items: center;
    font-size: 14px;
  }
  li.done .l > span:first-child {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .l {
    display: grid;
    gap: 4px;
  }
  .bar {
    height: 5px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width var(--dur);
  }
  .muted {
    font-size: 12px;
    color: var(--text-muted);
  }
  .got {
    font-size: 12px;
    color: var(--success-text);
    font-weight: 700;
  }
  .foot {
    margin: 8px 0 0;
  }
</style>
