<script lang="ts">
  // An embedded player or a media server's own web app in a frame. Many sites refuse to be framed
  // (X-Frame-Options / frame-ancestors) and a cross-origin page can't tell, so a hint and "Open in a new tab"
  // show after a few seconds either way.
  import { onDestroy, onMount } from 'svelte';
  import { FRAME_ALLOW, FRAME_SANDBOX, isMixedContent, referrerFor, type EmbedProvider } from '../../../lib/watch/embed';

  interface Props {
    src: string;
    title: string;
    provider?: EmbedProvider;
    /** what "Open in a new tab" opens (the original link rather than the embed URL) */
    openUrl?: string;
    /** a server's web app needs more room than a 16:9 player */
    tall?: boolean;
  }
  let { src, title, provider = 'web', openUrl, tall = false }: Props = $props();

  let wrap = $state<HTMLDivElement>();
  let hint = $state(false);
  // a frame from this app's own origin with scripts + same-origin could reach the app's data: never allowed
  const sameOrigin = $derived.by(() => {
    try {
      return new URL(src).origin === location.origin;
    } catch {
      return true;
    }
  });
  const mixed = $derived(isMixedContent(src, location.protocol));
  const timer = setTimeout(() => (hint = true), 5000);
  onDestroy(() => clearTimeout(timer));
  let fullscreen = $state(false);
  onMount(() => {
    const onFs = () => (fullscreen = !!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void wrap?.requestFullscreen?.().catch(() => {});
  }
</script>

{#if sameOrigin}
  <p class="err" role="alert">Pages from this app's own site can't be shown here.</p>
{:else if mixed}
  <div class="card mixed" role="note">
    <p>
      This is an <code>http://</code> address and this app is served over https, so the browser won't show it inside the app (mixed content). It opens fine in a new tab. To watch it
      here, give the server https (a reverse proxy with a certificate, Tailscale Serve/Funnel or a Cloudflare Tunnel), or run this app on the same network over http. See WATCH.md.
    </p>
    <a class="btn sm" href={openUrl ?? src} target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
  </div>
{:else}
  <div class="ef" class:tall class:fs={fullscreen} bind:this={wrap}>
    <iframe {src} {title} sandbox={FRAME_SANDBOX} allow={FRAME_ALLOW} allowfullscreen referrerpolicy={referrerFor(provider)}></iframe>
  </div>
  <div class="ef-bar">
    <a class="btn ghost sm" href={openUrl ?? src} target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
    <button class="btn ghost sm" onclick={toggleFullscreen}>⛶ Full screen</button>
  </div>
  {#if hint}
    <p class="hint">Not loading? Some sites don't allow being shown inside other apps. Open it in a new tab.</p>
  {/if}
{/if}

<style>
  .ef {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: var(--radius, 10px);
    overflow: hidden;
  }
  .ef.tall {
    aspect-ratio: auto;
    height: min(78vh, 900px);
  }
  .ef.fs {
    border-radius: 0;
  }
  iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }
  .ef-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }
  .hint {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0 0;
  }
  .err {
    color: var(--danger, #e17055);
  }
  .mixed p {
    font-size: 13px;
    margin: 0 0 8px;
  }
</style>
