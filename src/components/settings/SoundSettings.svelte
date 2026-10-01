<script lang="ts">
  // Settings → Sounds: the switch, the volume, seven packs to hear and pick, what plays, the timer chime, a board
  // to try every sound, and the phone's vibration.
  import { store } from '../../lib/store.svelte';
  import type { SoundPack } from '../../lib/types';
  import { playSound, previewChime, previewSound, type SoundName, type TimerChime } from '../../lib/sounds';
  import { SOUND_NAMES, SOUND_PACKS, TIMER_CHIMES } from '../../lib/soundkit';
  import { buzz } from '../../lib/haptics';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  const PACK_ICON: Record<SoundPack, string> = { soft: '🫧', click: '🖱️', arcade: '🕹️', bubble: '🫠', chime: '🔔', synth: '🎹', paper: '📄' };
  let volumeTimer: ReturnType<typeof setTimeout> | undefined;
  function onVolume(e: Event) {
    set('soundVolume', Number((e.target as HTMLInputElement).value));
    // a pop at the new level once the thumb settles
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => previewSound('pop'), 120);
  }
  function pickPack(p: SoundPack) {
    set('soundPack', p);
    previewSound('pop', p);
  }
</script>

<section class="card">
  <h2>{t('settings.sounds')}</h2>
  <div class="row">
    <label for="snd">{t('settings.sounds')}</label>
    <input
      id="snd"
      type="checkbox"
      class="switch"
      checked={s.soundsEnabled}
      onchange={(e) => {
        set('soundsEnabled', (e.target as HTMLInputElement).checked);
        if ((e.target as HTMLInputElement).checked) playSound('pop');
      }}
    />
  </div>
  <div class="row">
    <label for="vol">{t('settings.volume')}</label>
    <div class="vol">
      <span aria-hidden="true">🔈</span>
      <input id="vol" type="range" min="0" max="100" value={s.soundVolume ?? 70} oninput={onVolume} />
      <span class="pct">{s.soundVolume ?? 70}%</span>
    </div>
  </div>
  <div class="block">
    <span id="pack-l" class="lbl">{t('settings.soundPack')}</span>
    <div class="packs" role="radiogroup" aria-labelledby="pack-l">
      {#each SOUND_PACKS as p (p)}
        <button class="pack" class:on={s.soundPack === p} role="radio" aria-checked={s.soundPack === p} aria-label={t(`sound.${p}` as const)} onclick={() => pickPack(p)}>
          <span class="ico" aria-hidden="true">{PACK_ICON[p]}</span>
          <span class="name">{t(`sound.${p}` as const)}</span>
          <span class="desc">{t(`sound.${p}Desc` as const)}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class="block">
    <span class="lbl">{t('settings.soundCategories')}</span>
    <div class="cats">
      <label><input type="checkbox" checked={s.soundUi ?? true} onchange={(e) => set('soundUi', (e.target as HTMLInputElement).checked)} /> {t('settings.soundUi')}</label>
      <label
        ><input type="checkbox" checked={s.soundRewards ?? true} onchange={(e) => set('soundRewards', (e.target as HTMLInputElement).checked)} />
        {t('settings.soundRewards')}</label
      >
      <label><input type="checkbox" checked={s.soundTimer ?? true} onchange={(e) => set('soundTimer', (e.target as HTMLInputElement).checked)} /> {t('settings.soundTimer')}</label>
    </div>
  </div>
  <div class="row">
    <label for="chime">{t('settings.timerChime')}</label>
    <div class="chime">
      <select
        id="chime"
        class="select"
        value={s.timerChime ?? 'pack'}
        onchange={(e) => {
          const c = (e.target as HTMLSelectElement).value as TimerChime;
          set('timerChime', c);
          previewChime(c);
        }}
      >
        {#each TIMER_CHIMES as c (c)}<option value={c}>{t(`chime.${c}` as const)}</option>{/each}
      </select>
      <button class="btn ghost sm icon" aria-label={t('settings.tryIt')} onclick={() => previewChime(s.timerChime ?? 'pack')}>▶</button>
    </div>
  </div>
  <div class="block">
    <span class="lbl">{t('settings.tryIt')}</span>
    <div class="board">
      {#each SOUND_NAMES as n (n)}
        <button class="chip" onclick={() => previewSound(n as SoundName)}>{t(`soundName.${n}` as const)}</button>
      {/each}
    </div>
  </div>
  <p class="help">{t('settings.soundHint')}</p>
  <div class="row">
    <label for="hap">{t('settings.haptics')}</label>
    <input
      id="hap"
      type="checkbox"
      class="switch"
      checked={s.haptics !== false}
      onchange={(e) => {
        set('haptics', (e.target as HTMLInputElement).checked);
        if ((e.target as HTMLInputElement).checked) buzz('done');
      }}
    />
  </div>
  <p class="help">{t('settings.hapticsHint')}</p>
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
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
  .block {
    padding: 8px 0;
    border-top: 1px solid var(--border);
  }
  .lbl {
    display: block;
    font-size: 14px;
    margin-bottom: 8px;
  }
  .vol {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 320px;
  }
  .vol input {
    flex: 1;
    accent-color: var(--accent);
  }
  .pct {
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    color: var(--text-muted);
    min-width: 3.2em;
    text-align: end;
  }
  .packs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .pack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    text-align: start;
    color: var(--text);
    transition:
      border-color var(--dur),
      background var(--dur),
      transform var(--dur);
  }
  .pack:hover {
    transform: translateY(-1px);
    border-color: var(--border-strong);
  }
  .pack.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg-elev-2));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .pack .ico {
    font-size: 22px;
  }
  .pack .name {
    font-weight: 700;
    font-size: 14px;
    text-transform: capitalize;
  }
  .pack .desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.35;
  }
  .cats {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 14px;
  }
  .cats label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cats input {
    accent-color: var(--accent);
  }
  .chime {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .select {
    width: auto;
    min-width: 120px;
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .board .chip {
    cursor: pointer;
  }
  .board .chip:hover {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
    color: var(--text);
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
</style>
