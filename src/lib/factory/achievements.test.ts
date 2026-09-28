import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT, ACHIEVEMENTS, ACH_SHARDS, checkAchievements, earnedAchievements, type AchState } from './achievements';
import { PHASES, type BuildingId } from './data';
import { newGame, type Building } from './state';

function fresh(): AchState {
  const s = newGame(0) as AchState;
  s.ach = [];
  s.madeTotal = 0;
  s.lifetime = { launches: 0, contracts: 0, relaunches: 0 };
  s.runs = 0;
  s.sectors = [];
  return s;
}

let nextId = 100;
const building = (type: BuildingId | string, extra: Partial<Building> = {}): Building => ({
  id: nextId++,
  type: type as BuildingId,
  x: 0,
  y: 0,
  rot: 0,
  clock: 1,
  shards: 0,
  inBuf: {},
  outBuf: {},
  ...extra,
});

describe('ACHIEVEMENTS', () => {
  it('has unique ids, names, descriptions and emoji', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.name).toBeTruthy();
      expect(a.desc).toBeTruthy();
      expect(a.emoji).toBeTruthy();
      expect(ACHIEVEMENT[a.id]).toBe(a);
    }
  });

  it('none are earned by a fresh game', () => {
    const s = fresh();
    expect(ACHIEVEMENTS.filter((a) => a.test(s))).toEqual([]);
  });

  it('each test fires on its own trigger', () => {
    const cases: [string, (s: AchState) => void][] = [
      ['belt1', (s) => s.belts.push({ id: 1, from: 1, to: 2, tier: 1 })],
      [
        'belt50',
        (s) => {
          for (let i = 0; i < 50; i++) s.belts.push({ id: i, from: 1, to: 2, tier: 1 });
        },
      ],
      [
        'machines10',
        (s) => {
          for (let i = 0; i < 10; i++) s.buildings.push(building('smelter'));
        },
      ],
      ['power100', (s) => s.buildings.push(building('coalGenerator'), building('biomassBurner'))],
      ['overclock', (s) => s.buildings.push(building('smelter', { clock: 1.5, shards: 1 }))],
      ['alt1', (s) => s.research.push('r-castScrew')],
      ['made1k', (s) => (s.madeTotal = 1000)],
      ['made10k', (s) => (s.madeTotal = 10000)],
      ['made100k', (s) => (s.madeTotal = 100000)],
      ['tier3', (s) => (s.phase = 3)],
      ['launched', (s) => (s.phase = PHASES.length)],
      ['relaunch', (s) => (s.runs = 1)],
      ['contracts5', (s) => (s.lifetime.contracts = 5)],
      ['sectors3', (s) => s.sectors.push('a', 'b', 'c')],
      ['storage', (s) => s.buildings.push(building('storage'))],
    ];
    expect(cases.map(([id]) => id).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
    for (const [id, arm] of cases) {
      const s = fresh();
      arm(s);
      expect(ACHIEVEMENT[id].test(s), id).toBe(true);
    }
  });

  it('counts a loader as storage and 99 MW as not enough', () => {
    const s = fresh();
    s.buildings.push(building('loader'));
    expect(ACHIEVEMENT.storage.test(s)).toBe(true);
    const t = fresh();
    t.buildings.push(building('coalGenerator'));
    expect(ACHIEVEMENT.power100.test(t)).toBe(false);
  });
});

describe('checkAchievements', () => {
  it('awards each achievement once, with a shard, and lists what was earned', () => {
    const s = fresh();
    expect(checkAchievements(s)).toEqual([]);
    s.belts.push({ id: 1, from: 1, to: 2, tier: 1 });
    s.madeTotal = 1500;
    const fresh1 = checkAchievements(s);
    expect(fresh1.map((a) => a.id).sort()).toEqual(['belt1', 'made1k']);
    expect(s.ach.sort()).toEqual(['belt1', 'made1k']);
    expect(s.shards).toBe(2 * ACH_SHARDS);
    expect(checkAchievements(s)).toEqual([]);
    expect(s.shards).toBe(2 * ACH_SHARDS);
    s.madeTotal = 20000;
    expect(checkAchievements(s).map((a) => a.id)).toEqual(['made10k']);
    expect(
      earnedAchievements(s)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['belt1', 'made10k', 'made1k']);
  });
});
