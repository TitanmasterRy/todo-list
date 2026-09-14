<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { fly } from 'svelte/transition';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { primeAudio, playSound } from '../lib/sounds';

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
  <div use:focusTrap class="modal ob" role="dialog" aria-modal="true" aria-label="Welcome" tabindex="-1">
    <div class="dots" aria-hidden="true">{#each [0, 1, 2] as i}<span class:on={i === step}></span>{/each}</div>
    {#key step}
      <div class="body" in:fly={{ x: 30, duration: 220 }}>
        {#if step === 0}
          <div class="hero">✓</div>
          <h2>Welcome to Homework To-Do</h2>
          <p>A fast, offline to-do list built for school. Everything stays in your browser. Finishing a task should feel great, so we made it feel great.</p>
          <p class="muted">Start by adding a task below, or set up your courses on the last step.</p>
        {:else if step === 1}
          <div class="hero">⌨️</div>
          <h2>Type tasks like you’d say them</h2>
          <div class="example"><span class="plus">+</span> Read ch 4 <b>tomorrow 8pm</b> <b>#calc</b> <b>!high</b> <b>~45m</b></div>
          <ul class="syntax">
            <li><b>tomorrow, fri, next mon, in 3 days, sep 21, 8pm</b> set the due date and time</li>
            <li><b>#calc</b> picks a course (or becomes a tag)</li>
            <li><b>!low !high !urgent</b> priority · <b>~45m ~2h</b> estimate</li>
            <li><b>every mon wed</b>, <b>weekdays</b>, <b>every 3 days</b> repeat</li>
          </ul>
          <p class="muted">Press <span class="kbd">n</span> anywhere to add, <span class="kbd">?</span> for all shortcuts.</p>
        {:else}
          <div class="hero">🔥</div>
          <h2>Set a daily goal</h2>
          <p>Close the ring every day to build a streak. Tasks earn XP; badges and levels follow.</p>
          <div class="goal">
            {#each [1, 2, 3, 4, 5] as g}
              <button class="g" class:on={goal === g} onclick={() => (goal = g)} aria-pressed={goal === g}>{g}</button>
            {/each}
            <span class="muted">tasks per day</span>
          </div>
          <label class="check"><input type="checkbox" bind:checked={sounds} /> Turn on completion sounds (a crisp pop)</label>
          <p class="muted">You can hide gamification entirely in Settings if it’s not your thing.</p>
        {/if}
      </div>
    {/key}
    <div class="actions">
      {#if step > 0}<button class="btn ghost" onclick={() => step--}>Back</button>{/if}
      <span class="grow"></span>
      {#if step < 2}
        <button class="btn ghost" onclick={() => finish()}>Skip</button>
        <button class="btn primary" onclick={() => step++}>Next</button>
      {:else}
        <button class="btn" onclick={() => finish(true)}>Set up my courses</button>
        <button class="btn primary" onclick={() => finish()}>Start</button>
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
    text-align: left;
    margin: 8px 0 10px;
    font-size: 15px;
  }
  .example b {
    color: var(--accent);
    font-weight: 600;
  }
  .plus {
    color: var(--accent);
    font-weight: 700;
    margin-right: 6px;
  }
  .syntax {
    text-align: left;
    margin: 0 0 10px;
    padding-left: 18px;
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
    color: #fff;
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
</style>
