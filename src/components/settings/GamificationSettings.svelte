<script lang="ts">
  // Settings → Gamification: XP, weekly goal, level and streak freezes.
  import { store } from '../../lib/store.svelte';
  import { MAX_FREEZES, levelTitle } from '../../lib/gamification';
  import { set } from './settings';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>Gamification</h2>
  <div class="row">
    <label for="gam">XP, streaks, badges, confetti</label>
    <input id="gam" type="checkbox" class="switch" checked={s.gamification} onchange={(e) => set('gamification', (e.target as HTMLInputElement).checked)} />
  </div>
  <div class="row">
    <label for="wxp">Weekly XP goal</label>
    <input
      id="wxp"
      class="input num"
      type="number"
      min="50"
      step="50"
      value={s.weeklyXpGoal}
      onchange={(e) => set('weeklyXpGoal', Math.max(50, Number((e.target as HTMLInputElement).value) || 500))}
    />
  </div>
  <p class="help">
    Level {store.stats.level}: <strong>{levelTitle(store.stats.level)}</strong>. New accent colors unlock as you level up. Critical hits (5% chance, double XP), tiered early
    bonuses (up to ×1.5 for 3+ days early), grade XP for scores you enter, and notecard study XP all count.
  </p>
  <p class="help">
    Streak freezes: you earn one per 7-day streak (max {MAX_FREEZES} banked). A missed day uses one automatically instead of breaking your streak. You have
    <strong>{store.stats.streak.freezes}</strong>
    banked. Current streak {store.streak}, best {store.stats.streak.best}.
  </p>
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
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
</style>
