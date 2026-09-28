<script lang="ts">
  // Orebelt: a factory-building idle game in Play. Mine ore, belt it through smelters and assemblers, keep the power
  // grid up, and deliver parts to the Launch Tower. Homework powers it: tasks give overclock shards, insight and boosts.
  import { onMount } from 'svelte';
  import { PHASES, type ItemId } from '../../../lib/factory/data';
  import { economy } from '../../../lib/economy.svelte';
  import FactoryIcon from './FactoryIcon.svelte';
  import FactoryMap from './FactoryMap.svelte';
  import FactoryStats from './FactoryStats.svelte';
  import FactoryTech from './FactoryTech.svelte';
  import FactoryMarket from './FactoryMarket.svelte';
  import { FactoryCtl, fmt, fmtRate, fmtTime, itemName, motionOk } from './controller.svelte';

  const ctl = new FactoryCtl();
  const TABS = [
    { id: 'map', name: 'Factory', icon: 'M2 13h12M4 13V7l3-3 3 3v6M10 7l2-2 2 2v6' },
    { id: 'stats', name: 'Production', icon: 'M2 13l4-5 3 3 5-7M2 14h12' },
    { id: 'tech', name: 'Milestones', icon: 'M8 1c2 2 3 5 2 8H6C5 6 6 3 8 1zM6 9l-2 3h2zM10 9l2 3h-2zM7 12h2v3H7z' },
    { id: 'trade', name: 'Supply & market', icon: 'M2 5h12l-1 8H3zM6 5V3h4v2' },
  ] as const;

  onMount(() => {
    const timer = setInterval(() => ctl.pump(), 1000);
    const onVis = () => {
      if (document.visibilityState === 'hidden') ctl.save();
      else {
        ctl.pump();
        ctl.collectRewards();
      }
    };
    const onHide = () => ctl.save();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      ctl.save();
    };
  });

  const hud = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const p = ctl.report?.power;
    return {
      cap: p?.capacity ?? 20,
      demand: p?.demand ?? 0,
      factor: p?.factor ?? 1,
      tier: Math.min(s.phase, PHASES.length - 1),
      launched: s.phase >= PHASES.length,
      shards: s.shards,
      insight: s.insight,
      boost: s.boostLeft,
      rush: s.rushLeft,
      extra: s.extraOffline,
    };
  });

  const awayItems = $derived(ctl.away ? (Object.entries(ctl.away.gained) as [ItemId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 10) : []);
</script>

<section class="factory" aria-label="Orebelt factory game">
  <header class="fhead">
    <div class="brand">
      <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" rx="8" fill="#1b1f24" stroke="#e0701a" stroke-width="2" />
        <path d="M7 29h26" stroke="#5b6470" stroke-width="5" stroke-linecap="round" />
        <path d="M9 29h2M15 29h2M21 29h2M27 29h2" stroke="#f2b632" stroke-width="2" />
        <path d="M11 22l3-8 7-3 6 4-1 7z" fill="#c77a4a" stroke="#0e1013" stroke-width="1.2" />
        <path d="M15 15l5-2 1 4-5 1z" fill="#fff" opacity=".25" />
        <circle cx="31" cy="11" r="3" fill="#14a3b1" />
      </svg>
      <div>
        <h2>Orebelt</h2>
        <p>Build a factory. Your homework powers it.</p>
      </div>
    </div>
    <div class="hud" aria-label="Factory status">
      <div class="h" class:bad={hud.factor < 0.999} class:pulse={hud.factor < 0.999 && motionOk()} title="Power in use / capacity">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9 1 3 9h4l-1 6 6-8H8z" fill="currentColor" /></svg>
        <span><strong>{fmtRate(Math.min(hud.demand, hud.cap))}</strong>/{fmtRate(hud.cap)} MW</span>
        <span class="meter"><span style="width: {Math.min(100, (hud.demand / Math.max(1, hud.cap)) * 100)}%"></span></span>
      </div>
      <div class="h" title="Launch Tower tier">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
          ><path d="M8 1c2 2 3 5 2 8H6C5 6 6 3 8 1zM6 9l-2 3h2zM10 9l2 3h-2zM7 12h2v3H7z" fill="currentColor" /></svg
        >
        <span>{hud.launched ? 'Launched' : `Tier ${hud.tier}`}</span>
      </div>
      <div class="h" title="Free overclock shards" data-shards>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1l4 5-4 9-4-9z" fill="#b15fd6" stroke="currentColor" stroke-width=".8" /></svg>
        <span><strong>{hud.shards}</strong> shard{hud.shards === 1 ? '' : 's'}</span>
      </div>
      <div class="h" title="Insight for research">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
          ><circle cx="8" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M6 13h4M7 15h2" stroke="currentColor" stroke-width="1.4" /></svg
        >
        <span><strong>{hud.insight}</strong> insight</span>
      </div>
      {#if hud.boost > 0}
        <div class="h boost" title="Homework boost: machines run faster"><span>⚡ Boost ×1.25 · {fmtTime(hud.boost)}</span></div>
      {/if}
      {#if hud.rush > 0}
        <div class="h boost" title="Rush order: machines run faster"><span>📦 Rush ×1.5 · {fmtTime(hud.rush)}</span></div>
      {/if}
      {#if hud.extra > 0}
        <div class="h" title="Offline cap raised for your next long absence"><span>🌙 Night shift booked</span></div>
      {/if}
    </div>
  </header>
  <div class="hazard" aria-hidden="true"></div>

  {#if ctl.away}
    <div class="away" role="status" data-away>
      <div>
        <strong>While you were away</strong> ({fmtTime(ctl.away.seconds)}{ctl.away.seconds >= 8 * 3600 ? ', the most offline time counted' : ''}) your factory stocked:
        <ul>
          {#each awayItems as [k, n] (k)}
            <li><FactoryIcon item={k} size={16} /> {fmt(n)} {itemName(k)}</li>
          {/each}
        </ul>
      </div>
      <button class="btn" onclick={() => (ctl.away = null)}>Nice</button>
    </div>
  {/if}

  <div class="subtabs" role="tablist" aria-label="Factory sections">
    {#each TABS as tb (tb.id)}
      {#if tb.id !== 'trade' || economy.enabled}
        <button role="tab" aria-selected={ctl.tab === tb.id} class:on={ctl.tab === tb.id} onclick={() => ctl.pickTab(tb.id)}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
            ><path d={tb.icon} fill={tb.id === 'tech' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg
          >
          {tb.name}
        </button>
      {/if}
    {/each}
  </div>

  <div class="msg" class:bad={ctl.message?.bad} aria-live="polite" data-msg>{ctl.message?.text ?? ''}</div>

  {#if ctl.tab === 'map'}
    <FactoryMap {ctl} />
  {:else if ctl.tab === 'stats'}
    <FactoryStats {ctl} />
  {:else if ctl.tab === 'tech'}
    <FactoryTech {ctl} />
  {:else}
    <FactoryMarket {ctl} />
  {/if}
</section>

<style>
  .factory {
    --f-bg: #15181c;
    --f-panel: #1f242a;
    --f-panel2: #283038;
    --f-line: #39424c;
    --f-text: #e8ebef;
    --f-muted: #a3acb6;
    --f-orange: #e0701a;
    --f-teal: #14a3b1;
    --f-yellow: #f2b632;
    background: var(--f-bg);
    color: var(--f-text);
    border-radius: 14px;
    padding: 12px;
    border: 1px solid #2b3137;
    color-scheme: dark;
  }
  @media (max-width: 480px) {
    .factory {
      padding: 8px;
      margin: 0 -4px;
    }
  }
  .fhead {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }
  .brand {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 20px;
    letter-spacing: 0.02em;
  }
  .brand p {
    margin: 0;
    font-size: 12px;
    color: var(--f-muted);
  }
  .hud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .h {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(180deg, #2b323a, var(--f-panel));
    border: 1px solid var(--f-line);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 1px 2px rgba(0, 0, 0, 0.35);
  }
  .h svg {
    color: var(--f-yellow);
    filter: drop-shadow(0 0 2px rgba(242, 182, 50, 0.35));
  }
  .h.bad {
    border-color: #e5484d;
    color: #ffb4ae;
    background: linear-gradient(180deg, #4a2326, #31191b);
  }
  .h.bad svg {
    color: #ff9b8f;
  }
  .h.pulse {
    animation: ob-pulse 1.2s ease-in-out infinite;
  }
  @keyframes ob-pulse {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 0 0 0 rgba(229, 72, 77, 0.5);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        0 0 0 5px rgba(229, 72, 77, 0);
    }
  }
  .h.boost {
    border-color: var(--f-teal);
    color: #8fe7ef;
    background: linear-gradient(180deg, #1c3f45, #14313a);
  }
  .meter {
    width: 44px;
    height: 6px;
    border-radius: 3px;
    background: var(--f-panel2);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--f-orange);
  }
  .hazard {
    height: 6px;
    margin: 10px -12px 10px;
    background: repeating-linear-gradient(-45deg, var(--f-yellow) 0 10px, #1b1f24 10px 20px);
    opacity: 0.85;
  }
  .away {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
    background: #16343a;
    border: 1px solid var(--f-teal);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: 13px;
  }
  .away ul {
    list-style: none;
    padding: 0;
    margin: 6px 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .away li {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }
  .btn {
    font-size: 13px;
    font-weight: 700;
    padding: 7px 14px;
    min-height: 36px;
    border-radius: 8px;
    background: var(--f-teal);
    color: #0e1013;
  }
  .subtabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    margin-bottom: 8px;
    padding: 4px;
    border-radius: 10px;
    background: #121518;
    border: 1px solid #23282e;
  }
  .subtabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 7px;
    color: var(--f-muted);
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .subtabs button.on {
    color: var(--f-text);
    background: linear-gradient(180deg, #2e3740, var(--f-panel));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      inset 0 -2px 0 var(--f-orange);
  }
  .subtabs button.on svg {
    color: var(--f-orange);
  }
  .msg {
    min-height: 18px;
    font-size: 12.5px;
    color: #8fe7ef;
    margin-bottom: 4px;
  }
  .msg.bad {
    color: #ffb4ae;
  }
</style>
