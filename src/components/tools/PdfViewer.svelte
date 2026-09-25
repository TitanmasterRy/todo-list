<script lang="ts">
  // Renders one page of a PDF (from a Blob) to a canvas plus a selectable pdf.js text layer.
  // pdf.js itself is loaded lazily so the rest of the app never pays for it.
  import { onDestroy } from 'svelte';
  import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';

  let {
    blob,
    page,
    onpage,
    onselect,
    zoom = 1,
  }: {
    blob: Blob;
    page: number;
    onpage: (n: number, count: number) => void;
    onselect?: (text: string, page: number) => void;
    zoom?: number;
  } = $props();

  type Pdfjs = typeof import('pdfjs-dist');
  let pdfjsMod: Pdfjs | null = null;
  let doc: PDFDocumentProxy | null = $state.raw(null);
  let pageCount = $state(0);
  let loading = $state(true);
  let rendering = $state(false);
  let error = $state<string | null>(null);
  let wrapEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let textEl = $state<HTMLDivElement | null>(null);
  let containerWidth = $state(0);
  let scale = $state(1);
  let cssW = $state(0);
  let cssH = $state(0);

  let loadingTask: PDFDocumentLoadingTask | null = null;
  let renderTask: RenderTask | null = null;
  let textLayer: TextLayer | null = null;
  let loadToken = 0;
  let renderToken = 0;

  async function loadPdfjs(): Promise<Pdfjs> {
    if (pdfjsMod) return pdfjsMod;
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    }
    pdfjsMod = pdfjs;
    return pdfjs;
  }

  function cancelRender() {
    renderTask?.cancel();
    renderTask = null;
    textLayer?.cancel();
    textLayer = null;
  }

  async function destroyDoc() {
    cancelRender();
    const t = loadingTask;
    loadingTask = null;
    doc = null;
    pageCount = 0;
    if (t) await t.destroy().catch(() => {});
  }

  // Load the document whenever the blob changes.
  $effect(() => {
    const b = blob;
    const token = ++loadToken;
    loading = true;
    error = null;
    void (async () => {
      await destroyDoc();
      try {
        const pdfjs = await loadPdfjs();
        const data = new Uint8Array(await b.arrayBuffer());
        if (token !== loadToken) return;
        const task = pdfjs.getDocument({ data });
        const d = await task.promise;
        if (token !== loadToken) {
          await task.destroy().catch(() => {});
          return;
        }
        loadingTask = task;
        doc = d;
        pageCount = d.numPages;
        onpage(Math.min(Math.max(1, page), d.numPages), d.numPages);
      } catch (e) {
        if (token !== loadToken) return;
        error = e instanceof Error ? e.message : String(e);
      } finally {
        if (token === loadToken) loading = false;
      }
    })();
  });

  // Track the available width so the default is fit-to-width.
  $effect(() => {
    const el = wrapEl;
    if (!el) return;
    containerWidth = el.clientWidth;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? el.clientWidth);
      if (w && w !== containerWidth) containerWidth = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Render the current page whenever the page, zoom, width or document changes.
  $effect(() => {
    const d = doc;
    const n = page;
    const z = zoom;
    const w = containerWidth;
    const canvas = canvasEl;
    const text = textEl;
    if (!d || !canvas || !text || !w) return;
    const token = ++renderToken;
    void renderPage(d, n, z, w, canvas, text, token);
  });

  async function renderPage(d: PDFDocumentProxy, n: number, z: number, w: number, canvas: HTMLCanvasElement, text: HTMLDivElement, token: number) {
    const pdfjs = pdfjsMod;
    if (!pdfjs) return;
    const num = Math.min(Math.max(1, n), d.numPages);
    cancelRender();
    rendering = true;
    try {
      const pg = await d.getPage(num);
      if (token !== renderToken) return;
      const base = pg.getViewport({ scale: 1 });
      const s = (w / base.width) * z;
      const viewport = pg.getViewport({ scale: s });
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      scale = s;
      cssW = viewport.width;
      cssH = viewport.height;
      const task = pg.render({ canvas, viewport: pg.getViewport({ scale: s * dpr }) });
      renderTask = task;
      await task.promise;
      if (token !== renderToken) return;
      renderTask = null;
      // Selectable text layer on top of the canvas.
      text.replaceChildren();
      const content = await pg.getTextContent();
      if (token !== renderToken) return;
      const tl = new pdfjs.TextLayer({ textContentSource: content, container: text, viewport });
      textLayer = tl;
      await tl.render();
      if (token === renderToken) textLayer = null;
    } catch (e) {
      if (token !== renderToken) return;
      if (e instanceof Error && e.name === 'RenderingCancelledException') return;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (token === renderToken) rendering = false;
    }
  }

  function checkSelection() {
    if (!onselect || !textEl) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    if (!anchor || !textEl.contains(anchor)) return;
    const t = sel.toString().replace(/\s+/g, ' ').trim();
    if (t) onselect(t, page);
  }
  function onPointerUp() {
    // Let the browser finish adjusting the selection first.
    setTimeout(checkSelection, 0);
  }

  onDestroy(() => {
    loadToken++;
    renderToken++;
    void destroyDoc();
  });
</script>

<svelte:window onmouseup={onPointerUp} ontouchend={onPointerUp} />

<div class="viewer" bind:this={wrapEl}>
  {#if error}
    <div class="err" role="alert">
      <strong>Couldn’t open this PDF.</strong>
      <span>{error}</span>
    </div>
  {:else}
    {#if loading || rendering}
      <div class="status" aria-live="polite">{loading ? 'Opening…' : 'Rendering…'}</div>
    {/if}
    <div
      class="page"
      style="--scale-factor:{scale}; width:{cssW ? cssW + 'px' : '100%'}; height:{cssH ? cssH + 'px' : 'auto'}"
      role="document"
      aria-label="Page {page} of {pageCount}"
    >
      <canvas bind:this={canvasEl} style="width:{cssW ? cssW + 'px' : '100%'}; height:{cssH ? cssH + 'px' : 'auto'}"></canvas>
      <div class="textLayer" bind:this={textEl}></div>
    </div>
  {/if}
</div>

<style>
  .viewer {
    position: relative;
    width: 100%;
    overflow-x: auto;
  }
  .status {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: var(--bg-elev-2);
    color: var(--text-muted);
    border: 1px solid var(--border);
    pointer-events: none;
  }
  .err {
    padding: 20px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger) 12%, var(--bg-elev-2));
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }
  .err span {
    color: var(--text-muted);
    word-break: break-word;
  }
  .page {
    --user-unit: 1;
    --total-scale-factor: calc(var(--scale-factor) * var(--user-unit));
    --scale-round-x: 1px;
    --scale-round-y: 1px;
    position: relative;
    margin: 0 auto;
    max-width: 100%;
    background: #fff;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    direction: ltr;
  }
  canvas {
    display: block;
    max-width: 100%;
  }
  /* Minimal port of pdf.js's textLayer rules (the spans are created by pdf.js, so they're :global). */
  .textLayer {
    color-scheme: only light;
    position: absolute;
    inset: 0;
    overflow: clip;
    opacity: 1;
    line-height: 1;
    letter-spacing: normal;
    word-spacing: normal;
    text-align: initial;
    text-size-adjust: none;
    forced-color-adjust: none;
    transform-origin: 0 0;
    z-index: 1;
    --min-font-size: 1;
    --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
    --min-font-size-inv: calc(1 / var(--min-font-size));
  }
  .textLayer :global(span),
  .textLayer :global(br) {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
    user-select: text;
    -webkit-user-select: text;
  }
  .textLayer > :global(:not(.markedContent)),
  .textLayer :global(.markedContent span:not(.markedContent)) {
    z-index: 1;
    --font-height: 0;
    font-size: calc(var(--text-scale-factor) * var(--font-height));
    --scale-x: 1;
    --rotate: 0deg;
    transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
  }
  .textLayer :global(.markedContent) {
    display: contents;
  }
  .textLayer :global(span[role='img']) {
    user-select: none;
    cursor: default;
  }
  .textLayer :global(span::selection) {
    background: color-mix(in srgb, var(--accent) 35%, transparent);
    color: transparent;
  }
  .textLayer :global(.endOfContent) {
    display: block;
    position: absolute;
    inset: 100% 0 0;
    z-index: 0;
    cursor: default;
    user-select: none;
  }
</style>
