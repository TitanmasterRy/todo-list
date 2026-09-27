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

<section class="card gifts" aria-label="Gifts">
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
        <ul class="sent">
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
      <p class="msg" aria-live="polite" data-gift-message>{message}</p>
    </form>
  </div>
</section>

<style>
  .gifts {
    margin-top: 18px;
    display: grid;
    gap: 8px;
  }
  .sec {
    font-size: 15px;
    margin: 0;
  }
  h3 {
    font-size: 13px;
    margin: 4px 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }
  .col .btn {
    justify-self: start;
  }
  .col {
    display: grid;
    gap: 6px;
    align-content: start;
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
  }
  .sent li span {
    grid-column: 1 / -1;
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
    margin: 0;
  }
  .msg {
    font-size: 13px;
    margin: 0;
    min-height: 18px;
  }
</style>
