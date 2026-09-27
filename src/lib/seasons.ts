// Seasonal events: yearly date windows (local dates) that unlock limited shop items, a themed quest set and a themed
// look for the Play page. Pure, so the window logic (including the one that crosses New Year) is unit-tested.

export type SeasonId = 'halloween' | 'winter' | 'finals' | 'summer';

export interface Season {
  id: SeasonId;
  name: string;
  emoji: string;
  /** yearly windows as MM-DD, inclusive; `to` before `from` wraps into the next year */
  windows: { from: string; to: string }[];
  blurb: string;
  decor: string[]; // emoji sprinkled on the Play header
}

export const SEASONS: Season[] = [
  {
    id: 'halloween',
    name: 'Halloween',
    emoji: '🎃',
    windows: [{ from: '10-15', to: '11-01' }],
    blurb: 'Spooky cosmetics and a haunted quest set.',
    decor: ['🎃', '👻', '🦇', '🕸️'],
  },
  { id: 'winter', name: 'Winter holidays', emoji: '❄️', windows: [{ from: '12-15', to: '01-05' }], blurb: 'Frosty cosmetics and cozy quests.', decor: ['❄️', '⛄', '🎁', '✨'] },
  {
    id: 'finals',
    name: 'Finals week',
    emoji: '📝',
    windows: [
      { from: '12-01', to: '12-14' },
      { from: '05-15', to: '06-10' },
    ],
    blurb: 'Study-hard cosmetics and exam-prep quests.',
    decor: ['📝', '📚', '☕', '⏰'],
  },
  { id: 'summer', name: 'Summer', emoji: '☀️', windows: [{ from: '06-15', to: '08-31' }], blurb: 'Sunny cosmetics and a laid-back quest set.', decor: ['☀️', '🏖️', '🍉', '🌊'] },
];

export function seasonById(id: string | undefined): Season | undefined {
  return SEASONS.find((s) => s.id === id);
}

export interface EventWindow {
  start: string; // YYYY-MM-DD
  end: string;
}

/** The window of `season` that contains `day` (YYYY-MM-DD), or undefined. */
export function seasonWindow(season: Season, day: string): EventWindow | undefined {
  const y = Number(day.slice(0, 4));
  const md = day.slice(5);
  for (const w of season.windows) {
    if (w.from <= w.to) {
      if (md >= w.from && md <= w.to) return { start: `${y}-${w.from}`, end: `${y}-${w.to}` };
    } else if (md >= w.from) return { start: `${y}-${w.from}`, end: `${y + 1}-${w.to}` };
    else if (md <= w.to) return { start: `${y - 1}-${w.from}`, end: `${y}-${w.to}` };
  }
  return undefined;
}

export function inSeason(id: string | undefined, day: string): boolean {
  const s = seasonById(id);
  return !!s && !!seasonWindow(s, day);
}

/** The event running on `day` (windows don't overlap). */
export function activeSeason(day: string): { season: Season; window: EventWindow } | undefined {
  for (const season of SEASONS) {
    const window = seasonWindow(season, day);
    if (window) return { season, window };
  }
  return undefined;
}

/** The next event to start after `day`, and in how many days. */
export function nextSeason(day: string): { season: Season; start: string; days: number } {
  const y = Number(day.slice(0, 4));
  const today = Date.UTC(y, Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  let best: { season: Season; start: string; days: number } | undefined;
  for (const season of SEASONS)
    for (const w of season.windows)
      for (const year of [y, y + 1]) {
        const start = `${year}-${w.from}`;
        const t = Date.UTC(year, Number(w.from.slice(0, 2)) - 1, Number(w.from.slice(3)));
        const days = Math.round((t - today) / 86_400_000);
        if (days > 0 && (!best || days < best.days)) best = { season, start, days };
      }
  return best!;
}

/** Days left in the window, counting today. */
export function daysLeft(w: EventWindow, day: string): number {
  const t = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((t(w.end) - t(day)) / 86_400_000) + 1;
}
