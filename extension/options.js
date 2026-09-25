const input = document.getElementById('app');
chrome.storage.sync.get('app').then(({ app }) => (input.value = app || ''));
document.getElementById('save').addEventListener('click', async () => {
  let v = input.value.trim();
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('Use an https:// address');
    v = u.toString();
  } catch (e) {
    document.getElementById('msg').textContent = e.message || 'That isn’t a web address';
    return;
  }
  await chrome.storage.sync.set({ app: v });
  document.getElementById('msg').textContent = 'Saved';
});
