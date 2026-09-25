// Economy runtime: pays coins for schoolwork (listening to app events), runs the shop, and moves chips
// and vouchers for the casino and arcade. All state lives in store.ledger so it syncs like everything else.
import { store } from './store.svelte';
import { on } from './events';
import { balances, canBuy, coinsForStreak, coinsForXp, purchaseEntries, REWARDS, shopItem, type ShopItem } from './economy';
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
  check(item: ShopItem) {
    return canBuy(store.ledger, item, { freezes: store.stats.streak.freezes, maxFreezes: MAX_FREEZES });
  }

  buy(id: string): boolean {
    const item = shopItem(id);
    if (!item) return false;
    if (!this.check(item).ok) return false;
    if (item.kind === 'freeze' && !store.addStreakFreeze(MAX_FREEZES)) return false;
    store.addLedger(purchaseEntries(item));
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

  // ---------- casino ----------
  /** Take a bet. Returns false when there aren't enough chips. */
  bet(game: string, amount: number): boolean {
    amount = Math.floor(amount);
    if (amount <= 0 || this.wallet.chips < amount) return false;
    store.addLedger([{ currency: 'chips', amount: -amount, reason: `casino:${game}` }]);
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
