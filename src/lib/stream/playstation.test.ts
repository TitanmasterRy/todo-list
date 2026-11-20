import { describe, expect, it } from 'vitest';
import { findPlayStationApp, isPlayStationApp } from './playstation';

const app = (id: number, name: string) => ({ id, name, art: null });

describe('isPlayStationApp', () => {
  it('matches the names people give the Remote Play app', () => {
    for (const n of ['PlayStation', 'PlayStation 5', 'PS5', 'ps4 remote', 'chiaki-ng', 'Chiaki', 'PS Remote Play']) expect(isPlayStationApp(n)).toBe(true);
  });

  it('leaves other apps alone', () => {
    for (const n of ['Desktop', 'Steam Big Picture', 'Photoshop', 'PS2 emulator', 'Apps5']) expect(isPlayStationApp(n)).toBe(false);
  });
});

describe('findPlayStationApp', () => {
  it('picks the first matching app', () => {
    expect(findPlayStationApp([app(1, 'Desktop'), app(4, 'PlayStation'), app(5, 'PS5 (backup)')])).toEqual(app(4, 'PlayStation'));
  });

  it('is null when the PC has no PlayStation app', () => {
    expect(findPlayStationApp([app(1, 'Desktop'), app(2, 'Steam Big Picture')])).toBeNull();
    expect(findPlayStationApp([])).toBeNull();
  });
});
