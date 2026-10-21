import { describe, expect, it } from 'vitest';
import { chooseMethod, isPlayable, JellyfinClient, JellyfinError, planPlayback, qualitiesFor, QUALITIES, ticks, toItem, type JfMediaSource } from './jellyfin';

const SERVER = 'https://jf.example.com';

interface Call {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fake fetch answering by "METHOD /path" (query ignored), recording every call. */
function mockServer(routes: Record<string, unknown | ((c: Call) => unknown)>, status: Record<string, number> = {}) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const call: Call = { url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const key = `${method} ${url.pathname}`;
    if (status[key]) return new Response('', { status: status[key] });
    if (!(key in routes)) return new Response('not found', { status: 404 });
    const r = routes[key];
    const body = typeof r === 'function' ? (r as (c: Call) => unknown)(call) : r;
    return body === null ? new Response(null, { status: 204 }) : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetcher };
}

const movie = {
  Id: 'm1',
  Name: 'Big Buck Bunny <b>bold</b>',
  Type: 'Movie',
  Overview: 'A bunny.',
  ProductionYear: 2008,
  RunTimeTicks: 6_000_000_000,
  ImageTags: { Primary: 'tag1' },
  UserData: { PlaybackPositionTicks: 1_200_000_000, Played: false },
  MediaSources: [
    {
      Id: 'ms1',
      Name: '4K HDR',
      Container: 'mkv',
      Bitrate: 25_000_000,
      MediaStreams: [
        { Type: 'Video', Codec: 'hevc', Index: 0, Width: 3840, Height: 2160 },
        { Type: 'Audio', Codec: 'ac3', Index: 1, IsDefault: true, Language: 'eng', DisplayTitle: 'English - Dolby Digital - 5.1' },
        { Type: 'Audio', Codec: 'aac', Index: 4, Language: 'jpn', DisplayTitle: 'Japanese' },
        { Type: 'Subtitle', Codec: 'subrip', Index: 2, Language: 'eng', DisplayTitle: 'English', IsTextSubtitleStream: true, IsDefault: true },
        { Type: 'Subtitle', Codec: 'PGSSUB', Index: 3, Language: 'spa', DisplayTitle: 'Spanish (image)' },
      ],
    },
  ],
};

