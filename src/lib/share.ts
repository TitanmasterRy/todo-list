// Files shared into the app from another app (see the share-target handler in public/sw-extra.js).
const SHARE_CACHE = 'hwtodo-share';

/** Take the shared files out of Cache Storage (they're removed once read). */
export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open(SHARE_CACHE);
  const keys = await cache.keys();
  const files: File[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    await cache.delete(req);
    if (!res) continue;
    const blob = await res.blob();
    const name = decodeURIComponent(res.headers.get('x-file-name') ?? '') || 'shared file';
    files.push(new File([blob], name, { type: res.headers.get('content-type') ?? blob.type }));
  }
  return files;
}

export const isPdf = (f: File): boolean => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** A task title from what was shared: the shared text/title, else the first file's name without its extension. */
export function titleForShare(files: File[], shared: { title?: string; text?: string }): string {
  const t = (shared.title || shared.text || '').trim();
  if (t) return t.slice(0, 140);
  const n = files[0]?.name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return n ? n.slice(0, 140) : 'Shared file';
}
