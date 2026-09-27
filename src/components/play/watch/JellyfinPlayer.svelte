<script lang="ts">
  // Plays one Jellyfin / Emby item: direct play when this browser handles the file, else the server's HLS
  // conversion. Reports start, progress (every 10 s and on pause) and stop, so "Continue watching" and resume
  // points follow the user to every device.
  import { onDestroy, untrack } from 'svelte';
  import { chooseMethod, type JellyfinClient, type JfItem, type PlaybackReport } from '../../../lib/watch/jellyfin';
  import { randomId } from '../../../lib/watch/sources';
  import VideoPlayer, { type Track } from './VideoPlayer.svelte';

  interface Props {
    client: JellyfinClient;
    item: JfItem;
    /** start from the beginning instead of the saved position */
    restart?: boolean;
    speed: number;
    onspeed: (s: number) => void;
    onactive: (on: boolean) => void;
    onended?: () => void;
  }
  let { client, item, restart = false, speed, onspeed, onactive, onended }: Props = $props();

  // read once: the parent re-creates this component for a different item
  const [it, api, fromStart] = untrack(() => [$state.snapshot(item) as JfItem, client, restart] as const);
  const source = it.mediaSources[0] ?? { id: it.id, container: '', videoCodec: '', audioCodec: '', subtitles: [] };
  const sessionId = randomId(16);
  const probe = typeof document === 'undefined' ? null : document.createElement('video');
  const method = chooseMethod(source, (m) => probe?.canPlayType(m) ?? '');
  const hls = method === 'hls';
  const src = hls ? api.hlsUrl(it.id, source.id, sessionId) : api.directUrl(it.id, source.id, sessionId);
  const tracks: Track[] = source.subtitles
    .filter((s) => s.text)
    .slice(0, 20)
    .map((s) => ({ src: api.subtitleUrl(it.id, source.id, s.index), label: s.label, lang: s.language, isDefault: s.isDefault }));
  const startAt = fromStart ? 0 : it.positionSeconds;

  let position = startAt;
  let paused = true;
  let started = false;
  let lastSent = 0;
  const report = (): PlaybackReport => ({
    itemId: it.id,
    mediaSourceId: source.id,
    playSessionId: sessionId,
    positionSeconds: position,
    isPaused: paused,
    method: hls ? 'Transcode' : 'DirectPlay',
  });
  const quiet = (p: Promise<unknown>) => void p.catch(() => {});

  function onTime(t: number, _d: number, p: boolean) {
    position = t;
    paused = p;
    if (started && Date.now() - lastSent > 10_000) {
      lastSent = Date.now();
      quiet(api.reportProgress(report()));
    }
  }
  function onPlaying(on: boolean) {
    onactive(on);
    paused = !on;
    if (on && !started) {
      started = true;
      lastSent = Date.now();
      quiet(api.reportStart(report()));
    } else if (started) {
      lastSent = Date.now();
      quiet(api.reportProgress(report()));
    }
  }
  onDestroy(() => {
    onactive(false);
    if (started) quiet(api.reportStopped(report()));
  });
</script>

<VideoPlayer {src} {hls} title={it.name} {startAt} {speed} {tracks} crossOrigin={tracks.length > 0} ontime={onTime} onplaying={onPlaying} {onspeed} onended={() => onended?.()} />
<p class="how">{hls ? 'Converted by the server (HLS)' : 'Direct play'}{tracks.length ? ` · ${tracks.length} subtitle track${tracks.length === 1 ? '' : 's'} (CC button)` : ''}</p>

<style>
  .how {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
</style>
