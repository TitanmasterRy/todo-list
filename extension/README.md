# Homework To-Do browser extension

Adds the page you're on to Homework To-Do: toolbar button (Alt+Shift+H), or right-click a page, link or selected text.
It opens your app with the task in quick add, so "tomorrow" or "fri 3pm" in the title set the due date.

## Install (Chrome, Edge, Brave, Arc)

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension/` folder.
2. Open the extension's **Options** and paste your app's address (e.g. `https://you.github.io/todo-list/`).

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick `manifest.json`.

To publish it in a store, zip the folder (`npm run pack:extension`) and upload it.

The extension sends nothing anywhere itself: it only opens a tab with your app's address plus the page title and link.
