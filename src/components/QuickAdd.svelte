<script lang="ts">
  import { store, type NewTaskInput } from '../lib/store.svelte';
  import { parseQuickAdd } from '../lib/parser';
  import { ui } from '../lib/ui.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { primeAudio } from '../lib/sounds';
  import { locale, t } from '../lib/i18n/index.svelte';

  interface Props {
    defaultDueKey?: string;
    defaultCourseId?: string;
    placeholder?: string;
    autofocus?: boolean;
  }
  let { defaultDueKey, defaultCourseId, placeholder, autofocus = false }: Props = $props();

  let text = $state('');
  let input: HTMLInputElement | undefined = $state();
  let focused = $state(false);
  let listening = $state(false);
  let describeNext = $state(true);
  type SR = {
    start(): void;
    stop(): void;
    lang: string;
    interimResults: boolean;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  };
  const SRClass =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition)
      : undefined;
  let rec: SR | null = null;
  function toggleVoice() {
    if (!SRClass) return;
    if (listening) {
      rec?.stop();
      return;
    }
    rec = new SRClass();
    rec.lang = locale() === 'en' ? navigator.language || 'en-US' : locale();
    rec.interimResults = true;
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      text = t;
    };
    rec.onend = () => {
      listening = false;
      input?.focus();
    };
    rec.onerror = () => (listening = false);
    listening = true;
    rec.start();
  }
  function onPaste(e: ClipboardEvent) {
    const data = e.clipboardData?.getData('text') ?? '';
    const lines = data
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const inputs = lines.map((line) => lineToInput(line));
    const created = store.addTasks(inputs);
    toasts.push({ message: t('quick.pasted', { count: created.length }), kind: 'success', emoji: '📋' });
    text = '';
  }
  $effect(() => {
    if (ui.quickAddPrefill) {
      text = ui.quickAddPrefill;
      ui.quickAddPrefill = '';
      input?.focus();
    }
  });

  const parsed = $derived(
    parseQuickAdd(text, {
      now: store.now,
      courses: store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
      weekStart: store.settings.weekStart,
      locale: locale(),
      timeFormat: store.settings.timeFormat,
    }),
  );
  const template = $derived(parsed.template ? store.findTemplate(parsed.template) : undefined);
  const templateSuggestions = $derived.by(() => {
    const m = /(?:^|\s)@([\w-]*)$/.exec(text);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return store.templates.filter((t) => t.name.startsWith(q)).slice(0, 5);
  });
  const courseSuggestions = $derived.by(() => {
    const m = /(?:^|\s)#([\w-]*)$/.exec(text);
    if (!m) return [];
    const q = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    return store.activeCourses
      .filter((c) =>
        c.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .startsWith(q),
      )
      .slice(0, 5);
  });

  $effect(() => {
    if (ui.quickAddFocus > 0 && input) {
      input.focus();
    }
  });
  $effect(() => {
    if (autofocus && input && window.innerWidth > 720) input.focus();
  });

  function lineToInput(line: string): NewTaskInput {
    const p = parseQuickAdd(line, { now: store.now, courses: store.activeCourses.map((c) => ({ id: c.id, name: c.name })), weekStart: store.settings.weekStart, locale: locale() });
    const base: NewTaskInput = { title: p.title || line };
    if (p.courseId) base.courseId = p.courseId;
    else if (defaultCourseId) base.courseId = defaultCourseId;
    if (p.tags.length) base.tags = p.tags;
    if (p.priority) base.priority = p.priority;
    if (p.estimateMin) base.estimateMin = p.estimateMin;
    if (p.type) base.type = p.type;
    if (p.recurrence) base.recurrence = p.recurrence;
    if (p.dueAt) base.dueAt = p.dueAt;
    else if (defaultDueKey) base.dueAt = defaultDueKey;
    return base;
  }

  function submit(e?: Event) {
    e?.preventDefault();
    const p = parsed;
    let title = p.title;
    const base: NewTaskInput = { title: '' };
    if (p.template) {
      if (!template) {
        toasts.push({ message: t('quick.noTemplate', { name: p.template }), kind: 'warn' });
        return;
      }
      Object.assign(base, {
        title: template.task.title,
        notes: template.task.notes,
        courseId: template.task.courseId,
        tags: [...template.task.tags],
        priority: template.task.priority,
        estimateMin: template.task.estimateMin,
        type: template.task.type,
        weight: template.task.weight,
        subtasks: [...template.task.subtasks],
        templateId: template.id,
      });
      if (title) base.title = title;
    } else {
      if (!title) return;
      base.title = title;
    }
    if (p.courseId) base.courseId = p.courseId;
    else if (!base.courseId && defaultCourseId) base.courseId = defaultCourseId;
    if (p.tags.length) base.tags = Array.from(new Set([...(base.tags ?? []), ...p.tags]));
    if (p.priority) base.priority = p.priority;
    if (p.estimateMin) base.estimateMin = p.estimateMin;
    if (p.type) base.type = p.type;
    if (p.recurrence) base.recurrence = p.recurrence;
    if (p.dueAt) base.dueAt = p.dueAt;
    else if (defaultDueKey) base.dueAt = defaultDueKey;
    primeAudio();
    store.addTask(base, { describe: describeNext && store.settings.autoDescribe });
    text = '';
  }

  function applySuggestion(kind: '@' | '#', name: string) {
    text = text.replace(new RegExp(`${kind === '@' ? '@' : '#'}[\\w-]*$`), `${kind}${name.replace(/\s+/g, '')} `);
    input?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (text) text = '';
      else input?.blur();
      e.stopPropagation();
    }
    if (e.key === 'Tab' && (templateSuggestions.length || courseSuggestions.length)) {
      e.preventDefault();
      if (templateSuggestions.length) applySuggestion('@', templateSuggestions[0].name);
      else applySuggestion('#', courseSuggestions[0].name);
    }
  }
