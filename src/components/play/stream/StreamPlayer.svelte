<script lang="ts">
  // One running stream: the picture (a <video> for WebRTC, a canvas for the WebSocket mode), input capture, full
  // screen with Keyboard Lock, the stats overlay, and the ways out (disconnect, quit the game, sign out everywhere).
  import { onDestroy, onMount } from 'svelte';
  import { t, type MessageKey } from '../../../lib/i18n/index.svelte';
  import type { GatewayClient, StreamSession, StreamTransport } from '../../../lib/stream/api';
  import { WsStream } from '../../../lib/stream/fallback';
  import { InputCapture } from '../../../lib/stream/input';
  import { WebRtcStream, type StreamPath, type StreamState, type StreamStats } from '../../../lib/stream/rtc';
  import { streamSettings } from '../../../lib/stream/state.svelte';

  interface Props {
    api: GatewayClient;
    session: StreamSession;
    appName: string;
    /** the stream is over; `failed` names the transport that couldn't connect */
    onend: (why: MessageKey | null, failed?: StreamTransport) => void;
    /** restart the same app (after a quality change) */
    onrestart: () => void;
    onsignedout: () => void;
  }
  let { api, session, appName, onend, onrestart, onsignedout }: Props = $props();

  let wrap = $state<HTMLDivElement>();
  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();
  let phase = $state<StreamState>('connecting');
  let stats = $state<StreamStats | null>(null);
  let fullscreen = $state(false);
  let mouseLocked = $state(false);
  let needsSound = $state(false);
  let ending = $state(false);
  let player: WebRtcStream | WsStream | null = null;
  let capture: InputCapture | null = null;
  let statsTimer: ReturnType<typeof setInterval> | undefined;
  let done = false;

  const PATHS: Record<StreamPath, MessageKey> = {
    'relay-udp': 'stream.path.udp',
    'relay-tcp': 'stream.path.tcp',
    'relay-tls': 'stream.path.tls',
    direct: 'stream.path.direct',
    ws: 'stream.path.ws',
    unknown: 'stream.path.unknown',
  };

  const keyboard = () => (navigator as Navigator & { keyboard?: { lock?: () => Promise<void>; unlock?: () => void } }).keyboard;

  function onState(s: StreamState, why?: MessageKey) {
    phase = s;
    if (s === 'connected') {
      capture?.start();
      video?.play().catch(() => (needsSound = true));
    } else if (s === 'failed' || s === 'ended') finish(why ?? null, s === 'failed');
  }

  onMount(() => {
    const target = (session.transport === 'ws' ? canvas : video) as HTMLElement;
    player =
      session.transport === 'ws'
        ? new WsStream({ url: api.wsUrl(session.mediaPath), ticket: session.ticket, canvas: canvas!, onState })
        : new WebRtcStream({ signalUrl: api.wsUrl(session.signalingPath), ticket: session.ticket, iceServers: session.iceServers, video: video!, onState });
    capture = new InputCapture({ target, send: (m) => player?.send(m), size: () => ({ width: stats?.width || session.width, height: stats?.height || session.height }) });
    player.start();
    statsTimer = setInterval(async () => {
      if (streamSettings.prefs.stats && phase === 'connected' && player) stats = await player.stats().catch(() => stats);
    }, 1000);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('pointerlockchange', onPointerLock);
  });

  function cleanup() {
    if (done) return;
    done = true;
    clearInterval(statsTimer);
    capture?.stop();
    player?.close();
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('fullscreenchange', onFullscreen);
    document.removeEventListener('pointerlockchange', onPointerLock);
    keyboard()?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }
  onDestroy(cleanup);

  function finish(why: MessageKey | null, failed: boolean) {
    if (done) return;
    cleanup();
    void api.endSession(session.id, false);
    onend(why, failed ? session.transport : undefined);
  }

  async function end(quitApp: boolean) {
    ending = true;
    cleanup();
    await api.endSession(session.id, quitApp);
    onend(null);
  }

  async function signOutEverywhere() {
    if (!confirm(t('stream.revokeConfirm'))) return;
    cleanup();
    try {
      await api.revokeAll();
    } finally {
      onsignedout();
    }
  }

  function onPageHide() {
    cleanup();
    void api.endSession(session.id, false, true);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    try {
      await wrap?.requestFullscreen({ navigationUI: 'hide' });
      // with Keyboard Lock, Escape, Alt+Tab and the like go to the PC instead of the browser (Chromium only)
      await keyboard()?.lock?.();
    } catch {
      /* not allowed here */
    }
  }

  function onFullscreen() {
    fullscreen = !!document.fullscreenElement;
    if (!fullscreen) keyboard()?.unlock?.();
  }

  function lockMouse() {
    const el = (session.transport === 'ws' ? canvas : video) as HTMLElement;
    void Promise.resolve(el.requestPointerLock?.()).catch(() => {});
  }

  function onPointerLock() {
    mouseLocked = !!document.pointerLockElement;
  }

  function unmute() {
    needsSound = false;
    if (video) {
      video.muted = false;
      void video.play().catch(() => {});
    }
  }

  function setQuality(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    if (v === 'native') streamSettings.update({ size: 'native', bitrate: 0 });
    else {
      const [w, h] = v.split('x').map(Number);
      streamSettings.update({ size: 'custom', width: w, height: h, bitrate: 0 });
    }
    cleanup();
    void api.endSession(session.id, false).then(onrestart);
  }

  const quality = $derived(streamSettings.prefs.size === 'native' ? 'native' : `${streamSettings.prefs.width}x${streamSettings.prefs.height}`);
