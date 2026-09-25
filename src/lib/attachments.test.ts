import { describe, expect, it } from 'vitest';
import { fitWithin, formatBytes, iconFor, shouldShrink } from './attachments';

describe('attachments helpers', () => {
  it('fits images inside the max side without scaling up', () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 2000, h: 1500 });
    expect(fitWithin(3000, 6000, 1000)).toEqual({ w: 500, h: 1000 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('only shrinks big photos', () => {
    expect(shouldShrink('image/jpeg', 3_000_000)).toBe(true);
    expect(shouldShrink('image/jpeg', 100_000)).toBe(false);
    expect(shouldShrink('image/gif', 3_000_000)).toBe(false);
    expect(shouldShrink('application/pdf', 3_000_000)).toBe(false);
  });
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3.25 * 1024 * 1024)).toBe('3.3 MB');
    expect(formatBytes(12 * 1024 * 1024)).toBe('12 MB');
  });
  it('picks icons by type', () => {
    expect(iconFor('image/png')).toBe('🖼️');
    expect(iconFor('application/pdf')).toBe('📕');
    expect(iconFor('application/zip')).toBe('📎');
  });
});
