// Economy runtime: pays coins for schoolwork (listening to app events), runs the shop, and moves chips
// and vouchers for the casino and arcade. All state lives in store.ledger so it syncs like everything else.
import { store } from './store.svelte';
import { on } from './events';
import { balances, canBuy, CASINO_ACHIEVEMENTS, coinsForStreak, coinsForXp, owned, purchaseEntries, REWARDS, shopItem, type ShopItem } from './economy';
import { ALL_DONE_BONUS, DEAL_DISCOUNT, dealOfDay, questsFor, type QuestDef } from './quests';
import { toasts } from './toast.svelte';
import { MAX_FREEZES } from './gamification';
import { playSound } from './sounds';
import type { Currency, LedgerEntry } from './types';

export interface Pop {
  id: number;
  text: string;
}

let popId = 1;

class Economy {
  wallet = $derived(balances(store.ledger));
  enabled = $derived(store.settings.economyEnabled);
  pops = $state<Pop[]>([]);

  /** Casino session stats (reset when you leave the casino). */
  session = $state({ startedAt: 0, rounds: 0, wagered: 0, returned: 0, reminded: false });

  private pop(amount: number, currency: Currency): void {
    const emoji = currency === 'coins' ? '🪙' : currency === 'chips' ? '🎰' : '🎟️';
    const p = { id: popId++, text: `${amount > 0 ? '+' : ''}${amount.toLocaleString()} ${emoji}` };
    this.pops = [...this.pops, p].slice(-4);
    setTimeout(() => (this.pops = this.pops.filter((x) => x.id !== p.id)), 1800);
  }

  hasEntry(reason: string, ref: string): boolean {
    return store.ledger.some((e) => e.reason === reason && e.ref === ref);
  }

  earn(amount: number, reason: string, ref?: string, currency: Currency = 'coins'): void {
    if (!this.enabled || amount <= 0) return;
    store.addLedger([{ currency, amount, reason, ref }]);
    this.pop(amount, currency);
  }

  // ---------- shop ----------
  /** Today's discounted item (30% off, once a day). */
  deal = $derived.by(() => {
    // skip items already owned, except the one bought as today's deal (so the deal stays put after buying it)
    const id = dealOfDay(store.today, (x) => !!shopItem(x)?.unique && owned(store.ledger, x) > 0 && !this.hasEntry(`shop:${x}`, `deal:${store.today}`));
    const item = id ? shopItem(id) : undefined;
    if (!item) return undefined;
    return { item, price: Math.max(1, Math.round(item.price * (1 - DEAL_DISCOUNT))), bought: this.hasEntry(`shop:${item.id}`, `deal:${store.today}`) };
  });

  check(item: ShopItem, price?: number) {
    return canBuy(store.ledger, item, { freezes: store.stats.streak.freezes, maxFreezes: MAX_FREEZES, price });
  }

  buy(id: string, opts: { deal?: boolean } = {}): boolean {
    const item = shopItem(id);
    if (!item) return false;
    const deal = opts.deal && this.deal && this.deal.item.id === id && !this.deal.bought ? this.deal : undefined;
    const price = deal?.price ?? item.price;
    if (!this.check(item, price).ok) return false;
    if (item.kind === 'freeze' && !store.addStreakFreeze(MAX_FREEZES)) return false;
    store.addLedger(purchaseEntries(item, price, deal ? `deal:${store.today}` : undefined));
    playSound('pop');
    // cosmetics are equipped straight away the first time
    if (item.kind === 'title' && !store.settings.equippedTitle) store.updateSettings({ equippedTitle: item.id });
    if (item.kind === 'frame' && !store.settings.equippedFrame) store.updateSettings({ equippedFrame: item.id });
    if (item.kind === 'confetti' && !store.settings.equippedConfetti) store.updateSettings({ equippedConfetti: item.id });
    return true;
  }

  equip(kind: 'title' | 'frame' | 'confetti', id: string | undefined): void {
    const key = kind === 'title' ? 'equippedTitle' : kind === 'frame' ? 'equippedFrame' : 'equippedConfetti';
    store.updateSettings({ [key]: id });
  }

  // ---------- daily quests ----------
  quests = $derived.by(() => {
    const ctx = { today: store.today, tasks: store.tasks, stats: store.stats, cards: store.cards, dailyGoal: store.settings.dailyGoal || 3 };
    return questsFor(ctx).map((q) => {
      const progress = Math.min(q.goal, q.progress(ctx));
      return { ...q, progress, done: progress >= q.goal, claimed: this.hasEntry('quest', `${store.today}:${q.id}`) };
    });
  });
  allQuestsClaimed = $derived(this.quests.length > 0 && this.quests.every((q) => q.claimed));

  claimQuest(q: Pick<QuestDef, 'id' | 'reward'> & { done: boolean; claimed: boolean }): void {
    if (!q.done || q.claimed) return;
    this.earn(q.reward, 'quest', `${store.today}:${q.id}`);
    playSound('pop');
    // bonus once all three are claimed
    const others = this.quests.filter((x) => x.id !== q.id);
    if (others.every((x) => x.claimed) && !this.hasEntry('quest', `${store.today}:all`)) {
      this.earn(ALL_DONE_BONUS, 'quest', `${store.today}:all`);
      toasts.push({ message: 'All daily quests done!', detail: `+${ALL_DONE_BONUS} bonus coins`, kind: 'success', emoji: '🏅' });
    }
  }

