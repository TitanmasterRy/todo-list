// "What's new" after an update: the newest CHANGELOG.md section, shown once per new heading.

/** The first `## ` section of a changelog: its heading and the markdown under it. */
export function latestSection(md: string): { title: string; body: string } | null {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.startsWith('## '));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  if (end < 0) end = lines.length;
  return {
    title: lines[start].slice(3).trim(),
    body: lines
      .slice(start + 1, end)
      .join('\n')
      .trim(),
  };
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
