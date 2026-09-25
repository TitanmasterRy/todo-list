// Due-soon browser notifications and a morning digest. Runs a check every minute while the app is open.
import { store } from './store.svelte';
import { dueKey, isDateOnly, formatDue } from './dates';
import { dueReminders } from './remind';
import { toasts } from './toast.svelte';

// per-task reminders already delivered (kept across reloads so a refresh doesn't repeat them)
const SENT_KEY = 'homework-todo:reminders-sent';
function loadSent(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
const sentReminders = loadSent();
function saveSent(): void {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...sentReminders].slice(-300)));
  } catch {
    /* ignore */
  }
}

/** Per-task reminders: a notification when allowed, an in-app toast either way. */
function checkTaskReminders(): void {
  const due = dueReminders(store.openTasks, new Date(), sentReminders);
  for (const r of due) {
    sentReminders.add(r.key);
    const when = r.task.dueAt ? formatDue(r.task.dueAt, new Date(), store.settings.timeFormat) : '';
    const course = store.courseById(r.task.courseId)?.name;
    notify(`⏰ ${r.task.title}`, [when && `Due ${when}`, course].filter(Boolean).join(' · ') || 'Reminder', r.key);
    toasts.push({
      message: `Reminder: ${r.task.title}`,
      detail: when ? `Due ${when}` : undefined,
      kind: 'info',
      emoji: '⏰',
      timeout: 12000,
      action: { label: 'Focus', onClick: () => store.go('focus', { taskId: r.task.id }) },
    });
  }
  if (due.length) saveSent();
}

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
  checkTaskReminders();
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
        const first = store.todayTasks
          .slice(0, 3)
          .map((t) => `• ${t.title}`)
          .join('\n');
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
