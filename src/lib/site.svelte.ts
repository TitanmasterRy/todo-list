// Site-wide settings the admin publishes as site.json next to the app: an announcement banner and feature switches.
import { activeAnnouncement, parseSite, type SiteConfig } from './siteconfig';

const DISMISS_KEY = 'hwtodo-announcement-dismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

class Site {
  config = $state<SiteConfig>({ flags: {} });
  dismissed = $state<string | null>(readDismissed());

  /** Is a feature on? Missing flags mean on. */
  on(flag: keyof SiteConfig['flags']): boolean {
    return this.config.flags[flag] !== false;
  }

  announcement(today: string) {
    return activeAnnouncement(this.config, today, this.dismissed);
  }

  dismiss(id: string): void {
    this.dismissed = id;
    try {
      localStorage.setItem(DISMISS_KEY, id);
    } catch {
      /* private mode */
    }
  }

  async load(): Promise<void> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}site.json`, { cache: 'no-cache' });
      if (res.ok) this.config = parseSite(await res.json());
    } catch {
      /* offline or no site.json: defaults */
    }
  }
}

export const site = new Site();