describe('Jellyfin client', () => {
  it('signs in with the MediaBrowser header and keeps the token', async () => {
    const { calls, fetcher } = mockServer({
      'POST /Users/AuthenticateByName': { AccessToken: 'tok_1234567890', ServerId: 'srv1', User: { Id: 'user-1', Name: 'Kid' } },
    });
    const c = new JellyfinClient({ server: `${SERVER}/`, deviceId: 'dev1', fetch: fetcher });
    const auth = await c.authenticate('kid', 'secret');
    expect(auth).toEqual({ token: 'tok_1234567890', userId: 'user-1', userName: 'Kid', serverId: 'srv1' });
    expect(calls[0].url.href).toBe(`${SERVER}/Users/AuthenticateByName`);
    expect(calls[0].body).toEqual({ Username: 'kid', Pw: 'secret' });
    expect(calls[0].headers['X-Emby-Authorization']).toBe('MediaBrowser Client="Homework To-Do", Device="Browser", DeviceId="dev1", Version="1.0"');
    expect(c.token).toBe('tok_1234567890');
    expect(c.authorization()).toContain('Token="tok_1234567890"');
  });

  it('reports a wrong password and a server that is not Jellyfin', async () => {
    const bad = mockServer({}, { 'POST /Users/AuthenticateByName': 401 });
    await expect(new JellyfinClient({ server: SERVER, deviceId: 'd', fetch: bad.fetcher }).authenticate('a', 'b')).rejects.toMatchObject({ kind: 'auth' });
    const html = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
    await expect(new JellyfinClient({ server: SERVER, deviceId: 'd', fetch: html }).authenticate('a', 'b')).rejects.toMatchObject({ kind: 'data' });
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const err = await new JellyfinClient({ server: SERVER, deviceId: 'd', fetch: down }).publicInfo().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JellyfinError);
    expect((err as JellyfinError).kind).toBe('network');
  });

  it('lists libraries, items, resume and next up for the user', async () => {
    const { calls, fetcher } = mockServer({
      'GET /Users/user-1/Views': { Items: [{ Id: 'lib1', Name: 'Movies', Type: 'CollectionFolder', CollectionType: 'movies' }, { Name: 'no id' }] },
      'GET /Users/user-1/Items': { Items: [movie], TotalRecordCount: 41 },
      'GET /Users/user-1/Items/Resume': { Items: [movie] },
      'GET /Shows/NextUp': { Items: [{ Id: 'e1', Name: 'Pilot', Type: 'Episode', SeriesName: 'Show', IndexNumber: 1, ParentIndexNumber: 1 }] },
      'GET /Shows/s1/Seasons': { Items: [{ Id: 'se1', Name: 'Season 1', Type: 'Season', SeriesId: 's1' }] },
      'GET /Shows/s1/Episodes': { Items: [{ Id: 'e1', Name: 'Pilot', Type: 'Episode' }] },
    });
    const c = new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'user-1', fetch: fetcher });
    const views = await c.views();
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ id: 'lib1', name: 'Movies', collectionType: 'movies' });
    const r = await c.items({ parentId: 'lib1', start: 60 });
    expect(r.total).toBe(41);
    expect(r.items[0]).toMatchObject({ id: 'm1', name: 'Big Buck Bunny <b>bold</b>', runTimeSeconds: 600, positionSeconds: 120, primaryImageTag: 'tag1' });
    const itemsCall = calls.find((x) => x.url.pathname === '/Users/user-1/Items')!;
    expect(itemsCall.url.searchParams.get('ParentId')).toBe('lib1');
    expect(itemsCall.url.searchParams.get('StartIndex')).toBe('60');
    expect(await c.resume()).toHaveLength(1);
    const next = await c.nextUp();
    expect(next[0]).toMatchObject({ type: 'Episode', seriesName: 'Show', indexNumber: 1 });
    expect(calls.find((x) => x.url.pathname === '/Shows/NextUp')!.url.searchParams.get('userId')).toBe('user-1');
    expect(await c.seasons('s1')).toHaveLength(1);
    await c.episodes('s1', 'se1');
    expect(calls.at(-1)!.url.searchParams.get('seasonId')).toBe('se1');
    // search
    await c.items({ search: '  bunny ', recursive: true });
    expect(calls.at(-1)!.url.searchParams.get('SearchTerm')).toBe('bunny');
    expect(calls.every((x) => x.headers.Authorization?.includes('Token="tok_abcdefgh"'))).toBe(true);
  });

  it('needs a sign-in for user data, and a 401 later means signed out', async () => {
    await expect(new JellyfinClient({ server: SERVER, deviceId: 'd' }).views()).rejects.toMatchObject({ kind: 'auth' });
    const { fetcher } = mockServer({}, { 'GET /Users/u1/Views': 401 });
    await expect(new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'u1', fetch: fetcher }).views()).rejects.toMatchObject({
      kind: 'auth',
      message: 'The server signed you out. Sign in again.',
    });
  });

  it('reads an item with media sources and subtitle streams', async () => {
    const { fetcher } = mockServer({ 'GET /Users/u1/Items/m1': movie });
    const it = await new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'u1', fetch: fetcher }).item('m1');
    expect(it.mediaSources).toEqual([
      {
        id: 'ms1',
        name: '4K HDR',
        container: 'mkv',
        videoCodec: 'hevc',
        audioCodec: 'ac3',
        bitrate: 25_000_000,
        width: 3840,
        height: 2160,
        audio: [
          { index: 1, label: 'English - Dolby Digital - 5.1', language: 'eng', isDefault: true },
          { index: 4, label: 'Japanese', language: 'jpn', isDefault: false },
        ],
        subtitles: [
          { index: 2, label: 'English', language: 'eng', text: true, isDefault: true },
          { index: 3, label: 'Spanish (image)', language: 'spa', text: false, isDefault: false },
        ],
      },
    ]);
    expect(isPlayable(it)).toBe(true);
    expect(isPlayable({ type: 'Series' })).toBe(false);
  });

  it('builds playback, image and subtitle URLs with the token', () => {
    const c = new JellyfinClient({ server: SERVER, deviceId: 'dev1', token: 'tok_abcdefgh', userId: 'u1' });
    const direct = new URL(c.directUrl('m1', 'ms1', 'ps1'));
    expect(direct.pathname).toBe('/Videos/m1/stream');
    expect(Object.fromEntries(direct.searchParams)).toMatchObject({
      static: 'true',
      MediaSourceId: 'ms1',
      api_key: 'tok_abcdefgh',
      ApiKey: 'tok_abcdefgh',
      DeviceId: 'dev1',
      PlaySessionId: 'ps1',
    });
    const hls = new URL(c.hlsUrl('m1', 'ms1', 'ps1'));
    expect(hls.pathname).toBe('/Videos/m1/master.m3u8');
    expect(Object.fromEntries(hls.searchParams)).toMatchObject({
      api_key: 'tok_abcdefgh',
      MediaSourceId: 'ms1',
      VideoCodec: 'h264',
      AudioCodec: 'aac',
      MaxStreamingBitrate: '20000000',
    });
    expect([...hls.searchParams.keys()]).not.toContain('MaxHeight');
    // a chosen quality, audio track and burned-in subtitles
    const low = new URL(c.hlsUrl('m1', 'ms1', 'ps1', { maxBitrate: 4_000_000, maxHeight: 720, audioIndex: 4, burnIn: 3 }));
    expect(Object.fromEntries(low.searchParams)).toMatchObject({
      MaxStreamingBitrate: '4000000',
      VideoBitrate: '3808000',
      AudioBitrate: '192000',
      MaxHeight: '720',
      AudioStreamIndex: '4',
      SubtitleStreamIndex: '3',
      SubtitleMethod: 'Encode',
    });
    expect([...new URL(c.hlsUrl('m1', 'ms1', 'ps1', { audioIndex: -1, burnIn: 1.5 })).searchParams.keys()]).not.toContain('AudioStreamIndex');
    expect(c.subtitleUrl('m1', 'ms1', 2)).toBe(`${SERVER}/Videos/m1/ms1/Subtitles/2/Stream.vtt?api_key=tok_abcdefgh&ApiKey=tok_abcdefgh`);
    expect(c.imageUrl({ id: 'm1', primaryImageTag: 'tag1' })).toBe(`${SERVER}/Items/m1/Images/Primary?maxHeight=300&quality=90&tag=tag1`);
    expect(c.webAppUrl()).toBe(`${SERVER}/web/`);
    // ids from the server can't escape the path
    expect(new URL(c.directUrl('../../x', 'ms1', 'p')).pathname).toBe('/Videos//stream');
  });

  it('reports playback start, progress and stop in ticks', async () => {
    const { calls, fetcher } = mockServer({ 'POST /Sessions/Playing': null, 'POST /Sessions/Playing/Progress': null, 'POST /Sessions/Playing/Stopped': null });
    const c = new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'u1', fetch: fetcher });
    const r = { itemId: 'm1', mediaSourceId: 'ms1', playSessionId: 'ps1', positionSeconds: 12.5, method: 'DirectPlay' as const };
    await c.reportStart(r);
    await c.reportProgress({ ...r, positionSeconds: 30, isPaused: true });
    await c.reportStopped({ ...r, positionSeconds: 42 });
    expect(calls.map((x) => `${x.method} ${x.url.pathname}`)).toEqual(['POST /Sessions/Playing', 'POST /Sessions/Playing/Progress', 'POST /Sessions/Playing/Stopped']);
    expect(calls[0].body).toEqual({
      ItemId: 'm1',
      MediaSourceId: 'ms1',
      PlaySessionId: 'ps1',
      PositionTicks: 125_000_000,
      IsPaused: false,
      CanSeek: true,
      PlayMethod: 'DirectPlay',
    });
    expect(calls[1].body).toMatchObject({ PositionTicks: 300_000_000, IsPaused: true });
    expect(calls[2].body).toMatchObject({ PositionTicks: 420_000_000 });
    expect(ticks(-5)).toBe(0);
  });

  it('finds the next episode and the marked intro and credits', async () => {
    const { calls, fetcher } = mockServer({
      'GET /Shows/s1/Episodes': {
        Items: [
          { Id: 'e1', Name: 'Pilot', Type: 'Episode' },
          { Id: 'e2', Name: 'Second', Type: 'Episode', IndexNumber: 2 },
        ],
      },
      'GET /MediaSegments/e1': {
        Items: [
          { Type: 'Outro', StartTicks: 12_000_000_000, EndTicks: 13_000_000_000 },
          { Type: 'Intro', StartTicks: 300_000_000, EndTicks: 1_200_000_000 },
          { Type: 'Intro', StartTicks: 5, EndTicks: 1 },
          { Type: 'Bogus', StartTicks: 0, EndTicks: 10 },
        ],
      },
    });
    const c = new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'u1', fetch: fetcher });
    expect(await c.nextEpisode({ id: 'e1', type: 'Episode', seriesId: 's1' })).toMatchObject({ id: 'e2', name: 'Second' });
    expect(calls[0].url.searchParams.get('startItemId')).toBe('e1');
    expect(await c.nextEpisode({ id: 'm1', type: 'Movie', seriesId: '' })).toBeNull();
    expect(await c.segments('e1')).toEqual([
      { type: 'Intro', start: 30, end: 120 },
      { type: 'Outro', start: 1200, end: 1300 },
    ]);
    // Emby and older Jellyfin don't have segments
    expect(await c.segments('m9')).toEqual([]);
  });

  it('signs out on the server', async () => {
    const { calls, fetcher } = mockServer({ 'POST /Sessions/Logout': null });
    const c = new JellyfinClient({ server: SERVER, deviceId: 'd', token: 'tok_abcdefgh', userId: 'u1', fetch: fetcher });
    await c.logout();
    expect(calls[0].url.pathname).toBe('/Sessions/Logout');
    expect(c.token).toBe('');
  });
});

