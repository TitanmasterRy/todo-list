<script lang="ts">
  // Stats → Friends: swap share codes to compare streaks and this week's XP. The code is the only thing shared.
  import { onMount } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { ago, encodeCard, friendLink, leaderboard } from '../../lib/friends';
  import { startOfWeekKey } from '../../lib/dates';
  import { friends } from '../../lib/social/friends.svelte';
  import { account, accountConfig } from '../../lib/account.svelte';
  import { formatNumber, t } from '../../lib/i18n/index.svelte';

  let name = $state(friends.profile.name);
  let emoji = $state(friends.profile.emoji);
  let paste = $state('');
  let busy = $state(false);
  // re-made when the stats or the profile change
  const me = $derived(friends.myCard());
  const code = $derived(encodeCard(me));
  const link = $derived(friendLink(me, location.href));
  const week = $derived(startOfWeekKey(store.today, store.settings.weekStart));
  const rows = $derived(leaderboard(me, friends.list, week));
  const anyStale = $derived(rows.some((r) => r.stale || (r.lastWeek && !r.me)));
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const liveAvailable = $derived(!!accountConfig());

  onMount(() => {
    if (friends.list.some((f) => f.card.pid)) void pull(true);
  });

  function saveProfile() {
    friends.setProfile(name, emoji);
  }
  function add(e: SubmitEvent) {
    e.preventDefault();
    const { result, card } = friends.add(paste);
    const msg: Record<string, string> = {
      added: t('friends.added', { name: card?.name ?? '' }),
      updated: t('friends.updated', { name: card?.name ?? '' }),
      older: t('friends.older', { name: card?.name ?? '' }),
      self: t('friends.self'),
      full: t('friends.full'),
      invalid: t('friends.invalid'),
    };
    toasts.push({ message: msg[result], kind: result === 'added' || result === 'updated' ? 'success' : 'warn', emoji: card?.emoji });
    if (result !== 'invalid') paste = '';
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: t('friends.copied', { what }), kind: 'success', emoji: '📋' });
    } catch {
      toasts.push({ message: t('friends.copyFailed'), kind: 'warn' });
    }
  }
  async function share() {
    try {
      await navigator.share({ title: t('friends.shareTitle'), text: t('friends.shareText', { code }), url: link });
    } catch {
      /* cancelled */
    }
  }
  async function pull(quiet = false) {
    busy = true;
    try {
      const n = await friends.pull();
      if (!quiet) toasts.push({ message: n ? t('friends.pulled', { count: n }) : t('friends.upToDate'), kind: 'info' });
    } catch (e) {
      if (!quiet) toasts.push({ message: t('friends.fetchFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
  async function toggleLive(on: boolean) {
    busy = true;
    try {
      if (on) await friends.enableLive();
      else await friends.disableLive();
      toasts.push({ message: on ? t('friends.liveOn') : t('friends.liveOff'), kind: 'success' });
    } catch (e) {
      toasts.push({ message: on ? t('friends.liveOnFailed') : t('friends.liveOffFailed'), detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
</script>

<section class="card block friends" aria-label={t('friends.title')}>
  <div class="block-title">{t('friends.title')} <span class="muted">{t('friends.sub')}</span></div>
  <p class="muted">
    {t('friends.intro')}
  </p>
  {#if friends.profile.shareChips || friends.profile.shareScores}
    <p class="muted">
      Also in your code, because you switched it on in Play → Leaderboards: {[
        friends.profile.shareChips && 'your chip balance',
        friends.profile.shareScores && 'your best arcade scores',
      ]
        .filter(Boolean)
        .join(' and ')}.
    </p>
  {/if}

  <div class="me">
    <label class="field">{t('friends.emoji')} <input class="input emoji" bind:value={emoji} maxlength="8" onchange={saveProfile} aria-label={t('friends.yourEmoji')} /></label>
    <label class="field grow"
      >{t('friends.nameSeen')}
      <input class="input" bind:value={name} maxlength="24" onchange={saveProfile} placeholder={t('friends.me')} aria-label={t('friends.yourName')} /></label
    >
  </div>
  <label class="field"
    >{t('friends.myCode')}
    <input class="input mono" readonly value={code} aria-label={t('friends.myCode')} onfocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
  </label>
  <div class="row">
    <button class="btn sm primary" onclick={() => copy(code, t('friends.code'))}>{t('friends.copyCode')}</button>
    <button class="btn sm" onclick={() => copy(link, t('friends.link'))}>{t('friends.copyLink')}</button>
    {#if canShare}<button class="btn sm" onclick={share}>{t('card.share')}</button>{/if}
  </div>

  <form class="row" onsubmit={add} aria-label={t('friends.addLabel')}>
    <input class="input grow" bind:value={paste} placeholder={t('friends.pastePh')} aria-label={t('friends.paste')} />
    <button class="btn" type="submit" disabled={!paste.trim()}>{t('friends.add')}</button>
  </form>

  <div class="scroll">
    <table class="board" aria-label={t('friends.board')}>
      <thead
        ><tr
          ><th>#</th><th>{t('friends.name')}</th><th>{t('friends.weekXp')}</th><th>{t('today.streak')}</th><th>{t('friends.level')}</th><th>{t('friends.updatedCol')}</th><th
          ></th></tr
        ></thead
      >
      <tbody>
        {#each rows as r (r.card.id)}
          <tr class:me={r.me}>
            <td>{r.rank}</td>
            <td>{r.card.emoji} {r.card.name}{r.me ? ` ${t('friends.you')}` : ''}</td>
            <td
              >{formatNumber(r.weekXp)}{#if r.lastWeek && !r.me}<span class="muted" title={t('friends.earlierWeek')}> · {t('friends.lastWeek')}</span>{/if}</td
            >
            <td>🔥 {r.card.streak} <span class="muted">{t('friends.best', { n: r.card.best })}</span></td>
            <td>{r.card.lvl}</td>
            <td class:stale={r.stale}>{r.me ? t('friends.now') : ago(r.card.at)}{r.card.pid && !r.me ? ` · ${t('friends.live')}` : ''}</td>
            <td>
              {#if !r.me}<button class="btn ghost sm" onclick={() => friends.remove(r.card.id)} aria-label={t('editor.removeBlocker', { title: r.card.name })}>✕</button>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if !friends.list.length}
    <p class="muted">{t('friends.none')}</p>
  {:else if anyStale}
    <p class="nudge">⏳ {t('friends.staleNudge')}</p>
  {/if}

  {#if liveAvailable}
    <details class="live">
      <summary>{t('friends.liveTitle')}</summary>
      <p class="muted">
        {t('friends.liveIntro')}
      </p>
      {#if !account.userId}
        <p class="muted">{t('friends.signIn')}</p>
      {:else}
        <label class="check"
          ><input type="checkbox" checked={friends.liveOn} disabled={busy} onchange={(e) => toggleLive((e.currentTarget as HTMLInputElement).checked)} />
          {t('friends.keepLive')}</label
        >
        {#if friends.liveError}<p class="muted">{friends.liveError}</p>{/if}
      {/if}
      {#if friends.list.some((f) => f.card.pid)}<button class="btn sm" onclick={() => pull()} disabled={busy}>{t('friends.refresh')}</button>{/if}
    </details>
  {/if}
</section>

<style>
  .friends {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }
  .me,
  .row {
    display: flex;
    gap: 8px;
    align-items: end;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .emoji {
    width: 64px;
    text-align: center;
  }
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .scroll {
    overflow-x: auto;
  }
  .board {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .board th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 6px;
  }
  .board td {
    padding: 6px;
    border-top: 1px solid var(--border);
  }
  .board tr.me td {
    font-weight: 700;
  }
  .stale {
    color: var(--warning, #f59e0b);
  }
  .nudge {
    font-size: 13px;
    margin: 0;
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }
  .live {
    font-size: 13px;
  }
  .live summary {
    cursor: pointer;
    color: var(--text-muted);
  }
  @media (max-width: 560px) {
    .board th:nth-child(5),
    .board td:nth-child(5) {
      display: none;
    }
  }
</style>
