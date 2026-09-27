<script lang="ts">
  // Tools → Periodic table: the full table (colored by block, with a category highlight), element details
  // with electron configuration, a molar mass calculator, and "make notecards" for the elements shown.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { CATEGORY_LABEL, electronConfig, ELEMENTS, molarMass, type Category, type Element } from '../../lib/elements';
  import { formatNumber, locale, t } from '../../lib/i18n/index.svelte';

  // names in the app language
  const names = $derived(locale() === 'en' ? null : t('pt.names').split('|'));
  const nameOf = (e: Element) => names?.[e.z - 1] ?? e.name;
  const catLabel = (c: Category) => t(`pt.cat.${c}`);
  const catPlural = (c: Category) => t(`pt.cats.${c}`);

  let selected = $state<Element>(ELEMENTS[0]);
  let highlight = $state<'' | Category | 'gas' | 'liquid'>('');
  let q = $state('');
  let formula = $state('');

  const matches = (e: Element): boolean => {
    const s = q.trim().toLowerCase();
    const inSearch = !s || e.symbol.toLowerCase() === s || e.name.toLowerCase().includes(s) || nameOf(e).toLowerCase().includes(s) || String(e.z) === s;
    const inHighlight = !highlight || e.category === highlight || e.state === highlight;
    return inSearch && inHighlight;
  };
  const shown = $derived(ELEMENTS.filter(matches));
  const filtering = $derived(!!q.trim() || !!highlight);

  // grid position: rows 1–7 by period and group; the lanthanide/actinide rows sit below (rows 9 and 10)
  function pos(e: Element): { row: number; col: number } {
    if (e.group !== null) return { row: e.period, col: e.group };
    const first = e.period === 6 ? 57 : 89;
    return { row: e.period === 6 ? 9 : 10, col: 3 + (e.z - first) };
  }
  const byPos = new Map(ELEMENTS.map((e) => [`${pos(e).row}:${pos(e).col}`, e]));

  function move(e: KeyboardEvent, el: Element) {
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    let { row, col } = pos(el);
    for (let i = 0; i < 20; i++) {
      row += d[0];
      col += d[1];
      if (row === 8) row += d[0]; // the gap above the f rows
      if (row < 1 || row > 10 || col < 1 || col > 18) return;
      const next = byPos.get(`${row}:${col}`);
      if (next) {
        selected = next;
        document.getElementById(`el-${next.z}`)?.focus();
        return;
      }
    }
  }

  const result = $derived.by(() => {
    if (!formula.trim()) return null;
    try {
      return { ok: true as const, r: molarMass(formula) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });
  const fmt = (n: number, d = 3) => formatNumber(n, { maximumFractionDigits: d });

  function makeCards() {
    const list = filtering ? shown : ELEMENTS;
    const group = highlight === 'gas' ? t('pt.gases') : highlight === 'liquid' ? t('pt.liquids') : highlight ? catPlural(highlight) : '';
    const name = group ? t('pt.deckOf', { group }) : t('pt.deck');
    const deck = store.decks.find((d) => d.name === name) ?? store.addDeck(name);
    const have = new Set(store.cards.filter((c) => c.deckId === deck.id).map((c) => c.front));
    const fresh = list.filter((e) => !have.has(e.symbol));
    store.addCards(
      deck.id,
      fresh.map((e) => ({ front: e.symbol, back: t('pt.cardBack', { name: nameOf(e), z: e.z }) })),
    );
    toasts.push({
      message: t('pt.added', { count: fresh.length, deck: deck.name }),
      detail: have.size ? t('pt.already', { count: list.length - fresh.length }) : undefined,
      kind: 'success',
      emoji: '🃏',
    });
  }
</script>

<section class="card pt">
  <div class="head">
    <h2>⚗️ {t('tools.elements')}</h2>
    <input class="input search" bind:value={q} placeholder={t('pt.findPh')} aria-label={t('pt.find')} />
    <select class="select" bind:value={highlight} aria-label={t('pt.highlight')}>
      <option value="">{t('pt.highlightPh')}</option>
      {#each Object.keys(CATEGORY_LABEL) as k (k)}<option value={k}>{catPlural(k as Category)}</option>{/each}
      <option value="gas">{t('pt.gasRoom')}</option>
      <option value="liquid">{t('pt.liquidRoom')}</option>
    </select>
    <button class="btn sm" onclick={makeCards}>🃏 {t('tools.notecards')}{filtering ? ` (${shown.length})` : ''}</button>
  </div>
  <div class="legend" aria-hidden="true">
    <span><i class="sw s"></i> {t('pt.block', { b: 's' })}</span>
    <span><i class="sw p"></i> {t('pt.block', { b: 'p' })}</span>
    <span><i class="sw d"></i> {t('pt.block', { b: 'd' })}</span>
    <span><i class="sw f"></i> {t('pt.block', { b: 'f' })}</span>
  </div>

  <div class="scroll">
    <div class="grid" role="group" aria-label={t('pt.gridLabel')}>
      {#each ELEMENTS as e (e.z)}
        {@const p = pos(e)}
        <button
          id="el-{e.z}"
          class="el {e.block}"
          class:dim={filtering && !matches(e)}
          class:sel={selected.z === e.z}
          style="grid-row:{p.row};grid-column:{p.col}"
          tabindex={selected.z === e.z ? 0 : -1}
          aria-label={t('pt.elLabel', { name: nameOf(e), symbol: e.symbol, z: e.z })}
          aria-pressed={selected.z === e.z}
          onclick={() => (selected = e)}
          onkeydown={(ev) => move(ev, e)}
        >
          <span class="z">{e.z}</span>
          <span class="sym">{e.symbol}</span>
          <span class="nm">{nameOf(e)}</span>
        </button>
      {/each}
      <span class="fmark" style="grid-row:6;grid-column:3" aria-hidden="true">57–71</span>
      <span class="fmark" style="grid-row:7;grid-column:3" aria-hidden="true">89–103</span>
    </div>
  </div>

  <div class="panels">
    <div class="detail" aria-live="polite">
      <div class="big {selected.block}"><span class="z">{selected.z}</span><span class="sym">{selected.symbol}</span></div>
      <div>
        <h3>{nameOf(selected)}</h3>
        <dl>
          <dt>{t('pt.mass')}</dt>
          <dd>{selected.massIsotope ? `[${selected.mass}]` : fmt(selected.mass, 4)} u{selected.massIsotope ? ` ${t('pt.isotope')}` : ''}</dd>
          <dt>{t('units.category')}</dt>
          <dd>{catLabel(selected.category)}</dd>
          <dt>{t('pt.position')}</dt>
          <dd>
            {t('pt.period', { n: selected.period })}{selected.group ? `, ${t('pt.group', { n: selected.group })}` : ''}, {t('pt.block', { b: selected.block })}
          </dd>
          <dt>{t('pt.room')}</dt>
          <dd>{t(`pt.state.${selected.state}`)}</dd>
          <dt>{t('pt.electrons')}</dt>
          <dd><code>{electronConfig(selected.z)}</code>{selected.z >= 104 ? ` ${t('pt.predicted')}` : ''}</dd>
        </dl>
        <button class="btn sm ghost" onclick={() => (formula += selected.symbol)}>{t('pt.addFormula')}</button>
      </div>
    </div>

    <div class="calc">
      <h3>{t('pt.molar')}</h3>
      <input class="input" bind:value={formula} placeholder="H2SO4, Ca(OH)2, CuSO4·5H2O" aria-label={t('pt.formula')} spellcheck="false" />
      {#if result?.ok}
        <p class="mm" role="status"><strong>{fmt(result.r.mass, 3)} g/mol</strong></p>
        <table>
          <thead><tr><th>{t('pt.element')}</th><th>{t('pt.atoms')}</th><th>{t('pt.massCol')}</th><th>{t('pt.pct')}</th></tr></thead>
          <tbody>
            {#each result.r.percent as p (p.symbol)}
              <tr><td>{p.symbol}</td><td>{p.atoms}</td><td>{fmt(p.mass, 3)}</td><td>{fmt(p.percent, 2)}%</td></tr>
            {/each}
          </tbody>
        </table>
      {:else if result}
        <p class="err" role="status">{result.error}</p>
      {:else}
        <p class="muted">{t('pt.typeFormula')}</p>
      {/if}
    </div>
  </div>
</section>

<style>
  /* block colors: three validated categorical hues (dark steps by default, light steps under the light theme);
     the f-block rows sit apart from the rest, so they use a neutral hatch instead of a fourth hue */
  .pt {
    --blk-s: #3987e5;
    --blk-p: #d95926;
    --blk-d: #199e70;
  }
  :global(:root[data-theme='light']) .pt,
  :global(:root[data-theme='system']:not(.force-dark)) .pt {
    --blk-s: #2a78d6;
    --blk-p: #eb6834;
    --blk-d: #1baf7a;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
    flex: 1 1 auto;
  }
  .head .select,
  .search {
    width: auto;
  }
  .search {
    flex: 0 1 180px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .sw {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: inline-block;
  }
  .sw.s,
  .el.s,
  .big.s {
    --c: var(--blk-s);
  }
  .sw.p,
  .el.p,
  .big.p {
    --c: var(--blk-p);
  }
  .sw.d,
  .el.d,
  .big.d {
    --c: var(--blk-d);
  }
  .sw {
    background: var(--c);
  }
  .sw.f,
  .el.f,
  .big.f {
    --c: var(--text-muted);
    background-image: repeating-linear-gradient(45deg, color-mix(in srgb, var(--text-muted) 22%, transparent) 0 2px, transparent 2px 6px);
  }
  .scroll {
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(18, minmax(44px, 1fr));
    grid-template-rows: repeat(7, auto) 10px repeat(2, auto);
    gap: 3px;
    min-width: 820px;
  }
  .el {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px 2px 4px;
    border-radius: 6px;
    background-color: color-mix(in srgb, var(--c) 16%, var(--bg-elev));
    border-top: 3px solid var(--c);
    color: var(--text);
    min-width: 0;
    transition: opacity 0.15s;
  }
  .el:hover {
    background-color: color-mix(in srgb, var(--c) 28%, var(--bg-elev));
  }
  .el.sel {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }
  .el.dim {
    opacity: 0.28;
  }
  .el .z {
    font-size: 9px;
    color: var(--text-muted);
    align-self: flex-start;
    line-height: 1;
  }
  .el .sym {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.1;
  }
  .el .nm {
    font-size: 8px;
    color: var(--text-muted);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fmark {
    font-size: 9px;
    color: var(--text-muted);
    display: grid;
    place-items: center;
    border: 1px dashed var(--border);
    border-radius: 6px;
  }
  .panels {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    margin-top: 12px;
  }
  @media (max-width: 760px) {
    .panels {
      grid-template-columns: 1fr;
    }
  }
  .detail {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .big {
    width: 76px;
    height: 76px;
    flex: none;
    border-radius: 10px;
    background-color: color-mix(in srgb, var(--c) 18%, var(--bg-elev));
    border-top: 4px solid var(--c);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .big .z {
    font-size: 11px;
    color: var(--text-muted);
  }
  .big .sym {
    font-size: 30px;
    font-weight: 700;
  }
  h3 {
    font-size: 15px;
    margin: 0 0 6px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0 0 8px;
    font-size: 13px;
  }
  dt {
    color: var(--text-muted);
  }
  dd {
    margin: 0;
  }
  .calc .input {
    font-family: var(--mono, monospace);
  }
  .mm {
    font-size: 18px;
    margin: 8px 0 4px;
  }
  table {
    border-collapse: collapse;
    font-size: 13px;
    width: 100%;
    max-width: 360px;
    font-variant-numeric: tabular-nums;
  }
  th {
    text-align: start;
    font-weight: 500;
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 6px;
  }
  td {
    padding: 2px 6px;
    border-top: 1px solid var(--border);
  }
  .err {
    color: var(--danger-text);
    font-size: 13px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
