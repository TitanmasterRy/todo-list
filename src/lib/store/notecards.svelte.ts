// Store methods: Notecard decks and cards, and study sessions.
// Attached to Store.prototype in store.svelte.ts, so they're called as store.method(...) like the rest.
import * as db from '../storage';
import type { Card, Deck, Stats } from '../types';
import { uid } from '../id';
import { isoNow } from '../dates';
import { applyStudySession } from '../gamification';
import { review as reviewCard } from '../flashcards';
import { undo } from '../undo.svelte';
import { emit } from '../events';
import type { Store } from '../store.svelte';

export const notecardsMethods = {
  // ---------- notecards ----------
  persistCards(this: Store, cards: Card[]): void {
    db.putCards(cards.map((c) => $state.snapshot(c) as Card)).catch((e) => console.error(e));
    emit('changed', { reason: 'cards' });
  },
  addDeck(this: Store, name: string, courseId?: string): Deck {
    const now = isoNow();
    const d: Deck = { id: uid('deck'), name: name.trim() || 'Untitled deck', courseId, createdAt: now, updatedAt: now };
    this.decks = [...this.decks, d];
    db.putDeck(d).catch((e) => console.error(e));
    emit('changed', { reason: 'deck' });
    return d;
  },
  updateDeck(this: Store, id: string, patch: Partial<Deck>): void {
    const prev = this.decks.find((d) => d.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: isoNow() };
    this.decks = this.decks.map((d) => (d.id === id ? next : d));
    db.putDeck(next).catch((e) => console.error(e));
    emit('changed', { reason: 'deck' });
  },
  deleteDeck(this: Store, id: string): void {
    const deck = this.decks.find((d) => d.id === id);
    if (!deck) return;
    const cards = this.cards.filter((c) => c.deckId === id).map((c) => structuredClone($state.snapshot(c)) as Card);
    this.decks = this.decks.filter((d) => d.id !== id);
    this.cards = this.cards.filter((c) => c.deckId !== id);
    db.deleteDeck(id).catch((e) => console.error(e));
    this.bury('deck', [id]);
    emit('changed', { reason: 'deck' });
    undo.push(
      {
        label: `Deleted deck “${deck.name}”`,
        undo: () => {
          const now = isoNow();
          const d = { ...deck, updatedAt: now };
          const back = cards.map((c) => ({ ...c, updatedAt: now }));
          this.unbury('deck', [id]);
          this.decks = [...this.decks, d];
          this.cards = [...this.cards, ...back];
          db.putDeck(d).catch(() => {});
          this.persistCards(back);
        },
      },
      { kind: 'warn' },
    );
  },
  addCards(this: Store, deckId: string, items: { front: string; back: string; frontImage?: string; backImage?: string; noteId?: string }[]): Card[] {
    const now = isoNow();
    const cards: Card[] = items
      .filter((i) => (i.front.trim() || i.frontImage) && (i.back.trim() || i.backImage))
      .map((i) => ({
        id: uid('card'),
        deckId,
        front: i.front.trim(),
        back: i.back.trim(),
        box: 1,
        due: this.today,
        reps: 0,
        lapses: 0,
        createdAt: now,
        updatedAt: now,
        ...(i.frontImage ? { frontImage: i.frontImage } : {}),
        ...(i.backImage ? { backImage: i.backImage } : {}),
        ...(i.noteId ? { noteId: i.noteId } : {}),
      }));
    if (!cards.length) return [];
    this.cards = [...this.cards, ...cards];
    this.persistCards(cards);
    this.updateDeck(deckId, {});
    return cards;
  },
  updateCard(this: Store, id: string, patch: Partial<Card>): void {
    const prev = this.cards.find((c) => c.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: isoNow() };
    this.cards = this.cards.map((c) => (c.id === id ? next : c));
    this.persistCards([next]);
  },
  deleteCard(this: Store, id: string): void {
    const card = this.cards.find((c) => c.id === id);
    if (!card) return;
    const snap = structuredClone($state.snapshot(card)) as Card;
    this.cards = this.cards.filter((c) => c.id !== id);
    db.deleteCard(id).catch((e) => console.error(e));
    this.bury('card', [id]);
    undo.push({
      label: 'Deleted card',
      undo: () => {
        const back = { ...snap, updatedAt: isoNow() };
        this.unbury('card', [id]);
        this.cards = [...this.cards, back];
        this.persistCards([back]);
      },
    });
  },
  /** Record one answer during a study session. */
  /** Record one answer: true/false (Good/Again) or an FSRS rating 1–4. */
  answerCard(this: Store, id: string, correct: boolean | 1 | 2 | 3 | 4): void {
    const card = this.cards.find((c) => c.id === id);
    if (!card) return;
    const next = reviewCard($state.snapshot(card) as Card, correct, this.today);
    this.cards = this.cards.map((c) => (c.id === id ? next : c));
    this.persistCards([next]);
  },
  /** Award XP at the end of a study session. */
  finishStudySession(this: Store, reviewed: number, correct: number, clearedAll: boolean): void {
    if (!reviewed) return;
    const r = applyStudySession($state.snapshot(this.stats) as Stats, reviewed, correct, clearedAll, this.today, this.openTasks.length);
    this.stats = r.stats;
    this.persistStats();
    emit('studied', { reviewed, correct, xp: r.xp.xp, clearedAll, leveledUp: r.leveledUp, newLevel: r.newLevel, newBadges: r.newBadges });
    if (r.leveledUp) emit('levelup', { level: r.newLevel });
    for (const b of r.newBadges) emit('badge', { id: b });
  },
};
