<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { THEMES } from '../lib/themes';
  import { previewPack, primeAudio } from '../lib/sounds';
  import type { ThemePack } from '../lib/types';

  function pick(id: ThemePack) {
    const t = THEMES.find((x) => x.id === id)!;
    store.updateSettings({ themePack: id, soundPack: t.sound });
    primeAudio();
    if (store.settings.soundsEnabled) previewPack(t.sound);
  }
</script>

<div class="packs">
  {#each THEMES as t (t.id)}
    <button
      class="pack"
      class:on={store.settings.themePack === t.id}
      onclick={() => pick(t.id)}
      aria-pressed={store.settings.themePack === t.id}
      style="--pc:{t.confetti[0]}; --pc2:{t.confetti[1]}; --pc3:{t.confetti[2]}"
    >
      <span class="swatch"><i></i><i></i><i></i></span>
      <span class="name">{t.emoji} {t.name}</span>
      <span class="tag">{t.tagline}</span>
      <span class="meta"
        >sound: {t.sound} · {t.particles.shapes
          .filter((s) => !['dot', 'line', 'pixel', 'star'].includes(s))
          .slice(0, 3)
          .join(' ') || t.particles.shapes[0]} particles</span
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    text-align: left;
    color: var(--text);
    background: var(--bg-elev-2);
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur);
  }
  .pack:hover {
    transform: translateY(-2px);
  }
  .pack.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .swatch {
    display: flex;
    gap: 3px;
  }
  .swatch i {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--pc);
  }
  .swatch i:nth-child(2) {
    background: var(--pc2);
  }
  .swatch i:nth-child(3) {
    background: var(--pc3);
  }
  .name {
    font-weight: 700;
  }
  .tag {
    font-size: 12px;
    color: var(--text-muted);
  }
  .meta {
    font-size: 11px;
    color: var(--text-faint);
  }
</style>
