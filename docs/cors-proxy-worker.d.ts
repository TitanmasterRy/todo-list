// Types for cors-proxy-worker.js (used by its unit test in src/lib/corsWorker.test.ts).
export interface RelayEnv {
  ALLOWED_ORIGINS?: string;
  EXTRA_FEED_HOSTS?: string;
  RATE_LIMIT_PER_MIN?: string | number;
  RATE_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}
export function allowedOrigins(env?: RelayEnv): string[];
export function extraFeedHosts(env?: RelayEnv): string[];
export function takeToken(key: string, perMin: number, now?: number): boolean;
export function resetBuckets(): void;
declare const worker: { fetch(request: Request, env?: RelayEnv): Promise<Response> };
export default worker;
