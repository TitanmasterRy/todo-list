// Shared by the popup, the options page and the background worker.
// The app reads ?title=…&url=… (its share target) and puts it in quick add, where dates like "fri" or "tomorrow" work.
const DEFAULT_APP = 'https://your-homework-todo.example/';

async function appUrl() {
  const { app } = await chrome.storage.sync.get('app');
  return (app || DEFAULT_APP).replace(/\/?$/, '/');
}

async function openTask(title, url) {
  const base = await appUrl();
  const u = new URL(base);
  u.searchParams.set('title', title.slice(0, 300));
  if (url) u.searchParams.set('url', url);
  await chrome.tabs.create({ url: u.toString() });
}