</script>

<form class="quick" class:focused onsubmit={submit} role="search" aria-label={t('quick.label')}>
  <span class="plus" aria-hidden="true">+</span>
  <input
    bind:this={input}
    bind:value={text}
    placeholder={placeholder ?? t('quick.placeholder')}
    aria-label={t('quick.input')}
    autocomplete="off"
    enterkeyhint="done"
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    onkeydown={onKey}
    onpaste={onPaste}
    data-quick-add
  />
  {#if SRClass}
    <button
      type="button"
      class="btn ghost sm icon mic"
      class:on={listening}
      onclick={toggleVoice}
      aria-label={listening ? t('quick.stopListening') : t('quick.voice')}
      title={t('quick.voice')}>{listening ? '🔴' : '🎤'}</button
    >
  {/if}
  {#if text}
    <button class="btn primary sm go" type="submit">{t('common.add')}</button>
  {:else}
    <span class="hint" aria-hidden="true"><span class="kbd hint-only">n</span></span>
  {/if}
</form>
{#if text.trim()}
  <div class="preview" aria-live="polite">
    <span class="title-preview"
      >{parsed.template ? (template ? `${template.task.title}${parsed.title ? ' — ' + parsed.title : ''}` : `@${parsed.template}?`) : parsed.title || '…'}</span
    >
    {#each parsed.chips as chip}
      <span class="chip {chip.kind}">{chip.label}</span>
    {/each}
    {#if !parsed.dueAt && defaultDueKey}
      <span class="chip faint">📅 {t('date.today')}</span>
    {/if}
    {#if store.settings.autoDescribe && !parsed.template}
      <button type="button" class="chip auto" class:off={!describeNext} onclick={() => (describeNext = !describeNext)} title={t('quick.autoPlanTitle')}
        >{describeNext ? t('quick.autoPlan') : t('quick.noAutoPlan')}</button
      >
    {/if}
    {#if !parsed.courseId && defaultCourseId && store.courseById(defaultCourseId)}
      <span class="chip faint">{store.courseById(defaultCourseId)?.name}</span>
    {/if}
    {#if templateSuggestions.length}
      <span class="sugg">
        {#each templateSuggestions as tp}
          <button type="button" class="chip" onclick={() => applySuggestion('@', tp.name)}>@{tp.name}</button>
        {/each}
      </span>
    {/if}
    {#if courseSuggestions.length}
      <span class="sugg">
        {#each courseSuggestions as c}
          <button type="button" class="chip" style="border-color:{c.color}" onclick={() => applySuggestion('#', c.name)}>{c.emoji ?? ''} {c.name}</button>
        {/each}
      </span>
    {/if}
  </div>
{/if}

<style>
  .quick {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 6px 14px;
    border-radius: 12px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    transition:
      border-color var(--dur),
      box-shadow var(--dur);
  }
  .quick.focused {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .plus {
    color: var(--accent-text);
    font-size: 20px;
    font-weight: 600;
  }
  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    padding: 8px 0;
    font-size: 15px;
  }
  input:focus {
    outline: none;
  }
  .hint {
    opacity: 0.7;
  }
  .preview {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 4px 0;
    font-size: 13px;
    animation: pop-in 120ms var(--ease);
  }
  .title-preview {
    color: var(--text-muted);
    font-weight: 500;
  }
  .chip.due {
    color: var(--accent-text);
  }
  .chip.course {
    color: var(--text);
    border-color: var(--accent);
  }
  .chip.priority {
    color: var(--warn-text);
  }
  .chip.faint {
    opacity: 0.6;
  }
  .sugg {
    display: inline-flex;
    gap: 4px;
  }
  .sugg .chip {
    cursor: pointer;
  }
  .chip.auto {
    cursor: pointer;
    color: var(--accent-text);
  }
  .chip.auto.off {
    color: var(--text-faint);
    text-decoration: line-through;
  }
  .mic.on {
    animation: pulse-mic 1s infinite;
  }
  @keyframes pulse-mic {
    50% {
      transform: scale(1.15);
    }
  }
</style>