describe('untrusted items and play method', () => {
  it('keeps only checked fields', () => {
    expect(toItem({ Id: '../x', Name: 'bad' })).toBeNull();
    expect(toItem(null)).toBeNull();
    const it = toItem({ Id: 'a1', Name: 42, Overview: 'x'.repeat(5000), ImageTags: { Primary: 'x" onerror="' }, UserData: 'junk' })!;
    expect(it.name).toBe('Untitled');
    expect(it.overview).toHaveLength(2000);
    expect(it.hasPrimaryImage).toBe(false);
    expect(it.positionSeconds).toBe(0);
  });

  it('plays what the browser can directly and converts the rest', () => {
    const chrome = (m: string) => (/webm|avc1|mp4a|opus|vp9/.test(m) && !/hvc1/.test(m) ? 'probably' : '');
    expect(chooseMethod({ container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }, chrome)).toBe('direct');
    expect(chooseMethod({ container: 'webm', videoCodec: 'vp9', audioCodec: 'opus' }, chrome)).toBe('direct');
    expect(chooseMethod({ container: 'mov,mp4,m4a', videoCodec: 'h264', audioCodec: 'aac' }, chrome)).toBe('direct');
    expect(chooseMethod({ container: 'mp4', videoCodec: 'hevc', audioCodec: 'aac' }, chrome)).toBe('hls');
    expect(chooseMethod({ container: 'mkv', videoCodec: 'h264', audioCodec: 'aac' }, chrome)).toBe('hls');
    expect(chooseMethod({ container: 'mp4', videoCodec: 'h264', audioCodec: 'ac3' }, chrome)).toBe('hls');
    expect(chooseMethod({ container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' }, () => '')).toBe('hls');
  });
});

describe('quality, audio and subtitle choices', () => {
  const chrome = (m: string) => (/webm|avc1|mp4a|opus|vp9/.test(m) && !/hvc1/.test(m) ? 'probably' : '');
  const file = (o: Partial<JfMediaSource> = {}): JfMediaSource => ({
    id: 'ms1',
    name: '',
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    bitrate: 8_000_000,
    width: 1920,
    height: 1080,
    audio: [
      { index: 1, label: 'English', language: 'eng', isDefault: true },
      { index: 2, label: 'Spanish', language: 'spa', isDefault: false },
    ],
    subtitles: [],
    ...o,
  });
  const auto = { maxBitrate: 0, audioIndex: null, burnIn: null };

  it('plays the original when it fits, and converts when a lower quality is picked', () => {
    expect(planPlayback(file(), auto, chrome)).toMatchObject({ method: 'direct', why: 'Direct play (original quality)' });
    // 20 Mbps is more than the file needs: still the original
    expect(planPlayback(file(), { ...auto, maxBitrate: 20_000_000 }, chrome).method).toBe('direct');
    expect(planPlayback(file(), { ...auto, maxBitrate: 4_000_000 }, chrome)).toEqual({
      method: 'hls',
      why: 'Converted by the server to 720p · 4 Mbps',
      maxBitrate: 4_000_000,
      maxHeight: 720,
    });
    // unknown bitrate: judged by the picture size
    expect(planPlayback(file({ bitrate: 0 }), { ...auto, maxBitrate: 3_000_000 }, chrome).method).toBe('hls');
    expect(planPlayback(file({ bitrate: 0, height: 0 }), { ...auto, maxBitrate: 3_000_000 }, chrome).method).toBe('direct');
    // a file the browser can't play is converted at the chosen quality (or the default one)
    expect(planPlayback(file({ container: 'mkv' }), auto, chrome)).toMatchObject({ method: 'hls', maxBitrate: 0, maxHeight: 0 });
    expect(planPlayback(file({ container: 'mkv' }), { ...auto, maxBitrate: 10_000_000 }, chrome)).toMatchObject({
      method: 'hls',
      why: 'Converted by the server (1080p · 10 Mbps)',
    });
  });

  it('converts for another audio track or burned-in subtitles', () => {
    expect(planPlayback(file(), { ...auto, audioIndex: 1 }, chrome).method).toBe('direct');
    expect(planPlayback(file(), { ...auto, audioIndex: 2 }, chrome)).toMatchObject({ method: 'hls', why: 'Converted by the server for this audio track' });
    expect(planPlayback(file(), { ...auto, burnIn: 5 }, chrome)).toMatchObject({ method: 'hls', why: 'Converted by the server to show these subtitles' });
  });

  it('offers qualities up to the size of the file', () => {
    expect(qualitiesFor({ height: 2160 })).toEqual(QUALITIES);
    expect(qualitiesFor({ height: 0 })).toEqual(QUALITIES);
    expect(qualitiesFor({ height: 800 })[0].label).toBe('1080p · 40 Mbps'); // a wide 1080p film
    expect(qualitiesFor({ height: 720 })[0].label).toBe('720p · 8 Mbps');
    expect(qualitiesFor({ height: 144 }).map((q) => q.label)).toEqual(['360p · 720 kbps']);
  });
});
