import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { balances } from './economy';
import { ledgerSig } from './ledgerSeal';
import type { LedgerEntry } from './types';

// A real (in-memory) localStorage, installed before the modules read it.
class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
Object.assign(globalThis, { localStorage: new MemoryStorage() });

let store: typeof import('./store.svelte').store;
let db: typeof import('./storage');
beforeAll(async () => {
  store = (await import('./store.svelte')).store;
  db = await import('./storage');
  const { startEconomy } = await import('./economy.svelte');
  store.updateSettings({ economyEnabled: true, gamification: true });
  startEconomy();
  await db.putMeta('ledgerSeal', 1);
  await store.checkStoredLedger([]); // what init does: loads the seal
});

const coins = () => balances(store.ledger).coins;
const forged = (amount: number): LedgerEntry => ({ id: `forged-${amount}`, at: new Date().toISOString(), currency: 'coins', amount, reason: 'task' });

describe('reopening a done task and completing it again', () => {
  it('pays XP and coins once, and puts the task back on its first completion', () => {
    const task = store.addTask({ title: 'Read chapter 4' }, { describe: false });
    store.completeTask(task.id);
    const first = store.taskById(task.id)!;
    const after = { xp: store.stats.xp, total: store.stats.totalCompleted, coins: coins(), days: { ...store.stats.completionsByDay } };
    expect(after.coins).toBeGreaterThan(0);
    expect(first.rewardedAt).toBe(first.completedAt);

    for (let i = 0; i < 3; i++) {
      store.uncompleteTask(task.id); // out of the Done list
      expect(store.taskById(task.id)!.completedAt).toBeUndefined();
      store.completeTask(task.id); // and back
    }
    expect(store.stats.xp).toBe(after.xp);
    expect(store.stats.totalCompleted).toBe(after.total);
    expect(store.stats.completionsByDay).toEqual(after.days);
    expect(coins()).toBe(after.coins);
    expect(store.taskById(task.id)!.completedAt).toBe(first.completedAt);
  });

  it('the Kanban board path (Done → To do → Done) pays nothing twice either', () => {
    const task = store.addTask({ title: 'Lab report' }, { describe: false });
    store.moveToColumn(task.id, 'done');
    const xp = store.stats.xp;
    const paid = coins();
    store.moveToColumn(task.id, 'todo');
    store.moveToColumn(task.id, 'done');
    expect(store.stats.xp).toBe(xp);
    expect(coins()).toBe(paid);
  });

  it('a task completed before rewardedAt existed is covered too', () => {
    const task = store.addTask({ title: 'Old task' }, { describe: false });
    store.completeTask(task.id);
    store.tasks = store.tasks.map((t) => (t.id === task.id ? { ...t, rewardedAt: undefined } : t));
    const xp = store.stats.xp;
    store.uncompleteTask(task.id);
    store.completeTask(task.id);
    expect(store.stats.xp).toBe(xp);
  });
});

describe('recurring tasks', () => {
  it('the next occurrence of a task planned for today does not land on Today', () => {
    const task = store.addTask({ title: 'Daily practice', recurrence: { kind: 'daily' } }, { describe: false });
    store.updateTask(task.id, { pinnedDay: store.today });
    store.completeTask(task.id);
    const next = store.tasks.find((t) => t.title === 'Daily practice' && !t.completedAt)!;
    expect(next).toBeDefined();
    expect(next.pinnedDay).toBeUndefined();
    expect(next.rewardedAt).toBeUndefined();
    expect(store.todayTasks.some((t) => t.id === next.id)).toBe(false);
  });
});

describe('ledger seal', () => {
  it('seals every entry the app writes', () => {
    const [e] = store.addLedger([{ currency: 'coins', amount: 5, reason: 'admin' }]);
    expect(e.sig).toBe(ledgerSig(e));
  });

  it('a backup or synced copy cannot bring in coins typed into the file', async () => {
    const before = coins();
    const bundle = store.snapshotBundle();
    const tampered = { ...forged(1000), sig: 'made-up' };
    const edited = bundle.ledger!.map((e, i) => (i === 0 ? { ...e, amount: e.amount + 500 } : e));
    await store.loadBundle({ ...bundle, ledger: [...edited, forged(999), tampered] });
    expect(store.rejectedLedger.map((e) => e.id).sort()).toEqual([bundle.ledger![0].id, 'forged-1000', 'forged-999'].sort());
    expect(coins()).toBe(before - bundle.ledger![0].amount);
    expect(store.snapshotBundle().ledger!.some((e) => e.id.startsWith('forged'))).toBe(false);
  });

  it('only an admin can let a set-aside entry count', async () => {
    const before = coins();
    const { approveLedger, discardRejected } = await import('./ledgerAdmin.svelte');
    approveLedger('forged-999');
    expect(coins()).toBe(before + 999);
    discardRejected(store.rejectedLedger.map((e) => e.id));
    expect(store.rejectedLedger).toEqual([]);
  });

  it('stamps what a device already had once, then sets unsealed entries aside', async () => {
    await db.putMeta('ledgerSeal', undefined);
    const old = forged(7);
    const sealed = await store.checkStoredLedger([old]);
    expect(sealed[0].sig).toBe(ledgerSig(old));
    expect(await db.getMeta('ledgerSeal')).toBe(1);
    expect(await store.checkStoredLedger([forged(8)])).toEqual([]);
    expect(store.rejectedLedger.map((e) => e.id)).toEqual(['forged-8']);
  });
});
