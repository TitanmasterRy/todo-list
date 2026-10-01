export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  kind: 'info' | 'success' | 'xp' | 'warn' | 'levelup' | 'badge';
  action?: ToastAction;
  timeout: number;
  combo?: number; // combo count for escalating xp visuals
  emoji?: string;
}

import { playSound } from './sounds';

let nextId = 1;

class ToastStore {
  items = $state<Toast[]>([]);

  push(t: Omit<Toast, 'id' | 'timeout'> & { timeout?: number }): number {
    const id = nextId++;
    const toast: Toast = { timeout: 4000, ...t, id };
    if (toast.kind === 'warn') playSound('error');
    this.items = [...this.items, toast].slice(-4);
    if (toast.timeout > 0) {
      setTimeout(() => this.dismiss(id), toast.timeout);
    }
    return id;
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }

  clear(): void {
    this.items = [];
  }
}

export const toasts = new ToastStore();
