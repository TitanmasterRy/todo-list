<script lang="ts">
  // Settings → Gamification: XP, weekly goal, level and streak freezes.
  import { store } from '../../lib/store.svelte';
  import { MAX_FREEZES, levelTitle } from '../../lib/gamification';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
</script>

<section class="card">
  <h2>{t('settings.gamification')}</h2>
  <div class="row">
    <label for="gam">{t('settings.gamificationToggle')}</label>
    <input id="gam" type="checkbox" class="switch" checked={s.gamification} onchange={(e) => set('gamification', (e.target as HTMLInputElement).checked)} />
  </div>
  <div class="row">
    <label for="wxp">{t('settings.weeklyXp')}</label>
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
    {t('stats.level', { level: store.stats.level })}: <strong class="grad-text">{levelTitle(store.stats.level)}</strong>. {t('gam.help')}
  </p>
  <p class="help">
    {t('gam.freezes', { max: MAX_FREEZES })}
    {t('gam.banked', { count: store.stats.streak.freezes, current: store.streak, best: store.stats.streak.best })}
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
  .num {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--text);
  }
</style>
