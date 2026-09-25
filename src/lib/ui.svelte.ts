// Small UI-only state shared across components.
class UIState {
  palette = $state(false);
  shortcuts = $state(false);
  search = $state(false);
  searchQuery = $state('');
  snoozeMenuFor = $state<string | null>(null);
  weeklyReview = $state(false);
  semesterSetup = $state(false);
  courseEditor = $state<string | null | 'new'>(null);
  templatePickerFor = $state<string | null>(null);
  quickAddFocus = $state(0); // bump to focus quick add
  frogPrompt = $state(false);
  recap = $state(false);
  whatNow = $state(false);
  inboxList = $state<string | null>(null); // saved list opened from the sidebar
  inboxListNonce = $state(0); // "What should I do now?" card on Today
  toolsTab = $state<string>('planner');
  quickAddPrefill = $state('');
  openDeck = $state<string | null>(null); // a task's "Study" button opens this deck in Notecards
  captureKeys = $state(false); // a tool (e.g. notecard study) owns single-key shortcuts
}

export const ui = new UIState();
