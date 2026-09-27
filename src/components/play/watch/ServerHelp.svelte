<script lang="ts">
  // Why this browser can't talk to a media server from this page, and exactly what fixes it.
  import { toasts } from '../../../lib/toast.svelte';
  import { isPrivateHost } from '../../../lib/watch/embed';

  interface Props {
    server: string;
    /** http:// server on an https:// page */
    mixed: boolean;
    /** the origin the page's security policy doesn't list ('' when it does) */
    blocked: string;
  }
  let { server, mixed, blocked }: Props = $props();

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: 'Copied', detail: text, kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: "Couldn't copy", detail: text, kind: 'warn' });
    }
  }
</script>

<div class="card help" role="note">
  {#if mixed}
    <h3>🔒 The browser blocks http:// servers on this https:// site</h3>
    <p>
      This app is served over https, so the browser refuses to load anything from <code>{server}</code> ("mixed content"){isPrivateHost(server)
        ? ', and a home-network address only works on that network anyway'
        : ''}. Ways to fix it:
    </p>
    <ul>
      <li>
        <strong>Give the server https:</strong> a reverse proxy with a certificate (Caddy, Nginx Proxy Manager, Traefik), <strong>Tailscale Serve</strong> (or Funnel to reach it
        from anywhere), or a <strong>Cloudflare Tunnel</strong>. Then add the https address here.
      </li>
      <li>
        <strong>Or run this app yourself on the same network over http</strong> (for example <code>npm run build && npx vite preview --host</code>, or the Docker image), and open
        it by its http address.
      </li>
    </ul>
  {/if}
  {#if blocked}
    <h3>🛡️ This site's security policy doesn't include your server yet</h3>
    <p>
      To keep your data from being sent to places it shouldn't go, the site only lets the app connect to servers it was built with. Signing in, browsing and streaming talk to the
      server directly, so the site owner needs to add this origin to <code>VITE_MEDIA_SERVERS</code> (on GitHub Pages: repository
      <em>Settings → Secrets and variables → Actions → Variables</em>) and deploy again:
    </p>
    <div class="copy">
      <code>{blocked}</code>
      <button class="btn sm" onclick={() => copy(blocked)}>Copy</button>
    </div>
  {/if}
  <p class="muted">Until then, the server's own web app (below) may still work, and "Open in a new tab" always does. More in WATCH.md.</p>
</div>

<style>
  .help h3 {
    font-size: 14px;
    margin: 0 0 6px;
  }
  .help h3 + p,
  .help p {
    font-size: 13px;
    margin: 4px 0 8px;
  }
  .help ul {
    font-size: 13px;
    margin: 0 0 10px;
    padding-inline-start: 18px;
    display: grid;
    gap: 4px;
  }
  .copy {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .copy code {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    padding: 4px 8px;
    border-radius: 6px;
    word-break: break-all;
  }
  .muted {
    color: var(--text-muted);
  }
</style>
