// Extra service-worker code, loaded into the generated Workbox worker with importScripts (see vite.config.ts).
// 1. Clicking a notification focuses the app (or opens it) and shows the task.
// 2. Periodic background sync (installed app, Chromium): a morning digest and the app-icon badge,
//    even when the app hasn't been opened today. Reads the same IndexedDB the app writes.

const DB_NAME = 'homework-todo';

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    // never create or upgrade the database from here: that's the app's job
    r.onupgradeneeded = () => {
      r.transaction.abort();
      reject(new Error('no database yet'));
    };
  });
}

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Open tasks due today (by local day) and overdue ones, from the stored tasks. Mirrors the app's Today counts. */
function todayCounts(tasks, now) {
  const today = dayKey(now);
  let due = 0;
  let overdue = 0;
  const titles = [];
  for (const t of tasks) {
    if (t.completedAt || t.archived) continue;
    const key = t.dueAt ? (t.dueAt.length === 10 ? t.dueAt : dayKey(new Date(t.dueAt))) : t.pinnedDay === today ? today : '';
    if (!key) continue;
    if (key === today) {
      due++;
      if (titles.length < 3) titles.push(t.title);
    } else if (key < today) overdue++;
  }
  return { due, overdue, titles };
}

async function backgroundCheck() {
  const db = await openDb();
  try {
    const prefs = (await req(db.transaction('meta').objectStore('meta').get('sw:prefs'))) || {};
    const tasks = await req(db.transaction('tasks').objectStore('tasks').getAll());
    const now = new Date();
    const c = todayCounts(tasks, now);
    if (prefs.badge && self.navigator.setAppBadge) {
      const n = c.due + c.overdue;
      await (n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {});
    }
    const today = dayKey(now);
    if (prefs.digest && now.getHours() >= 7 && prefs.lastDigest !== today && (c.due || c.overdue)) {
      const clients = await self.clients.matchAll({ type: 'window' });
      // the open app sends its own digest
      if (!clients.some((w) => w.visibilityState === 'visible')) {
        await self.registration.showNotification(`${c.due} task${c.due === 1 ? '' : 's'} today${c.overdue ? `, ${c.overdue} overdue` : ''}`, {
          body: c.titles.map((t) => `• ${t}`).join('\n'),
          tag: `digest:${today}`,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          data: { view: 'today' },
        });
      }
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ ...prefs, lastDigest: today }, 'sw:prefs');
    }
  } finally {
    db.close();
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hwtodo-daily') event.waitUntil(backgroundCheck().catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const scope = self.registration.scope;
  const url = data.taskId ? `${scope}?task=${encodeURIComponent(data.taskId)}` : `${scope}?view=${data.view || 'today'}`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(scope));
      if (win) {
        win.postMessage({ type: 'hwtodo:open', taskId: data.taskId, view: data.view });
        return win.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

// exported for tests (the worker ignores this)
if (typeof module !== 'undefined') module.exports = { todayCounts, dayKey };
