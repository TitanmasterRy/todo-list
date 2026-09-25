// Notecards: review scheduling (FSRS, see fsrs.ts), pasted-card parsing, cloze notes and mastery.
import type { Card } from './types';
import { schedule, type Rating } from './fsrs';

export const MAX_BOX = 5;

/** Record an answer. `correct` true/false maps to Good/Again; pass a Rating for Hard/Easy. */
export function review(card: Card, answer: boolean | Rating, today: string, now: string = new Date().toISOString()): Card {
  const rating: Rating = typeof answer === 'number' ? answer : answer ? 3 : 1;
  return { ...schedule(card, rating, today), updatedAt: now };
}

/**
 * Cloze deletions: "The {{c1::mitochondria}} makes {{c2::ATP}}" becomes one card per number (Anki style),
 * and plain "{{word}}" blanks each become their own card. Optional hints: {{c1::answer::hint}}.
 */
export function parseCloze(text: string): { front: string; back: string }[] {
  const re = /\{\{(?:c(\d+)::)?([^{}]+?)(?:::([^{}]+))?\}\}/g;
  const matches = [...text.matchAll(re)];
  if (!matches.length) return [];
  let auto = 1000;
  const groups = new Map<string, number[]>();
  matches.forEach((m, i) => {
    const key = m[1] ?? String(auto++);
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const answerOf = (m: RegExpMatchArray) => m[2].trim();
  const full = text.replace(re, (_all, _n, ans) => ans.trim());
  return [...groups.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, idxs]) => {
      let i = -1;
      const front = text.replace(re, (_all, _n, ans: string, hint?: string) => {
        i++;
        return idxs.includes(i) ? `[${hint ? hint.trim() : '…'}]` : ans.trim();
      });
      return { front, back: `${idxs.map((k) => answerOf(matches[k])).join(', ')}\n\n${full}` };
    });
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
