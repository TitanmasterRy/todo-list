// Parent/teacher lock for the economy settings and a daily casino time limit. The PIN is stored as a
// salted SHA-256 hash in this browser; it's a speed bump for kids, not security against a determined user.

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`homework-todo:parent:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPin(pin: string, hash: string): Promise<boolean> {
  return !!hash && (await hashPin(pin)) === hash;
}

export function validPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/** Minutes left today under the limit (Infinity when there's no limit). */
export function casinoMinutesLeft(limit: number, byDay: Record<string, number>, today: string): number {
  if (!limit) return Infinity;
  return Math.max(0, limit - (byDay[today] ?? 0));
}

/** Add played minutes for today, keeping two weeks of history. */
export function addCasinoMinutes(byDay: Record<string, number>, today: string, minutes: number): Record<string, number> {
  const out: Record<string, number> = { [today]: (byDay[today] ?? 0) + minutes };
  for (const k of Object.keys(byDay).sort().reverse().slice(0, 14)) if (k !== today) out[k] = byDay[k];
  return out;
}
