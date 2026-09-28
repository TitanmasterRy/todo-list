import { beforeEach, describe, expect, it, vi } from 'vitest';
import { art, parseArtManifest } from './art.svelte';

const asFetch = (f: () => Promise<Response>) => f as unknown as typeof fetch;

describe('art manifest', () => {
  beforeEach(() => art.reset());

  it('keeps only safe relative string paths', () => {
    const s = parseArtManifest({ files: ['casino/card-back.webp', 3, '', '/abs.webp', '../up.webp', 'https://x.test/a.webp', 'casino/chip-5.webp'] });
    expect([...s]).toEqual(['casino/card-back.webp', 'casino/chip-5.webp']);
    expect(parseArtManifest(null).size).toBe(0);
    expect(parseArtManifest({ files: 'nope' }).size).toBe(0);
    expect(parseArtManifest([]).size).toBe(0);
  });

  it('loads the manifest once, uncached, and returns urls only for listed files', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ files: ['casino/card-back.webp'] }), { status: 200 }));
    await art.load(asFetch(fetcher), '/app/');
    await art.load(asFetch(fetcher), '/app/');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/app/art/manifest.json', { cache: 'no-cache' });
    expect(art.url('casino/card-back.webp', '/app/')).toBe('/app/art/casino/card-back.webp');
    expect(art.url('casino/chip-5.webp', '/app/')).toBeUndefined();
  });

  it('ignores a missing manifest, a network failure or bad JSON', async () => {
    await art.load(
      asFetch(async () => new Response('nope', { status: 404 })),
      '/',
    );
    expect(art.url('casino/card-back.webp', '/')).toBeUndefined();
    art.reset();
    await art.load(
      asFetch(async () => {
        throw new Error('offline');
      }),
      '/',
    );
    expect(art.url('casino/card-back.webp', '/')).toBeUndefined();
    art.reset();
    await art.load(
      asFetch(async () => new Response('{not json', { status: 200 })),
      '/',
    );
    expect(art.files.size).toBe(0);
  });
});
