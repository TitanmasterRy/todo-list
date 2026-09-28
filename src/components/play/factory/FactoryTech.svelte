<script lang="ts">
  // Orebelt progression: the Launch Tower (deliver parts to reach the next tier, with a launch show when a phase
  // completes), milestones and research.
  import { BELTS, BUILDING, MILESTONES, PHASES, RECIPE, RESEARCH, RESOURCE_NAME, type Inv, type ItemId, type Milestone } from '../../../lib/factory/data';
  import { canMilestone, canResearch, completeMilestone, deliverPhase, doResearch } from '../../../lib/factory/actions';
  import { toasts } from '../../../lib/toast.svelte';
  import Burst from './Burst.svelte';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, itemName, motionOk, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  /** The launch show: set when a phase completes, cleared when it has played out. */
  let show = $state<{ n: number; name: string; final: boolean; tier: number } | null>(null);
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let towerBurst = $state(0);
  let msBurst = $state<{ id: string; n: number }>({ id: '', n: 0 });
  const STARS = Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 70, d: (i % 5) * 0.4, s: 1 + (i % 3) }));

  const v = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const phase = PHASES[s.phase];
    return {
      phaseIdx: s.phase,
      phase,
      need: phase ? (Object.entries(phase.cost) as [ItemId, number][]).map(([k, n]) => ({ item: k, need: n, done: s.delivered[k] ?? 0, have: s.inv[k] ?? 0 })) : [],
      tiers: Array.from({ length: PHASES.length }, (_, tier) => ({
        tier,
        open: tier <= s.phase,
        items: MILESTONES.filter((m) => m.tier === tier).map((m) => ({ m, done: s.milestones.includes(m.id), check: canMilestone(s, m.id) })),
      })),
      research: RESEARCH.map((r) => ({ r, done: s.research.includes(r.id), check: canResearch(s, r.id), recipe: RECIPE[r.recipe] })),
      insight: s.insight,
      inv: s.inv,
    };
  });

  function unlockText(m: Milestone): string[] {
    const u = m.unlock;
    return [
      ...(u.buildings ?? []).map((b) => BUILDING[b].name),
      ...(u.recipes ?? []).map((r) => `${RECIPE[r].name} recipe`),
      ...(u.resources ?? []).map((r) => RESOURCE_NAME[r]),
      ...(u.belt ? [BELTS[u.belt - 1].name] : []),
      ...(u.shards ? [`+${u.shards} overclock shard${u.shards > 1 ? 's' : ''}`] : []),
    ];
  }

  function deliver() {
    const name = v.phase?.name ?? '';
    const before = ctl.game.phase;
    ctl.run((s) => {
      const r = deliverPhase(s);
      return r.ok ? { ok: true } : { ok: false, error: 'Nothing to deliver yet: stock the parts below at the Base Camp' };
    }, 'Parts delivered');
    const after = ctl.game.phase;
    if (after <= before) return;
    const final = after >= PHASES.length;
    toasts.push({
      message: `${name} complete!`,
      detail: final ? 'The launch is a success. Your factory keeps running.' : `Tier ${after} unlocked`,
      kind: 'levelup',
      emoji: '🚀',
    });
    towerBurst++;
    show = { n: (show?.n ?? 0) + 1, name, final, tier: after };
    clearTimeout(showTimer);
    showTimer = setTimeout(() => (show = null), motionOk() ? (final ? 9000 : 5200) : 3500);
  }
  function milestone(m: Milestone) {
    if (ctl.run((s) => completeMilestone(s, m.id))) {
      toasts.push({ message: `Milestone: ${m.name}`, detail: unlockText(m).join(' · '), kind: 'success', emoji: '🏗️' });
      msBurst = { id: m.id, n: msBurst.n + 1 };
    }
  }
</script>

