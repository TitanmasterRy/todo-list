// Arcade runtime: loads the site's games manifest and this browser's admin-added games, tracks high scores.
import * as db from './storage';
import { parseManifest } from './arcade';
import type { ArcadeGame } from './types';

const SCORES_KEY = 'homework-todo:arcade-scores';
const TIMES_KEY = 'homework-todo:arcade-times'; // best (lowest) times in ms, e.g. match rush per deck

function loadScores(key = SCORES_KEY): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

class Arcade {
  siteGames = $state<ArcadeGame[]>([]);
  localGames = $state<ArcadeGame[]>([]);
  errors = $state<string[]>([]);
  loaded = $state(false);
  loading = $state(false);
  scores = $state<Record<string, number>>(loadScores());
  times = $state<Record<string, number>>(loadScores(TIMES_KEY));
  games = $derived([...this.siteGames, ...this.localGames]);

  manifestUrl(): string {
    return (import.meta.env.VITE_ARCADE_MANIFEST as string | undefined) || `${import.meta.env.BASE_URL}games/games.json`;
  }

  async load(force = false): Promise<void> {
    if ((this.loaded && !force) || this.loading) return;
    this.loading = true;
    const errors: string[] = [];
    try {
      const res = await fetch(this.manifestUrl(), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`games.json: HTTP ${res.status}`);
      const parsed = parseManifest(await res.json());
      this.siteGames = parsed.games;
      errors.push(...parsed.errors);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
    try {
      this.localGames = (await db.getLocalGames()).map((g) => ({ ...g, local: true }));
    } catch {
      /* no IndexedDB (private mode) */
    }
    this.errors = errors;
    this.loaded = true;
    this.loading = false;
  }

  /** Resolve where a game's HTML lives. Site files get theme hints in the query string. */
  srcFor(game: ArcadeGame, params: Record<string, string> = {}): string | undefined {
    if (game.url) return game.url;
    if (!game.src) return undefined;
    const base = this.manifestUrl().replace(/[^/]*$/, '');
    const u = new URL(game.src, new URL(base, location.href));
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  }

  recordScore(id: string, score: number): boolean {
    const best = this.scores[id] ?? 0;
    if (score <= best) return false;
    this.scores = { ...this.scores, [id]: score };
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(this.scores));
    } catch {
      /* ignore */
    }
    return true;
  }

  /** Keep the fastest time for a timed game. Returns true for a new best. */
  recordTime(id: string, ms: number): boolean {
    const best = this.times[id];
    if (best !== undefined && ms >= best) return false;
    this.times = { ...this.times, [id]: ms };
    try {
      localStorage.setItem(TIMES_KEY, JSON.stringify(this.times));
    } catch {
      /* ignore */
    }
    return true;
  }

  async saveLocal(game: ArcadeGame): Promise<void> {
    const g = { ...$state.snapshot(game), local: true } as ArcadeGame;
    await db.putLocalGame(g);
    this.localGames = [...this.localGames.filter((x) => x.id !== g.id), g];
  }

  async removeLocal(id: string): Promise<void> {
    await db.deleteLocalGame(id);
    this.localGames = this.localGames.filter((g) => g.id !== id);
  }
}

export const arcade = new Arcade();
