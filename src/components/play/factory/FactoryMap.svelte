<script lang="ts">
  // Orebelt map: a scrollable tile grid with resource nodes, buildings and animated belts, plus the build/belt tools.
  // Keyboard: arrows move between tiles, Enter/Space acts, R rotates, Esc cancels the tool.
  import { BELTS, BUILDING, BUILDINGS, ITEM, MAP_H, MAP_W, NODES, RECIPE, RESOURCE_ITEM, RESOURCE_NAME, type BuildingId } from '../../../lib/factory/data';
  import { beltCost, beltPath, connect, DIRS, place, rotate } from '../../../lib/factory/actions';
  import { has, unlocked, type Dir } from '../../../lib/factory/state';
  import { beltRate, type Status } from '../../../lib/factory/sim';
  import { store } from '../../../lib/store.svelte';
  import FactoryIcon from './FactoryIcon.svelte';
  import FactoryPanel from './FactoryPanel.svelte';
  import { itemName, type FactoryCtl } from './controller.svelte';

  interface Props {
    ctl: FactoryCtl;
  }
  let { ctl }: Props = $props();

  type Tool = 'select' | 'build' | 'belt';
  let tool = $state<Tool>('select');
  let buildType = $state<BuildingId>('miner1');
  let placeRot = $state<Dir>(0);
  let beltTier = $state(1);
  let beltFrom = $state<number | null>(null);
  let sel = $state<{ x: number; y: number } | null>(null);
  let cursor = $state({ x: 2, y: 5 });
  let zoom = $state(1);
  const TILE = [34, 44, 58];
  const t = $derived(TILE[zoom]);
  let grid: HTMLDivElement | undefined = $state();

  const prefersReduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate = $derived(!store.settings.reducedMotion && !prefersReduced);

  const STATUS: Record<Status, string> = {
    ok: 'Running',
    starved: 'Input starved',
    blocked: 'Output blocked',
    power: 'Low power',
    off: 'Paused',
    idle: 'No recipe',
    nofuel: 'No fuel',
  };
  const DIR_NAME = ['east', 'south', 'west', 'north'];

  const view = $derived.by(() => {
    void ctl.rev;
    const s = ctl.game;
    const rep = ctl.report;
    const u = unlocked(s);
    const at = new Map(s.buildings.map((b) => [`${b.x},${b.y}`, b]));
    const def = BUILDING[buildType];
    const affordable = has(s.inv, def.cost);
    const tiles = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const b = at.get(`${x},${y}`);
        const node = NODES.find((n) => n.x === x && n.y === y);
        const r = b ? rep?.buildings[b.id] : undefined;
        const recipe = b?.recipe ? RECIPE[b.recipe] : undefined;
        const outItem = recipe ? (Object.keys(recipe.out)[0] as keyof typeof ITEM) : b && node && BUILDING[b.type].kind === 'miner' ? RESOURCE_ITEM[node.res] : undefined;
        const canHere = tool === 'build' && !b && affordable && (def.kind === 'miner' ? !!node && def.mines!.includes(node.res) && u.resources.has(node.res) : !node);
        let label = `Tile ${x + 1}, ${y + 1}: `;
        if (b) {
          label += BUILDING[b.type].name;
          if (outItem && b.type !== 'camp') label += ` making ${itemName(outItem)}`;
          if (r) label += `, ${STATUS[r.st]}${b.type === 'camp' || b.type === 'depot' ? '' : ` ${Math.round(r.eff * 100)}%`}`;
          if (b.type !== 'camp' && b.type !== 'depot') label += `, output ${DIR_NAME[b.rot]}`;
        } else if (node) label += `${RESOURCE_NAME[node.res]} (${node.purity})${u.resources.has(node.res) ? '' : ', locked'}`;
        else label += 'open ground';
        tiles.push({
          x,
          y,
          id: b?.id,
          type: b?.type,
          rot: b?.rot ?? 0,
          st: r?.st,
          eff: r?.eff ?? 0,
          off: !!b?.off,
          outItem,
          nodeLocked: !!node && !u.resources.has(node.res),
          canHere,
          label,
        });
      }
    const byId = new Map(s.buildings.map((b) => [b.id, b]));
    const belts = s.belts.flatMap((bl) => {
      const a = byId.get(bl.from);
      const b = byId.get(bl.to);
      if (!a || !b) return [];
      const kind = BUILDING[b.type].kind;
      const pts = beltPath(a, b, kind === 'camp' || kind === 'depot');
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
      const flow = rep?.belts[bl.id];
      return [{ id: bl.id, d, tier: bl.tier, rate: flow?.rate ?? 0, color: flow?.item ? ITEM[flow.item].color : '#888', full: (flow?.rate ?? 0) >= beltRate(bl.tier) * 0.98 }];
    });
    const nodes = NODES.map((n) => ({ ...n, locked: !u.resources.has(n.res), color: ITEM[RESOURCE_ITEM[n.res]].color }));
    const palette = BUILDINGS.filter((b) => b.id !== 'camp')
      .map((b) => ({ def: b, locked: !u.buildings.has(b.id), afford: has(s.inv, b.cost) }))
      .sort((a, b) => Number(a.locked) - Number(b.locked));
    return { tiles, belts, nodes, palette, maxBelt: u.belt, beltFromName: beltFrom ? BUILDING[byId.get(beltFrom)?.type ?? 'camp'].name : '' };
  });

  function pickTool(next: Tool) {
    tool = next;
    beltFrom = null;
  }

  function act(x: number, y: number) {
    cursor = { x, y };
    const s = ctl.game;
    const here = s.buildings.find((b) => b.x === x && b.y === y);
    if (tool === 'build') {
      let id: number | undefined;
      const ok = ctl.run((g) => {
        const r = place(g, buildType, x, y, placeRot);
        id = r.id;
        return r;
      }, `${BUILDING[buildType].name} built`);
      if (ok && id) sel = { x, y };
      return;
    }
    if (tool === 'belt') {
      if (beltFrom === null) {
        if (!here) return ctl.say('Tap a building to start the belt', true);
        if (BUILDING[here.type].outs <= 0) return ctl.say(`${BUILDING[here.type].name} has no output: start from a miner or machine`, true);
        beltFrom = here.id;
        sel = { x, y };
        return;
      }
      if (here?.id === beltFrom) {
        beltFrom = null;
        return;
      }
      if (!here) return ctl.say('Tap the building the belt should feed', true);
      const from = beltFrom;
      if (ctl.run((g) => connect(g, from, here.id, beltTier), 'Belt connected')) beltFrom = null;
      return;
    }
    sel = { x, y };
  }

  function rotateAction() {
    if (tool === 'build') placeRot = ((placeRot + 1) % 4) as Dir;
    else if (sel) {
      const b = ctl.game.buildings.find((x) => x.x === sel!.x && x.y === sel!.y);
      if (b) ctl.run((g) => rotate(g, b.id));
    }
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key;
    const move: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (move[k]) {
      e.preventDefault();
      cursor = { x: Math.max(0, Math.min(MAP_W - 1, cursor.x + move[k][0])), y: Math.max(0, Math.min(MAP_H - 1, cursor.y + move[k][1])) };
      grid?.querySelector<HTMLElement>(`[data-x="${cursor.x}"][data-y="${cursor.y}"]`)?.focus();
    } else if (k === 'r' || k === 'R') {
      e.preventDefault();
      rotateAction();
    } else if (k === 'Escape') {
      if (tool !== 'select' || beltFrom !== null) {
        e.preventDefault();
        pickTool('select');
      }
    }
  }

  const costText = (cost: Partial<Record<keyof typeof ITEM, number>>) =>
    Object.entries(cost)
      .map(([k, n]) => `${n} ${itemName(k as keyof typeof ITEM)}`)
      .join(', ');
  const beltSpeed = (tier: number) => [0.9, 1.3, 1.9, 2.6, 3.4][tier - 1];
