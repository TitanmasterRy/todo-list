<script lang="ts">
  // Settings → Goals and timer: daily goal and Pomodoro lengths.
  import { store } from '../../lib/store.svelte';
  import { set } from './settings';
  const s = $derived(store.settings);
  const breaks = $derived((store.stats.breaks ?? []).filter((b) => !b.deleted && b.to >= store.today));
  let bFrom = $state('');
  let bTo = $state('');
  let bName = $state('');
  function addBreak(e: SubmitEvent) {
    e.preventDefault();
    if (store.addBreak(bFrom, bTo, bName)) bFrom = bTo = bName = '';
  }
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

<section class="card" aria-labelledby="breaks-h">
  <h2 id="breaks-h">Break mode</h2>
  <p class="help">Add school breaks and holidays. Days inside a break don't count against your streak, so a week off doesn't cost you a 40-day run.</p>
  {#if breaks.length}
    <ul class="breaks">
      {#each breaks as b (b.id)}
        <li>
          <span>🏖️ {b.name || 'Break'} · {b.from} → {b.to}{store.currentBreak?.id === b.id ? ' (now)' : ''}</span>
          <button type="button" class="btn ghost sm" onclick={() => store.removeBreak(b.id)} aria-label="Remove {b.name || 'break'}">Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  <form class="addbreak" onsubmit={addBreak}>
    <input class="input" bind:value={bName} placeholder="Winter break" aria-label="Break name" maxlength="40" />
    <input class="input" type="date" bind:value={bFrom} aria-label="Break starts" required />
    <input class="input" type="date" bind:value={bTo} aria-label="Break ends" required />
    <button class="btn sm" type="submit" disabled={!bFrom || !bTo}>Add break</button>
  </form>
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .breaks {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .breaks li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .addbreak {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .addbreak .input {
    width: auto;
    flex: 1 1 140px;
  }
</style>
