<script lang="ts">
  // Settings → Economy: coins, casino limits and the parent PIN lock.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { checkPin, hashPin, validPin } from '../../lib/parental';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  // ---------- parent lock ----------
  let pinInput = $state('');
  let ecoUnlocked = $state(false);
  const ecoLocked = $derived(!!s.parentPinHash && !ecoUnlocked);
  async function setParentPin() {
    if (!validPin(pinInput)) return toasts.push({ message: 'Use 4–8 digits for the PIN', kind: 'warn' });
    set('parentPinHash', await hashPin(pinInput));
    pinInput = '';
    ecoUnlocked = false;
    toasts.push({ message: 'Parent lock on', detail: 'Economy settings now need the PIN.', kind: 'success', emoji: '🔒' });
  }
  async function unlockParent() {
    if (await checkPin(pinInput, s.parentPinHash)) {
      ecoUnlocked = true;
      pinInput = '';
    } else toasts.push({ message: 'Wrong PIN', kind: 'warn' });
  }
</script>

<section class="card">
  <h2>
    {t('settings.economy')}
    {#if s.parentPinHash}<span class="chip">🔒 {t('settings.parentLock')}{ecoUnlocked ? ` ${t('settings.unlocked')}` : ''}</span>{/if}
  </h2>
  <fieldset class="plain" disabled={ecoLocked}>
    <div class="row">
      <label for="eco">Coins, shop and Play view</label>
      <input id="eco" type="checkbox" class="switch" checked={s.economyEnabled} onchange={(e) => set('economyEnabled', (e.target as HTMLInputElement).checked)} />
    </div>
    {#if s.economyEnabled}
      <div class="row">
        <label for="cas">Casino (play chips only)</label>
        <input id="cas" type="checkbox" class="switch" checked={s.casinoEnabled} onchange={(e) => set('casinoEnabled', (e.target as HTMLInputElement).checked)} />
      </div>
      {#if s.casinoEnabled}
        <div class="row">
          <label for="brk">Homework-break reminder after (minutes of casino play, 0 = off)</label>
          <input
            id="brk"
            class="input num"
            type="number"
            min="0"
            max="240"
            value={s.casinoBreakMin}
            onchange={(e) => set('casinoBreakMin', Math.max(0, Math.min(240, Number((e.target as HTMLInputElement).value) || 0)))}
          />
        </div>
        <div class="row">
          <label for="lim">Casino time limit per day (minutes, 0 = none)</label>
          <input
            id="lim"
            class="input num"
            type="number"
            min="0"
            max="600"
            step="5"
            value={s.casinoDailyLimitMin}
            onchange={(e) => set('casinoDailyLimitMin', Math.max(0, Math.min(600, Number((e.target as HTMLInputElement).value) || 0)))}
          />
        </div>
      {/if}
      <div class="row">
        <label for="adm">Show arcade admin (add games)</label>
        <input id="adm" type="checkbox" class="switch" checked={s.arcadeAdmin} onchange={(e) => set('arcadeAdmin', (e.target as HTMLInputElement).checked)} />
      </div>
    {/if}
  </fieldset>
  {#if s.economyEnabled}
    <p class="help">
      Coins come only from schoolwork (tasks, the daily ring, streaks, grades, notecards, Pomodoros). There's no real money anywhere: nothing can be bought with cash, and chips
      never turn back into coins.
    </p>
  {/if}
  <h3 class="sub">Parent lock</h3>
  {#if !s.parentPinHash}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        void setParentPin();
      }}
    >
      <input class="input" type="password" inputmode="numeric" autocomplete="new-password" bind:value={pinInput} placeholder="Choose a 4–8 digit PIN" aria-label="New parent PIN" />
      <button class="btn" type="submit">Set PIN</button>
    </form>
    <p class="help">
      A PIN keeps these economy settings (casino on/off, time limit, reminders) from being changed without it. It's stored only in this browser as a hash: a speed bump, not a
      security system.
    </p>
  {:else if ecoLocked}
    <form
      class="btns"
      onsubmit={(e) => {
        e.preventDefault();
        void unlockParent();
      }}
    >
      <input class="input" type="password" inputmode="numeric" autocomplete="off" bind:value={pinInput} placeholder="Parent PIN" aria-label="Parent PIN" />
      <button class="btn" type="submit">Unlock</button>
    </form>
  {:else}
    <div class="btns">
      <button class="btn" onclick={() => (ecoUnlocked = false)}>Lock again</button>
      <button
        class="btn ghost"
        onclick={() => {
          set('parentPinHash', '');
          ecoUnlocked = false;
        }}>Remove PIN</button
      >
    </div>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  fieldset.plain {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }
  fieldset.plain:disabled {
    opacity: 0.6;
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
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .btns .input {
    flex: 1;
    min-width: 200px;
  }
  .sub {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 4px;
  }
</style>
