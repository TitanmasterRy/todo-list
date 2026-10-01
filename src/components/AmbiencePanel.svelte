<script lang="ts">
  // Focus → Ambience: a noise bed (rain, fire, wind, waves, brown, pink, white) with its own volume. Can start and
  // stop with the timer. Loaded with the Focus view's first visit.
  import { store } from '../lib/store.svelte';
  import { pomodoro } from '../lib/pomodoro.svelte';
  import { ambience, AMBIENCE_ICON, AMBIENCE_KINDS, type AmbienceKind } from '../lib/ambience.svelte';
  import { t } from '../lib/i18n/index.svelte';

  const kind = $derived((store.settings.ambienceKind ?? 'rain') as AmbienceKind);
  const volume = $derived(store.settings.ambienceVolume ?? 40);
  const auto = $derived(store.settings.ambienceAuto ?? false);

  function pick(k: AmbienceKind) {
    store.updateSettings({ ambienceKind: k });
    if (ambience.playing) ambience.start(k, volume);
  }
  function toggle() {
    if (ambience.playing) ambience.stop();
    else ambience.start(kind, volume);
  }
  function setVolume(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    store.updateSettings({ ambienceVolume: v });
    ambience.setVolume(v);
  }
  // follow the timer: on while a work session runs, off on pause, break or reset
  $effect(() => {
    if (!auto) return;
    const working = pomodoro.running && (pomodoro.mode === 'work' || pomodoro.mode === 'custom' || pomodoro.mode === 'stopwatch');
    if (working && !ambience.playing) ambience.start(kind, volume);
    else if (!working && ambience.playing) ambience.stop();
  });
</script>

<section class="card amb" aria-label={t('focus.ambience')}>
  <div class="head">
    <h3>🎧 {t('focus.ambience')}</h3>
    <button class="btn sm" class:primary={ambience.playing} onclick={toggle} aria-pressed={ambience.playing}
      >{ambience.playing ? `⏹ ${t('ambience.stop')}` : `▶ ${t('ambience.play')}`}</button
    >
  </div>
  <div class="kinds" role="radiogroup" aria-label={t('focus.ambience')}>
    {#each AMBIENCE_KINDS as k (k)}
      <button class="chip" class:on={kind === k} role="radio" aria-checked={kind === k} onclick={() => pick(k)}>{AMBIENCE_ICON[k]} {t(`ambience.${k}` as const)}</button>
    {/each}
  </div>
  <div class="row">
    <label class="vol">
      <span>🔉</span>
      <input type="range" min="0" max="100" value={volume} oninput={setVolume} aria-label={t('ambience.volume')} />
    </label>
    <label class="auto"
      ><input type="checkbox" checked={auto} onchange={(e) => store.updateSettings({ ambienceAuto: (e.target as HTMLInputElement).checked })} /> {t('ambience.auto')}</label
    >
  </div>
  <p class="hint">{t('ambience.hint')}</p>
</section>

<style>
  .amb {
    margin-top: 12px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .chip {
    cursor: pointer;
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent-text);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .vol {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 180px;
  }
  .vol input {
    flex: 1;
    accent-color: var(--accent);
  }
  .auto {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
