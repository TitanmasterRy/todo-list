// Service worker registration with an update prompt, plus install prompt capture.
import { registerSW } from 'virtual:pwa-register';
import { toasts } from './toast.svelte';

class PwaState {
  installEvent = $state<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  installed = $state(false);
  offlineReady = $state(false);
}
export const pwa = new PwaState();

export function setupPwa(): void {
  if (typeof window === 'undefined') return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      toasts.push({
        message: 'Update available',
        detail: 'Reload to get the latest version.',
        kind: 'info',
        emoji: '⬆️',
        timeout: 0,
        action: { label: 'Reload', onClick: () => void update(true) },
      });
    },
    onOfflineReady() {
      pwa.offlineReady = true;
    },
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwa.installEvent = e as PwaState['installEvent'];
  });
  window.addEventListener('appinstalled', () => {
    pwa.installed = true;
    pwa.installEvent = null;
    toasts.push({ message: 'Installed', detail: 'Homework To-Do is on your home screen.', kind: 'success', emoji: '📱' });
  });
  if (window.matchMedia('(display-mode: standalone)').matches) pwa.installed = true;
}

export async function promptInstall(): Promise<void> {
  const ev = pwa.installEvent;
  if (!ev) return;
  await ev.prompt();
  const choice = await ev.userChoice;
  if (choice.outcome === 'accepted') pwa.installEvent = null;
}