</script>

<div class="toolbar" role="toolbar" aria-label="Map tools">
  <div class="seg">
    <button class:on={tool === 'select'} aria-pressed={tool === 'select'} onclick={() => pickTool('select')}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 2l10 6-4 1 2 5-2 1-2-5-3 3z" fill="currentColor" /></svg> Inspect
    </button>
    <button class:on={tool === 'build'} aria-pressed={tool === 'build'} onclick={() => pickTool('build')}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 14h12M4 14V7l4-4 4 4v7" stroke="currentColor" stroke-width="2" fill="none" /></svg> Build
    </button>
    <button class:on={tool === 'belt'} aria-pressed={tool === 'belt'} onclick={() => pickTool('belt')}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path d="M2 8h12" stroke="currentColor" stroke-width="4" /><path d="M4 8h1M8 8h1M12 8h1" stroke="#1b1f24" stroke-width="2" /></svg
      > Belt
    </button>
  </div>
  {#if tool === 'belt'}
    <label class="tier">
      <span class="sr">Belt tier</span>
      <select bind:value={beltTier}>
        {#each BELTS as b (b.tier)}
          <option value={b.tier} disabled={b.tier > view.maxBelt}>{b.name} · {b.rate}/min{b.tier > view.maxBelt ? ' (locked)' : ''}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if tool === 'build' || sel}
    <button class="tb" onclick={rotateAction} title="Rotate (R)">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"
        ><path d="M13 8a5 5 0 1 1-2-4" stroke="currentColor" stroke-width="2" fill="none" /><path d="M9 1l3 3-3 2" fill="currentColor" /></svg
      >
      Rotate{tool === 'build' ? ` (${DIR_NAME[placeRot]})` : ''}
    </button>
  {/if}
  <span class="grow"></span>
  <div class="seg zoom" role="group" aria-label="Zoom">
    <button aria-label="Zoom out" disabled={zoom === 0} onclick={() => (zoom = Math.max(0, zoom - 1))}>−</button>
    <button aria-label="Zoom in" disabled={zoom === 2} onclick={() => (zoom = Math.min(2, zoom + 1))}>+</button>
  </div>
</div>

{#if tool === 'build'}
  <div class="palette" role="radiogroup" aria-label="Building to place">
    {#each view.palette as p (p.def.id)}
      <button
        role="radio"
        aria-checked={buildType === p.def.id}
        class="pal"
        class:on={buildType === p.def.id}
        class:locked={p.locked}
        disabled={p.locked}
        data-build={p.def.id}
        title={p.locked ? 'Locked: see Milestones' : `${p.def.desc} Costs ${costText(p.def.cost)}.`}
        onclick={() => (buildType = p.def.id)}
      >
        <FactoryIcon building={p.def.id} size={30} />
        <span class="pn">{p.def.name}</span>
        <span class="pc" class:short={!p.afford && !p.locked}>
          {#if p.locked}Locked{:else}
            {#each Object.entries(p.def.cost) as [k, n] (k)}<span class="cost"><FactoryIcon item={k as keyof typeof ITEM} size={12} />{n}</span>{/each}
          {/if}
        </span>
      </button>
    {/each}
  </div>
{/if}

<p class="hint" aria-live="polite">
  {#if tool === 'build'}
    Tap a tile to place a <strong>{BUILDING[buildType].name}</strong> (output faces {DIR_NAME[placeRot]}).
    {BUILDING[buildType].kind === 'miner' ? 'Miners go on glowing resource nodes.' : 'Machines go on open ground.'}
  {:else if tool === 'belt'}
    {#if beltFrom === null}Tap the building the belt starts from.{:else}From <strong>{view.beltFromName}</strong>: tap the building to feed ({BELTS[beltTier - 1].name},
      {costText(beltCost(beltTier, 1))} per tile).{/if}
  {:else}
    Tap a building to inspect it, pick a recipe and set its clock speed. Tap a node to mine it by hand.
  {/if}
</p>

<div class="layout">
  <div class="map-wrap">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="map"
      style="--t: {t}px; width: {MAP_W * t}px; height: {MAP_H * t}px"
      bind:this={grid}
      role="application"
      aria-label="Factory map, {MAP_W} by {MAP_H} tiles"
      onkeydown={onKey}
    >
      <svg class="layer" viewBox="0 0 {MAP_W} {MAP_H}" width={MAP_W * t} height={MAP_H * t} aria-hidden="true">
        {#each view.nodes as n (`${n.x},${n.y}`)}
          <g class="node" class:locked={n.locked} transform="translate({n.x} {n.y})">
            <rect x=".06" y=".06" width=".88" height=".88" rx=".22" fill={n.color} opacity=".28" />
            <rect x=".06" y=".06" width=".88" height=".88" rx=".22" fill="none" stroke={n.color} stroke-width=".04" stroke-dasharray=".12 .08" />
            {#if n.res === 'oil'}
              <path d="M.5 .22c0 0-.2.24-.2.36a.2.2 0 0 0 .4 0c0-.12-.2-.36-.2-.36z" fill={n.color} stroke="#000" stroke-width=".03" />
            {:else if n.res === 'grove'}
              <path d="M.3 .72l.12-.4.12.4zM.5 .66l.14-.46.14.46z" fill={n.color} stroke="#000" stroke-width=".03" />
            {:else}
              <path d="M.22 .68l.1-.26.2-.08.14.14-.04.24-.2.06z" fill={n.color} stroke="#000" stroke-width=".03" />
              <path d="M.56 .5l.08-.16.14.04.04.16-.12.08z" fill={n.color} stroke="#000" stroke-width=".03" />
            {/if}
            {#each Array.from({ length: n.purity === 'pure' ? 3 : n.purity === 'normal' ? 2 : 1 }) as _, i}
              <circle cx={0.2 + i * 0.13} cy=".86" r=".045" fill="#f2b632" />
            {/each}
          </g>
        {/each}
        {#each view.belts as b (b.id)}
          <g class="belt tier{b.tier}">
            <path d={b.d} class="bed" fill="none" />
            <path d={b.d} class="rail" fill="none" />
            {#if b.rate > 0.01}
              <path
                d={b.d}
                class="items"
                class:moving={animate}
                fill="none"
                stroke={b.color}
                style="animation-duration: {(0.45 / beltSpeed(b.tier)).toFixed(2)}s"
                stroke-dasharray={b.full ? '0 0.3' : '0 0.45'}
              />
            {/if}
          </g>
        {/each}
      </svg>
      <div class="tiles" style="grid-template-columns: repeat({MAP_W}, var(--t))">
        {#each view.tiles as tile (`${tile.x},${tile.y}`)}
          <button
            class="tile"
            class:sel={sel?.x === tile.x && sel?.y === tile.y}
            class:can={tile.canHere}
            class:src={beltFrom !== null && tile.id === beltFrom}
            class:has={!!tile.type}
            data-x={tile.x}
            data-y={tile.y}
            data-building={tile.type}
            tabindex={cursor.x === tile.x && cursor.y === tile.y ? 0 : -1}
            aria-label={tile.label}
            onclick={() => act(tile.x, tile.y)}
            onfocus={() => (cursor = { x: tile.x, y: tile.y })}
          >
            {#if tile.type}
              <span class="bg" class:off={tile.off}><FactoryIcon building={tile.type} size={Math.round(t * 0.76)} /></span>
              {#if tile.type !== 'camp' && tile.type !== 'depot'}
                <span class="port" style="--dx: {DIRS[tile.rot][0]}; --dy: {DIRS[tile.rot][1]}; rotate: {tile.rot * 90}deg"></span>
              {/if}
              {#if tile.st && tile.type !== 'camp' && tile.type !== 'depot'}
                <span class="led st-{tile.st}"></span>
              {/if}
              {#if tile.outItem && tile.type !== 'camp' && t >= 40}
                <span class="mini"><FactoryIcon item={tile.outItem} size={Math.round(t * 0.3)} /></span>
              {/if}
            {:else if tool === 'build' && tile.canHere}
              <span class="ghost"><FactoryIcon building={buildType} size={Math.round(t * 0.8)} /></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
  <aside class="side">
    <FactoryPanel {ctl} {sel} onbelt={(id) => ((tool = 'belt'), (beltFrom = id))} />
    <div class="legend" aria-hidden="true">
      <span><i class="led st-ok"></i>Running</span><span><i class="led st-starved"></i>Starved</span><span><i class="led st-blocked"></i>Blocked</span><span
        ><i class="led st-power"></i>Low power / no fuel</span
      >
      <span><i class="dots"></i>Node purity: 1–3 dots</span>
    </div>
  </aside>
</div>

<style>
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--f-line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button,
  .tb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px;
    min-height: 36px;
    color: var(--f-text);
    background: var(--f-panel2);
    font-weight: 600;
    font-size: 13px;
  }
  .tb {
    border: 1px solid var(--f-line);
    border-radius: 8px;
  }
  .seg button + button {
    border-left: 1px solid var(--f-line);
  }
  .seg button.on {
    background: var(--f-orange);
    color: #1b1f24;
  }
  .seg button:disabled {
    opacity: 0.4;
  }
  .zoom button {
    width: 36px;
    justify-content: center;
    font-size: 18px;
  }
  .grow {
    flex: 1;
  }
  .tier select {
    background: var(--f-panel2);
    color: var(--f-text);
    border: 1px solid var(--f-line);
    border-radius: 8px;
    padding: 7px 8px;
    min-height: 36px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .palette {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-bottom: 4px;
  }
  .pal {
    flex: none;
    display: grid;
    justify-items: center;
    gap: 2px;
    width: 92px;
    padding: 6px 4px;
    background: var(--f-panel2);
    border: 1px solid var(--f-line);
    border-radius: 8px;
    color: var(--f-text);
  }
  .pal.on {
    border-color: var(--f-orange);
    box-shadow: inset 0 0 0 1px var(--f-orange);
  }
  .pal.locked {
    opacity: 0.45;
  }
  .pn {
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    line-height: 1.15;
  }
  .pc {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
    font-size: 10px;
    color: var(--f-muted);
  }
  .pc.short {
    color: #ff9b8f;
  }
  .cost {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .hint {
    font-size: 12.5px;
    color: var(--f-muted);
    margin: 2px 0 8px;
    min-height: 1.4em;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 300px;
    }
  }
  .map-wrap {
    align-self: start;
    overflow: auto;
    max-height: min(68vh, 640px);
    border: 2px solid var(--f-line);
    border-radius: 10px;
    background: #22272d;
    overscroll-behavior: contain;
  }
  .map {
    position: relative;
    background-color: #2a3036;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      radial-gradient(circle at 30% 40%, rgba(95, 168, 75, 0.08), transparent 40%), radial-gradient(circle at 80% 70%, rgba(224, 112, 26, 0.06), transparent 45%);
    background-size:
      var(--t) var(--t),
      var(--t) var(--t),
      100% 100%,
      100% 100%;
  }
  .layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .node.locked {
    opacity: 0.4;
  }
  .belt .bed {
    stroke: #16191d;
    stroke-width: 0.3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .belt .rail {
    stroke: #4a525d;
    stroke-width: 0.2;
    stroke-linejoin: round;
  }
  .belt.tier2 .rail {
    stroke: #6b7a8a;
  }
  .belt.tier3 .rail {
    stroke: #14a3b1;
  }
  .belt.tier4 .rail {
    stroke: #e0701a;
  }
  .belt.tier5 .rail {
    stroke: #b15fd6;
  }
  .belt .items {
    stroke-width: 0.15;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .belt .items.moving {
    animation: ob-flow linear infinite;
  }
  @keyframes ob-flow {
    to {
      stroke-dashoffset: -0.45px;
    }
  }
  .tiles {
    position: absolute;
    inset: 0;
    display: grid;
    grid-auto-rows: var(--t);
  }
  .tile {
    position: relative;
    width: var(--t);
    height: var(--t);
    padding: 0;
    border-radius: 6px;
    display: grid;
    place-items: center;
    background: transparent;
    touch-action: manipulation;
  }
  .tile.has .bg {
    display: grid;
    place-items: center;
    width: 82%;
    height: 82%;
    border-radius: 7px;
    background: rgba(27, 31, 36, 0.78);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
  .bg.off {
    filter: grayscale(1) brightness(0.7);
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  .tile.can {
    background: rgba(63, 185, 80, 0.14);
    box-shadow: inset 0 0 0 1px rgba(63, 185, 80, 0.5);
  }
  .tile.sel {
    box-shadow:
      inset 0 0 0 2px var(--f-orange),
      0 0 0 1px #000;
    z-index: 1;
  }
  .tile.src {
    box-shadow: inset 0 0 0 2px var(--f-teal);
  }
  .tile:focus-visible {
    outline: 2px solid #fff;
    outline-offset: -2px;
    z-index: 2;
  }
  .ghost {
    opacity: 0;
  }
  .tile.can:hover .ghost,
  .tile.can:focus-visible .ghost {
    opacity: 0.5;
  }
  .port {
    position: absolute;
    left: calc(50% - 4px + var(--dx) * (var(--t) / 2 - 5px));
    top: calc(50% - 4px + var(--dy) * (var(--t) / 2 - 5px));
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-left: 7px solid var(--f-yellow);
    transform-origin: 3.5px 4px;
  }
  .led {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid #000;
  }
  .st-ok {
    background: #3fb950;
  }
  .st-starved {
    background: #f2b632;
  }
  .st-blocked {
    background: #e0701a;
  }
  .st-power,
  .st-nofuel {
    background: #e5484d;
  }
  .st-off,
  .st-idle {
    background: #7a828c;
  }
  .mini {
    position: absolute;
    bottom: 1px;
    right: 1px;
    display: grid;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 4px;
    padding: 1px;
  }
  .side {
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    font-size: 11.5px;
    color: var(--f-muted);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .legend .led {
    position: static;
  }
  .dots {
    width: 20px;
    height: 6px;
    background: radial-gradient(circle, #f2b632 2px, transparent 2.5px) 0 0 / 7px 6px repeat-x;
  }
</style>
