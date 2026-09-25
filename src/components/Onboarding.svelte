<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { fly } from 'svelte/transition';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { primeAudio, playSound } from '../lib/sounds';
  import { LOCALES, t } from '../lib/i18n/index.svelte';

  let step = $state(0);
  let goal = $state(store.settings.dailyGoal);
  let sounds = $state(false);

  function finish(openSetup = false) {
    store.updateSettings({ onboarded: true, dailyGoal: goal, soundsEnabled: sounds, soundPromptShown: true });
    if (sounds) {
      primeAudio();
      playSound('pop');
    }
    if (openSetup) {
      store.go('courses', { courseId: null });
      ui.semesterSetup = true;
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') finish();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="modal-backdrop" role="presentation">
  <div use:focusTrap class="modal ob" role="dialog" aria-modal="true" aria-label={t('onb.label')} tabindex="-1">
    <div class="dots" aria-hidden="true">
      {#each [0, 1, 2] as i}<span class:on={i === step}></span>{/each}
    </div>
    {#key step}
      <div class="body" in:fly={{ x: document.documentElement.dir === 'rtl' ? -30 : 30, duration: 220 }}>
        {#if step === 0}
          <div class="hero">✓</div>
          <h2>{t('onb.welcome')}</h2>
          <p>{t('onb.intro')}</p>
          <p class="muted">{t('onb.start')}</p>
          <label class="check lang"
            >{t('settings.language')}
            <select class="select" value={store.settings.locale ?? 'auto'} onchange={(e) => store.updateSettings({ locale: e.currentTarget.value as 'auto' | 'en' | 'es' })}>
              <option value="auto">{t('settings.languageAuto')}</option>
              {#each LOCALES as l (l.id)}<option value={l.id} lang={l.id}>{l.name}</option>{/each}
            </select></label
          >
        {:else if step === 1}
          <div class="hero">⌨️</div>
          <h2>{t('onb.typeTitle')}</h2>
          <div class="example">
            <span class="plus">+</span>
            {t('onb.exTitle')} <b>{t('keys.exDate')}</b> <b>{t('keys.exCourse')}</b> <b>{t('keys.exPriority')}</b> <b>~45m</b>
          </div>
          <ul class="syntax">
            <li><b>{t('onb.synDates')}</b> {t('onb.synDatesText')}</li>
            <li><b>{t('keys.exCourse')}</b> {t('onb.synCourse')}</li>
            <li><b>{t('onb.synPriority')}</b> {t('onb.synPriorityText')} · <b>~45m ~2h</b> {t('onb.synEstimate')}</li>
            <li><b>{t('onb.synRepeat')}</b> {t('onb.synRepeatText')}</li>
          </ul>
          <p class="muted">{t('onb.press')} <span class="kbd">n</span> {t('onb.pressAdd')} <span class="kbd">?</span> {t('onb.pressAll')}</p>
        {:else}
          <div class="hero">🔥</div>
          <h2>{t('onb.goalTitle')}</h2>
          <p>{t('onb.goalText')}</p>
          <div class="goal">
            {#each [1, 2, 3, 4, 5] as g}
              <button class="g" class:on={goal === g} onclick={() => (goal = g)} aria-pressed={goal === g}>{g}</button>
            {/each}
            <span class="muted">{t('onb.perDay')}</span>
          </div>
          <label class="check"><input type="checkbox" bind:checked={sounds} /> {t('onb.sounds')}</label>
          <p class="muted">{t('onb.hideGame')}</p>
        {/if}
      </div>
    {/key}
    <div class="actions">
      {#if step > 0}<button class="btn ghost" onclick={() => step--}>{t('common.back')}</button>{/if}
      <span class="grow"></span>
      {#if step < 2}
        <button class="btn ghost" onclick={() => finish()}>{t('common.skip')}</button>
        <button class="btn primary" onclick={() => step++}>{t('common.next')}</button>
      {:else}
        <button class="btn" onclick={() => finish(true)}>{t('onb.setup')}</button>
        <button class="btn primary" onclick={() => finish()}>{t('onb.go')}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .ob {
    max-width: 480px;
    text-align: center;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-strong);
  }
  .dots span.on {
    background: var(--accent);
  }
  .hero {
    width: 64px;
    height: 64px;
    margin: 8px auto 12px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    font-size: 30px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }
  h2 {
    margin: 0 0 8px;
  }
  p {
    margin: 0 0 10px;
    font-size: 15px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .example {
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    text-align: start;
    margin: 8px 0 10px;
    font-size: 15px;
  }
  .example b {
    color: var(--accent-text);
    font-weight: 600;
  }
  .plus {
    color: var(--accent-text);
    font-weight: 700;
    margin-inline-end: 6px;
  }
  .syntax {
    text-align: start;
    margin: 0 0 10px;
    padding-inline-start: 18px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .syntax b {
    color: var(--text);
    font-weight: 600;
  }
  .goal {
    display: flex;
    gap: 6px;
    justify-content: center;
    align-items: center;
    margin: 12px 0;
  }
  .g {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-weight: 700;
    font-size: 16px;
  }
  .g.on {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-color: var(--accent);
  }
  .check {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    margin: 8px 0;
  }
  .check input {
    accent-color: var(--accent);
  }
  .grow {
    flex: 1;
  }
  .lang {
    font-size: 13px;
    color: var(--text-muted);
  }
  .lang .select {
    width: auto;
  }
</style>
