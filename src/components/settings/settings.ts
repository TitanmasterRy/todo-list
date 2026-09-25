// Shared by the Settings sections: write one setting, and keep a running Pomodoro in step when its lengths change.
import { store } from '../../lib/store.svelte';
import { pomodoro } from '../../lib/pomodoro.svelte';
import type { Settings } from '../../lib/types';

export function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  store.updateSettings({ [key]: value } as Partial<Settings>);
  if (key.startsWith('pomodoro')) pomodoro.syncSettings();
}
