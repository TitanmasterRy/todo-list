<script lang="ts">
  // The seasonal event's quest set: three goals counted over the whole event, paid in coins once each.
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { activeSeason } from '../../lib/seasons';
  import { EVENT_QUESTS, eventQuestRef } from '../../lib/eventquests';
  import { playSound } from '../../lib/sounds';
  import { toasts } from '../../lib/toast.svelte';

  const event = $derived(activeSeason(store.today));
  const quests = $derived.by(() => {
    if (!event) return [];
    const ctx = { tasks: store.tasks, stats: store.stats, window: event.window };
    return EVENT_QUESTS[event.season.id].map((q) => {
      const ref = eventQuestRef(event.season.id, event.window, q.id);
      const progress = Math.min(q.goal, q.progress(ctx));
      return { ...q, ref, progress, done: progress >= q.goal, claimed: economy.hasEntry('quest', ref) };
    });
  });

  function claim(q: (typeof quests)[number]) {
    if (!q.done || q.claimed) return;
    economy.earn(q.reward, 'quest', q.ref);
    playSound('pop');
    toasts.push({ message: `Event quest done: ${q.label}`, detail: `+${q.reward} coins`, kind: 'success', emoji: q.emoji });
  }
</script>

{#if event}
  <section class="card ev" aria-label="{event.season.name} event quests">
    <div class="head">
      <strong>{event.season.emoji} {event.season.name} quests</strong>
      <span class="muted">{event.season.blurb} {quests.filter((q) => q.claimed).length}/{quests.length} claimed</span>
    </div>
    <ul>
      {#each quests as q (q.id)}
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
            <button class="btn primary sm" onclick={() => claim(q)}>Claim {q.reward} 🪙</button>
          {:else}
            <span class="muted">{q.progress}/{q.goal} · {q.reward} 🪙</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .ev {
    margin: 10px 0 14px;
    border-color: color-mix(in srgb, var(--season, var(--warn)) 55%, var(--border));
  }
  .head {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: baseline;
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
    grid-template-columns: 28px 1fr auto;
    gap: 10px;
    align-items: center;
    font-size: 14px;
  }
  li.done .l {
    opacity: 0.7;
  }
  .e {
    font-size: 20px;
    text-align: center;
  }
  .l {
    display: grid;
    gap: 4px;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--season, var(--accent));
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .got {
    color: var(--success-text);
    font-weight: 700;
    font-size: 13px;
  }
</style>
