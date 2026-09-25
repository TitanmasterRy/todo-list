let pageUrl = '';
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  document.getElementById('title').value = tab?.title ?? '';
  pageUrl = tab?.url ?? '';
  document.getElementById('title').select();
});
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const when = document.getElementById('when').value.trim();
  if (!title) return;
  await openTask(when ? `${title} ${when}` : title, pageUrl);
  window.close();
});
