<script lang="ts">
  // Full-screen sandboxed player for arcade games. Tracks the voucher timer and score messages.
  import { onMount, untrack } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { readScoreMessage, sandboxFor } from '../../lib/arcade';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { focusTrap } from '../../lib/focusTrap';
  import type { ArcadeGame } from '../../lib/types';

  interface Props {
    game: ArcadeGame;
    preview?: boolean; // admin preview: no timer
    onclose: () => void;
    onextend?: () => boolean; // spend another voucher; returns false when out
  }
  let { game, preview = false, onclose, onextend }: Props = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  // the timer starts from the game the player opened with
  let endsAt = $state(untrack(() => (!preview && game.minutes ? Date.now() + game.minutes * 60_000 : 0)));
  let now = $state(Date.now());
  let timeUp = $state(false);
  let key = $state(0);
  let best = $state(untrack(() => arcade.scores[game.id] ?? 0));

  const dark = $derived(document.documentElement.classList.contains('force-dark') || store.settings.theme === 'dark');
  // words from notecards (single words, 3–10 letters) for word games
  const words = $derived(
    Array.from(
      new Set(
        store.cards
          .flatMap((c) => [c.front, c.back])
          .map((w) => w.trim().toUpperCase())
          .filter((w) => /^[A-Z]{3,10}$/.test(w)),
      ),
    ).slice(0, 20),
  );
  const src = $derived(
    game.html
      ? undefined
      : arcade.srcFor(game, { theme: store.settings.themePack, dark: dark ? '1' : '0', accent: store.settings.accent, ...(words.length >= 4 ? { words: words.join(',') } : {}) }),
  );
  const left = $derived(endsAt ? Math.max(0, endsAt - now) : 0);
  const mmss = $derived(`${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`);

  onMount(() => {
    const tick = setInterval(() => {
      now = Date.now();
      if (endsAt && now >= endsAt && !timeUp) timeUp = true;
    }, 500);
    const onMsg = (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return;
      const score = readScoreMessage(e.data);
      if (score === null) return;
      if (arcade.recordScore(game.id, score)) {
        best = score;
        toasts.push({ message: `New high score in ${game.title}`, detail: score.toLocaleString(), kind: 'success', emoji: '🏆' });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    };
    window.addEventListener('message', onMsg);
    window.addEventListener('keydown', onKey);
    frame?.focus();
    return () => {
      clearInterval(tick);
      window.removeEventListener('message', onMsg);
      window.removeEventListener('keydown', onKey);
    };
  });

  function extend() {
    if (!onextend?.()) return;
    endsAt = Date.now() + (game.minutes ?? 10) * 60_000;
    timeUp = false;
    key++;
  }
</script>

<div class="player" role="dialog" aria-modal="true" aria-label={game.title} use:focusTrap>
  <header>
    <span class="t">{game.emoji} {game.title}</span>
    {#if preview}<span class="chip">Preview</span>{/if}
    {#if best}<span class="best">🏆 {best.toLocaleString()}</span>{/if}
    <span class="grow"></span>
    {#if endsAt}<span class="time" class:low={left < 60_000}>⏱ {mmss}</span>{/if}
    <button class="btn sm" onclick={onclose}>Close</button>
  </header>
  {#if timeUp}
    <div class="up">
      <h2>Time's up!</h2>
      <p>Your voucher's {game.minutes} minutes are done.</p>
      <div class="btns">
        {#if onextend}<button class="btn primary" onclick={extend}>Play again ({game.cost} 🎟️)</button>{/if}
        <button class="btn" onclick={onclose}>Back</button>
      </div>
    </div>
  {:else}
    {#key key}
      {#if game.html}
        <iframe bind:this={frame} title={game.title} srcdoc={game.html} sandbox={sandboxFor(game)} allow="fullscreen; gamepad; autoplay"></iframe>
      {:else if src}
        <iframe bind:this={frame} title={game.title} {src} sandbox={sandboxFor(game)} allow="fullscreen; gamepad; autoplay" referrerpolicy="no-referrer"></iframe>
      {/if}
    {/key}
  {/if}
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: #000;
    display: grid;
    grid-template-rows: auto 1fr;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
  }
  .t {
    font-weight: 700;
  }
  .grow {
    flex: 1;
  }
  .best {
    font-size: 13px;
    color: var(--text-muted);
  }
  .time {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .time.low {
    color: var(--danger-text);
  }
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    background: #fff;
  }
  .up {
    display: grid;
    place-content: center;
    text-align: center;
    color: #fff;
    gap: 8px;
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
</style>
