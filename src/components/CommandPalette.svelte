<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store, VIEWS } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { backupFilename, downloadJSON } from '../lib/backup';
  import { buildICS } from '../lib/ics';
  import { downloadText } from '../lib/download';
  import { t } from '../lib/i18n/index.svelte';

  interface Cmd {
    id: string;
    label: string;
    hint?: string;
    icon: string;
    run: () => void;
    keywords?: string;
  }

  let q = $state('');
  let idx = $state(0);
  let input: HTMLInputElement | undefined = $state();
  $effect(() => input?.focus());

  function close() {
    ui.palette = false;
  }

  const commands = $derived.by((): Cmd[] => {
    const list: Cmd[] = [];
    for (const v of VIEWS.filter((x) => x.id !== 'play' || store.settings.economyEnabled))
      list.push({ id: `view:${v.id}`, label: t('cmd.goTo', { view: v.label }), icon: v.icon, hint: v.key, run: () => store.go(v.id) });
    for (const c of store.activeCourses) {
      list.push({
        id: `course:${c.id}`,
        label: t('cmd.openCourse', { name: c.name }),
        icon: c.emoji ?? '📚',
        keywords: 'course',
        run: () => store.go('courses', { courseId: c.id }),
      });
    }
    list.push({
      id: 'new-course',
      label: t('cmd.createCourse'),
      icon: '➕',
      run: () => {
        store.go('courses', { courseId: null });
        ui.courseEditor = 'new';
      },
    });
    list.push({
      id: 'semester',
      label: t('cmd.semester'),
      icon: '🎓',
      run: () => {
        store.go('courses', { courseId: null });
        ui.semesterSetup = true;
      },
    });
    list.push({ id: 'review', label: t('cmd.review'), icon: '📋', run: () => (ui.weeklyReview = true) });
    list.push({
      id: 'whatnow',
      label: t('cmd.whatNow'),
      icon: '🧭',
      run: () => {
        store.go('today');
        ui.whatNow = true;
      },
    });
    list.push({ id: 'recap', label: t('cmd.recap'), icon: '🌙', run: () => (ui.recap = true) });
    list.push({ id: 'frog', label: t('cmd.frog'), icon: '🐸', run: () => (ui.frogPrompt = true) });
    list.push({ id: 'roll', label: t('cmd.roll'), icon: '⏩', run: () => store.rollOverdueToToday() });
    list.push({
      id: 'export',
      label: t('cmd.export'),
      icon: '💾',
      run: () => {
        downloadJSON(backupFilename(), store.snapshotBundle());
        store.updateSettings({ lastExportAt: new Date().toISOString() });
        toasts.push({ message: t('cmd.exported'), kind: 'success' });
      },
    });
    list.push({
      id: 'ics',
      label: t('cmd.ics'),
      icon: '📆',
      keywords: 'calendar google apple outlook',
      run: () => {
        downloadText('homework-todo.ics', buildICS(store.openTasks, store.courses), 'text/calendar');
        toasts.push({ message: t('cmd.icsDone'), detail: t('cmd.icsDetail'), kind: 'success' });
      },
    });
    list.push({
      id: 'sounds',
      label: t('cmd.sounds', { change: store.settings.soundsEnabled ? t('cmd.onOff') : t('cmd.offOn') }),
      icon: '🔊',
      keywords: 'mute toggle',
      run: () => store.updateSettings({ soundsEnabled: !store.settings.soundsEnabled }),
    });
    list.push({
      id: 'gamification',
      label: t('cmd.gamification', { change: store.settings.gamification ? t('cmd.onOff') : t('cmd.offOn') }),
      icon: '🎮',
      keywords: 'xp streak toggle',
      run: () => store.updateSettings({ gamification: !store.settings.gamification }),
    });
    list.push({
      id: 'motion',
      label: t('cmd.motion', { change: store.settings.reducedMotion ? t('cmd.onOff') : t('cmd.offOn') }),
      icon: '🐢',
      keywords: 'animation toggle',
      run: () => store.updateSettings({ reducedMotion: !store.settings.reducedMotion }),
    });
    const nextTheme = store.settings.theme === 'dark' ? 'light' : store.settings.theme === 'light' ? 'system' : 'dark';
    list.push({
      id: 'theme',
      label: t('cmd.theme', { from: t(`theme.${store.settings.theme}` as const), to: t(`theme.${nextTheme}` as const) }),
      icon: '🌗',
      keywords: 'dark light toggle',
      run: () => store.updateSettings({ theme: nextTheme }),
    });
    list.push({
      id: 'select',
      label: store.bulkMode ? t('cmd.exitBulk') : t('cmd.bulk'),
      icon: '☑️',
      run: () => (store.bulkMode ? store.clearSelection() : (store.bulkMode = true)),
    });
    list.push({ id: 'shortcuts', label: t('keys.title'), icon: '⌨️', hint: '?', run: () => (ui.shortcuts = true) });
    return list;
  });

  const results = $derived.by(() => {
    const s = q.trim().toLowerCase();
    const cmds = commands.filter((c) => !s || `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(s));
    const tasks: Cmd[] =
      s.length >= 2
        ? store.openTasks
            .filter((t) => t.title.toLowerCase().includes(s))
            .slice(0, 6)
            .map((t) => ({ id: `task:${t.id}`, label: t.title, icon: '○', hint: store.courseById(t.courseId)?.name, run: () => (store.editingTaskId = t.id) }))
        : [];
    return [...cmds, ...tasks];
  });

  $effect(() => {
    void q;
    idx = 0;
  });

  function run(c: Cmd) {
    close();
    c.run();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(results.length - 1, idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(0, idx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[idx]) run(results[idx]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
</script>

<div class="modal-backdrop" onclick={close} role="presentation">
  <div use:focusTrap class="modal palette" role="dialog" aria-modal="true" aria-label={t('nav.palette')} tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={onKey}>
    <input
      class="input"
      bind:this={input}
      bind:value={q}
      placeholder={t('cmd.placeholder')}
      aria-label={t('cmd.label')}
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-activedescendant={results[idx] ? `cmd-${results[idx].id}` : undefined}
    />
    <ul id="palette-list" role="listbox">
      {#each results as c, i (c.id)}
        <li id="cmd-{c.id}" role="option" aria-selected={i === idx} class:active={i === idx}>
          <button onclick={() => run(c)} onmousemove={() => (idx = i)}>
            <span class="ico">{c.icon}</span>
            <span class="lbl">{c.label}</span>
            {#if c.hint}<span class="hint">{c.hint}</span>{/if}
          </button>
        </li>
      {/each}
      {#if !results.length}
        <li class="none">{t('inbox.noMatches')}</li>
      {/if}
    </ul>
  </div>
</div>

<style>
  .palette {
    padding: 10px;
    max-width: 520px;
  }
  ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    max-height: 50vh;
    overflow-y: auto;
  }
  li button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    text-align: start;
    font-size: 14px;
    color: var(--text);
  }
  li.active button {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .ico {
    width: 22px;
    text-align: center;
  }
  .lbl {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    font-size: 12px;
    color: var(--text-faint);
  }
  .none {
    padding: 10px;
    color: var(--text-faint);
    font-size: 13px;
  }
</style>
