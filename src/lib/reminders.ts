// Due-soon browser notifications and a morning digest. Runs a check every minute while the app is open.
import { store } from './store.svelte';
import { dueKey, isDateOnly, formatDue } from './dates';

const notified = new Set<string>();
let timer: ReturnType<typeof setInterval> | undefined;

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export async function requestNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

function notify(title: string, body: string, tag: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: './icons/icon-192.png' });
  } catch {
    /* ignore */
  }
}

function check(): void {
  const s = store.settings;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const now = Date.now();
  if (s.notifyDueSoon) {
    const lead = (s.notifyLeadMin || 60) * 60 * 1000;
    for (const t of store.openTasks) {
      if (!t.dueAt || isDateOnly(t.dueAt)) continue;
      const due = new Date(t.dueAt).getTime();
      const key = `${t.id}:${t.dueAt}`;
      if (due - now <= lead && due - now > -60 * 1000 && !notified.has(key)) {
        notified.add(key);
        const course = store.courseById(t.courseId)?.name;
        notify(`Due ${formatDue(t.dueAt, new Date(), s.timeFormat)}: ${t.title}`, course ? `${course}` : 'Homework To-Do', key);
      }
    }
  }
  if (s.notifyMorningDigest) {
    const d = new Date();
    const dayKey = store.today;
    const digestKey = `digest:${dayKey}`;
    if (d.getHours() >= 7 && !notified.has(digestKey) && localStorage.getItem('homework-todo:digest') !== dayKey) {
      notified.add(digestKey);
      localStorage.setItem('homework-todo:digest', dayKey);
      const n = store.todayTasks.length;
      const overdue = store.overdueTasks.length;
      if (n || overdue) {
        const first = store.todayTasks.slice(0, 3).map((t) => `• ${t.title}`).join('\n');
        notify(`${n} task${n === 1 ? '' : 's'} today${overdue ? `, ${overdue} overdue` : ''}`, first, digestKey);
      }
    }
  }
}

export function startReminders(): void {
  if (timer) return;
  timer = setInterval(check, 60 * 1000);
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}

export function dueKeyOf(t: { dueAt?: string }): string | undefined {
  return t.dueAt ? dueKey(t.dueAt) : undefined;
}
