<script lang="ts">
  // Orebelt detail panel for the selected tile: recipe picker, clock speed, rates in/out, efficiency, belts.
  import { BELTS, BUILDING, nodeAt, PURITY, RECIPES, RESOURCE_ITEM, RESOURCE_NAME, shardsFor, type ItemId } from '../../../lib/factory/data';
  import { beltCost, beltLength, dismantle, handMine, maxClock, removeBelt, rotate, setClock, setRecipe, toggle, upgradeBelt } from '../../../lib/factory/actions';
  import { unlocked } from '../../../lib/factory/state';
  import { beltRate, boostMult, fullPower, minerRate, type Status } from '../../../lib/factory/sim';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, fmtRate, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
    sel: { x: number; y: number } | null;
    onbelt: (id: number) => void;
  }
  let { ctl, sel, onbelt }: Props = $props();

  const STATUS: Record<Status, string> = {
    ok: 'Running',
    starved: 'Input starved',
    blocked: 'Output blocked',
    power: 'Low power',
    off: 'Paused',
    idle: 'No recipe',
    nofuel: 'No fuel',
  };
  let confirmDismantle = $state(false);
  let clockDraft = $state<number | null>(null);

  const v = $derived.by(() => {
    void ctl.rev;
    if (!sel) return null;
    const s = ctl.game;
    const b = s.buildings.find((x) => x.x === sel.x && x.y === sel.y);
    const node = nodeAt(sel.x, sel.y);
    const u = unlocked(s);
    if (!b) return { b: null, node, nodeOpen: !!node && u.resources.has(node.res) };
    const def = BUILDING[b.type];
    const rep = ctl.report?.buildings[b.id];
    const boost = boostMult(s);
    const recipe = b.recipe ? RECIPES.find((r) => r.id === b.recipe) : undefined;
    const eff = rep?.eff ?? 0;
    const rows: { item: ItemId; dir: 'in' | 'out'; target: number; now: number; buf: number }[] = [];
    if (def.kind === 'producer' && recipe) {
      const cycles = (60 / recipe.time) * b.clock * boost;
      for (const [k, n] of Object.entries(recipe.in) as [ItemId, number][]) rows.push({ item: k, dir: 'in', target: n * cycles, now: n * cycles * eff, buf: b.inBuf[k] ?? 0 });
      for (const [k, n] of Object.entries(recipe.out) as [ItemId, number][]) rows.push({ item: k, dir: 'out', target: n * cycles, now: n * cycles * eff, buf: b.outBuf[k] ?? 0 });
    } else if (def.kind === 'miner' && node) {
      const it = RESOURCE_ITEM[node.res];
      const target = minerRate(b) * boost;
      rows.push({ item: it, dir: 'out', target, now: target * eff, buf: b.outBuf[it] ?? 0 });
    } else if (def.kind === 'generator') {
      const g = def.gen!;
      rows.push({ item: g.fuel, dir: 'in', target: g.burn * b.clock, now: g.burn * b.clock * eff, buf: b.inBuf[g.fuel] ?? 0 });
    }
    const byId = new Map(s.buildings.map((x) => [x.id, x]));
    const belts = s.belts
      .filter((x) => x.from === b.id || x.to === b.id)
      .map((x) => {
        const other = byId.get(x.from === b.id ? x.to : x.from)!;
        const flow = ctl.report?.belts[x.id];
        const next = x.tier + 1;
        const len = beltLength(byId.get(x.from)!, byId.get(x.to)!);
        return {
          id: x.id,
          out: x.from === b.id,
          other: BUILDING[other.type].name,
          tier: x.tier,
          rate: flow?.rate ?? 0,
          cap: beltRate(x.tier),
          item: flow?.item,
          len,
          next: next <= u.belt ? next : 0,
          nextCost: next <= BELTS.length ? beltCost(next, len) : {},
        };
      });
    return {
      b,
      def,
      node,
      nodeOpen: false,
      st: rep?.st,
      eff,
      mw: rep?.mw ?? 0,
      fullMw: fullPower(b),
      recipe,
      recipes: RECIPES.filter((r) => r.building === b.type && u.recipes.has(r.id)),
      rows,
      belts,
      maxClock: maxClock(s, b),
      freeShards: s.shards,
      boost,
      insIn: belts.filter((x) => !x.out).length,
      insMax: def.ins,
      outsOut: belts.filter((x) => x.out).length,
      outsMax: def.outs,
      stockIn: belts.filter((x) => !x.out).reduce((a, x) => a + x.rate, 0),
    };
  });

  $effect(() => {
    void sel;
    confirmDismantle = false;
    clockDraft = null;
  });

  const costLine = (cost: Partial<Record<ItemId, number>>) =>
    Object.entries(cost)
      .map(([k, n]) => `${n} ${itemName(k as ItemId)}`)
      .join(', ');

  function commitClock(pct: number) {
    const b = v?.b;
    if (!b) return;
    const want = pct / 100;
    ctl.run((s) => {
      const got = setClock(s, b.id, want);
      if (got + 1e-9 < want) return { ok: false, error: `Needs ${shardsFor(want) - b.shards} more overclock shard(s): finish homework to earn them` };
      return { ok: true };
    });
    clockDraft = null;
  }
