// Due-soon browser notifications and a morning digest. Runs a check every minute while the app is open.
import { store } from './store.svelte';
import { dueKey, isDateOnly, formatDue } from './dates';
import { dueReminders } from './remind';
import { toasts } from './toast.svelte';
import { on } from './events';
import { putMeta, getMeta } from './storage';

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
    notify(`⏰ ${r.task.title}`, [when && `Due ${when}`, course].filter(Boolean).join(' · ') || 'Reminder', r.key, r.task.id);
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

/** Show a notification through the service worker when there is one (required on Android, and clicks open the task), else directly. */
export function notify(title: string, body: string, tag: string, taskId?: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { body, tag, icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: taskId ? { taskId } : { view: 'today' } };
  const direct = () => {
    try {
      const n = new Notification(title, opts);
      n.onclick = () => {
        window.focus();
        openFromNotification({ taskId });
        n.close();
      };
    } catch {
      /* ignore */
    }
  };
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!sw?.controller) return direct();
  sw.getRegistration()
    .then((reg) => (reg ? reg.showNotification(title, opts) : direct()))
    .catch(direct);
}

/** A notification was clicked: show the task (or the view) it was about. */
export function openFromNotification(d: { taskId?: string; view?: string }): void {
  const go = () => {
    if (d.taskId && store.taskById(d.taskId)) {
      store.go('today');
      store.editingTaskId = d.taskId;
    } else store.go('today');
  };
  if (store.ready) go();
  else {
    const t = setInterval(() => store.ready && (clearInterval(t), go()), 100);
    setTimeout(() => clearInterval(t), 10_000);
  }
}

// ---------- app icon badge ----------
let lastBadge = -1;
export function updateBadge(): void {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }) : undefined;
  if (!nav?.setAppBadge) return;
  const n = store.settings.appBadge ? store.todayTasks.length : 0;
  if (n === lastBadge) return;
  lastBadge = n;
  void (n ? nav.setAppBadge(n) : nav.clearAppBadge?.())?.catch(() => {});
}

// ---------- background (service worker) ----------
/** Settings the service worker needs (it can't read localStorage), kept in IndexedDB. */
async function syncWorkerPrefs(): Promise<void> {
  const s = store.settings;
  const prev = ((await getMeta<Record<string, unknown>>('sw:prefs').catch(() => undefined)) ?? {}) as Record<string, unknown>;
  const next = { ...prev, digest: s.notifyMorningDigest && s.backgroundReminders, badge: s.appBadge && s.backgroundReminders };
  if (prev.digest !== next.digest || prev.badge !== next.badge) await putMeta('sw:prefs', next).catch(() => {});
  if (next.digest || next.badge) void registerPeriodic();
}

let periodicAsked = false;
async function registerPeriodic(): Promise<void> {
  if (periodicAsked || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  periodicAsked = true;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } };
    if (!reg.periodicSync) return;
    const perm = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName }).catch(() => undefined);
    if (perm && perm.state !== 'granted') return; // granted automatically to installed apps people use
    await reg.periodicSync.register('hwtodo-daily', { minInterval: 6 * 60 * 60 * 1000 });
  } catch {
    /* unsupported */
  }
}

/** Whether this browser can run background checks (installed Chromium apps). */
export function backgroundSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PeriodicSyncManager' in window;
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
      // tell the service worker so it doesn't send a second digest later today
      void getMeta<Record<string, unknown>>('sw:prefs')
        .then((p) => putMeta('sw:prefs', { ...(p ?? {}), lastDigest: dayKey }))
        .catch(() => {});
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
  timer = setInterval(() => {
    check();
    updateBadge();
  }, 60 * 1000);
  on('changed', () => setTimeout(updateBadge, 0));
  on('completed', () => setTimeout(updateBadge, 0));
  setTimeout(() => {
    updateBadge();
    void syncWorkerPrefs();
  }, 1500);
  navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; taskId?: string; view?: string } | null;
    if (d?.type === 'hwtodo:open') openFromNotification(d);
  });
  // opened from a notification while the app was closed
  const task = new URLSearchParams(location.search).get('task');
  if (task) {
    window.history.replaceState({}, '', location.pathname);
    openFromNotification({ taskId: task });
  }
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
}

/** Call after notification settings change. */
export function remindersSettingsChanged(): void {
  lastBadge = -1;
  updateBadge();
  void syncWorkerPrefs();
}

export function dueKeyOf(t: { dueAt?: string }): string | undefined {
  return t.dueAt ? dueKey(t.dueAt) : undefined;
}
