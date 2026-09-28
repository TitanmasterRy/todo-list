<script lang="ts">
  // Full-screen sandboxed player for arcade games. Tracks the voucher timer and score messages, and lets games sell
  // power-ups for coins: the game posts { type: 'hwtodo:buy', id, label, cost }, the player confirms here, and the
  // game gets { type: 'hwtodo:bought', id } or { type: 'hwtodo:denied', id, reason }. The wallet is sent as
  // { type: 'hwtodo:wallet', coins } when the game loads (or says { type: 'hwtodo:hello' }) and after each purchase.
  // Saves: sandboxed games can't use localStorage, so they post { type: 'hwtodo:save', data: string } (≤ 1 MB) and
  // get { type: 'hwtodo:load', data: string | null } back after saying hello. Kept per game on this device.
  import { onMount, untrack } from 'svelte';
  import { arcade } from '../../lib/arcade.svelte';
  import { readSaveMessage, readScoreMessage, sandboxFor, saveKey } from '../../lib/arcade';
  import { getMeta, putMeta } from '../../lib/storage';
  import { store } from '../../lib/store.svelte';
  import { economy } from '../../lib/economy.svelte';
  import { parsePowerup, POWERUP_SESSION_MAX, type PowerupRequest } from '../../lib/economy';
  import { toasts } from '../../lib/toast.svelte';
  import { focusTrap } from '../../lib/focusTrap';
  import SandboxFrame from '../SandboxFrame.svelte';
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
  // ---------- coin power-ups ----------
  let pending = $state<PowerupRequest | null>(null);
  let spent = $state(0);
  const coinsOn = $derived(economy.enabled && !preview);

  function post(msg: Record<string, unknown>) {
    frame?.contentWindow?.postMessage(msg, '*');
  }
  function sendWallet() {
    if (coinsOn) post({ type: 'hwtodo:wallet', coins: economy.wallet.coins });
  }
  $effect(() => {
    const f = frame;
    if (!f) return;
    f.addEventListener('load', sendWallet);
    return () => f.removeEventListener('load', sendWallet);
  });
  function request(req: PowerupRequest) {
    const deny = (reason: string) => post({ type: 'hwtodo:denied', id: req.id, reason });
    if (!coinsOn) return deny('Coins are off');
    if (pending) return deny('Another purchase is waiting');
    if (req.cost > economy.wallet.coins) return deny('Not enough coins');
    if (spent + req.cost > POWERUP_SESSION_MAX) return deny(`Limit of ${POWERUP_SESSION_MAX} coins per game reached`);
    pending = req;
  }
  function confirmBuy() {
    const req = pending;
    pending = null;
    if (!req) return;
    if (req.cost > economy.wallet.coins) {
      post({ type: 'hwtodo:denied', id: req.id, reason: 'Not enough coins' });
      return;
    }
    store.addLedger([{ currency: 'coins', amount: -req.cost, reason: `game:${game.id}`, ref: req.label }]);
    spent += req.cost;
    post({ type: 'hwtodo:bought', id: req.id });
    sendWallet();
    frame?.focus();
  }
  function cancelBuy() {
    if (pending) post({ type: 'hwtodo:denied', id: pending.id, reason: 'Cancelled' });
    pending = null;
    frame?.focus();
  }

  const left = $derived(endsAt ? Math.max(0, endsAt - now) : 0);
  const mmss = $derived(`${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`);

  onMount(() => {
    const tick = setInterval(() => {
      now = Date.now();
      if (endsAt && now >= endsAt && !timeUp) timeUp = true;
    }, 500);
    const onMsg = (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return;
      if ((e.data as { type?: unknown } | null)?.type === 'hwtodo:hello') {
        sendWallet();
        // previews (admin/try it) start fresh and don't overwrite the real save
        if (preview) post({ type: 'hwtodo:load', data: null });
        else void getMeta<string>(saveKey(game.id)).then((data) => post({ type: 'hwtodo:load', data: data ?? null }));
        return;
      }
      const save = readSaveMessage(e.data);
      if (save !== null) {
        if (!preview) void putMeta(saveKey(game.id), save);
        return;
      }
      const req = parsePowerup(e.data);
      if (req) return request(req);
      const score = readScoreMessage(e.data);
      if (score === null) return;
      if (arcade.recordScore(game.id, score)) {
        best = score;
        toasts.push({ message: `New high score in ${game.title}`, detail: score.toLocaleString(), kind: 'success', emoji: '🏆' });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pending) cancelBuy();
        else onclose();
      }
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
    {#if coinsOn && spent}<span class="best" title="Spent on power-ups this game">−{spent} 🪙</span>{/if}
    {#if endsAt}<span class="time" class:low={left < 60_000}>⏱ {mmss}</span>{/if}
    <button class="btn sm" onclick={onclose}>Close</button>
  </header>
  {#if pending}
    <div class="buy" role="alertdialog" aria-labelledby="buy-h">
      <p id="buy-h"><strong>{pending.label}</strong> for {pending.cost} 🪙?</p>
      <p class="muted">You have {economy.wallet.coins.toLocaleString()} 🪙</p>
      <div class="btns">
        <button class="btn" onclick={cancelBuy}>No thanks</button>
        <!-- svelte-ignore a11y_autofocus -->
        <button class="btn primary" onclick={confirmBuy} autofocus>Buy</button>
      </div>
    </div>
  {/if}
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
        <SandboxFrame bind:frame html={game.html} title={game.title} sandbox={sandboxFor(game)} allow="fullscreen; gamepad; autoplay" />
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
    animation: fade-in 200ms var(--ease) both;
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, var(--bg-elev)), var(--bg-elev));
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
    box-shadow: 0 4px 20px -8px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .t {
    font-weight: 800;
  }
  .grow {
    flex: 1;
  }
  .best {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  .time {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
  }
  .time.low {
    color: var(--danger-text);
    border-color: color-mix(in srgb, var(--danger) 60%, var(--border));
    animation: glow-pulse 1s ease-out infinite;
  }
  /* the uploaded-game frame lives in SandboxFrame */
  .player :global(iframe) {
    width: 100%;
    height: 100%;
    border: 0;
    background: #fff;
  }
  .buy {
    position: fixed;
    z-index: 201;
    left: 50%;
    top: 64px;
    transform: translateX(-50%);
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid color-mix(in srgb, var(--gold) 60%, var(--border-strong));
    border-radius: var(--radius-lg);
    box-shadow:
      var(--shadow-lg),
      0 0 40px -10px color-mix(in srgb, var(--gold) 60%, transparent);
    padding: 14px 18px;
    text-align: center;
    min-width: 240px;
    animation: modal-in 300ms var(--spring) both;
  }
  .buy p {
    margin: 0 0 6px;
  }
  .buy .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .up {
    display: grid;
    place-content: center;
    text-align: center;
    color: #fff;
    gap: 8px;
    background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%);
  }
  .up h2 {
    font-size: 36px;
    margin: 0;
    font-weight: 900;
    background: var(--grad-accent);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: bump 600ms var(--spring);
  }
  .btns {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
</style>
