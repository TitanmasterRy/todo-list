import { store } from './store.svelte';
import { playSound } from './sounds';
import { toasts } from './toast.svelte';

export type Mode = 'work' | 'break' | 'long';

class Pomodoro {
  mode = $state<Mode>('work');
  running = $state(false);
  remaining = $state(25 * 60); // seconds
  total = $state(25 * 60);
  sessions = $state(0); // work sessions completed this run
  private endAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  lengthFor(mode: Mode): number {
    const s = store.settings;
    return 60 * (mode === 'work' ? s.pomodoroWorkMin : mode === 'break' ? s.pomodoroBreakMin : s.pomodoroLongBreakMin);
  }

  setMode(mode: Mode): void {
    this.pause();
    this.mode = mode;
    this.total = this.lengthFor(mode);
    this.remaining = this.total;
  }

  start(): void {
    if (this.running) return;
    if (this.remaining <= 0) this.remaining = this.total;
    this.endAt = Date.now() + this.remaining * 1000;
    this.running = true;
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }

  pause(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  toggle(): void {
    this.running ? this.pause() : this.start();
  }

  reset(): void {
    this.pause();
    this.total = this.lengthFor(this.mode);
    this.remaining = this.total;
  }

  skip(): void {
    this.finish(false);
  }

  private tick(): void {
    const left = Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
    this.remaining = left;
    if (left <= 0) this.finish(true);
  }

  private finish(natural: boolean): void {
    this.pause();
    if (this.mode === 'work') {
      if (natural) {
        this.sessions += 1;
        store.recordPomodoro();
        playSound('timerDone');
        toasts.push({ message: 'Pomodoro done', detail: 'Take a break. You earned it.', kind: 'success', emoji: '🍅' });
        this.notify('Pomodoro done', 'Time for a break.');
      }
      this.setMode(this.sessions > 0 && this.sessions % 4 === 0 ? 'long' : 'break');
    } else {
      if (natural) {
        playSound('timerDone');
        this.notify('Break over', 'Back to it.');
      }
      this.setMode('work');
    }
  }

  private notify(title: string, body: string): void {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        new Notification(title, { body });
      }
    } catch {
      /* ignore */
    }
  }

  /** Re-sync lengths after settings change (only when idle). */
  syncSettings(): void {
    if (!this.running && this.remaining === this.total) this.reset();
  }
}

export const pomodoro = new Pomodoro();
