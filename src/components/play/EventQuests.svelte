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
  <section class="card ev" class:alldone={quests.length > 0 && quests.every((q) => q.claimed)} aria-label="{event.season.name} event quests">
    <div class="head">
      <strong>{event.season.emoji} {event.season.name} quests</strong>
      <span class="muted">{event.season.blurb} {quests.filter((q) => q.claimed).length}/{quests.length} claimed</span>
    </div>
    <ul>
      {#each quests as q (q.id)}
        <li class:done={q.claimed} class:ready={q.done && !q.claimed}>
          <span class="e" aria-hidden="true">{q.emoji}</span>
          <span class="l">
            <span>{q.label}</span>
            <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={q.goal} aria-valuenow={q.progress} aria-label="{q.label} progress"
              ><span class="fill" style="width:{(q.progress / q.goal) * 100}%"></span></span
            >
          </span>
          {#if q.claimed}
            <span class="got"><span class="burst" aria-hidden="true"></span>✓ {q.reward} 🪙</span>
          {:else if q.done}
            <button class="btn primary sm claim" onclick={() => claim(q)}>Claim {q.reward} 🪙</button>
          {:else}
            <span class="muted count"
              >{#key q.progress}<span class="bump">{q.progress}</span>{/key}/{q.goal} · {q.reward} 🪙</span
            >
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .ev {
    position: relative;
    margin: 10px 0 14px;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--season, var(--warn)) 55%, var(--border));
    background: radial-gradient(70% 100% at 100% 0%, color-mix(in srgb, var(--season-2, var(--season, var(--warn))) 14%, transparent), transparent 60%), var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 30px -12px color-mix(in srgb, var(--season, var(--warn)) 60%, transparent);
  }
  .ev.alldone {
    border-color: transparent;
    background:
      linear-gradient(var(--bg-elev), var(--bg-elev)) padding-box,
      var(--grad-gold) border-box;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 34px -10px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .ev.alldone::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.12) 50%, transparent 60%);
    transform: translateX(-130%);
    animation: sheen 3s var(--ease) 800ms infinite;
  }
  .head {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: baseline;
  }
  .head strong {
    font-size: 15px;
  }
  .alldone .head strong {
    background: var(--grad-gold);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
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
    grid-template-columns: 32px 1fr auto;
    gap: 10px;
    align-items: center;
    font-size: 14px;
    padding: 4px 6px;
    margin: 0 -6px;
    border-radius: var(--radius-sm);
    transition: background var(--dur);
  }
  li:hover {
    background: color-mix(in srgb, var(--season, var(--accent)) 8%, transparent);
  }
  li.ready {
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  li.done .l {
    opacity: 0.7;
  }
  .e {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    font-size: 19px;
    background: color-mix(in srgb, var(--season, var(--warn)) 16%, transparent);
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
    transition: transform var(--dur-slow) var(--spring);
  }
  li:hover .e {
    transform: scale(1.15) rotate(-8deg);
  }
  li.ready .e {
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    animation: wiggle 1.6s ease-in-out infinite;
  }
  .l {
    display: grid;
    gap: 5px;
  }
  .bar {
    position: relative;
    height: 7px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
    overflow: hidden;
  }
  .fill {
    position: relative;
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--season, var(--accent)), var(--season-2, var(--accent-2)));
    box-shadow: 0 0 10px color-mix(in srgb, var(--season, var(--accent)) 50%, transparent);
    transition: width var(--dur-slow) var(--spring);
    overflow: hidden;
  }
  .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 2.2s linear infinite;
  }
  li.done .fill {
    background: linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 60%, var(--accent-2)));
    box-shadow: 0 0 10px color-mix(in srgb, var(--success) 50%, transparent);
  }
  li.ready .fill {
    background: var(--grad-gold);
    box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .claim {
    background: var(--grad-gold);
    color: #3a2a00;
    border-color: transparent;
    font-variant-numeric: tabular-nums;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.45),
      0 6px 18px -6px color-mix(in srgb, var(--gold) 80%, transparent);
    animation: gold-pulse 1.8s ease-in-out infinite;
  }
  .claim:hover {
    background: var(--grad-gold);
    filter: brightness(1.06) saturate(1.1);
  }
  @keyframes gold-pulse {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        0 6px 18px -6px color-mix(in srgb, var(--gold) 80%, transparent),
        0 0 0 0 color-mix(in srgb, var(--gold) 50%, transparent);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        0 6px 18px -6px color-mix(in srgb, var(--gold) 80%, transparent),
        0 0 0 8px color-mix(in srgb, var(--gold) 0%, transparent);
    }
  }
  .got {
    position: relative;
    color: var(--success-text);
    font-weight: 700;
    font-size: 13px;
    padding: 3px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--success) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
    font-variant-numeric: tabular-nums;
    animation: pop-in var(--dur-slow) var(--spring) backwards;
  }
  .burst {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    pointer-events: none;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 60%, transparent);
    animation: burst 700ms var(--ease) backwards;
  }
  @keyframes burst {
    to {
      box-shadow: 0 0 0 14px color-mix(in srgb, var(--success) 0%, transparent);
    }
  }
</style>
