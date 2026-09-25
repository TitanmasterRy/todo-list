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
  whatNow = $state(false); // "What should I do now?" card on Today
  toolsTab = $state<string>('planner');
  quickAddPrefill = $state('');
  captureKeys = $state(false); // a tool (e.g. notecard study) owns single-key shortcuts
}

export const ui = new UIState();
