import { describe, expect, it } from 'vitest';
import { httpUrl, isMixedContent, isPrivateHost, parseStartTime, referrerFor, toPlayable } from './embed';

const src = (url: string, parent = 'me.github.io') => {
  const p = toPlayable(url, parent);
  return p && 'src' in p ? p.src : null;
};

describe('share links → embed players', () => {
  it('YouTube watch, short, youtu.be, live and embed links use the privacy-enhanced player', () => {
    expect(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src('https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(src('https://youtube.com/shorts/abcDEF12345')).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
    expect(src('https://www.youtube.com/live/abcDEF12345')).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
    expect(src('https://www.youtube.com/embed/abcDEF12345')).toBe('https://www.youtube-nocookie.com/embed/abcDEF12345');
    expect(src('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(toPlayable('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ kind: 'iframe', provider: 'youtube' });
  });

  it('keeps YouTube start times and playlists', () => {
    expect(src('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90');
    expect(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90');
    expect(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123abc')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?list=PL123abc');
    expect(src('https://www.youtube.com/playlist?list=PL123abc')).toBe('https://www.youtube-nocookie.com/embed/videoseries?list=PL123abc');
  });

  it('refuses odd YouTube ids (falls back to a plain page)', () => {
    expect(toPlayable('https://www.youtube.com/watch?v=<script>')).toMatchObject({ provider: 'web' });
    expect(toPlayable('https://www.youtube.com/feed/subscriptions')).toMatchObject({ provider: 'web' });
  });

  it('Vimeo, including unlisted links and channels', () => {
    expect(src('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(src('https://vimeo.com/76979871/abcdef1234')).toBe('https://player.vimeo.com/video/76979871?h=abcdef1234');
    expect(src('https://vimeo.com/channels/staffpicks/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(src('https://player.vimeo.com/video/76979871')).toBe('https://player.vimeo.com/video/76979871');
  });

  it('Twitch channels, videos and clips carry this page as the parent', () => {
    expect(src('https://www.twitch.tv/SomeStreamer')).toBe('https://player.twitch.tv/?channel=somestreamer&parent=me.github.io');
    expect(src('https://twitch.tv/videos/123456789', 'localhost')).toBe('https://player.twitch.tv/?video=v123456789&parent=localhost');
    expect(src('https://clips.twitch.tv/FunnyClipSlug-abc')).toBe('https://clips.twitch.tv/embed?clip=FunnyClipSlug-abc&parent=me.github.io');
    expect(src('https://www.twitch.tv/someone/clip/FunnyClipSlug')).toBe('https://clips.twitch.tv/embed?clip=FunnyClipSlug&parent=me.github.io');
  });

  it('Dailymotion, Archive.org and Google Drive', () => {
    expect(src('https://www.dailymotion.com/video/x7tgad0')).toBe('https://www.dailymotion.com/embed/video/x7tgad0');
    expect(src('https://dai.ly/x7tgad0')).toBe('https://www.dailymotion.com/embed/video/x7tgad0');
    expect(src('https://archive.org/details/night_of_the_living_dead')).toBe('https://archive.org/embed/night_of_the_living_dead');
    expect(src('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview');
    expect(src('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp')).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview');
  });

  it('video files go to the built-in player, playlists through HLS', () => {
    expect(toPlayable('https://cdn.example.com/a/movie.mp4?x=1')).toEqual({ kind: 'video', src: 'https://cdn.example.com/a/movie.mp4?x=1', hls: false });
    expect(toPlayable('https://cdn.example.com/clip.WEBM')).toMatchObject({ kind: 'video', hls: false });
    expect(toPlayable('https://cdn.example.com/live/index.m3u8')).toMatchObject({ kind: 'video', hls: true });
  });

  it('anything else is a web page; non-web links are refused', () => {
    expect(toPlayable('https://app.plex.tv/desktop')).toEqual({ kind: 'iframe', src: 'https://app.plex.tv/desktop', provider: 'web' });
    expect(toPlayable('javascript:alert(1)')).toBeNull();
    expect(toPlayable('data:text/html,hi')).toBeNull();
    expect(toPlayable('file:///etc/passwd')).toBeNull();
    expect(toPlayable('https://user:pw@example.com/')).toBeNull();
    expect(toPlayable('')).toBeNull();
    expect(toPlayable('not a url')).toBeNull();
  });
});

describe('helpers', () => {
  it('parses start times', () => {
    expect(parseStartTime('75')).toBe(75);
    expect(parseStartTime('75s')).toBe(75);
    expect(parseStartTime('1h2m3s')).toBe(3723);
    expect(parseStartTime('abc')).toBe(0);
    expect(parseStartTime(null)).toBe(0);
  });

  it('accepts bare hosts as https', () => {
    expect(httpUrl('jellyfin.example.com')?.href).toBe('https://jellyfin.example.com/');
    expect(httpUrl('http://192.168.1.5:8096')?.port).toBe('8096');
  });

  it('spots mixed content (http server on an https page), except localhost', () => {
    expect(isMixedContent('http://192.168.1.5:8096', 'https:')).toBe(true);
    expect(isMixedContent('http://192.168.1.5:8096', 'http:')).toBe(false);
    expect(isMixedContent('https://jf.example.com', 'https:')).toBe(false);
    expect(isMixedContent('http://localhost:8096', 'https:')).toBe(false);
    expect(isMixedContent('http://127.0.0.1:8096', 'https:')).toBe(false);
    expect(isPrivateHost('http://192.168.1.5:8096')).toBe(true);
    expect(isPrivateHost('http://nas.local:8096')).toBe(true);
    expect(isPrivateHost('https://jf.example.com')).toBe(false);
  });

  it('sends no referrer except to players that insist on one', () => {
    expect(referrerFor('web')).toBe('no-referrer');
    expect(referrerFor('youtube')).toBe('strict-origin-when-cross-origin');
  });
});
