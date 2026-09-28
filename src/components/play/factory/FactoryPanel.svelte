<script lang="ts">
  // Orebelt detail panel for the selected tile: recipe picker with a rate card and belt ratio hints, clock speed,
  // rates in/out, belts and actions. With nothing selected on a young factory it shows the "First shift" checklist.
  import {
    BELTS,
    BUILDING,
    ITEMS,
    nodeAt,
    perMin,
    PURITY,
    RECIPE,
    RECIPES,
    RESOURCE_ITEM,
    RESOURCE_NAME,
    shardsFor,
    STORAGE_CAP,
    type BuildingId,
    type ItemId,
  } from '../../../lib/factory/data';
  import {
    beltCost,
    beltLength,
    clearJam,
    dismantle,
    handMine,
    maxClock,
    removeBelt,
    rotate,
    setBeltFilter,
    setClock,
    setLoaderItem,
    setRecipe,
    toggle,
    upgradeBelt,
  } from '../../../lib/factory/actions';
  import { unlocked, type Building } from '../../../lib/factory/state';
  import { beltRate, boostMult, fullPower, minerRate, type Status } from '../../../lib/factory/sim';
  import FactoryIcon from './FactoryIcon.svelte';
  import { fmt, fmtRate, itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
    onbelt: (id: number) => void;
  }
  let { ctl, onbelt }: Props = $props();

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

  /** What a building can put on a belt: its recipe's outputs, its node's ore, a loader's item, or whatever it holds. */
  function madeBy(src: Building): ItemId[] {
    const def = BUILDING[src.type];
    const rec = src.recipe ? RECIPE[src.recipe] : undefined;
    const node = nodeAt(src.x, src.y);
    if (rec) return Object.keys(rec.out) as ItemId[];
    if (def.kind === 'miner' && node) return [RESOURCE_ITEM[node.res]];
    if (def.kind === 'loader') return src.item ? [src.item] : [];
    return (Object.keys(src.outBuf) as ItemId[]).filter((k) => (src.outBuf[k] ?? 0) >= 0.5);
  }

  const v = $derived.by(() => {
    void ctl.rev;
    const sel = ctl.sel;
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
    } else if (def.kind === 'loader' && b.item) {
      const target = def.rate! * b.clock * boost;
      rows.push({ item: b.item, dir: 'out', target, now: target * eff, buf: b.outBuf[b.item] ?? 0 });
    }
    // storage: everything it holds, input and output side together
    const held =
      def.kind === 'storage'
        ? ITEMS.map((i) => ({ item: i.id, n: (b.inBuf[i.id] ?? 0) + (b.outBuf[i.id] ?? 0) }))
            .filter((x) => x.n >= 0.5)
            .sort((p, q) => q.n - p.n)
        : [];
    // loader picker: what's in stock first, then everything else you could reach, by tier
    const stocked = ITEMS.filter((i) => (s.inv[i.id] ?? 0) >= 1 || i.id === b.item);
    const tiers = Array.from({ length: s.phase + 2 }, (_, tier) => ({
      label: `Tier ${tier}`,
      items: ITEMS.filter((i) => i.tier === tier && !stocked.includes(i)),
    })).filter((g) => g.items.length);
    const loaderItems = def.kind === 'loader' ? [{ label: 'In stock', items: stocked }, ...tiers].filter((g) => g.items.length) : [];
    const byId = new Map(s.buildings.map((x) => [x.id, x]));
    const belts = s.belts
      .filter((x) => x.from === b.id || x.to === b.id)
      .map((x) => {
        const src = byId.get(x.from)!;
        const other = byId.get(x.from === b.id ? x.to : x.from)!;
        const flow = ctl.report?.belts[x.id];
        const next = x.tier + 1;
        const len = beltLength(src, byId.get(x.to)!);
        const made = madeBy(src);
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
          filter: x.filter,
          jammed: s.event?.beltId === x.id,
          // the source's own items first, then everything else
          filterItems: [...made, ...ITEMS.map((i) => i.id).filter((i) => !made.includes(i))],
        };
      });
    const sink = def.kind === 'camp' || def.kind === 'depot' || def.kind === 'storage';
    // the recipe card: what this machine wants per minute at its clock, against what its belts actually bring
    const speed = b.clock * boost;
    const card = recipe
      ? {
          ins: (Object.entries(recipe.in) as [ItemId, number][]).map(([k, n]) => {
            const need = perMin(recipe, n) * speed;
            const bring = belts.filter((x) => !x.out && x.item === k).reduce((a, x) => a + x.rate, 0);
            const feeders = belts.filter((x) => !x.out).length;
            return { item: k, need, bring, feeders };
          }),
          outs: (Object.entries(recipe.out) as [ItemId, number][]).map(([k, n]) => ({ item: k, rate: perMin(recipe, n) * speed })),
          cycles: (60 / recipe.time) * speed,
        }
      : null;
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
      card,
      recipes: RECIPES.filter((r) => r.building === b.type && u.recipes.has(r.id)),
      rows,
      held,
      loaderItems,
      belts,
      sink,
      intake: def.kind === 'camp' || def.kind === 'depot',
      maxClock: maxClock(s, b),
      freeShards: s.shards,
      boost,
      insIn: belts.filter((x) => !x.out).length,
      insMax: def.ins,
      outsOut: belts.filter((x) => x.out).length,
      outsMax: def.outs,
      stockIn: belts.filter((x) => !x.out).reduce((a, x) => a + x.rate, 0),
      copyable: !sink && s.buildings.filter((x) => x.type === b.type).length > 1,
    };
  });

  /** The first-shift checklist, read straight off the state so it's right after a reload too. */
  const shift = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const miners = s.buildings.filter((b) => BUILDING[b.type].kind === 'miner' && nodeAt(b.x, b.y)?.res === 'iron');
    const camp = s.buildings.find((b) => b.type === 'camp');
    // does any belt chain lead from an iron miner to the camp (straight, or through machines)?
    const reach = new Set(miners.map((m) => m.id));
    for (let grew = true; grew;) {
      grew = false;
      for (const bl of s.belts)
        if (reach.has(bl.from) && !reach.has(bl.to)) {
          reach.add(bl.to);
          grew = true;
        }
    }
    const build = (type: BuildingId) => () => {
      ctl.tool = 'build';
      ctl.buildType = type;
      ctl.say(`Green tiles can take a ${BUILDING[type].name}`, false);
    };
    const steps = [
      { id: 'miner', text: 'Place a Miner Mk1 on the iron deposit', done: miners.length > 0, show: build('miner1') },
      {
        id: 'belt',
        text: 'Belt the ore to the Base Camp (straight, or through a smelter)',
        done: !!camp && reach.has(camp.id),
        show: () => {
          ctl.tool = 'belt';
          ctl.say('Tap the miner, then the building the belt should feed', false);
        },
      },
      { id: 'smelter', text: 'Build a Smelter and pick the Iron ingot recipe', done: s.buildings.some((b) => b.type === 'smelter' && !!b.recipe), show: build('smelter') },
      { id: 'fasteners', text: 'Complete the Fasteners milestone (20 plates, 20 rods)', done: s.milestones.includes('fasteners'), show: () => ctl.pickTab('tech') },
    ];
    return { steps, n: steps.filter((x) => x.done).length, done: steps.every((x) => x.done) };
  });

  $effect(() => {
    void ctl.sel;
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

  function doDismantle() {
    const b = v?.b;
    if (!b) return;
    if (ctl.run((s) => dismantle(s, b.id), 'Dismantled: parts refunded', 'dismantle')) ctl.poof(b.x, b.y, 'dismantle');
  }

  function startCopy() {
    const b = v?.b;
    if (!b) return;
    ctl.copyFrom = b.id;
    ctl.tool = 'select';
    ctl.say(`Tap another ${BUILDING[b.type].name} to paste this recipe and clock`, false);
  }
</script>

<div class="panel" data-panel>
  {#if !v}
    {#if !shift.done}
      <div class="shift">
        <div class="sh">
          <h3>First shift</h3>
          <span class="pill">{shift.n}/{shift.steps.length}</span>
        </div>
        <p class="muted small">Get ore flowing and the tower will take care of the rest.</p>
        <ol class="steps">
          {#each shift.steps as st (st.id)}
            <li class:done={st.done}>
              <span class="tick" aria-hidden="true">{st.done ? '✓' : ''}</span>
              <span class="txt">{st.text}</span>
              {#if !st.done}<button class="chip" onclick={st.show}>Show me</button>{/if}
            </li>
          {/each}
        </ol>
      </div>
    {:else}
      <p class="muted">Select a tile on the map to see what's there.</p>
      <p class="muted small">Tip: a <strong>Loader</strong> puts parts from your stock back onto belts, and <strong>Storage</strong> soaks up bursts between machines.</p>
    {/if}
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
        <button class="btn" onclick={() => ctl.run((s) => handMine(s, ctl.sel!.x, ctl.sel!.y), `+1 ${itemName(it)}`)}>⛏ Mine by hand (+1)</button>
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
        {#if v.st && !v.sink}
          <span class="pill st-{v.st}" data-status={v.st}>{v.st === 'idle' && v.def!.kind === 'loader' ? 'No item' : STATUS[v.st]}</span>
        {/if}
      </div>
    </div>
    <p class="muted small">{v.def!.desc}</p>

    {#if !v.sink}
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
      {#if v.card}
        {@const c = v.card}
        <div class="rc">
          <div class="rio">
            <div class="rlist">
              {#each c.ins as x (x.item)}
                <span class="rit"><FactoryIcon item={x.item} size={16} /><strong>{fmtRate(x.need)}</strong>/min {itemName(x.item)}</span>
              {/each}
            </div>
            <span class="arrow" aria-hidden="true">→</span>
            <div class="rlist">
              {#each c.outs as x (x.item)}
                <span class="rit out"><FactoryIcon item={x.item} size={16} /><strong>{fmtRate(x.rate)}</strong>/min {itemName(x.item)}</span>
              {/each}
            </div>
          </div>
          <p class="muted small">{v.recipe!.time} s per cycle · {fmtRate(c.cycles)} cycles/min at {Math.round(b.clock * 100)}%{v.boost > 1 ? ' boosted' : ''}</p>
          <ul class="ratio">
            {#each c.ins as x (x.item)}
              <li class:ok={x.bring + 1e-6 >= x.need} class:short={x.bring > 0.01 && x.bring + 1e-6 < x.need} class:none={x.bring <= 0.01}>
                needs {fmtRate(x.need)}
                {itemName(x.item)}/min;
                {#if x.bring > 0.01}connected belts bring {fmtRate(x.bring)}/min{:else if x.feeders}no belt brings {itemName(x.item)} yet{:else}no belt feeds it yet{/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}

    {#if v.def!.kind === 'loader'}
      <label class="field">
        <span>Item to pull from stock</span>
        <select
          value={b.item ?? ''}
          onchange={(e) => ctl.run((s) => setLoaderItem(s, b.id, ((e.currentTarget as HTMLSelectElement).value || undefined) as ItemId | undefined))}
          data-loader-item
        >
          <option value="">Choose an item…</option>
          {#each v.loaderItems as g (g.label)}
            <optgroup label={g.label}>
              {#each g.items as i (i.id)}
                <option value={i.id}>{i.name} ({fmt(ctl.stock(i.id))})</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </label>
      {#if b.item}
        <p class="muted small">Pulls {fmtRate(v.def!.rate! * b.clock)}/min while your stock lasts: {fmt(ctl.stock(b.item))} {itemName(b.item)} left.</p>
      {/if}
    {/if}

    {#if v.def!.kind === 'storage'}
      <h4>Contents <span class="muted small">up to {STORAGE_CAP} of each</span></h4>
      {#if v.held.length}
        <ul class="held" data-storage>
          {#each v.held as h (h.item)}
            <li>
              <FactoryIcon item={h.item} size={16} />
              <span class="hn">{itemName(h.item)}</span>
              <span class="bar"><span style="width: {Math.min(100, (h.n / STORAGE_CAP) * 100)}%" class:full={h.n >= STORAGE_CAP * 0.98}></span></span>
              <strong>{fmt(h.n)}</strong>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted small">Empty. Belt items in and they wait here until the belts out can take them.</p>
      {/if}
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
    {#if v.intake}
      <p class="small">Intake: <strong>{fmtRate(v.stockIn)}/min</strong> into your stock from {v.insIn} belt{v.insIn === 1 ? '' : 's'} (max {v.insMax}).</p>
    {/if}

    {#if !v.sink}
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
            {#if x.jammed}
              <p class="small jam">
                Jammed: nothing moves until it's cleared.
                <button class="chip" onclick={() => ctl.run((s) => clearJam(s), 'Belt cleared: it moves again', 'belt')}>Clear the jam</button>
              </p>
            {/if}
            <div class="bb">
              <label class="flt">
                <span class="sr">Only carry</span>
                <select
                  value={x.filter ?? ''}
                  title="Let only one item ride this belt"
                  data-belt-filter={x.id}
                  onchange={(e) => ctl.run((s) => setBeltFilter(s, x.id, ((e.currentTarget as HTMLSelectElement).value || undefined) as ItemId | undefined))}
                >
                  <option value="">Any item</option>
                  {#each x.filterItems as i (i)}
                    <option value={i}>Only {itemName(i)}</option>
                  {/each}
                </select>
              </label>
              {#if x.next}
                <button
                  class="chip"
                  title="Costs {costLine(x.nextCost)} (the old belt is refunded)"
                  onclick={() => ctl.run((s) => upgradeBelt(s, x.id, x.next), `Belt upgraded to Mk${x.next}`, 'belt')}>Upgrade to Mk{x.next}</button
                >
              {/if}
              <button class="chip" onclick={() => ctl.run((s) => removeBelt(s, x.id), 'Belt removed (refunded)', 'dismantle')}>Remove</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if ctl.copyFrom === b.id}
      <p class="small copying">Copying these settings: tap another {v.def!.name} on the map. <button class="chip" onclick={() => (ctl.copyFrom = null)}>Cancel</button></p>
    {/if}
    <div class="acts">
      {#if v.def!.outs > 0}<button class="btn" onclick={() => onbelt(b.id)}>Belt from here</button>{/if}
      {#if b.type !== 'camp'}
        <button class="btn" onclick={() => ctl.run((s) => rotate(s, b.id))}>Rotate</button>
      {/if}
      {#if !v.sink}
        <button class="btn" onclick={() => ctl.run((s) => toggle(s, b.id), undefined, 'click')}>{b.off ? 'Resume' : 'Pause'}</button>
      {/if}
      {#if v.copyable && ctl.copyFrom !== b.id}
        <button class="btn" onclick={startCopy} title="Give another {v.def!.name} this recipe and clock speed">Copy settings</button>
      {/if}
      {#if b.type !== 'camp'}
        {#if confirmDismantle}
          <button class="btn danger" onclick={doDismantle}>Confirm dismantle</button>
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
  .ph,
  .sh {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .sh {
    justify-content: space-between;
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
  .shift {
    display: grid;
    gap: 6px;
  }
  .steps {
    list-style: none;
    margin: 2px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
    counter-reset: step;
  }
  .steps li {
    counter-increment: step;
    display: grid;
    grid-template-columns: 22px 1fr auto;
    gap: 8px;
    align-items: center;
    font-size: 12.5px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--f-panel2);
    border-left: 3px solid var(--f-orange);
  }
  .steps li.done {
    border-left-color: #3fb950;
    color: var(--f-muted);
  }
  .steps li.done .txt {
    text-decoration: line-through;
  }
  .tick {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--f-line);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    color: #3fb950;
    background: var(--f-panel);
  }
  .steps li:not(.done) .tick::before {
    content: counter(step);
    color: var(--f-muted);
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
  .rc {
    display: grid;
    gap: 5px;
    padding: 8px;
    border-radius: 8px;
    background: linear-gradient(180deg, #23292f, var(--f-panel2));
    border: 1px solid var(--f-line);
  }
  .rio {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rlist {
    display: grid;
    gap: 3px;
  }
  .rit {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    white-space: nowrap;
  }
  .rit.out strong {
    color: var(--f-orange);
  }
  .arrow {
    color: var(--f-muted);
    font-size: 16px;
  }
  .ratio {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    font-size: 11.5px;
  }
  .ratio li::before {
    content: '●';
    margin-right: 5px;
    font-size: 9px;
    vertical-align: 1px;
  }
  .ratio li.ok::before {
    color: #3fb950;
  }
  .ratio li.short::before {
    color: var(--f-yellow);
  }
  .ratio li.none::before {
    color: #7a828c;
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
  .copying {
    color: #8fe7ef;
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
  .flt select {
    font-size: 12px;
    padding: 4px 6px;
    min-height: 30px;
    max-width: 160px;
    border-radius: 999px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .jam {
    color: #ffb4ae;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .held {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .held li {
    display: grid;
    grid-template-columns: 18px minmax(70px, 1fr) minmax(40px, 2fr) auto;
    gap: 6px;
    align-items: center;
  }
  .hn {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .held .bar span {
    background: var(--f-teal);
  }
  .held .bar span.full {
    background: var(--f-yellow);
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
