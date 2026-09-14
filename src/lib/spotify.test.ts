import { describe, expect, it } from 'vitest';
import { pkce, toEmbedUrl } from './spotify.svelte';

describe('pkce', () => {
  it('produces a base64url verifier of valid length and a 43-char S256 challenge', async () => {
    const { verifier, challenge } = await pkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('derives the challenge from the verifier with SHA-256', async () => {
    const { verifier, challenge } = await pkce();
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const expected = Buffer.from(digest).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(challenge).toBe(expected);
  });
  it('is random', async () => {
    const a = await pkce();
    const b = await pkce();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('toEmbedUrl', () => {
  it('converts Spotify share links', () => {
    expect(toEmbedUrl('https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS?si=abc')).toEqual({
      provider: 'spotify',
      src: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhn9wzrS?theme=0',
    });
    expect(toEmbedUrl('https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX')?.src).toBe('https://open.spotify.com/embed/album/1ATL5GLyefJaxhQzSPVrLX?theme=0');
    expect(toEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')?.src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0');
    expect(toEmbedUrl('https://open.spotify.com/episode/5V5Oe6r3VtL1fZ1t0VnTQE')?.src).toBe('https://open.spotify.com/embed/episode/5V5Oe6r3VtL1fZ1t0VnTQE?theme=0');
    expect(toEmbedUrl('https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC')?.src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0');
    expect(toEmbedUrl('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC')?.src).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0');
    expect(toEmbedUrl('https://open.spotify.com/artist/abc')).toBeNull();
    expect(toEmbedUrl('https://open.spotify.com/user/someone')).toBeNull();
  });
  it('converts Apple Music links', () => {
    expect(toEmbedUrl('https://music.apple.com/us/album/lo-fi-beats/1440935467')).toEqual({
      provider: 'apple',
      src: 'https://embed.music.apple.com/us/album/lo-fi-beats/1440935467',
    });
    expect(toEmbedUrl('https://music.apple.com/gb/playlist/pure-focus/pl.abc123')?.src).toBe('https://embed.music.apple.com/gb/playlist/pure-focus/pl.abc123');
    expect(toEmbedUrl('https://music.apple.com/us/album/x/1?i=2')?.src).toBe('https://embed.music.apple.com/us/album/x/1?i=2');
    expect(toEmbedUrl('https://music.apple.com/us/artist/x/1')).toBeNull();
  });
  it('converts YouTube links', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toEqual({ provider: 'youtube', src: 'https://www.youtube.com/embed/jfKfPfyJRdk' });
    expect(toEmbedUrl('https://youtu.be/jfKfPfyJRdk?t=10')?.src).toBe('https://www.youtube.com/embed/jfKfPfyJRdk');
    expect(toEmbedUrl('https://www.youtube.com/playlist?list=PL123abc')?.src).toBe('https://www.youtube.com/embed/videoseries?list=PL123abc');
    expect(toEmbedUrl('https://m.youtube.com/watch?v=abc')?.src).toBe('https://www.youtube.com/embed/abc');
    expect(toEmbedUrl('https://www.youtube.com/')).toBeNull();
  });
  it('wraps SoundCloud links', () => {
    const r = toEmbedUrl('https://soundcloud.com/artist/track-name');
    expect(r?.provider).toBe('soundcloud');
    expect(r?.src).toBe('https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name');
  });
  it('rejects everything else', () => {
    expect(toEmbedUrl('')).toBeNull();
    expect(toEmbedUrl('not a url')).toBeNull();
    expect(toEmbedUrl('https://example.com/playlist/123')).toBeNull();
    expect(toEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});
