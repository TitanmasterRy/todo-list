<script lang="ts">
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { SECTION_LABEL, SHOP, TITLE_TEXT, type ShopItem, type ShopSection } from '../../lib/economy';
  import { toasts } from '../../lib/toast.svelte';
  import QuestsCard from '../QuestsCard.svelte';
  import { activeSeason, inSeason, nextSeason, seasonById } from '../../lib/seasons';

  const sections: ShopSection[] = ['currency', 'boosts', 'cosmetics', 'seasonal', 'prizes'];
  const s = $derived(store.settings);
  const event = $derived(activeSeason(store.today));
  const upcoming = $derived(event ? undefined : nextSeason(store.today));
  const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  /** Limited items show during their event, and afterwards only to their owners (to equip). */
  function listed(item: ShopItem): boolean {
    if (item.section === 'prizes') return s.casinoEnabled;
    if (item.section !== 'seasonal') return true;
    return inSeason(item.season, store.today) || ownedCount(item.id) > 0;
  }

  function buy(item: ShopItem) {
    if (economy.buy(item.id)) toasts.push({ message: `Bought ${item.name}`, kind: 'success', emoji: item.emoji, timeout: 1800 });
  }
  function equipped(item: ShopItem): boolean {
    return (
      (item.kind === 'title' && s.equippedTitle === item.id) ||
      (item.kind === 'frame' && s.equippedFrame === item.id) ||
      (item.kind === 'confetti' && s.equippedConfetti === item.id)
    );
  }
  function toggleEquip(item: ShopItem) {
    if (item.kind !== 'title' && item.kind !== 'frame' && item.kind !== 'confetti') return;
    economy.equip(item.kind, equipped(item) ? undefined : item.id);
  }
  const ownedCount = (id: string) => economy.wallet.items[id] ?? 0;
</script>

<QuestsCard />
{#if event}
  {#await import('./EventQuests.svelte') then m}<m.default />{/await}
{/if}

{#if economy.deal}
  {@const d = economy.deal}
  <section class="card deal" aria-label="Deal of the day">
    <span class="tag">Deal of the day · 30% off</span>
    <div class="dl">
      <span class="emoji" aria-hidden="true">{d.item.emoji}</span>
      <div>
        <div class="name">{d.item.name}</div>
        <div class="desc">{d.item.description}</div>
      </div>
      {#if d.bought}
        <span class="got">Bought today</span>
      {:else}
        <button
          class="btn primary sm"
          onclick={() => economy.buy(d.item.id, { deal: true }) && toasts.push({ message: `Bought ${d.item.name} on sale`, kind: 'success', emoji: d.item.emoji, timeout: 1800 })}
          disabled={!economy.check(d.item, d.price).ok}
        >
          <s>{d.item.price}</s>
          {d.price} 🪙
        </button>
      {/if}
    </div>
  </section>
{/if}

{#each sections as sec (sec)}
  {@const items = SHOP.filter((i) => i.section === sec && listed(i))}
  {#if sec === 'seasonal' && (items.length || upcoming)}
    <h2 class="sec" data-seasonal>
      {SECTION_LABEL[sec]}{#if event}<span class="lim">{event.season.emoji} {event.season.name} · until {fmtDay(event.window.end)}</span>{/if}
    </h2>
    {#if upcoming}<p class="muted soon">
        Next event: {upcoming.season.emoji}
        {upcoming.season.name} in {upcoming.days} day{upcoming.days === 1 ? '' : 's'}. Limited items are only for sale during their event, and you keep them afterwards.
      </p>{/if}
  {:else if items.length}
    <h2 class="sec">{SECTION_LABEL[sec]}</h2>
  {/if}
  {#if items.length}
    <div class="items">
      {#each items as item (item.id)}
        {@const check = economy.check(item)}
        {@const own = ownedCount(item.id)}
        <div class="item card" class:owned={item.unique && own > 0}>
          <div class="emoji" aria-hidden="true">{item.emoji}</div>
          <div class="info">
            <div class="name">
              {item.name}{#if !item.unique && own > 0}<span class="own">×{own}</span>{/if}
            </div>
            <div class="desc">{item.description}</div>
          </div>
          <div class="act">
            {#if item.unique && own > 0}
              {#if item.kind === 'title' || item.kind === 'frame' || item.kind === 'confetti'}
                <button class="btn sm" class:primary={equipped(item)} onclick={() => toggleEquip(item)}>{equipped(item) ? 'Equipped' : 'Equip'}</button>
              {:else}
                <span class="got">Owned</span>
              {/if}
            {:else}
              <button class="btn sm primary" onclick={() => buy(item)} disabled={!check.ok} title={check.ok ? '' : check.reason}>
                {item.price.toLocaleString()}
                {item.pay === 'coins' ? '🪙' : '🎰'}
              </button>
              {#if !check.ok}<span class="why">{check.reason}</span>{/if}
            {/if}
            {#if item.season && !(item.unique && own > 0)}<span class="ltag">Limited · {seasonById(item.season)?.name}</span>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/each}

{#if s.equippedTitle}
  <p class="muted">Your title: <strong>{TITLE_TEXT[s.equippedTitle]}</strong> (shown in the sidebar and on Stats).</p>
{/if}
{#await import('./GiftsCard.svelte') then m}<m.default />{/await}

<p class="muted">Coins only come from schoolwork: tasks, the daily ring, streaks, grades, notecards and Pomodoros. Chips cash back at half value, a little a day (Wallet).</p>

<style>
  .deal {
    margin-bottom: 14px;
    border-color: color-mix(in srgb, var(--warn) 60%, var(--border));
    background: color-mix(in srgb, var(--warn) 8%, var(--bg-elev));
  }
  .tag {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 800;
    color: var(--warn-text);
  }
  .dl {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 6px;
  }
  .dl > div {
    flex: 1;
  }
  .dl s {
    opacity: 0.7;
  }
  .sec {
    font-size: 15px;
    margin: 18px 0 8px;
  }
  .items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 8px;
  }
  .item {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 4px 10px;
    align-items: center;
    padding: 12px;
  }
  .item.owned {
    opacity: 0.85;
  }
  .emoji {
    font-size: 28px;
    grid-row: span 2;
    text-align: center;
  }
  .name {
    font-weight: 700;
    font-size: 14px;
  }
  .own {
    margin-left: 6px;
    color: var(--accent-text);
  }
  .desc {
    font-size: 12px;
    color: var(--text-muted);
  }
  .act {
    grid-column: 2;
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }
  .why {
    font-size: 11px;
    color: var(--text-muted);
  }
  .got {
    font-size: 12px;
    color: var(--success-text);
    font-weight: 700;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .lim {
    margin-inline-start: 8px;
    font-size: 12px;
    font-weight: 700;
    color: var(--warn-text);
  }
  .soon {
    margin: 0 0 8px;
  }
  .ltag {
    font-size: 11px;
    font-weight: 700;
    color: var(--warn-text);
  }
</style>
