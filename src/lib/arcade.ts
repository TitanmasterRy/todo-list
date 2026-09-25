// Arcade: games the site admin lists in games/games.json (HTML files in public/games/ or embed links),
// plus games added in this browser's admin panel. Games run in sandboxed iframes and cost vouchers.
import type { ArcadeGame, ThemePack } from './types';

export const THEME_PACKS: ThemePack[] = ['classic', 'sleek', 'cute', 'arcade', 'nature', 'space', 'paper'];

/** Validate one manifest entry. Returns null (and a reason) for anything unsafe or incomplete. */
export function validateGame(raw: unknown): { game: ArcadeGame | null; error?: string } {
  if (!raw || typeof raw !== 'object') return { game: null, error: 'not an object' };
  const g = raw as Record<string, unknown>;
  const id = typeof g.id === 'string' ? g.id.trim() : '';
  if (!/^[a-z0-9][a-z0-9-_]{0,48}$/i.test(id)) return { game: null, error: `bad id “${String(g.id)}”` };
  const title = typeof g.title === 'string' ? g.title.trim().slice(0, 60) : '';
  if (!title) return { game: null, error: `${id}: missing title` };
  let src: string | undefined;
  let url: string | undefined;
  if (typeof g.src === 'string' && g.src.trim()) {
    src = g.src.trim();
    // a file next to games.json: no scheme, no parent directories, no absolute paths
    if (/^[a-z]+:/i.test(src) || src.startsWith('/') || src.split(/[\\/]/).includes('..') || !/\.html?$/i.test(src)) return { game: null, error: `${id}: src must be an .html file inside games/` };
  } else if (typeof g.url === 'string' && g.url.trim()) {
    url = g.url.trim();
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return { game: null, error: `${id}: url must be https` };
    } catch {
      return { game: null, error: `${id}: invalid url` };
    }
  } else if (typeof g.html !== 'string') {
    return { game: null, error: `${id}: needs src or url` };
  }
  const cost = g.cost === undefined ? 1 : Math.max(0, Math.min(99, Math.floor(Number(g.cost)) || 0));
  const minutes = g.minutes === undefined ? undefined : Math.max(1, Math.min(240, Math.floor(Number(g.minutes)) || 0)) || undefined;
  const theme = typeof g.theme === 'string' && THEME_PACKS.includes(g.theme as ThemePack) ? (g.theme as ThemePack) : undefined;
  return {
    game: {
      id,
      title,
      emoji: typeof g.emoji === 'string' ? g.emoji.slice(0, 4) : '🎮',
      description: typeof g.description === 'string' ? g.description.slice(0, 200) : undefined,
      src,
      url,
      html: typeof g.html === 'string' ? g.html : undefined,
      cost,
      minutes,
      theme,
      tags: Array.isArray(g.tags) ? g.tags.filter((t): t is string => typeof t === 'string').slice(0, 6) : undefined,
      builtIn: g.builtIn === true,
    },
  };
}

export function parseManifest(json: unknown): { games: ArcadeGame[]; errors: string[] } {
  const list = Array.isArray(json) ? json : json && typeof json === 'object' && Array.isArray((json as { games?: unknown }).games) ? (json as { games: unknown[] }).games : null;
  if (!list) return { games: [], errors: ['games.json must be an array or { "games": [...] }'] };
  const games: ArcadeGame[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const { game, error } = validateGame(raw);
    if (!game) {
      errors.push(error ?? 'invalid entry');
      continue;
    }
    if (seen.has(game.id)) {
      errors.push(`${game.id}: duplicate id`);
      continue;
    }
    seen.add(game.id);
    // manifest games can't carry inline HTML (that's for local admin games)
    games.push({ ...game, html: undefined });
  }
  return { games, errors };
}

/**
 * iframe sandbox for a game. Files on this site and uploaded HTML get no allow-same-origin, so they run
 * in an opaque origin and can't read the app's IndexedDB or localStorage. External embeds are already on
 * another origin, so they keep their own storage (many embeds need it to load).
 */
export function sandboxFor(game: Pick<ArcadeGame, 'url'>): string {
  const base = 'allow-scripts allow-pointer-lock allow-modals';
  return game.url ? `${base} allow-same-origin allow-popups allow-forms` : base;
}

/** The manifest entry to paste into games.json for a game made in the admin panel. */
export function manifestEntry(game: ArcadeGame): Record<string, unknown> {
  const out: Record<string, unknown> = { id: game.id, title: game.title, emoji: game.emoji };
  if (game.description) out.description = game.description;
  if (game.url) out.url = game.url;
  else out.src = `${game.id}.html`;
  out.cost = game.cost;
  if (game.minutes) out.minutes = game.minutes;
  if (game.theme) out.theme = game.theme;
  if (game.tags?.length) out.tags = game.tags;
  return out;
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'game'
  );
}

/** A score message from a game: { type: 'hwtodo:score', score: number }. */
export function readScoreMessage(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { type?: unknown; score?: unknown };
  if (d.type !== 'hwtodo:score') return null;
  const n = Number(d.score);
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.floor(n) : null;
}
