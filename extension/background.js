importScripts('shared.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'add-page', title: 'Add page to Homework To-Do', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'add-link', title: 'Add link to Homework To-Do', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'add-selection', title: 'Add “%s” to Homework To-Do', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-selection') return openTask(info.selectionText || '', tab?.url);
  if (info.menuItemId === 'add-link') return openTask(info.linkUrl || '', info.linkUrl);
  return openTask(tab?.title || '', tab?.url);
});
