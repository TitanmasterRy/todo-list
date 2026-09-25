<script lang="ts">
  // Settings → Goals and timer: daily goal and Pomodoro lengths.
  import { store } from '../../lib/store.svelte';
  import { set } from './settings';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>Goals and timer</h2>
  <div class="row">
    <label for="goal">Daily goal (tasks)</label>
    <input
      id="goal"
      class="input num"
      type="number"
      min="1"
      max="20"
      value={s.dailyGoal}
      onchange={(e) => set('dailyGoal', Math.max(1, Math.min(20, Number((e.target as HTMLInputElement).value) || 3)))}
    />
  </div>
  <div class="row">
    <label for="pw">Pomodoro focus (min)</label>
    <input
      id="pw"
      class="input num"
      type="number"
      min="1"
      max="120"
      value={s.pomodoroWorkMin}
      onchange={(e) => set('pomodoroWorkMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 25))}
    />
  </div>
  <div class="row">
    <label for="pb">Short break (min)</label>
    <input
      id="pb"
      class="input num"
      type="number"
      min="1"
      max="60"
      value={s.pomodoroBreakMin}
      onchange={(e) => set('pomodoroBreakMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 5))}
    />
  </div>
  <div class="row">
    <label for="pl">Long break (min)</label>
    <input
      id="pl"
      class="input num"
      type="number"
      min="1"
      max="90"
      value={s.pomodoroLongBreakMin}
      onchange={(e) => set('pomodoroLongBreakMin', Math.max(1, Number((e.target as HTMLInputElement).value) || 15))}
    />
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
  .input.num {
    width: auto;
    min-width: 90px;
  }
  .input.num {
    width: 90px;
  }
</style>
