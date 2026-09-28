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
  <section class="card deal" class:bought={d.bought} aria-label="Deal of the day">
    <span class="ribbon" aria-hidden="true">30% off</span>
    <span class="tag">Deal of the day · 30% off</span>
    <div class="dl">
      <span class="emoji hero" aria-hidden="true">{d.item.emoji}</span>
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
    <div class="items stagger">
      {#each items as item, i (item.id)}
        {@const check = economy.check(item)}
        {@const own = ownedCount(item.id)}
        <div class="item card lift" class:owned={item.unique && own > 0} class:equipped={equipped(item)} style="--hue:{(i * 47 + 200) % 360}">
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
                <span class="got"><span class="chk" aria-hidden="true">✓</span>Owned</span>
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
  /* ---- deal of the day: a gold-edged hero card with a corner ribbon and a passing shimmer ---- */
  .deal {
    position: relative;
    margin-bottom: 14px;
    overflow: hidden;
    border-color: transparent;
    background:
      linear-gradient(var(--bg-elev), var(--bg-elev)) padding-box,
      var(--grad-gold) border-box;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 34px -10px color-mix(in srgb, var(--gold) 60%, transparent);
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .deal::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(70% 90% at 0% 0%, color-mix(in srgb, var(--gold) 16%, transparent), transparent 60%);
  }
  .deal::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.14) 50%, transparent 60%);
    transform: translateX(-130%);
    animation: sheen 2.6s var(--ease) 600ms infinite;
  }
  .deal.bought::after {
    animation: none;
  }
  .deal > * {
    position: relative;
    z-index: 1;
  }
  .ribbon {
    position: absolute;
    top: 14px;
    right: -34px;
    z-index: 2;
    padding: 3px 40px;
    transform: rotate(35deg);
    background: var(--grad-gold);
    color: #3a2a00;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.5),
      0 4px 12px -4px rgba(0, 0, 0, 0.4);
  }
  :global([dir='rtl']) .ribbon {
    right: auto;
    left: -34px;
    transform: rotate(-35deg);
  }
  .tag {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 800;
    color: var(--warn-text);
  }
  .dl {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-top: 6px;
  }
  .dl > div {
    flex: 1;
  }
  .dl s {
    opacity: 0.7;
    margin-inline-end: 4px;
  }
  .emoji.hero {
    display: grid;
    place-items: center;
    width: 60px;
    height: 60px;
    border-radius: 16px;
    font-size: 34px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 35%, transparent), color-mix(in srgb, var(--gold) 8%, transparent));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 8px 20px -8px color-mix(in srgb, var(--gold) 70%, transparent);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
    animation: float 3.4s ease-in-out infinite;
  }
  .deal .name {
    font-size: 16px;
  }
  /* ---- section headings with a gradient bar ---- */
  .sec {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    margin: 20px 0 8px;
    letter-spacing: -0.01em;
  }
  .sec::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: var(--grad-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
    flex-shrink: 0;
  }
  .sec[data-seasonal]::before {
    background: var(--grad-gold);
    box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  /* ---- item cards: a hue-tinted emoji badge, lift on hover, glowing owned/equipped states ---- */
  .items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 8px;
  }
  .item {
    position: relative;
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: 4px 12px;
    align-items: center;
    padding: 12px;
    overflow: hidden;
    background: radial-gradient(60% 50% at 100% 0%, hsl(var(--hue) 80% 60% / 0.1), transparent 70%), var(--bg-elev);
  }
  .item .emoji {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    font-size: 24px;
    grid-row: span 2;
    background: linear-gradient(135deg, hsl(var(--hue) 80% 60% / 0.28), hsl(var(--hue) 80% 60% / 0.08));
    border: 1px solid hsl(var(--hue) 80% 60% / 0.3);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    filter: drop-shadow(0 3px 6px hsl(var(--hue) 80% 40% / 0.4));
    transition: transform var(--dur-slow) var(--spring);
  }
  .item:hover .emoji {
    transform: scale(1.12) rotate(-6deg);
  }
  .item.owned {
    border-color: color-mix(in srgb, var(--success) 45%, var(--border));
    background: radial-gradient(60% 50% at 100% 0%, color-mix(in srgb, var(--success) 14%, transparent), transparent 70%), var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 22px -10px color-mix(in srgb, var(--success) 60%, transparent);
  }
  .item.equipped {
    border-color: color-mix(in srgb, var(--gold) 60%, var(--border));
    background: radial-gradient(60% 50% at 100% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%), var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm),
      0 0 26px -8px color-mix(in srgb, var(--gold) 65%, transparent);
  }
  .item.equipped .emoji {
    background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 40%, transparent), color-mix(in srgb, var(--gold) 10%, transparent));
    border-color: color-mix(in srgb, var(--gold) 50%, transparent);
  }
  .name {
    font-weight: 700;
    font-size: 14px;
  }
  .own {
    margin-inline-start: 6px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 12px;
    color: var(--accent-text);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    font-variant-numeric: tabular-nums;
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
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .act .btn {
    font-variant-numeric: tabular-nums;
  }
  .why {
    font-size: 11px;
    color: var(--text-muted);
  }
  .got {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--success-text);
    font-weight: 700;
    padding: 3px 10px 3px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--success) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--success) 35%, transparent);
    box-shadow: 0 0 12px -4px color-mix(in srgb, var(--success) 60%, transparent);
  }
  .chk {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    font-size: 10px;
    color: #fff;
    background: var(--success);
    animation: pop-in var(--dur-slow) var(--spring) both;
  }
  .deal .got {
    padding: 4px 12px;
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
    padding: 1px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--warn) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 35%, transparent);
  }
</style>
