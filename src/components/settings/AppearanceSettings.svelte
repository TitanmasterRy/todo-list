<script lang="ts">
  // Settings → Appearance: theme, accent, motion, contrast, font, text size, time and week format.
  import { store } from '../../lib/store.svelte';
  import type { Theme } from '../../lib/types';
  import { ACCENT_UNLOCKS } from '../../lib/gamification';
  import { FONTS } from '../../lib/fonts';
  import { set } from './settings';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>Appearance</h2>
  <div class="row">
    <label for="theme">Theme</label>
    <select id="theme" class="select" value={s.theme} onchange={(e) => set('theme', (e.target as HTMLSelectElement).value as Theme)}>
      <option value="system">System</option>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </select>
  </div>
  <div class="row">
    <span id="accent-l">Accent</span>
    <div class="swatches" role="radiogroup" aria-labelledby="accent-l">
      {#each ACCENT_UNLOCKS as a}
        {@const locked = s.gamification && store.stats.level < a.level}
        <button
          class="sw"
          class:on={s.accent === a.color}
          class:locked
          style="background:{a.color}"
          role="radio"
          aria-checked={s.accent === a.color}
          aria-label="{a.name}{locked ? ` (unlocks at level ${a.level})` : ''}"
          title="{a.name}{locked ? ` · unlocks at level ${a.level}` : ''}"
          disabled={locked}
          onclick={() => set('accent', a.color)}>{locked ? '🔒' : ''}</button
        >
      {/each}
      <input type="color" value={s.accent} onchange={(e) => set('accent', (e.target as HTMLInputElement).value)} aria-label="Custom accent" class="custom" />
    </div>
  </div>
  <div class="row">
    <label for="motion">Reduced motion</label>
    <input id="motion" type="checkbox" class="switch" checked={s.reducedMotion} onchange={(e) => set('reducedMotion', (e.target as HTMLInputElement).checked)} />
  </div>
  <div class="row">
    <label for="celeb">Confetti and sparkle bursts</label>
    <input id="celeb" type="checkbox" class="switch" checked={s.celebrations} onchange={(e) => set('celebrations', (e.target as HTMLInputElement).checked)} />
  </div>
  <div class="row">
    <label for="hc">High contrast</label>
    <input id="hc" type="checkbox" class="switch" checked={s.highContrast} onchange={(e) => set('highContrast', (e.target as HTMLInputElement).checked)} />
  </div>
  <div class="row">
    <label for="font">Font</label>
    <select id="font" class="select" value={s.fontChoice} onchange={(e) => set('fontChoice', (e.target as HTMLSelectElement).value as typeof s.fontChoice)}>
      {#each FONTS as f (f.id)}<option value={f.id} title={f.hint}>{f.label}</option>{/each}
    </select>
  </div>
  <p class="help">{FONTS.find((f) => f.id === s.fontChoice)?.hint}</p>
  <div class="row">
    <label for="ts">Text size</label>
    <select id="ts" class="select" value={String(s.textScale)} onchange={(e) => set('textScale', Number((e.target as HTMLSelectElement).value))}>
      {#each [100, 112, 125, 140] as z (z)}<option value={String(z)}>{z}%</option>{/each}
    </select>
  </div>
  <div class="row">
    <label for="tf">Time format</label>
    <select id="tf" class="select" value={s.timeFormat} onchange={(e) => set('timeFormat', (e.target as HTMLSelectElement).value as '12h' | '24h')}>
      <option value="12h">12-hour (8pm)</option>
      <option value="24h">24-hour (20:00)</option>
    </select>
  </div>
  <div class="row">
    <label for="ws">Week starts on</label>
    <select id="ws" class="select" value={String(s.weekStart)} onchange={(e) => set('weekStart', Number((e.target as HTMLSelectElement).value) as 0 | 1)}>
      <option value="1">Monday</option>
      <option value="0">Sunday</option>
    </select>
  </div>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .row label {
    color: var(--text);
  }
  .row > span:first-child {
    color: var(--text);
  }
  .select {
    width: auto;
    min-width: 90px;
  }
  .switch {
    width: 40px;
    height: 22px;
    appearance: none;
    background: var(--border-strong);
    border-radius: 999px;
    position: relative;
    cursor: pointer;
    transition: background var(--dur);
    flex-shrink: 0;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform var(--dur) var(--spring);
  }
  .switch:checked {
    background: var(--accent);
  }
  .switch:checked::after {
    transform: translateX(18px);
  }
  .swatches {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .sw {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
  }
  .sw.on {
    border-color: var(--text);
    transform: scale(1.15);
  }
  .sw.locked {
    opacity: 0.35;
    font-size: 11px;
    cursor: not-allowed;
  }
  .custom {
    width: 24px;
    height: 24px;
    border: none;
    padding: 0;
    background: none;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
</style>
