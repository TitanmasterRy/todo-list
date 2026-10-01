<script lang="ts">
  // Full-screen canvas confetti. Bump `trigger` to fire. Every distinct piece (a shape in a color, an emoji) is drawn
  // once into a small sprite; each frame is then one drawImage per piece with no font or path work, which is what
  // kept phones from dropping frames. Physics runs on real elapsed time, so a slow frame never slows the burst down.
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { themeById } from '../lib/themes';
  import { CONFETTI_STYLES } from '../lib/economy';
  import { BURST_SECONDS, buildSprites, burstAlpha, frameStep, particleBudget, spawnParticles, stepParticles, type Particle, type Sprite } from '../lib/confetti';
  import { framesJanky, liteEffects, noteJank, readDeviceHints, sawJank } from '../lib/effects';

  interface Props {
    trigger: number; // bump to fire
    intensity?: number;
  }
  let { trigger, intensity = 180 }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let active = $state(false);
  let raf = 0;
  let parts: Particle[] = [];
  const SPRITE = 24; // px, before the pixel ratio

  // sprite cache, keyed by the piece's look; cleared when the theme or style changes
  const cache = new Map<string, HTMLCanvasElement>();
  function sprite(s: Sprite, dpr: number): HTMLCanvasElement {
    const key = `${s.kind}|${s.color}|${s.glyph ?? ''}|${dpr}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = SPRITE * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.translate(SPRITE / 2, SPRITE / 2);
    g.fillStyle = s.color;
    if (s.kind === 'glyph') {
      g.font = `${SPRITE * 0.8}px system-ui`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s.glyph ?? '✦', 0, 1);
    } else if (s.kind === 'rect') g.fillRect(-4, -8, 8, 16);
    else if (s.kind === 'dot') {
      g.beginPath();
      g.arc(0, 0, 5.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(8, 8);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
    }
    cache.set(key, c);
    return c;
  }

  function fire() {
    if (!canvas || store.settings.celebrations === false || store.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.visibilityState === 'hidden') return;
    const lite = liteEffects(store.settings.effects, readDeviceHints(), sawJank());
    // a crisp but cheap backing store: at most 1.5× on full effects, 1× on lite
    const dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })!;
    const theme = themeById(store.settings.themePack);
    // a confetti style bought in the shop overrides the theme pack's
    const style = store.settings.equippedConfetti ? CONFETTI_STYLES[store.settings.equippedConfetti] : undefined;
    const colors = style?.colors ?? theme.confetti;
    const emoji = style?.emoji ?? theme.particles.shapes.filter((s) => !['dot', 'line', 'pixel', 'star'].includes(s));
    const sprites = buildSprites(colors, emoji, theme.flourish, !!style).map((s) => sprite(s, dpr));
    const count = particleBudget({ width: W, height: H, requested: intensity, lite });
    parts = spawnParticles(count, W, H, sprites.length);
    active = true;
    document.documentElement.classList.add('celebrating');
    cancelAnimationFrame(raf);
    const start = performance.now();
    let prev = start;
    const frames: number[] = [];
    const half = SPRITE / 2;
    const finish = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      active = false;
      document.documentElement.classList.remove('celebrating');
      // "auto" effects drop to lite for the rest of the session after a stuttering burst
      if (!sawJank() && framesJanky(frames)) {
        noteJank(true);
        store.applyTheme();
      }
    };
    const step = (t: number) => {
      const dt = t - prev;
      prev = t;
      frames.push(dt);
      const elapsed = (t - start) / 1000;
      const alive = stepParticles(parts, frameStep(dt), H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.globalAlpha = burstAlpha(elapsed);
      for (const p of parts) {
        if (p.y > H + 20) continue;
        const s = p.scale * dpr;
        const c = Math.cos(p.rot) * s;
        const sn = Math.sin(p.rot) * s;
        ctx.setTransform(c, sn, -sn, c, p.x * dpr, p.y * dpr);
        ctx.drawImage(sprites[p.sprite], -half, -half, SPRITE, SPRITE);
      }
      if (alive > 0 && elapsed < BURST_SECONDS && document.visibilityState !== 'hidden') raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
  }

  let last = 0;
  $effect(() => {
    if (trigger !== last) {
      last = trigger;
      if (trigger > 0) fire();
    }
  });

  // the sprites belong to a theme and a style: redraw them after a change
  $effect(() => {
    void store.settings.themePack;
    void store.settings.equippedConfetti;
    cache.clear();
  });

  onMount(() => () => {
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove('celebrating');
  });
</script>

<canvas bind:this={canvas} class="confetti" class:active aria-hidden="true"></canvas>

<style>
  .confetti {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 500;
    opacity: 0;
    /* its own compositor layer, so repainting it never repaints the page under it */
    will-change: transform;
    transform: translateZ(0);
  }
  .confetti.active {
    opacity: 1;
  }
</style>
