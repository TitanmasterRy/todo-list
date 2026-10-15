<script lang="ts">
  // Plays one Jellyfin / Emby item: direct play when this browser handles the file, else the server's HLS
  // conversion. Quality, audio track, subtitles and version can change mid-play (the stream reloads where it was).
  // Reports start, progress (every 10 s and on pause) and stop, so "Continue watching" and resume points follow the
  // user to every device. Marked intros get a Skip button, and an episode's credits offer the next one.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { planPlayback, qualitiesFor, QUALITIES, type JellyfinClient, type JfItem, type JfMediaSource, type JfSegment, type PlaybackReport } from '../../../lib/watch/jellyfin';
  import { randomId } from '../../../lib/watch/sources';
  import VideoPlayer, { type Track } from './VideoPlayer.svelte';

  interface Props {
    client: JellyfinClient;
    item: JfItem;
    /** start from the beginning instead of the saved position */
    restart?: boolean;
    speed: number;
    onspeed: (s: number) => void;
    /** max streaming bitrate, 0 for Auto */
    quality: number;
    onquality: (bitrate: number) => void;
    onactive: (on: boolean) => void;
    onended?: () => void;
    /** play the next episode */
    onnext?: (next: JfItem) => void;
  }
  let { client, item, restart = false, speed, onspeed, quality, onquality, onactive, onended, onnext }: Props = $props();

  // read once: the parent re-creates this component for a different item
  const [it, api, fromStart, firstQuality] = untrack(() => [$state.snapshot(item) as JfItem, client, restart, quality] as const);
  const sources: JfMediaSource[] = it.mediaSources.length
    ? it.mediaSources
    : [{ id: it.id, name: '', container: '', videoCodec: '', audioCodec: '', bitrate: 0, width: 0, height: 0, audio: [], subtitles: [] }];
  const probe = typeof document === 'undefined' ? null : document.createElement('video');
  const canPlay = (m: string) => probe?.canPlayType(m) ?? '';

  let sourceAt = $state(0);
  let maxBitrate = $state(QUALITIES.some((q) => q.bitrate === firstQuality) ? firstQuality : 0);
  let audioIndex = $state<number | null>(null);
  /** 'off', 't<index>' (a text track) or 'b<index>' (an image track burned in) */
  let subChoice = $state(defaultSub(sources[0]));
  let sessionId = $state(randomId(16));
  let startAt = $state(fromStart ? 0 : it.positionSeconds);

  const source = $derived(sources[sourceAt]);
  const burnIn = $derived(subChoice.startsWith('b') ? Number(subChoice.slice(1)) : null);
  const plan = $derived(planPlayback(source, { maxBitrate, audioIndex, burnIn }, canPlay));
  const hls = $derived(plan.method === 'hls');
  const src = $derived(
    hls ? api.hlsUrl(it.id, source.id, sessionId, { maxBitrate: plan.maxBitrate, maxHeight: plan.maxHeight, audioIndex, burnIn }) : api.directUrl(it.id, source.id, sessionId),
  );
  const textSubs = $derived(source.subtitles.filter((s) => s.text).slice(0, 20));
  const tracks: Track[] = $derived(textSubs.map((s) => ({ src: api.subtitleUrl(it.id, source.id, s.index), label: s.label, lang: s.language })));
  const shownTrack = $derived(subChoice.startsWith('t') ? (tracks[textSubs.findIndex((s) => `t${s.index}` === subChoice)]?.src ?? '') : '');
  // the saved quality stays listed even when it's more than this file needs
  const qualities = $derived(QUALITIES.filter((q) => q.bitrate === maxBitrate || qualitiesFor(source).includes(q)));

  function defaultSub(s: JfMediaSource): string {
    const d = s.subtitles.find((x) => x.isDefault && x.text);
    return d ? `t${d.index}` : 'off';
  }

  let position = untrack(() => startAt);
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

  /** Change what's streamed: end this play session on the server (it stops its conversion) and resume in a new one. */
  function restream(change: () => void) {
    const [before, old] = [src, report()];
    change();
    if (src === before) return; // the same stream (the file already fits the quality): nothing to reload
    if (started) quiet(api.reportStopped(old));
    started = false;
    startAt = position;
    sessionId = randomId(16);
  }

  function setQuality(v: number) {
    onquality(v);
    restream(() => (maxBitrate = v));
  }
  function setAudio(v: string) {
    restream(() => (audioIndex = v === '' ? null : Number(v)));
  }
  function setSub(v: string) {
    if (!v.startsWith('b') && burnIn === null)
      subChoice = v; // text tracks switch without reloading
    else restream(() => (subChoice = v));
  }
  function setSource(v: number) {
    restream(() => {
      sourceAt = v;
      audioIndex = null;
      subChoice = defaultSub(sources[v]);
    });
  }
  /** The browser's own CC menu picked a track. */
  function fromCc(trackSrc: string) {
    if (trackSrc === shownTrack || (!trackSrc && burnIn !== null)) return;
    const at = tracks.findIndex((t) => t.src === trackSrc);
    setSub(at >= 0 ? `t${textSubs[at].index}` : 'off');
  }

  // ---------- intro skipping and up next ----------
  let player = $state<ReturnType<typeof VideoPlayer>>();
  let now = $state(untrack(() => startAt));
  let duration = $state(it.runTimeSeconds);
  let ended = $state(false);
  let segments = $state<JfSegment[]>([]);
  let next = $state<JfItem | null>(null);
  let upNextHidden = $state(false);
  let countdown = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    quiet(api.segments(it.id).then((s) => (segments = s)));
    if (onnext) quiet(api.nextEpisode(it).then((n) => (next = n)));
  });

  const SKIP: Record<string, string> = { Intro: 'Skip intro', Recap: 'Skip recap', Preview: 'Skip preview', Commercial: 'Skip ad', Outro: 'Skip credits' };
  const skippable = $derived(segments.find((s) => now >= s.start && now < s.end - 1 && (s.type !== 'Outro' || !next)) ?? null);
  const outro = $derived(segments.find((s) => s.type === 'Outro'));
  // the credits (or the last 20 s when the server hasn't marked them) offer the next episode
  const inCredits = $derived(ended || (outro ? now >= outro.start : duration > 60 && now >= duration - 20));
  const upNext = $derived(next && inCredits && !upNextHidden ? next : null);

  $effect(() => {
    if (!upNext) {
      clearInterval(timer);
      timer = undefined;
      return;
    }
    if (timer) return;
    countdown = 10;
    timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) playNext();
    }, 1000);
  });

  function playNext() {
    clearInterval(timer);
    timer = undefined;
    if (next) onnext?.(next);
  }

  function epLabel(n: JfItem): string {
    return n.parentIndexNumber !== null && n.indexNumber !== null ? `S${n.parentIndexNumber}:E${n.indexNumber} · ${n.name}` : n.name;
  }

  function onTime(t: number, d: number, p: boolean) {
    position = t;
    now = t;
    if (Number.isFinite(d) && d > 0) duration = d;
    if (t < duration - 1) ended = false;
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
  function onEnd() {
    ended = true;
    if (!next) onended?.();
  }
  onDestroy(() => {
    clearInterval(timer);
    onactive(false);
    if (started) quiet(api.reportStopped(report()));
  });

  const kbps = (b: number) => (b >= 1_000_000 ? `${Math.round(b / 100_000) / 10} Mbps` : `${Math.round(b / 1000)} kbps`);
  const fileInfo = $derived([source.height ? `${source.height}p` : '', source.videoCodec.toUpperCase(), source.bitrate ? kbps(source.bitrate) : ''].filter(Boolean).join(' · '));
</script>

{#snippet extra()}
  <label class="opt">
    Quality
    <select value={maxBitrate} onchange={(e) => setQuality(Number(e.currentTarget.value))}>
      <option value={0}>Auto{fileInfo ? ` (original: ${fileInfo})` : ''}</option>
      {#each qualities as q (q.bitrate)}<option value={q.bitrate}>{q.label}</option>{/each}
    </select>
  </label>
  {#if source.audio.length > 1}
    <label class="opt">
      Audio
      <select value={audioIndex === null ? '' : String(audioIndex)} onchange={(e) => setAudio(e.currentTarget.value)}>
        {#each source.audio as a (a.index)}<option value={a.isDefault ? '' : String(a.index)}>{a.label}</option>{/each}
      </select>
    </label>
  {/if}
  {#if source.subtitles.length}
    <label class="opt">
      Subtitles
      <select value={subChoice} onchange={(e) => setSub(e.currentTarget.value)}>
        <option value="off">Off</option>
        {#each source.subtitles.slice(0, 40) as s (s.index)}
          <option value={`${s.text ? 't' : 'b'}${s.index}`}>{s.label}{s.text ? '' : ' (burned in)'}</option>
        {/each}
      </select>
    </label>
  {/if}
  {#if sources.length > 1}
    <label class="opt">
      Version
      <select value={sourceAt} onchange={(e) => setSource(Number(e.currentTarget.value))}>
        {#each sources as s, i (s.id)}<option value={i}>{s.name || `Version ${i + 1}`}</option>{/each}
      </select>
    </label>
  {/if}
{/snippet}

{#snippet overlay()}
  {#if skippable}
    <button class="btn skip" onclick={() => player?.seek(skippable.end)}>{SKIP[skippable.type]} ⏭</button>
  {/if}
  {#if upNext}
    <div class="next" role="status">
      <span class="lbl">Up next{countdown > 0 ? ` in ${countdown}` : ''}</span>
      <strong>{epLabel(upNext)}</strong>
      <span class="btns">
        <button class="btn sm" onclick={playNext}>▶ Play now</button>
        <button class="btn ghost sm" onclick={() => (upNextHidden = true)}>Hide</button>
      </span>
    </div>
  {/if}
{/snippet}

<VideoPlayer
  bind:this={player}
  {src}
  {hls}
  title={it.name}
  {startAt}
  {speed}
  {tracks}
  subtitle={shownTrack}
  onsubtitle={fromCc}
  crossOrigin={tracks.length > 0}
  ontime={onTime}
  onplaying={onPlaying}
  {onspeed}
  onended={onEnd}
  {extra}
  {overlay}
/>
<p class="how">{plan.why}{burnIn === null && textSubs.length ? ` · ${textSubs.length} subtitle track${textSubs.length === 1 ? '' : 's'}` : ''}</p>

<style>
  .opt {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--text-muted);
  }
  .opt select {
    background: var(--bg-elev);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 6px;
    max-width: 210px;
  }
  .how {
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
  .skip {
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.5);
  }
  .next {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    max-width: 320px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-size: 13px;
  }
  .next .lbl {
    opacity: 0.8;
    font-size: 12px;
  }
  .next .btns {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .next .ghost {
    color: #fff;
  }
</style>
