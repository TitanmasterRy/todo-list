// Patch notes: every CHANGELOG.md section. After an update, the ones this device hasn't seen open by themselves.
// Which one a device saw last is `settings.lastSeenChangelog` (per device, never synced).

export interface PatchNote {
  title: string;
  body: string;
}

/** Every `## ` section of a changelog, newest first (the file is written newest first). */
export function allSections(md: string): PatchNote[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: PatchNote[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const l of lines) {
    if (l.startsWith('## ')) {
      if (cur) out.push({ title: cur.title, body: cur.lines.join('\n').trim() });
      cur = { title: l.slice(3).trim(), lines: [] };
    } else if (/^# /.test(l)) {
      if (cur) out.push({ title: cur.title, body: cur.lines.join('\n').trim() });
      cur = null;
    } else cur?.lines.push(l);
  }
  if (cur) out.push({ title: cur.title, body: cur.lines.join('\n').trim() });
  return out;
}

/** The first `## ` section of a changelog: its heading and the markdown under it. */
export function latestSection(md: string): PatchNote | null {
  return allSections(md)[0] ?? null;
}

/** How many sections (from the top) this device hasn't seen. Unknown last-seen heading: just the newest. */
export function unseenCount(sections: PatchNote[], lastSeen: string | undefined): number {
  if (!sections.length || !lastSeen) return 0;
  const i = sections.findIndex((s) => s.title === lastSeen);
  return i < 0 ? 1 : i;
}

/**
 * What to do on startup. First run: remember the current heading silently (a new user has nothing to catch up on).
 * After that: show when the heading changed.
 */
export function whatsNewAction(current: string, lastSeen: string | undefined): 'remember' | 'show' | 'none' {
  if (!current) return 'none';
  if (!lastSeen) return 'remember';
  return lastSeen === current ? 'none' : 'show';
}
