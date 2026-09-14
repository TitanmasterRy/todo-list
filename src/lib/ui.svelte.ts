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
}

export const ui = new UIState();
