<script lang="ts">
  // Shop → Gifts: turn one owned cosmetic into a gift code for a friend, or redeem a code you were sent.
  import { economy } from '../../lib/economy.svelte';
  import { store } from '../../lib/store.svelte';
  import { SHOP, shopItem } from '../../lib/economy';
  import { canRedeem, canSend, decodeGift, encodeGift, giftable, GIFTS_PER_DAY, redeemEntries, sendEntries, type Gift } from '../../lib/gifts';
  import { randomId } from '../../lib/b64url';
  import { friends } from '../../lib/social/friends.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { playSound } from '../../lib/sounds';

  const SENT_KEY = 'homework-todo:gifts-sent';
  interface Sent {
    code: string;
    item: string;
    to?: string;
    at: number;
  }
  function loadSent(): Sent[] {
    try {
      const v = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as unknown;
      return Array.isArray(v) ? (v as Sent[]).filter((x) => typeof x?.code === 'string').slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  const giftables = $derived(SHOP.filter((i) => giftable(i) && (economy.wallet.items[i.id] ?? 0) > 0));
  let pick = $state('');
  let to = $state('');
  let confirming = $state(false);
  let sent = $state<Sent[]>(loadSent());
  let paste = $state('');
  let message = $state('');
  const item = $derived(shopItem(pick) ?? giftables[0]);
  const sendCheck = $derived(item ? canSend(store.ledger, item.id, store.today) : null);

  function send() {
    // keep the item: once it leaves the inventory, `item` moves on to the next giftable one
    const given = item;
    if (!given || !sendCheck?.ok) return;
    const gift: Gift = {
      g: randomId(16),
      item: given.id,
      from: friends.profile.name.trim() || 'A friend',
      fe: friends.profile.emoji || '🎁',
      fid: friends.profile.id,
      at: Math.floor(Date.now() / 1000),
      ...(to ? { to } : {}),
    };
    store.addLedger(sendEntries(gift));
    // unequip what you gave away
    if (store.settings.equippedTitle === given.id) economy.equip('title', undefined);
    if (store.settings.equippedFrame === given.id) economy.equip('frame', undefined);
    if (store.settings.equippedConfetti === given.id) economy.equip('confetti', undefined);
    sent = [{ code: encodeGift(gift), item: given.id, to: friends.list.find((f) => f.card.id === to)?.card.name, at: gift.at }, ...sent].slice(0, 10);
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    } catch {
      /* ignore */
    }
    confirming = false;
    pick = '';
    playSound('pop');
    toasts.push({ message: `Gift code made for ${given.name}`, detail: 'Send the code to your friend.', kind: 'success', emoji: '🎁' });
  }

  function redeem(e: SubmitEvent) {
    e.preventDefault();
    const gift = decodeGift(paste);
    if (!gift) {
      message = "That isn't a gift code.";
      return;
    }
    const check = canRedeem(store.ledger, gift, friends.profile.id, store.today);
    if (!check.ok) {
      message = check.reason;
      return;
    }
    store.addLedger(redeemEntries(gift));
    const got = shopItem(gift.item)!;
    message = `${gift.fe} ${gift.from} sent you ${got.name}!`;
    paste = '';
    playSound('badge');
    toasts.push({ message: `Gift received: ${got.name}`, detail: `From ${gift.from}. Equip it in the Shop.`, kind: 'success', emoji: got.emoji });
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toasts.push({ message: 'Gift code copied', kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: "Couldn't copy: select it and copy it", kind: 'warn' });
    }
  }
</script>

