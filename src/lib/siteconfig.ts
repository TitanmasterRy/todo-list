// site.json: the announcement banner and feature switches the site admin publishes (see admin.ts).
export type AnnouncementLevel = 'info' | 'warn' | 'party';

export interface Announcement {
  id: string;
  text: string;
  level: AnnouncementLevel;
  link?: string;
  /** Hide after this day (YYYY-MM-DD). */
  until?: string;
}

/** Site-wide switches. Missing means on. They hide features in the app; they don't lock anything. */
export interface SiteFlags {
  casino?: boolean;
  arcade?: boolean;
  shop?: boolean;
  ai?: boolean;
}

export interface SiteConfig {
  announcement?: Announcement;
  flags: SiteFlags;
  updatedAt?: string;
}

const FLAG_KEYS: (keyof SiteFlags)[] = ['casino', 'arcade', 'shop', 'ai'];

/** Read a site.json, keeping only fields with the expected shape. */
export function parseSite(raw: unknown): SiteConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const flags: SiteFlags = {};
  const f = (o.flags && typeof o.flags === 'object' ? o.flags : {}) as Record<string, unknown>;
  for (const k of FLAG_KEYS) if (typeof f[k] === 'boolean') flags[k] = f[k] as boolean;
  const a = (o.announcement && typeof o.announcement === 'object' ? o.announcement : null) as Record<string, unknown> | null;
  let announcement: Announcement | undefined;
  if (a && typeof a.text === 'string' && a.text.trim()) {
    const link = typeof a.link === 'string' && /^https?:\/\//.test(a.link) ? a.link.slice(0, 500) : undefined;
    announcement = {
      id: typeof a.id === 'string' && a.id ? a.id.slice(0, 40) : 'a',
      text: a.text.trim().slice(0, 300),
      level: a.level === 'warn' || a.level === 'party' ? a.level : 'info',
      link,
      until: typeof a.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.until) ? a.until : undefined,
    };
  }
  return { announcement, flags, updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined };
}

/** The announcement to show today, unless it has expired or was dismissed. */
export function activeAnnouncement(site: SiteConfig, today: string, dismissed: string | null): Announcement | undefined {
  const a = site.announcement;
  if (!a) return undefined;
  if (a.until && a.until < today) return undefined;
  if (dismissed === a.id) return undefined;
  return a;
}
