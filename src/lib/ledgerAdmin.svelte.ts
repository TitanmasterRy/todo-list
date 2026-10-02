// Admin panel → Economy → Tamper check: decide about ledger entries that failed the seal (ledgerSeal.ts).
// Kept out of the store so the first load doesn't carry admin-only code.
import { store } from './store.svelte';
import * as db from './storage';
import { emit } from './events';
import { sealEntry } from './ledgerSeal';
import type { LedgerEntry } from './types';

/** Count a set-aside entry after all (it gets a fresh seal). */
export function approveLedger(id: string): void {
  const e = store.rejectedLedger.find((x) => x.id === id);
  if (!e) return;
  const sealed = sealEntry({ ...($state.snapshot(e) as LedgerEntry), sig: undefined });
  store.rejectedLedger = store.rejectedLedger.filter((x) => x.id !== id);
  store.ledger = [...store.ledger.filter((x) => x.id !== id), sealed].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  db.putLedgerEntries([sealed]).catch((err) => console.error('save failed', err));
  emit('changed', { reason: 'ledger' });
}

/** Delete set-aside entries for good. */
export function discardRejected(ids: string[]): void {
  store.rejectedLedger = store.rejectedLedger.filter((x) => !ids.includes(x.id));
  db.deleteLedgerEntries(ids).catch((err) => console.error('save failed', err));
}
