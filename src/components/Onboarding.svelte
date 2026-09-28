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
          <div class="hero" aria-hidden="true">✓</div>
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
          <div class="hero" aria-hidden="true">⌨️</div>
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
          <div class="hero" aria-hidden="true">🔥</div>
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
    background: radial-gradient(70% 45% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), var(--bg-elev);
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
    border-radius: 999px;
    background: var(--border-strong);
    transition:
      width var(--dur-slow) var(--spring),
      background var(--dur);
  }
  .dots span.on {
    width: 22px;
    background: var(--grad-accent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 70%, transparent);
    animation: glow-pulse 2s ease-out infinite;
  }
  /* the hero orb: gradient sphere with a highlight, drifting gently */
  .hero {
    position: relative;
    width: 84px;
    height: 84px;
    margin: 10px auto 16px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 38px;
    color: #fff;
    background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.55), transparent 45%), var(--grad-accent);
    box-shadow:
      inset 0 -8px 20px rgba(0, 0, 0, 0.18),
      var(--glow-strong),
      0 14px 30px -12px color-mix(in srgb, var(--accent) 80%, transparent);
    animation:
      pop-in 420ms var(--spring) both,
      float 3.4s ease-in-out 420ms infinite;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }
  .hero::after {
    content: '';
    position: absolute;
    inset: -14px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    animation: ring 2.8s ease-out infinite;
  }
  @keyframes ring {
    from {
      transform: scale(0.8);
      opacity: 0.8;
    }
    to {
      transform: scale(1.25);
      opacity: 0;
    }
  }
  h2 {
    margin: 0 0 8px;
    font-size: 22px;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--text) 30%, color-mix(in srgb, var(--accent) 70%, var(--text)));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
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
    position: relative;
    background: var(--bg-elev-2);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
    border-radius: 10px;
    padding: 10px 12px;
    text-align: start;
    margin: 8px 0 10px;
    font-size: 15px;
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 24px -12px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .example b {
    color: var(--accent-text);
    font-weight: 600;
    padding: 0 4px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
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
  .syntax li {
    animation: rise-in 320ms var(--ease) backwards;
  }
  .syntax li:nth-child(2) {
    animation-delay: 60ms;
  }
  .syntax li:nth-child(3) {
    animation-delay: 120ms;
  }
  .syntax li:nth-child(4) {
    animation-delay: 180ms;
  }
  .syntax b {
    color: var(--text);
    font-weight: 600;
  }
  .goal {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
    margin: 12px 0;
  }
  .g {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    font-weight: 700;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    box-shadow: inset 0 1px 0 var(--sheen);
    transition:
      transform var(--dur) var(--spring),
      border-color var(--dur),
      box-shadow var(--dur);
  }
  .g:hover {
    transform: translateY(-2px) scale(1.06);
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .g:active {
    transform: scale(0.94);
  }
  .g.on {
    background: var(--grad-accent);
    color: var(--accent-contrast, #fff);
    border-color: transparent;
    transform: scale(1.12);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      var(--glow);
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
    width: 16px;
    height: 16px;
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
