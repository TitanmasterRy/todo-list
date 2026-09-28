<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { THEMES } from '../lib/themes';
  import { previewPack, primeAudio } from '../lib/sounds';
  import type { ThemePack } from '../lib/types';
  import { t } from '../lib/i18n/index.svelte';

  function pick(id: ThemePack) {
    const t = THEMES.find((x) => x.id === id)!;
    store.updateSettings({ themePack: id, soundPack: t.sound });
    primeAudio();
    if (store.settings.soundsEnabled) previewPack(t.sound);
  }
</script>

<div class="packs">
  {#each THEMES as th (th.id)}
    <button
      class="pack"
      class:on={store.settings.themePack === th.id}
      onclick={() => pick(th.id)}
      aria-pressed={store.settings.themePack === th.id}
      style="--pc:{th.confetti[0]}; --pc2:{th.confetti[1]}; --pc3:{th.confetti[2]}"
    >
      <span class="swatch" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="name">{th.emoji} {t(`packs.${th.id}`)}</span>
      <span class="tag">{t(`packs.${th.id}.tag`)}</span>
      <span class="meta"
        >{t('packs.sound')}
        {th.sound} · {th.particles.shapes
          .filter((s) => !['dot', 'line', 'pixel', 'star'].includes(s))
          .slice(0, 3)
          .join(' ') || th.particles.shapes[0]}
        {t('packs.particles')}</span
      >
    </button>
  {/each}
</div>

<style>
  .packs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 8px;
  }
  .pack {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    text-align: start;
    color: var(--text);
    background: var(--bg-elev-2);
    box-shadow: inset 0 1px 0 var(--sheen);
    overflow: hidden;
    transition:
      transform var(--dur-slow) var(--spring),
      border-color var(--dur),
      box-shadow var(--dur-slow) var(--ease);
  }
  /* a soft pool of the pack's first confetti color in the corner */
  .pack::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(80% 60% at 100% 0%, color-mix(in srgb, var(--pc) 22%, transparent), transparent 70%);
    opacity: 0.6;
    transition: opacity var(--dur-slow);
    pointer-events: none;
  }
  .pack:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--pc) 55%, var(--border));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      0 0 24px -8px color-mix(in srgb, var(--pc) 60%, transparent);
  }
  .pack:hover::before {
    opacity: 1;
  }
  .pack:active {
    transform: scale(0.98);
  }
  .pack.on {
    border-color: transparent;
    background:
      linear-gradient(var(--bg-elev-2), var(--bg-elev-2)) padding-box,
      linear-gradient(135deg, var(--pc), var(--pc2), var(--pc3)) border-box;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 0 3px color-mix(in srgb, var(--pc) 22%, transparent),
      0 0 28px -6px color-mix(in srgb, var(--pc) 70%, transparent);
  }
  .pack.on::before {
    opacity: 1;
  }
  /* mini preview: a gradient strip of the confetti colors with the three swatch dots riding on it */
  .swatch {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 26px;
    padding: 0 6px;
    border-radius: 8px;
    background: linear-gradient(90deg, var(--pc), var(--pc2) 50%, var(--pc3));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.35),
      0 3px 10px -4px color-mix(in srgb, var(--pc2) 70%, transparent);
    margin-bottom: 4px;
    overflow: hidden;
  }
  .swatch::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.4) 50%, transparent 65%);
    transform: translateX(-130%);
  }
  .pack:hover .swatch::after,
  .pack.on .swatch::after {
    animation: sheen 900ms var(--ease);
  }
  .swatch i {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--pc);
    border: 2px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: transform var(--dur-slow) var(--spring);
  }
  .swatch i:nth-child(2) {
    background: var(--pc2);
    transition-delay: 40ms;
  }
  .swatch i:nth-child(3) {
    background: var(--pc3);
    transition-delay: 80ms;
  }
  .pack:hover .swatch i {
    transform: translateY(-2px) scale(1.15);
  }
  .name {
    position: relative;
    font-weight: 700;
  }
  .tag {
    position: relative;
    font-size: 12px;
    color: var(--text-muted);
  }
  .meta {
    position: relative;
    font-size: 11px;
    color: var(--text-faint);
  }
</style>
