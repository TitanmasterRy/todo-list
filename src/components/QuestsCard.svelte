<script lang="ts">
  // Today's three daily quests with progress and a Claim button.
  import { economy } from '../lib/economy.svelte';
  import { store } from '../lib/store.svelte';
  import { ALL_DONE_BONUS } from '../lib/quests';
  import { hasKey, locale, t } from '../lib/i18n/index.svelte';

  interface Props {
    compact?: boolean;
  }
  let { compact = false }: Props = $props();
  const label = (q: { id: string; label: string }) => {
    const key = `quest.${q.id}`;
    return locale() !== 'en' && hasKey(key) ? t(key) : q.label;
  };
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
  <section class="card quests" class:compact class:alldone={economy.allQuestsClaimed} class:claimable={claimable > 0} aria-label={t('quest.title')}>
    <button class="head" onclick={toggle} aria-expanded={open}>
      <span class="t">🗺️ {t('quest.title')}</span>
      <span class="muted"
        >{economy.quests.filter((q) => q.claimed).length}/{economy.quests.length}{claimable ? ` · ${t('quest.toClaim', { n: claimable })}` : ''}{economy.allQuestsClaimed
          ? ` · ${t('quest.allDone')}`
          : ''}</span
      >
      <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
    {#if open}
      <ul>
        {#each economy.quests as q (q.id)}
          <li class:done={q.claimed} class:ready={q.done && !q.claimed}>
            <span class="e" aria-hidden="true">{q.emoji}</span>
            <span class="l">
              <span>{label(q)}</span>
              <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={q.goal} aria-valuenow={q.progress} aria-label={t('quest.progress', { label: label(q) })}
                ><span class="fill" style="width:{(q.progress / q.goal) * 100}%"></span></span
              >
            </span>
            {#if q.claimed}
              <span class="got"><span class="burst" aria-hidden="true"></span>✓ {q.reward} 🪙</span>
            {:else if q.done}
              <button class="btn primary sm claim" onclick={() => economy.claimQuest(q)}>{t('quest.claim', { n: q.reward })} 🪙</button>
            {:else}
              <span class="muted count"
                >{#key q.progress}<span class="bump">{q.progress}</span>{/key}/{q.goal} · {q.reward} 🪙</span
              >
            {/if}
          </li>
        {/each}
      </ul>
      {#if !economy.allQuestsClaimed}<p class="muted foot">{t('quest.foot', { n: ALL_DONE_BONUS })}</p>{/if}
    {/if}
  </section>
{/if}

<style>
  .quests {
    position: relative;
    margin-bottom: 14px;
    padding: 10px 14px;
    overflow: hidden;
    transition:
      border-color var(--dur-slow),
      box-shadow var(--dur-slow);
  }
  .quests.claimable {
    border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 26px -10px color-mix(in srgb, var(--gold) 55%, transparent);
  }
  /* every quest claimed: a gold edge, a warm glow pool and a slow passing shimmer */
  .quests.alldone {
    border-color: transparent;
    background:
      linear-gradient(var(--bg-elev), var(--bg-elev)) padding-box,
      var(--grad-gold) border-box;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 34px -10px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .quests.alldone::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(70% 100% at 0% 0%, color-mix(in srgb, var(--gold) 16%, transparent), transparent 60%);
  }
  .quests.alldone::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.12) 50%, transparent 60%);
    transform: translateX(-130%);
    animation: sheen 3s var(--ease) 800ms infinite;
  }
  .quests > * {
    position: relative;
    z-index: 1;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    background: none;
    padding: 0;
    text-align: start;
  }
  .t {
    font-weight: 800;
  }
  .alldone .t {
    background: var(--grad-gold);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .head .muted {
    flex: 1;
  }
  .chev {
    color: var(--text-muted);
    transition: transform var(--dur) var(--spring);
  }
  .head:hover .chev {
    transform: scale(1.3);
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
    padding: 4px 6px;
    margin: 0 -6px;
    border-radius: var(--radius-sm);
    transition: background var(--dur);
  }
  li:hover {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }
  li.ready {
    background: color-mix(in srgb, var(--gold) 8%, transparent);
  }
  .e {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 16px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
    transition: transform var(--dur-slow) var(--spring);
  }
  li:hover .e {
    transform: scale(1.15) rotate(-8deg);
  }
  li.done .e {
    background: color-mix(in srgb, var(--success) 14%, transparent);
  }
  li.ready .e {
    background: color-mix(in srgb, var(--gold) 22%, transparent);
    animation: wiggle 1.6s ease-in-out infinite;
  }
  li.done .l > span:first-child {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .l {
    display: grid;
    gap: 5px;
  }
  /* progress: gradient fill with a moving shimmer stripe */
  .bar {
    position: relative;
    height: 6px;
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
    background: var(--grad-accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 50%, transparent);
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
    font-size: 12px;
    color: var(--text-muted);
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  /* a claimable reward: gold-glowing Claim button */
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
  /* claimed: a tick pill with a burst ring that expands once */
  .got {
    position: relative;
    font-size: 12px;
    color: var(--success-text);
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--success) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
    font-variant-numeric: tabular-nums;
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .burst {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    pointer-events: none;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 60%, transparent);
    animation: burst 700ms var(--ease) both;
  }
  @keyframes burst {
    to {
      box-shadow: 0 0 0 14px color-mix(in srgb, var(--success) 0%, transparent);
    }
  }
  .foot {
    margin: 8px 0 0;
  }
  .compact li {
    padding: 2px 6px;
  }
</style>