</script>

<div class="player" class:fullscreen bind:this={wrap}>
  <div class="tools" role="toolbar" aria-label={t('stream.controls')}>
    <strong class="title">{appName}</strong>
    <span class="state" class:ok={phase === 'connected'}>{phase === 'connected' ? t('stream.live') : t('stream.connecting')}</span>
    <div class="grow"></div>
    <button class="btn ghost sm" onclick={toggleFullscreen}>{fullscreen ? t('stream.exitFullscreen') : t('stream.fullscreen')}</button>
    <button class="btn ghost sm" onclick={lockMouse} disabled={mouseLocked || phase !== 'connected'} title={t('stream.lockMouseHint')}>{t('stream.lockMouse')}</button>
    <label class="q">
      <span class="sr-only">{t('stream.quality')}</span>
      <select class="input sm" value={quality} onchange={setQuality} aria-label={t('stream.quality')}>
        <option value="native">{t('stream.qualityNative')}</option>
        <option value="2560x1440">1440p</option>
        <option value="1920x1080">1080p</option>
        <option value="1280x720">720p</option>
        {#if !['native', '2560x1440', '1920x1080', '1280x720'].includes(quality)}<option value={quality}>{quality.replace('x', '×')}</option>{/if}
      </select>
    </label>
    <button class="btn ghost sm" aria-pressed={streamSettings.prefs.stats} onclick={() => streamSettings.update({ stats: !streamSettings.prefs.stats })}>{t('stream.stats')}</button
    >
    <button class="btn sm" onclick={() => end(false)} disabled={ending} title={t('stream.disconnectHint')}>{t('stream.disconnect')}</button>
    <button class="btn ghost sm" onclick={() => end(true)} disabled={ending}>{t('stream.quitGame')}</button>
    <button class="btn ghost sm danger" onclick={signOutEverywhere}>{t('stream.signOutEverywhere')}</button>
  </div>

  <div class="screen">
    {#if session.transport === 'ws'}
      <canvas bind:this={canvas} tabindex="0" aria-label={t('stream.screenLabel', { app: appName })}></canvas>
    {:else}
      <video bind:this={video} autoplay playsinline tabindex="0" aria-label={t('stream.screenLabel', { app: appName })}></video>
    {/if}
    {#if phase === 'connecting'}<div class="veil" role="status">{t('stream.connectingLong')}</div>{/if}
    {#if needsSound}<button class="btn sound" onclick={unmute}>{t('stream.sound')}</button>{/if}
    {#if streamSettings.prefs.stats && stats}
      <div class="stats" aria-live="off">
        <span>{stats.width}×{stats.height}</span>
        <span>{stats.fps ?? '–'} fps</span>
        <span>{stats.kbps === null ? '–' : (stats.kbps / 1000).toFixed(1)} Mbps</span>
        <span>{stats.rttMs ?? '–'} ms</span>
        <span>{t(PATHS[stats.path])}</span>
        {#if stats.packetsLost}<span>{t('stream.lost', { n: stats.packetsLost })}</span>{/if}
      </div>
    {/if}
  </div>
  {#if mouseLocked}<p class="hint">{t('stream.escHint')}</p>{/if}
</div>

<style>
  .player {
    display: grid;
    gap: 8px;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .title {
    overflow-wrap: anywhere;
  }
  .state {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-elev);
    color: var(--text-muted);
  }
  .state.ok {
    color: var(--success, #2e7d32);
  }
  .grow {
    flex: 1;
  }
  .q select {
    min-width: 0;
  }
  .danger {
    color: var(--danger, #c62828);
  }
  .screen {
    position: relative;
    background: #000;
    border-radius: 10px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
  }
  .screen video,
  .screen canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    outline: none;
    cursor: default;
  }
  .fullscreen {
    position: relative;
    background: #000;
    gap: 0;
  }
  .fullscreen .tools {
    position: absolute;
    inset: 0 0 auto;
    z-index: 2;
    padding: 6px 10px;
    background: rgb(0 0 0 / 0.65);
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .fullscreen .tools:hover,
  .fullscreen .tools:focus-within {
    opacity: 1;
  }
  .fullscreen .screen {
    height: 100vh;
    aspect-ratio: auto;
    border-radius: 0;
  }
  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #fff;
    background: rgb(0 0 0 / 0.5);
    font-size: 15px;
  }
  .sound {
    position: absolute;
    inset: auto 50% 16px auto;
    transform: translateX(50%);
  }
  .stats {
    position: absolute;
    inset: 8px auto auto 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    font:
      12px/1.4 ui-monospace,
      monospace;
    pointer-events: none;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .fullscreen .hint {
    display: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
