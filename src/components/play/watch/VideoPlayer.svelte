<script lang="ts" module>
  export interface Track {
    src: string;
    label: string;
    lang: string;
    isDefault?: boolean;
  }
</script>

<script lang="ts">
  // The built-in player for Play → Watch: a plain <video> (the browser's own controls) plus speed, picture-in-picture,
  // fullscreen and keyboard shortcuts. HLS playlists go through hls.js unless the browser plays them itself.
  import { onDestroy, onMount } from 'svelte';
  import { loadHls, nativeHls, type HlsInstance } from '../../../lib/watch/hls';

  interface Props {
    src: string;
    title: string;
    hls?: boolean;
    /** resume here (seconds) */
    startAt?: number;
    speed?: number;
    tracks?: Track[];
    /** request the video with CORS (needed for subtitle tracks from another origin) */
    crossOrigin?: boolean;
    ontime?: (seconds: number, duration: number, paused: boolean) => void;
    onplaying?: (playing: boolean) => void;
    onended?: () => void;
    onspeed?: (speed: number) => void;
  }
  let { src, title, hls = false, startAt = 0, speed = 1, tracks = [], crossOrigin = false, ontime, onplaying, onended, onspeed }: Props = $props();

  let video = $state<HTMLVideoElement>();
  let wrap = $state<HTMLDivElement>();
  let error = $state('');
  let rate = $state(1);
  let fullscreen = $state(false);
  let hlsPlayer: HlsInstance | null = null;
  let started = false;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  async function attach(v: HTMLVideoElement) {
    error = '';
    if (!hls || nativeHls(v)) {
      v.src = src;
      return;
    }
    try {
      const Hls = await loadHls();
      if (!Hls.isSupported()) {
        error = "This browser can't play this stream.";
        return;
      }
      hlsPlayer = new Hls({ maxBufferLength: 30 });
      hlsPlayer.on(Hls.Events.ERROR, (_e, d) => {
        if (d.fatal) error = `The stream stopped (${d.details ?? d.type ?? 'error'}). Check that the server is online and allowed (see WATCH.md).`;
      });
      hlsPlayer.loadSource(src);
      hlsPlayer.attachMedia(v);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    rate = SPEEDS.includes(speed) ? speed : 1;
    if (video) void attach(video);
    wrap?.addEventListener('keydown', onKey);
    const onFs = () => (fullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      wrap?.removeEventListener('keydown', onKey);
    };
  });

  onDestroy(() => {
    hlsPlayer?.destroy();
    hlsPlayer = null;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  });

  function onMeta() {
    if (!video) return;
    video.playbackRate = rate;
    if (startAt > 5 && (!Number.isFinite(video.duration) || startAt < video.duration - 5)) video.currentTime = startAt;
    video.play().catch(() => {
      /* autoplay refused: the controls are there */
    });
  }

  function setRate(r: number) {
    rate = r;
    if (video) video.playbackRate = r;
    onspeed?.(r);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void wrap?.requestFullscreen?.().catch(() => {});
  }

  async function pip() {
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* not allowed for this video */
    }
  }

  function onKey(e: KeyboardEvent) {
    if (!video || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('select, input, button')) return;
    // the focused <video> handles space and the arrows with its own controls
    if (target === video && !['f', 'm'].includes(e.key)) return;
    let handled = true;
    if (e.key === ' ' || e.key === 'k') {
      if (video.paused) void video.play().catch(() => {});
      else video.pause();
    } else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
    else if (e.key === 'ArrowRight') video.currentTime = Math.min(Number.isFinite(video.duration) ? video.duration : Infinity, video.currentTime + 10);
    else if (e.key === 'f') toggleFullscreen();
    else if (e.key === 'm') video.muted = !video.muted;
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function report() {
    if (video) ontime?.(video.currentTime, video.duration, video.paused);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="vp"
  class:fs={fullscreen}
  bind:this={wrap}
  tabindex="0"
  role="group"
  aria-label={`Video player: ${title}. Space plays or pauses, arrows skip 10 seconds, F fullscreen, M mute.`}
>
  <video
    bind:this={video}
    controls
    playsinline
    preload="metadata"
    crossorigin={crossOrigin ? 'anonymous' : undefined}
    onloadedmetadata={onMeta}
    ontimeupdate={report}
    onpause={() => {
      report();
      onplaying?.(false);
    }}
    onplaying={() => {
      started = true;
      onplaying?.(true);
    }}
    onended={() => {
      report();
      onplaying?.(false);
      onended?.();
    }}
    onerror={() => {
      if (!hls && video?.error)
        error = started ? 'Playback stopped.' : "This video couldn't be played here (the format may not be supported by this browser, or the link is wrong).";
    }}
  >
    {#each tracks as t (t.src)}
      <track kind="subtitles" src={t.src} label={t.label} srclang={t.lang || undefined} default={t.isDefault} />
    {/each}
  </video>
  <div class="vp-bar">
    <label class="speed">
      Speed
      <select value={rate} onchange={(e) => setRate(Number((e.target as HTMLSelectElement).value))}>
        {#each SPEEDS as s (s)}<option value={s}>{s}×</option>{/each}
      </select>
    </label>
    {#if pipSupported}<button class="btn ghost sm" onclick={pip} title="Picture in picture">⧉ Picture in picture</button>{/if}
    <button class="btn ghost sm" onclick={toggleFullscreen}>{fullscreen ? 'Exit full screen' : '⛶ Full screen'}</button>
    <span class="keys">Space · ← → · F · M</span>
  </div>
  {#if error}<p class="err" role="alert">{error}</p>{/if}
</div>

<style>
  .vp {
    display: grid;
    gap: 6px;
    outline: none;
    border-radius: var(--radius, 10px);
  }
  .vp:focus-visible {
    box-shadow: 0 0 0 2px var(--accent);
  }
  video {
    width: 100%;
    max-height: 70vh;
    background: #000;
    border-radius: var(--radius, 10px);
  }
  .vp.fs {
    background: #000;
    align-content: center;
  }
  .vp.fs video {
    max-height: calc(100vh - 60px);
    border-radius: 0;
  }
  .vp-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 13px;
  }
  .speed {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--text-muted);
  }
  .speed select {
    background: var(--bg-elev);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px 6px;
  }
  .keys {
    margin-left: auto;
    color: var(--text-muted);
    font-size: 12px;
  }
  .err {
    color: var(--danger, #e17055);
    font-size: 13px;
    margin: 0;
  }
</style>
