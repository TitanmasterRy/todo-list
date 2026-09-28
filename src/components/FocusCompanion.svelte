<script lang="ts">
  // Focus-mode companion: naps while the focus timer runs, wakes up and plays on breaks. Loaded lazily by Focus.
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { COMPANIONS, COMPANION_TEXT, companionState, type CompanionId } from '../lib/companion';

  const KEY = 'homework-todo:companion';
  let pick = $state<CompanionId>(
    (() => {
      try {
        const v = localStorage.getItem(KEY) as CompanionId | null;
        return v && (v === 'off' || COMPANIONS.some((c) => c.id === v)) ? v : 'cat';
      } catch {
        return 'cat';
      }
    })(),
  );
  let choosing = $state(false);
  const mood = $derived(companionState(pomodoro.mode, pomodoro.running));
  const who = $derived(COMPANIONS.find((c) => c.id === pick));

  function choose(id: CompanionId) {
    pick = id;
    choosing = false;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }
</script>

<div class="companion" data-companion-state={pick === 'off' ? 'off' : mood}>
  {#if who}
    <div class="pal {mood}" role="img" aria-label="{who.name} {COMPANION_TEXT[mood]}">
      {#if who.id === 'cat'}
        <svg viewBox="0 0 120 80" width="96" height="64" aria-hidden="true">
          {#if mood === 'sleeping'}
            <!-- curled up -->
            <ellipse cx="60" cy="58" rx="40" ry="18" class="fur" />
            <path d="M22 60 q-10 -14 8 -20" class="fur-line" />
            <circle cx="88" cy="48" r="15" class="fur" />
            <path d="M78 38 l2 -12 l8 9 M92 35 l8 -9 l2 12" class="fur" />
            <path d="M82 49 q3 3 6 0 M92 49 q3 3 6 0" class="eye-line" />
            <text x="96" y="22" class="z">z</text><text x="106" y="12" class="z small">z</text>
          {:else}
            <!-- sitting up -->
            <ellipse cx="60" cy="62" rx="24" ry="16" class="fur" />
            <circle cx="60" cy="36" r="17" class="fur" />
            <path d="M46 26 l2 -14 l10 9 M64 21 l10 -9 l2 14" class="fur" />
            <circle cx="54" cy="36" r="3" class="eye" /><circle cx="66" cy="36" r="3" class="eye" />
            <path d="M57 43 q3 3 6 0" class="eye-line" />
            <path class="tail" d="M84 66 q18 -4 14 -24" />
          {/if}
        </svg>
      {:else}
        <span class="emoji" aria-hidden="true">{who.emoji}</span>{#if mood === 'sleeping'}<span class="zz" aria-hidden="true">💤</span>{/if}
      {/if}
    </div>
    <p class="txt">{who.name} {COMPANION_TEXT[mood]}</p>
  {/if}
  <button class="btn ghost sm" onclick={() => (choosing = !choosing)} aria-expanded={choosing}>{pick === 'off' ? 'Add a companion' : 'Change'}</button>
  {#if choosing}
    <div class="pick" role="group" aria-label="Pick a focus companion">
      {#each COMPANIONS as c (c.id)}
        <button class="btn sm" class:primary={pick === c.id} aria-pressed={pick === c.id} onclick={() => choose(c.id)}>{c.emoji} {c.name}</button>
      {/each}
      <button class="btn sm ghost" aria-pressed={pick === 'off'} onclick={() => choose('off')}>None</button>
    </div>
  {/if}
</div>

<style>
  .companion {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin: 10px 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .pal {
    display: grid;
    place-items: center;
    position: relative;
    min-width: 64px;
    padding: 6px 10px;
    border-radius: var(--radius);
    background: radial-gradient(circle at 50% 60%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%);
    transition: transform var(--dur-slow) var(--spring);
  }
  .pal:hover {
    transform: scale(1.06);
  }
  .companion .btn.primary {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      var(--glow);
  }
  .fur {
    fill: #f6b26b;
    stroke: rgba(0, 0, 0, 0.3);
    stroke-width: 1.5;
  }
  .fur-line,
  .tail {
    fill: none;
    stroke: #e69138;
    stroke-width: 6;
    stroke-linecap: round;
  }
  .eye {
    fill: #2b2b2b;
  }
  .eye-line {
    fill: none;
    stroke: #2b2b2b;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .z {
    fill: var(--text-muted);
    font-size: 14px;
    font-weight: 700;
    animation: float 2.4s ease-in-out infinite;
  }
  .z.small {
    font-size: 10px;
    animation-delay: 0.6s;
  }
  .sleeping svg {
    animation: breathe 3.2s ease-in-out infinite;
    transform-origin: center bottom;
  }
  .playing .tail {
    animation: wag 0.8s ease-in-out infinite alternate;
    transform-origin: 84px 66px;
  }
  .emoji {
    font-size: 40px;
    line-height: 1;
    filter: drop-shadow(0 6px 12px color-mix(in srgb, var(--accent) 40%, transparent));
  }
  .sleeping .emoji {
    filter: saturate(0.6);
    transform: rotate(-12deg);
  }
  .playing .emoji {
    animation: hop 0.9s ease-in-out infinite;
  }
  .zz {
    position: absolute;
    top: -8px;
    inset-inline-end: -10px;
    font-size: 18px;
  }
  .txt {
    margin: 0;
  }
  .pick {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    width: 100%;
    animation: rise-in var(--dur-slow) var(--ease) backwards;
  }
  @keyframes float {
    50% {
      transform: translateY(-4px);
      opacity: 0.6;
    }
  }
  @keyframes breathe {
    50% {
      transform: scale(1.03, 0.97);
    }
  }
  @keyframes wag {
    to {
      transform: rotate(14deg);
    }
  }
  @keyframes hop {
    50% {
      transform: translateY(-6px);
    }
  }
</style>
