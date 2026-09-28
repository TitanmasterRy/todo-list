<script lang="ts">
  // Orebelt map overlay for sectors you haven't surveyed yet: a hatched sheet over their tiles with the price and a
  // Survey button. Sits inside the map, so it scrolls and zooms with it.
  import { canSurvey, surveySector } from '../../../lib/factory/actions';
  import { SECTORS, type ItemId } from '../../../lib/factory/data';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
    /** Tile size in px. */
    t: number;
  }
  let { ctl, t }: Props = $props();

  const locked = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    return SECTORS.filter((sec) => !s.sectors.includes(sec.id)).map((sec) => ({
      sec,
      check: canSurvey(s, sec.id),
      cost: (Object.entries(sec.cost) as [ItemId, number][]).map(([item, n]) => ({ item, n, have: s.inv[item] ?? 0 })),
      insightShort: s.insight < sec.insight,
    }));
  });

  function survey(id: string, name: string, cx: number, cy: number) {
    if (ctl.run((s) => surveySector(s, id), `${name} surveyed: build away`, 'build')) ctl.poof(cx, cy, 'build');
  }
</script>

{#each locked as { sec, check, cost, insightShort } (sec.id)}
  <div class="sector" style="left: {sec.x * t}px; top: {sec.y * t}px; width: {sec.w * t}px; height: {sec.h * t}px" data-sector={sec.id}>
    <div class="info" style="max-width: {sec.w * t - 16}px">
      <div class="nm"><strong>{sec.name}</strong><span class="tier">Tier {sec.tier}</span></div>
      <div class="cost">
        {#each cost as c (c.item)}
          <span class:short={c.have + 1e-9 < c.n}><FactoryIcon item={c.item} size={13} />{c.n} {itemName(c.item)} <i>({fmt(c.have)})</i></span>
        {/each}
        <span class:short={insightShort}>◎ {sec.insight} insight</span>
      </div>
      <button
        class="btn"
        disabled={!check.ok}
        title={check.ok ? '' : check.error}
        onclick={() => survey(sec.id, sec.name, sec.x + Math.floor(sec.w / 2), sec.y + Math.floor(sec.h / 2))}
      >
        Survey {sec.name}
      </button>
      {#if !check.ok}<span class="why">{check.error}</span>{/if}
    </div>
  </div>
{/each}

<style>
  .sector {
    position: absolute;
    z-index: 4;
    pointer-events: none;
    background: repeating-linear-gradient(-45deg, rgba(10, 12, 15, 0.55) 0 8px, rgba(10, 12, 15, 0.35) 8px 16px);
    box-shadow: inset 0 0 0 2px rgba(242, 182, 50, 0.35);
  }
  .info {
    pointer-events: auto;
    /* stays in view while a wide sector scrolls by */
    position: sticky;
    top: 8px;
    left: 8px;
    display: inline-grid;
    gap: 4px;
    margin: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(21, 24, 28, 0.94);
    border: 1px solid var(--f-yellow);
    font-size: 11.5px;
    color: var(--f-text);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  .nm {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12.5px;
  }
  .tier {
    color: var(--f-yellow);
    font-weight: 700;
    white-space: nowrap;
  }
  .cost {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    color: var(--f-muted);
  }
  .cost span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .cost i {
    font-style: normal;
    opacity: 0.7;
  }
  .cost .short {
    color: #ff9b8f;
  }
  .btn {
    justify-self: start;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 10px;
    min-height: 32px;
    border-radius: 8px;
    background: var(--f-yellow);
    color: #1b1f24;
  }
  .btn:disabled {
    opacity: 0.55;
  }
  .why {
    color: var(--f-muted);
  }
</style>