{#snippet costs(cost: Inv, inv: Inv)}
  <ul class="costs">
    {#each Object.entries(cost) as [k, n] (k)}
      {@const have = inv[k as ItemId] ?? 0}
      <li class:short={have + 1e-9 < (n ?? 0)}>
        <FactoryIcon item={k as ItemId} size={16} />
        <span>{itemName(k as ItemId)}</span>
        <span class="num">{fmt(have)}/{n}</span>
      </li>
    {/each}
  </ul>
{/snippet}

<section class="tower card" aria-labelledby="ob-tower">
  {#if show}
    {#key show.n}
      <div class="launch" class:final={show.final} class:anim={motionOk()} role="status">
        <div class="sky" aria-hidden="true">
          {#each STARS as st, i (i)}<i style="left: {st.x}%; top: {st.y}%; --d: {st.d}s; --s: {st.s}px"></i>{/each}
        </div>
        <svg class="rocket" viewBox="0 0 40 60" aria-hidden="true">
          <path d="M20 2c7 8 9 18 8 30H12C11 20 13 10 20 2z" fill="#e8ebef" stroke="#1b1f24" stroke-width="1.5" />
          <path d="M12 26l-7 10h7zM28 26l7 10h-7z" fill="#e0701a" stroke="#1b1f24" />
          <circle cx="20" cy="18" r="3.5" fill="#14a3b1" stroke="#1b1f24" />
          <path class="flame" d="M14 33h12c0 8-3 16-6 24-3-8-6-16-6-24z" fill="#f2b632" />
          <path class="flame" d="M17 33h6c0 5-1.5 10-3 15-1.5-5-3-10-3-15z" fill="#fff1c2" />
        </svg>
        <div class="banner">
          <span class="eyebrow">{show.final ? 'Liftoff' : `Phase ${show.tier} complete`}</span>
          <strong>{show.name}</strong>
          <span class="sub">{show.final ? 'The Launch Tower flies. Your factory keeps running.' : `Tier ${show.tier} is open`}</span>
          <button class="btn small-btn" onclick={() => (show = null)}>Continue</button>
        </div>
      </div>
    {/key}
  {/if}
  <Burst trigger={towerBurst} kind="deliver" x={60} y={60} size={70} />
  <svg class="art" viewBox="0 0 120 160" aria-hidden="true">
    <rect x="0" y="146" width="120" height="14" fill="#2a2f36" />
    {#each Array.from({ length: 10 }) as _, i}<path d="M{i * 13} 160l8-14h5l-8 14z" fill="#f2b632" />{/each}
    <!-- the tower rises one section per phase delivered -->
    {#each Array.from({ length: PHASES.length }) as _, i}
      {@const y = 146 - (i + 1) * 20}
      <g opacity={i < v.phaseIdx ? 1 : i === v.phaseIdx ? 0.45 : 0.12}>
        <path d="M{44 + i} {y + 20}L{46 + i * 1.3} {y}H{74 - i * 1.3}L{76 - i} {y + 20}" fill="#3a424c" stroke="#e0701a" stroke-width="1.5" />
        <path d="M{46 + i} {y + 20}L{73 - i} {y}M{74 - i} {y + 20}L{47 + i} {y}" stroke="#5b6470" stroke-width="1" />
      </g>
    {/each}
    <g opacity={v.phaseIdx >= PHASES.length ? 1 : 0.15}>
      <path d="M60 4c6 6 7 14 6 22H54c-1-8 0-16 6-22z" fill="#e8ebef" stroke="#1b1f24" />
      <path d="M54 22l-5 6h5zM66 22l5 6h-5z" fill="#e0701a" />
      <circle cx="60" cy="14" r="2.5" fill="#14a3b1" />
    </g>
    <path d="M20 146V60h4v86M20 70h26M20 100h24" stroke="#14a3b1" stroke-width="2" fill="none" />
  </svg>
  <div class="tw">
    <h3 id="ob-tower">Launch Tower</h3>
    {#if v.phase}
      <p class="muted">
        Phase {v.phaseIdx + 1} of {PHASES.length}: <strong>{v.phase.name}</strong>. Delivering it unlocks tier {v.phaseIdx + 1} and gives {v.phase.shards} shard{v.phase.shards > 1
          ? 's'
          : ''}.
      </p>
      <ul class="need">
        {#each v.need as n (n.item)}
          <li>
            <FactoryIcon item={n.item} size={20} />
            <div class="nb">
              <div class="nl"><span>{itemName(n.item)}</span><span class="num">{fmt(n.done)}/{n.need} · {fmt(n.have)} in stock</span></div>
              <div class="bar" role="progressbar" aria-label="{itemName(n.item)} delivered" aria-valuemin="0" aria-valuemax={n.need} aria-valuenow={Math.floor(n.done)}>
                <span style="width: {Math.min(100, (n.done / n.need) * 100)}%"></span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
      <button class="btn primary" onclick={deliver}>Deliver parts</button>
      <p class="muted small">Partial deliveries count. Parts come from your stock (belt them into the Base Camp or a depot).</p>
    {:else}
      <p><strong>Launched!</strong> Every tier is open. Keep optimising, or sell spare parts at the market.</p>
    {/if}
  </div>
</section>

<h3 class="sec">Milestones</h3>
{#each v.tiers as t (t.tier)}
  <section class="tier" class:closed={!t.open} aria-label="Tier {t.tier}">
    <h4>Tier {t.tier}{t.open ? '' : ` · deliver Launch Tower phase ${t.tier} to open`}</h4>
    <div class="grid">
      {#each t.items as { m, done, check } (m.id)}
        <article class="ms card" class:done data-milestone={m.id}>
          {#if msBurst.id === m.id}<Burst trigger={msBurst.n} kind="milestone" size={60} />{/if}
          <header>
            <strong>{m.name}</strong>
            {#if done}<span class="ok">✓ Done</span>{/if}
          </header>
          <p class="muted small">{m.desc}</p>
          <p class="unl">Unlocks: {unlockText(m).join(' · ')}</p>
          {#if !done && t.open}
            {@render costs(m.cost, v.inv)}
            <button class="btn" disabled={!check.ok} onclick={() => milestone(m)}>{check.ok ? 'Complete' : 'Need more parts'}</button>
          {/if}
        </article>
      {/each}
    </div>
  </section>
{/each}

<h3 class="sec">Research: alternate recipes</h3>
<p class="muted small">
  Research costs parts and <strong>insight</strong>, which you earn by finishing homework, notecard sessions and pomodoros. You have <strong>{v.insight}</strong> insight.
</p>
<div class="grid">
  {#each v.research as { r, done, check, recipe } (r.id)}
    <article class="ms card" class:done class:closed={r.tier > v.phaseIdx} data-research={r.id}>
      <header>
        <strong>★ {recipe.name}</strong>
        {#if done}<span class="ok">✓ Researched</span>{:else}<span class="muted small">Tier {r.tier}</span>{/if}
      </header>
      <p class="muted small">{r.note}</p>
      <p class="unl">
        {BUILDING[recipe.building].name}:
        {Object.entries(recipe.in)
          .map(([k, n]) => `${n} ${itemName(k as ItemId)}`)
          .join(' + ')} → {Object.entries(recipe.out)
          .map(([k, n]) => `${n} ${itemName(k as ItemId)}`)
          .join(' + ')} every {recipe.time}s
      </p>
      {#if !done}
        {@render costs(r.cost, v.inv)}
        <button class="btn" disabled={!check.ok} title={check.ok ? '' : check.error} onclick={() => ctl.run((s) => doResearch(s, r.id), `${recipe.name} researched`)}
          >Research ({r.insight} insight)</button
        >
        {#if !check.ok}<p class="muted small">{check.error}</p>{/if}
      {/if}
    </article>
  {/each}
</div>

<style>
  .card {
    background: var(--f-panel);
    border: 1px solid var(--f-line);
    border-radius: 10px;
    padding: 12px;
  }
  .tower {
    position: relative;
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 14px;
    align-items: start;
    overflow: hidden;
  }
  .ms {
    position: relative;
  }
  /* the launch show sits over the whole tower card for a few seconds */
  .launch {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at 50% 100%, #2b1a0e, #0b0f16 60%);
    border-radius: 10px;
  }
  .launch.anim {
    animation: ob-fade 0.5s ease-out both;
  }
  .launch.anim.final {
    animation-duration: 0.8s;
  }
  .sky {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .sky i {
    position: absolute;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: #fff;
    opacity: 0.6;
  }
  .anim .sky i {
    animation: ob-twinkle 1.6s ease-in-out infinite;
    animation-delay: var(--d);
  }
  .rocket {
    position: absolute;
    left: calc(50% - 24px);
    bottom: -70px;
    width: 48px;
    height: 72px;
  }
  .anim .rocket {
    animation: ob-rise 3.6s cubic-bezier(0.35, 0, 0.6, 1) 0.4s forwards;
  }
  .anim.final .rocket {
    animation-duration: 6s;
    width: 64px;
    height: 96px;
    left: calc(50% - 32px);
  }
  .anim .flame {
    transform-origin: 20px 33px;
    animation: ob-flame 0.12s ease-in-out infinite alternate;
  }
  .banner {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 10px 18px;
    border: 2px solid var(--f-yellow);
    border-radius: 10px;
    background: rgba(15, 18, 21, 0.85);
    text-align: center;
    box-shadow: 0 0 24px rgba(242, 182, 50, 0.35);
  }
  .anim .banner {
    animation: ob-banner 0.7s cubic-bezier(0.2, 0.9, 0.3, 1.3) 0.3s both;
  }
  .final .banner {
    border-color: var(--f-teal);
    box-shadow: 0 0 34px rgba(20, 163, 177, 0.5);
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--f-yellow);
  }
  .final .eyebrow {
    color: #8fe7ef;
  }
  .banner strong {
    font-size: 20px;
  }
  .final .banner strong {
    font-size: 26px;
  }
  .sub {
    font-size: 12px;
    color: var(--f-muted);
  }
  @keyframes ob-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes ob-rise {
    0% {
      transform: translateY(0) scale(0.9);
    }
    15% {
      transform: translateY(-10px) scale(1);
    }
    100% {
      transform: translateY(-140vh) scale(0.6);
    }
  }
  @keyframes ob-flame {
    from {
      transform: scaleY(0.7);
    }
    to {
      transform: scaleY(1.15);
    }
  }
  @keyframes ob-twinkle {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 1;
    }
  }
  @keyframes ob-banner {
    from {
      transform: translateY(24px) scale(0.6);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @media (max-width: 480px) {
    .tower {
      grid-template-columns: 70px 1fr;
      gap: 10px;
    }
  }
  .art {
    width: 100%;
    height: auto;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 17px;
  }
  .sec {
    margin: 18px 0 8px;
  }
  h4 {
    margin: 10px 0 6px;
    font-size: 13px;
    color: var(--f-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .muted {
    color: var(--f-muted);
  }
  .small {
    font-size: 12px;
  }
  p {
    margin: 0 0 6px;
  }
  .need {
    list-style: none;
    padding: 0;
    margin: 8px 0;
    display: grid;
    gap: 8px;
  }
  .need li {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .nb {
    flex: 1;
    min-width: 0;
  }
  .nl {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 12.5px;
    flex-wrap: wrap;
  }
  .num {
    font-variant-numeric: tabular-nums;
    color: var(--f-muted);
  }
  .bar {
    height: 7px;
    border-radius: 4px;
    background: var(--f-panel2);
    overflow: hidden;
    margin-top: 3px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(-45deg, #e0701a 0 6px, #f2b632 6px 12px);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 8px;
  }
  .tier.closed .ms,
  .ms.closed {
    background: transparent;
    border-style: dashed;
    color: var(--f-muted);
  }
  .ms {
    display: grid;
    gap: 6px;
    align-content: start;
  }
  .ms.done {
    border-color: #2c7a3a;
  }
  .ms header {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    align-items: baseline;
  }
  .ok {
    color: #3fb950;
    font-size: 12px;
    font-weight: 700;
  }
  .unl {
    font-size: 12px;
    color: #7ee0ea;
  }
  .costs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
    font-size: 12px;
  }
  .costs li {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 6px;
    align-items: center;
  }
  .costs li.short .num {
    color: #ff9b8f;
  }
  .btn {
    font-size: 13px;
    font-weight: 700;
    padding: 8px 12px;
    min-height: 38px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
    justify-self: start;
  }
  .btn:disabled {
    opacity: 0.5;
  }
  .small-btn {
    margin-top: 6px;
    min-height: 32px;
    padding: 5px 12px;
    font-size: 12px;
    justify-self: center;
  }
  .btn.primary {
    background: var(--f-orange);
    border-color: var(--f-orange);
    color: #1b1f24;
  }
</style>
