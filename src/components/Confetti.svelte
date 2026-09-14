<script lang="ts">
  // Full-screen canvas confetti. Call fire() via bind:this or the exported trigger prop.
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';

  interface Props {
    trigger: number; // bump to fire
    intensity?: number;
  }
  let { trigger, intensity = 180 }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let active = $state(false);
  let raf = 0;

  interface P {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    rot: number;
    vr: number;
    color: string;
    life: number;
    shape: number;
  }
  let parts: P[] = [];
  const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#55efc4', '#fd79a8', '#74b9ff', '#ffeaa7'];

  function fire() {
    if (!canvas || store.settings.reducedMotion) return;
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    parts = [];
    for (let i = 0; i < intensity; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      parts.push({
        x: W / 2 + side * (W * 0.25) + (Math.random() - 0.5) * 60,
        y: H * 0.6,
        vx: side * -1 * (2 + Math.random() * 6) + (Math.random() - 0.5) * 4,
        vy: -(9 + Math.random() * 9),
        r: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length],
        life: 1,
        shape: i % 3,
      });
    }
    active = true;
    cancelAnimationFrame(raf);
    const start = performance.now();
    const step = (t: number) => {
      const ctx = canvas!.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      const elapsed = (t - start) / 1000;
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - Math.max(0, elapsed - 1.6) / 1.2);
        if (p.y < H + 20 && p.life > 0) alive++;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2);
        else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.r);
          ctx.lineTo(p.r, p.r);
          ctx.lineTo(-p.r, p.r);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0 && elapsed < 3.5) raf = requestAnimationFrame(step);
      else {
        ctx.clearRect(0, 0, W, H);
        active = false;
      }
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

  onMount(() => () => cancelAnimationFrame(raf));
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
  }
  .confetti.active {
    opacity: 1;
  }
</style>