</script>

<div class="panel" data-panel>
  {#if !v}
    <p class="muted">Select a tile on the map to see what's there.</p>
  {:else if !v.b}
    {#if v.node}
      {@const it = RESOURCE_ITEM[v.node.res]}
      <div class="ph">
        <FactoryIcon item={it} size={34} />
        <div>
          <h3>{RESOURCE_NAME[v.node.res]}</h3>
          <span class="pill">{v.node.purity} · ×{PURITY[v.node.purity]}</span>
        </div>
      </div>
      {#if v.nodeOpen}
        <p class="muted">A Miner Mk1 here makes {30 * PURITY[v.node.purity]} {itemName(it)}/min{v.node.res === 'oil' ? ' (use an Oil Pump)' : ''}.</p>
        <button class="btn" onclick={() => ctl.run((s) => handMine(s, sel!.x, sel!.y), `+1 ${itemName(it)}`)}>⛏ Mine by hand (+1)</button>
        <p class="muted small">You have {fmt(ctl.stock(it))}.</p>
      {:else}
        <p class="muted">Locked: a milestone unlocks this resource.</p>
      {/if}
    {:else}
      <p class="muted">Open ground. Use <strong>Build</strong> to place a machine here.</p>
    {/if}
  {:else}
    {@const b = v.b}
    <div class="ph">
      <FactoryIcon building={b.type} size={40} />
      <div>
        <h3>{v.def!.name}</h3>
        {#if v.st && b.type !== 'camp' && b.type !== 'depot'}
          <span class="pill st-{v.st}" data-status={v.st}>{STATUS[v.st]}</span>
        {/if}
      </div>
    </div>
    <p class="muted small">{v.def!.desc}</p>

    {#if b.type !== 'camp' && b.type !== 'depot'}
      <div class="eff" title="Efficiency: share of the target rate reached">
        <div class="bar"><span style="width: {Math.round(v.eff * 100)}%" class="st-{v.st}"></span></div>
        <strong data-eff>{Math.round(v.eff * 100)}%</strong>
      </div>
    {/if}

    {#if v.def!.kind === 'producer'}
      <label class="field">
        <span>Recipe</span>
        <select value={b.recipe ?? ''} onchange={(e) => ctl.run((s) => setRecipe(s, b.id, (e.currentTarget as HTMLSelectElement).value || undefined))} data-recipe>
          <option value="">Choose a recipe…</option>
          {#each v.recipes as r (r.id)}
            <option value={r.id}>{r.alt ? '★ ' : ''}{r.name}</option>
          {/each}
        </select>
      </label>
      {#if !v.recipes.length}<p class="muted small">No recipes unlocked for this building yet.</p>{/if}
    {/if}

    {#if v.rows.length}
      <table class="io">
        <thead><tr><th>Item</th><th>per min</th><th>now</th><th>held</th></tr></thead>
        <tbody>
          {#each v.rows as r (r.dir + r.item)}
            <tr class={r.dir}>
              <td
                ><span class="dir">{r.dir}</span><FactoryIcon item={r.item} size={16} />
                {itemName(r.item)}</td
              >
              <td>{fmtRate(r.target)}</td>
              <td>{fmtRate(r.now)}</td>
              <td>{fmt(r.buf)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if v.boost > 1}<p class="small boostline">Boosted ×{v.boost.toFixed(2)} (homework / rush order)</p>{/if}
    {/if}

    {#if v.def!.kind === 'generator'}
      <p class="small">Output: <strong>{fmtRate(v.mw)} MW</strong> of {fmtRate(v.def!.gen!.mw * b.clock)} MW max.</p>
    {/if}
    {#if b.type === 'camp' || b.type === 'depot'}
      <p class="small">Intake: <strong>{fmtRate(v.stockIn)}/min</strong> into your stock from {v.insIn} belt{v.insIn === 1 ? '' : 's'} (max {v.insMax}).</p>
    {/if}

    {#if b.type !== 'camp' && b.type !== 'depot'}
      {@const pct = clockDraft ?? Math.round(b.clock * 100)}
      <div class="clock">
        <label for="ob-clock">Clock speed <strong>{pct}%</strong></label>
        <input
          id="ob-clock"
          type="range"
          min="1"
          max="250"
          step="1"
          value={pct}
          aria-valuetext="{pct}%"
          oninput={(e) => (clockDraft = Number((e.currentTarget as HTMLInputElement).value))}
          onchange={(e) => commitClock(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <div class="presets">
          {#each [50, 100, 150, 200, 250] as p (p)}
            <button class="chip" class:on={Math.round(b.clock * 100) === p} disabled={p / 100 > v.maxClock + 1e-9} onclick={() => commitClock(p)}>{p}%</button>
          {/each}
        </div>
        <p class="muted small">
          Shards slotted: {b.shards} · free: {v.freeShards} · max {Math.round(v.maxClock * 100)}%.
          {#if v.def!.power > 0}Power: {fmtRate(v.fullMw)} MW at this clock (grows faster than speed).{/if}
        </p>
      </div>
    {/if}

    {#if v.belts.length}
      <h4>Belts <span class="muted small">in {v.insIn}/{v.insMax} · out {v.outsOut}/{v.outsMax}</span></h4>
      <ul class="belts">
        {#each v.belts as x (x.id)}
          <li>
            <div class="bl">
              <span>{x.out ? 'To' : 'From'} {x.other}</span>
              <span class="rate" class:full={x.rate >= x.cap * 0.98}>{fmtRate(x.rate)}/{x.cap} per min · Mk{x.tier}</span>
            </div>
            <div class="bb">
              {#if x.next}
                <button
                  class="chip"
                  title="Costs {costLine(x.nextCost)} (the old belt is refunded)"
                  onclick={() => ctl.run((s) => upgradeBelt(s, x.id, x.next), `Belt upgraded to Mk${x.next}`)}>Upgrade to Mk{x.next}</button
                >
              {/if}
              <button class="chip" onclick={() => ctl.run((s) => removeBelt(s, x.id), 'Belt removed (refunded)')}>Remove</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="acts">
      {#if v.def!.outs > 0}<button class="btn" onclick={() => onbelt(b.id)}>Belt from here</button>{/if}
      {#if b.type !== 'camp'}
        <button class="btn" onclick={() => ctl.run((s) => rotate(s, b.id))}>Rotate</button>
      {/if}
      {#if b.type !== 'camp' && b.type !== 'depot'}
        <button class="btn" onclick={() => ctl.run((s) => toggle(s, b.id))}>{b.off ? 'Resume' : 'Pause'}</button>
      {/if}
      {#if b.type !== 'camp'}
        {#if confirmDismantle}
          <button class="btn danger" onclick={() => ctl.run((s) => dismantle(s, b.id), 'Dismantled: parts refunded')}>Confirm dismantle</button>
          <button class="btn" onclick={() => (confirmDismantle = false)}>Keep</button>
        {:else}
          <button class="btn" onclick={() => (confirmDismantle = true)}>Dismantle</button>
        {/if}
      {/if}
    </div>
    {#if b.type !== 'camp'}<p class="muted small">Dismantling refunds everything: {costLine(v.def!.cost)}, plus belts and contents.</p>{/if}
  {/if}
</div>

<style>
  .panel {
    background: var(--f-panel);
    border: 1px solid var(--f-line);
    border-radius: 10px;
    padding: 12px;
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .ph {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  h3 {
    margin: 0;
    font-size: 16px;
  }
  h4 {
    margin: 4px 0 0;
    font-size: 13px;
  }
  .muted {
    color: var(--f-muted);
    margin: 0;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--f-panel2);
    color: var(--f-text);
    text-transform: capitalize;
  }
  .pill.st-ok,
  .bar .st-ok {
    background: #2c7a3a;
  }
  .pill.st-starved,
  .bar .st-starved {
    background: #8a6a12;
  }
  .pill.st-blocked,
  .bar .st-blocked {
    background: #9a4a10;
  }
  .pill.st-power,
  .pill.st-nofuel,
  .bar .st-power,
  .bar .st-nofuel {
    background: #a3292d;
  }
  .eff {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--f-panel2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: #7a828c;
    transition: width 0.4s;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--f-muted);
  }
  select {
    background: var(--f-panel2);
    color: var(--f-text);
    border: 1px solid var(--f-line);
    border-radius: 8px;
    padding: 8px;
    min-height: 38px;
  }
  .io {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .io th {
    text-align: right;
    color: var(--f-muted);
    font-weight: 600;
    padding: 2px 4px;
  }
  .io th:first-child,
  .io td:first-child {
    text-align: left;
  }
  .io td {
    text-align: right;
    padding: 3px 4px;
    border-top: 1px solid var(--f-line);
    white-space: nowrap;
  }
  .dir {
    display: inline-block;
    width: 26px;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--f-muted);
  }
  tr.out .dir {
    color: var(--f-orange);
  }
  .boostline {
    color: #7ee0ea;
  }
  .clock {
    display: grid;
    gap: 6px;
  }
  .clock label {
    font-size: 12px;
    color: var(--f-muted);
  }
  .clock strong {
    color: var(--f-text);
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--f-orange);
  }
  .presets,
  .bb,
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    font-size: 12px;
    padding: 5px 9px;
    min-height: 30px;
    border-radius: 999px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
  }
  .chip.on {
    border-color: var(--f-orange);
    color: var(--f-orange);
  }
  .chip:disabled {
    opacity: 0.4;
  }
  .btn {
    font-size: 13px;
    font-weight: 600;
    padding: 7px 12px;
    min-height: 36px;
    border-radius: 8px;
    border: 1px solid var(--f-line);
    background: var(--f-panel2);
    color: var(--f-text);
  }
  .btn.danger {
    background: #a3292d;
    border-color: #a3292d;
  }
  .belts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .belts li {
    background: var(--f-panel2);
    border-radius: 8px;
    padding: 6px 8px;
    display: grid;
    gap: 4px;
  }
  .bl {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 12px;
    flex-wrap: wrap;
  }
  .rate {
    color: var(--f-muted);
    font-variant-numeric: tabular-nums;
  }
  .rate.full {
    color: var(--f-yellow);
  }
</style>
