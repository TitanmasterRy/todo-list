<script lang="ts">
  // Global keyboard shortcuts. Extended in phase 6.
  import { undo } from '../lib/undo.svelte';

  function isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (isTyping(e)) return;
      e.preventDefault();
      void undo.undoLast();
    }
  }
</script>

<svelte:window onkeydown={onKey} />
