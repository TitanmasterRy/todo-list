// Service worker registration with an update prompt, plus install prompt capture.
import { registerSW } from 'virtual:pwa-register';
import { toasts } from './toast.svelte';
import { t } from './i18n/index.svelte';

class PwaState {
  installEvent = $state<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  installed = $state(false);
  offlineReady = $state(false);
}
export const pwa = new PwaState();

export function setupPwa(): void {
  if (typeof window === 'undefined') return;
  if (location.protocol === 'file:' || import.meta.env.LITE) return; // offline single-file build: no service worker
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      toasts.push({
        message: t('pwa.update'),
        detail: t('pwa.updateDetail'),
        kind: 'info',
        emoji: '⬆️',
        timeout: 0,
        action: { label: t('pwa.reload'), onClick: () => void update(true) },
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
    toasts.push({ message: t('pwa.installed'), detail: t('pwa.installedDetail'), kind: 'success', emoji: '📱' });
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
