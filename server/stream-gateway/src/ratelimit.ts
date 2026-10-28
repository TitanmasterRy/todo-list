// Sign-in throttling: 5 failures from one address lock it out for 15 minutes, and 20 failures from anywhere within
// 15 minutes lock everyone out for 15 minutes (an address costs an attacker nothing to change).
export const WINDOW_MS = 15 * 60_000;
export const PER_IP = 5;
export const GLOBAL = 20;

export class LoginLimiter {
  private ips = new Map<string, { fails: number[]; until: number }>();
  private globalFails: number[] = [];
  private globalUntil = 0;

  /** ms to wait before trying again, 0 when allowed */
  wait(ip: string, now: number): number {
    const e = this.ips.get(ip);
    return Math.max(0, this.globalUntil - now, (e?.until ?? 0) - now);
  }

  fail(ip: string, now: number): void {
    const e = this.ips.get(ip) ?? { fails: [], until: 0 };
    e.fails = [...e.fails.filter((t) => now - t < WINDOW_MS), now];
    if (e.fails.length >= PER_IP) {
      e.until = now + WINDOW_MS;
      e.fails = [];
    }
    this.ips.set(ip, e);
    this.globalFails = [...this.globalFails.filter((t) => now - t < WINDOW_MS), now];
    if (this.globalFails.length >= GLOBAL) {
      this.globalUntil = now + WINDOW_MS;
      this.globalFails = [];
    }
    if (this.ips.size > 10_000) for (const [k, v] of this.ips) if (v.until < now && v.fails.every((t) => now - t >= WINDOW_MS)) this.ips.delete(k);
  }

  succeed(ip: string): void {
    this.ips.delete(ip);
  }
}

/** The client's address: the last X-Forwarded-For hop (the one Nginx Proxy Manager added), else the socket peer. */
export function clientIp(xff: string | string[] | undefined, peer: string | undefined): string {
  const list = (Array.isArray(xff) ? xff.join(',') : (xff ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (list.at(-1) ?? peer ?? '').replace(/^::ffff:/, '') || 'unknown';
}
