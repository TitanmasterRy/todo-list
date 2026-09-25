<script lang="ts">
  // An iframe for untrusted HTML (uploaded arcade games, the Code tool's preview). The app page's CSP forbids
  // inline scripts and srcdoc frames inherit it, so the HTML is handed to public/sandbox.html, which renders it
  // in its own document. The offline single-file build has no CSP (and no sandbox.html), so it uses srcdoc.
  import { onMount } from 'svelte';

  interface Props {
    html: string;
    title: string;
    sandbox: string;
    allow?: string;
    class?: string;
    frame?: HTMLIFrameElement;
  }
  let { html, title, sandbox, allow, class: cls = '', frame = $bindable() }: Props = $props();

  const lite = !!import.meta.env.LITE;
  const src = `${import.meta.env.BASE_URL}sandbox.html`;
  let sent = false;

  onMount(() => {
    if (lite) return;
    const onMsg = (e: MessageEvent) => {
      if (sent || !frame || e.source !== frame.contentWindow || (e.data as { type?: string } | null)?.type !== 'hwtodo:sandbox-ready') return;
      sent = true;
      // the frame has an opaque origin, so '*' is the only target that reaches it
      frame.contentWindow?.postMessage({ type: 'hwtodo:render', html }, '*');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  });
</script>

{#if lite}
  <iframe bind:this={frame} {title} srcdoc={html} {sandbox} {allow} class={cls}></iframe>
{:else}
  <iframe bind:this={frame} {title} {src} {sandbox} {allow} class={cls}></iframe>
{/if}
