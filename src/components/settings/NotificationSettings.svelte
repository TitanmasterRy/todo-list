<script lang="ts">
  // Settings → Notifications: deadline reminders and the morning digest.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { backgroundSupported, notificationsSupported, remindersSettingsChanged, requestNotifications } from '../../lib/reminders';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  async function enableNotifications() {
    const ok = await requestNotifications();
    toasts.push({ message: ok ? t('notif.on') : t('notif.blocked'), kind: ok ? 'success' : 'warn' });
    if (ok) set('notifyDueSoon', true);
  }
  function setAndSync<K extends 'appBadge' | 'backgroundReminders' | 'notifyMorningDigest'>(key: K, on: boolean) {
    set(key, on);
    remindersSettingsChanged();
  }
  const badgeSupported = typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
</script>

<section class="card">
  <h2>{t('settings.notifications')}</h2>
  {#if !notificationsSupported()}
    <p class="help">{t('notif.unsupported')}</p>
  {:else}
    <div class="row">
      <label for="ndue">{t('notif.due')}</label>
      <input
        id="ndue"
        type="checkbox"
        class="switch"
        checked={s.notifyDueSoon}
        onchange={(e) => {
          const on = (e.target as HTMLInputElement).checked;
          if (on) void enableNotifications();
          else set('notifyDueSoon', false);
        }}
      />
    </div>
    <div class="row">
      <label for="nlead">{t('notif.lead')}</label>
      <input
        id="nlead"
        class="input num"
        type="number"
        min="5"
        max="1440"
        value={s.notifyLeadMin}
        onchange={(e) => set('notifyLeadMin', Math.max(5, Number((e.target as HTMLInputElement).value) || 60))}
      />
    </div>
    <div class="row">
      <label for="ndig">{t('notif.digest')}</label>
      <input
        id="ndig"
        type="checkbox"
        class="switch"
        checked={s.notifyMorningDigest}
        onchange={(e) => {
          const on = (e.target as HTMLInputElement).checked;
          setAndSync('notifyMorningDigest', on);
          if (on) void enableNotifications();
        }}
      />
    </div>
    <p class="help">{t('notif.help')}</p>
  {/if}
  {#if badgeSupported}
    <div class="row">
      <label for="nbadge">{t('notif.badge')}</label>
      <input id="nbadge" type="checkbox" class="switch" checked={s.appBadge} onchange={(e) => setAndSync('appBadge', (e.target as HTMLInputElement).checked)} />
    </div>
  {/if}
  {#if backgroundSupported()}
    <div class="row">
      <label for="nbg">{t('notif.bg')}</label>
      <input id="nbg" type="checkbox" class="switch" checked={s.backgroundReminders} onchange={(e) => setAndSync('backgroundReminders', (e.target as HTMLInputElement).checked)} />
    </div>
    <p class="help">{t('notif.bgHelp')}</p>
  {/if}
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