<section class="card gifts glow-edge" aria-label="Gifts">
  <span class="bow" aria-hidden="true">🎀</span>
  <h2 class="sec">🎁 Gifts</h2>
  <p class="muted">
    Give one of your cosmetics (titles, frames, confetti) to a friend. Making a code takes the item out of your inventory; your friend redeems it once. Up to {GIFTS_PER_DAY} gifts sent
    and {GIFTS_PER_DAY} redeemed a day. There's no server, so a code works like a gift card: whoever pastes it first on their device gets it. Only share it with the friend it's for.
  </p>

  <div class="grid">
    <div class="col">
      <h3>Send a gift</h3>
      {#if !giftables.length}
        <p class="muted">Buy a title, frame or confetti style to have something to give.</p>
      {:else}
        <label class="field"
          >Item
          <select
            class="input"
            value={item?.id}
            onchange={(e) => {
              pick = e.currentTarget.value;
              confirming = false;
            }}
            aria-label="Item to give"
          >
            {#each giftables as g (g.id)}<option value={g.id}>{g.emoji} {g.name}</option>{/each}
          </select>
        </label>
        <label class="field"
          >For
          <select class="input" bind:value={to} aria-label="Who the gift is for">
            <option value="">Anyone with the code</option>
            {#each friends.list as f (f.card.id)}<option value={f.card.id}>{f.card.emoji} {f.card.name}</option>{/each}
          </select>
        </label>
        {#if confirming && item}
          <p class="warn">{item.emoji} {item.name} will leave your inventory. Make the code?</p>
          <div class="row">
            <button class="btn primary sm" onclick={send}>Yes, make the gift code</button>
            <button class="btn ghost sm" onclick={() => (confirming = false)}>Cancel</button>
          </div>
        {:else}
          <button class="btn sm" onclick={() => (confirming = true)} disabled={!sendCheck?.ok}>Make gift code</button>
          {#if sendCheck && !sendCheck.ok}<span class="muted">{sendCheck.reason}</span>{/if}
        {/if}
      {/if}
      {#if sent.length}
        <h3>Your gift codes</h3>
        <ul class="sent stagger">
          {#each sent as x (x.code)}
            <li>
              <span>{shopItem(x.item)?.emoji} {shopItem(x.item)?.name ?? x.item}{x.to ? ` for ${x.to}` : ''}</span>
              <input
                class="input mono"
                readonly
                value={x.code}
                aria-label="Gift code for {shopItem(x.item)?.name ?? x.item}"
                onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
              />
              <button class="btn ghost sm" onclick={() => copy(x.code)}>Copy</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <form class="col" onsubmit={redeem} aria-label="Redeem a gift">
      <h3>Redeem a gift</h3>
      <input class="input" bind:value={paste} placeholder="Paste a gift code" aria-label="Gift code" />
      <button class="btn sm primary" type="submit" disabled={!paste.trim()}>Redeem</button>
      <p class="msg" aria-live="polite" data-gift-message>
        {#key message}<span class="rise-in">{message}</span>{/key}
      </p>
    </form>
  </div>
</section>

<style>
  /* a gift-wrapped card: gradient hairline, a bow in the corner and a warm glow pool */
  .gifts {
    position: relative;
    margin-top: 18px;
    display: grid;
    gap: 8px;
    overflow: hidden;
  }
  .gifts::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(50% 60% at 100% 0%, color-mix(in srgb, #ff6fae 14%, transparent), transparent 70%);
  }
  .gifts > :not(.bow) {
    position: relative;
  }
  .bow {
    position: absolute;
    top: -6px;
    right: 10px;
    font-size: 30px;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
    animation: wiggle 3s ease-in-out infinite;
    transform-origin: 50% 20%;
    pointer-events: none;
  }
  :global([dir='rtl']) .bow {
    right: auto;
    left: 10px;
  }
  .sec {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .sec::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background: linear-gradient(135deg, #ff6fae, var(--accent));
    box-shadow: 0 0 8px color-mix(in srgb, #ff6fae 50%, transparent);
    flex-shrink: 0;
  }
  h3 {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
  }
  /* the two halves are inset panels */
  .col {
    display: grid;
    gap: 8px;
    align-content: start;
    padding: 12px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--bg-elev-2) 75%, transparent);
    border: 1px solid var(--border);
    box-shadow: inset 0 1px 0 var(--sheen);
    transition:
      border-color var(--dur),
      box-shadow var(--dur-slow) var(--ease);
  }
  .col:focus-within {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 24px -12px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .col .btn {
    justify-self: start;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .sent {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .sent li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 6px;
    font-size: 13px;
    padding: 8px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 16px -8px color-mix(in srgb, var(--gold) 60%, transparent);
  }
  .sent li span {
    grid-column: 1 / -1;
    font-weight: 700;
  }
  .mono {
    font-family: var(--mono);
    font-size: 11px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
    margin: 0;
  }
  .warn {
    font-size: 13px;
    font-weight: 600;
    color: var(--warn-text);
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 35%, transparent);
    animation: pop-in var(--dur-slow) var(--spring) backwards;
  }
  .msg {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    min-height: 18px;
  }
</style>
