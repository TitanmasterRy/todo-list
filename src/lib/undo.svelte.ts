import { toasts } from './toast.svelte';
import { t } from './i18n/index.svelte';

export interface UndoEntry {
  label: string;
  undo: () => void | Promise<void>;
}

class UndoStore {
  stack = $state<UndoEntry[]>([]);
  readonly max = 50;

  /** Register an undoable action and show a toast with an Undo button. */
  push(entry: UndoEntry, opts: { toast?: boolean; detail?: string; kind?: 'info' | 'success' | 'warn'; timeout?: number } = {}): void {
    this.stack = [...this.stack.slice(-(this.max - 1)), entry];
    if (opts.toast !== false) {
      const id = toasts.push({
        message: entry.label,
        detail: opts.detail,
        kind: opts.kind ?? 'info',
        timeout: opts.timeout ?? 6000,
        action: {
          label: t('common.undo'),
          onClick: () => {
            toasts.dismiss(id);
            void this.undoEntry(entry);
          },
        },
      });
    }
  }

  async undoEntry(entry: UndoEntry): Promise<void> {
    const idx = this.stack.lastIndexOf(entry);
    if (idx === -1) return; // already undone
    this.stack = this.stack.filter((_, i) => i !== idx);
    await entry.undo();
  }

  /** Ctrl+Z: undo the most recent action. */
  async undoLast(): Promise<boolean> {
    const entry = this.stack[this.stack.length - 1];
    if (!entry) return false;
    await this.undoEntry(entry);
    toasts.push({ message: t('undo.undid', { label: entry.label }), kind: 'info', timeout: 2500 });
    return true;
  }

  get canUndo(): boolean {
    return this.stack.length > 0;
  }
}

export const undo = new UndoStore();
