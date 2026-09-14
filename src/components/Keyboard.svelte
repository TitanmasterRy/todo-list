<script lang="ts">
  // Global keyboard shortcuts. Listed in ShortcutSheet (?).
  import { store, VIEWS } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';
  import { undo } from '../lib/undo.svelte';

  function isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  /** Visible, open task ids in DOM order. */
  function visibleIds(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('main [data-task-id]'))
      .filter((el) => !el.classList.contains('done') && el.offsetParent !== null)
      .map((el) => el.dataset.taskId!);
  }

  function move(delta: number) {
    const ids = visibleIds();
    if (!ids.length) return;
    const idx = store.selectedTaskId ? ids.indexOf(store.selectedTaskId) : -1;
    let next = idx + delta;
    if (idx === -1) next = delta > 0 ? 0 : ids.length - 1;
    next = Math.max(0, Math.min(ids.length - 1, next));
    store.selectedTaskId = ids[next];
    document.querySelector<HTMLElement>(`[data-task-id="${ids[next]}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function closeAll(): boolean {
    let closed = false;
    if (ui.palette) (ui.palette = false), (closed = true);
    if (ui.shortcuts) (ui.shortcuts = false), (closed = true);
    if (ui.snoozeMenuFor) (ui.snoozeMenuFor = null), (closed = true);
    if (store.editingTaskId) (store.editingTaskId = null), (closed = true);
    if (ui.courseEditor) (ui.courseEditor = null), (closed = true);
    if (ui.weeklyReview) (ui.weeklyReview = false), (closed = true);
    if (ui.semesterSetup) (ui.semesterSetup = false), (closed = true);
    if (ui.frogPrompt) (ui.frogPrompt = false), (closed = true);
    if (ui.recap) (ui.recap = false), (closed = true);
    if (!closed && store.bulkMode) (store.clearSelection(), (closed = true));
    if (!closed && store.selectedTaskId) (store.selectedTaskId = null), (closed = true);
    return closed;
  }

  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      ui.palette = !ui.palette;
      return;
    }
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (isTyping(e)) return;
      e.preventDefault();
      void undo.undoLast();
      return;
    }
    if (e.key === 'Escape') {
      if (isTyping(e)) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (closeAll()) e.preventDefault();
      return;
    }
    if (isTyping(e) || mod || e.altKey) return;
    // Don't handle single-key shortcuts while a modal is open.
    if (ui.palette || store.editingTaskId || ui.courseEditor || ui.weeklyReview || ui.semesterSetup || ui.frogPrompt || ui.recap) return;

    switch (e.key) {
      case '?':
        e.preventDefault();
        ui.shortcuts = !ui.shortcuts;
        return;
      case 'n':
        e.preventDefault();
        if (!['today', 'upcoming', 'courses', 'inbox'].includes(store.view)) store.go('today');
        setTimeout(() => {
          ui.quickAddFocus++;
          document.querySelector<HTMLInputElement>('[data-quick-add]')?.focus();
        }, 0);
        return;
      case '/':
        e.preventDefault();
        if (store.view !== 'inbox') store.go('inbox');
        ui.search = true;
        setTimeout(() => document.querySelector<HTMLInputElement>('[data-search]')?.focus(), 0);
        return;
      case 'j':
      case 'ArrowDown':
        if (e.key === 'ArrowDown' && ui.shortcuts) return;
        e.preventDefault();
        move(1);
        return;
      case 'k':
      case 'ArrowUp':
        if (e.key === 'ArrowUp' && ui.shortcuts) return;
        e.preventDefault();
        move(-1);
        return;
      case 'Enter':
      case 'e':
        if (store.selectedTaskId) {
          e.preventDefault();
          store.editingTaskId = store.selectedTaskId;
        }
        return;
      case ' ':
        if (store.selectedTaskId) {
          e.preventDefault();
          const id = store.selectedTaskId;
          const ids = visibleIds();
          const idx = ids.indexOf(id);
          document.querySelector<HTMLElement>(`[data-task-id="${id}"] .cb`)?.click();
          store.selectedTaskId = ids[idx + 1] ?? ids[idx - 1] ?? null;
        }
        return;
      case 's':
        if (store.selectedTaskId) {
          e.preventDefault();
          ui.snoozeMenuFor = ui.snoozeMenuFor === store.selectedTaskId ? null : store.selectedTaskId;
        }
        return;
      case 'x':
        if (store.selectedTaskId) {
          e.preventDefault();
          store.toggleSelect(store.selectedTaskId);
        }
        return;
      case 'Delete':
      case 'Backspace':
        if (store.selectedTaskId) {
          e.preventDefault();
          store.deleteTask(store.selectedTaskId);
        }
        return;
      case 'f':
        if (store.selectedTaskId) {
          e.preventDefault();
          store.go('focus', { taskId: store.selectedTaskId });
        }
        return;
    }
    if (/^[1-7]$/.test(e.key)) {
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) {
        e.preventDefault();
        store.go(v.id);
      }
    }
  }
</script>

<svelte:window onkeydown={onKey} />
