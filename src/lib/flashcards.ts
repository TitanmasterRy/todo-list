// Leitner-box spaced repetition for notecards.
import type { Card } from './types';
import { addDaysKey } from './dates';

export const BOX_INTERVALS = [0, 1, 3, 7, 14]; // days until next review for boxes 1..5
export const MAX_BOX = 5;

export function review(card: Card, correct: boolean, today: string, now: string = new Date().toISOString()): Card {
  const box = correct ? Math.min(MAX_BOX, card.box + 1) : 1;
  const due = correct ? addDaysKey(today, BOX_INTERVALS[box - 1]) : today;
  return { ...card, box, due, reps: card.reps + 1, lapses: card.lapses + (correct ? 0 : 1), updatedAt: now };
}

export function dueCards(cards: Card[], today: string): Card[] {
  return cards.filter((c) => c.due <= today);
}

/** Deterministic shuffle so a study session order is stable for a given seed. */
export function shuffle<T>(arr: T[], seed = 1): T[] {
  const out = [...arr];
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Parse pasted text into cards. Supports "front :: back", "front - back", "front — back", "front\tback", "Q: ... A: ..." pairs, and "term: definition". */
export function parseCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let pendingQ: string | null = null;
  for (const line of lines) {
    const q = /^q(?:uestion)?\s*[:.)-]\s*(.+)$/i.exec(line);
    const a = /^a(?:nswer)?\s*[:.)-]\s*(.+)$/i.exec(line);
    if (q) {
      pendingQ = q[1].trim();
      continue;
    }
    if (a && pendingQ) {
      out.push({ front: pendingQ, back: a[1].trim() });
      pendingQ = null;
      continue;
    }
    const seps = ['::', '\t', ' — ', ' – ', ' - ', ' = '];
    let split: [string, string] | null = null;
    for (const sep of seps) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        split = [line.slice(0, idx), line.slice(idx + sep.length)];
        break;
      }
    }
    if (!split) {
      const m = /^([^:]{1,80}):\s+(.+)$/.exec(line);
      if (m) split = [m[1], m[2]];
    }
    if (split && split[0].trim() && split[1].trim()) out.push({ front: split[0].trim(), back: split[1].trim() });
  }
  return out;
}

/** Mastery 0–1: average box progress. */
export function mastery(cards: Card[]): number {
  if (!cards.length) return 0;
  return cards.reduce((a, c) => a + (c.box - 1) / (MAX_BOX - 1), 0) / cards.length;
}