  // ---------- casino achievements ----------
  achievements = $derived(CASINO_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: owned(store.ledger, `ach-${a.id}`) > 0 })));

  achieve(id: string): void {
    const a = CASINO_ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || !this.enabled || owned(store.ledger, `ach-${id}`) > 0) return;
    store.addLedger([
      { currency: `item:ach-${id}`, amount: 1, reason: 'achievement', ref: id },
      { currency: 'chips', amount: a.chips, reason: 'achievement', ref: id },
    ]);
    toasts.push({ message: `Achievement: ${a.name}`, detail: `${a.description} +${a.chips} chips`, kind: 'badge', emoji: a.emoji, timeout: 5000 });
    playSound('badge');
  }

  private lastBet = new Map<string, number>();

  // ---------- casino ----------
  /** Take a bet. Returns false when there aren't enough chips. */
  bet(game: string, amount: number): boolean {
    amount = Math.floor(amount);
    if (amount <= 0 || this.wallet.chips < amount) return false;
    store.addLedger([{ currency: 'chips', amount: -amount, reason: `casino:${game}` }]);
    this.lastBet.set(game, amount);
    this.achieve('first-bet');
    if (store.ledger.filter((e) => e.currency === 'chips' && e.amount < 0 && e.reason.startsWith('casino:')).length >= 100) this.achieve('regular');
    if (!this.session.startedAt) this.session.startedAt = Date.now();
    this.session.rounds++;
    this.session.wagered += amount;
    return true;
  }

  /** Return chips to the player at the end of a round (stake + winnings). */
  payout(game: string, amount: number): void {
    amount = Math.floor(amount);
    if (amount <= 0) return;
    store.addLedger([{ currency: 'chips', amount, reason: `casino:${game}` }]);
    this.session.returned += amount;
    const bet = this.lastBet.get(game) ?? 0;
    if (bet > 0 && amount >= bet * 50) this.achieve('jackpot');
  }

  /** Add to a bet that's already running (blackjack double down). */
  raise(game: string, amount: number): boolean {
    amount = Math.floor(amount);
    if (amount <= 0 || this.wallet.chips < amount) return false;
    store.addLedger([{ currency: 'chips', amount: -amount, reason: `casino:${game}` }]);
    this.session.wagered += amount;
    return true;
  }

  resetSession(): void {
    this.session = { startedAt: 0, rounds: 0, wagered: 0, returned: 0, reminded: false };
  }

  // ---------- arcade ----------
  spendVouchers(gameId: string, cost: number): boolean {
    if (cost <= 0) return true;
    if (this.wallet.vouchers < cost) return false;
    store.addLedger([{ currency: 'vouchers', amount: -cost, reason: `arcade:${gameId}`, ref: gameId }]);
    return true;
  }

  history(limit = 100): LedgerEntry[] {
    return store.ledger.slice(-limit).reverse();
  }
}

export const economy = new Economy();

let started = false;
/** Wire earning to app events. Called once after the store loads. */
export function startEconomy(): void {
  if (started) return;
  started = true;

  on('completed', ({ task, xp, ringClosed }) => {
    // a task pays coins once: reopening and re-completing it doesn't pay again (undo reverses the payment)
    const net = store.ledger.filter((e) => e.ref === task.id && e.currency === 'coins' && (e.reason === 'task' || e.reason === 'undo')).reduce((a, e) => a + e.amount, 0);
    if (net > 0) return;
    let coins = coinsForXp(xp.total);
    if (economy.enabled && economy.wallet.items.booster > 0) {
      store.addLedger([{ currency: 'item:booster', amount: -1, reason: 'booster', ref: task.id }]);
      coins *= 2;
    }
    economy.earn(coins, 'task', task.id);
    if (ringClosed) {
      const day = store.today;
      if (!economy.hasEntry('ring', day)) economy.earn(REWARDS.ring, 'ring', day);
      if (store.settings.casinoEnabled && !economy.hasEntry('ring-chips', day)) economy.earn(REWARDS.dailyChipBonus, 'ring-chips', day, 'chips');
    }
  });

  on('uncompleted', ({ task }) => {
    // reverse the coins (and any booster charge) this completion paid
    const paid = store.ledger.filter((e) => e.ref === task.id && e.currency === 'coins' && (e.reason === 'task' || e.reason === 'undo')).reduce((a, e) => a + e.amount, 0);
    const boost = store.ledger.filter((e) => e.ref === task.id && e.currency === 'item:booster').reduce((a, e) => a + e.amount, 0);
    const entries: Omit<LedgerEntry, 'id' | 'at'>[] = [];
    if (paid > 0) entries.push({ currency: 'coins', amount: -paid, reason: 'undo', ref: task.id });
    if (boost < 0) entries.push({ currency: 'item:booster', amount: -boost, reason: 'undo', ref: task.id });
    if (entries.length) store.addLedger(entries);
  });

  on('levelup', ({ level }) => {
    const ref = `level:${level}`;
    if (!economy.hasEntry('levelup', ref)) economy.earn(level * REWARDS.levelUpPerLevel, 'levelup', ref);
  });

  on('graded', ({ task, xp }) => economy.earn(coinsForXp(xp), 'grade', task.id));
  on('studied', ({ xp }) => economy.earn(coinsForXp(xp), 'study'));
  on('pomodoroDone', () => economy.earn(REWARDS.pomodoro, 'pomodoro'));
  on('streakMilestone', ({ days }) => {
    const ref = `streak:${days}:${store.today}`;
    if (!economy.hasEntry('streak', ref)) economy.earn(coinsForStreak(days), 'streak', ref);
  });
}
