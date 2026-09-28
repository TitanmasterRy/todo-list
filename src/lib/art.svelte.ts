// Art slots: generated artwork dropped into public/art/ replaces the drawn (CSS/SVG) art automatically.
// public/art/manifest.json lists the files that exist ({ "files": ["casino/card-back.webp", …] }); anything not
// listed keeps its fallback, so a missing or broken manifest never costs a request per image.

/** Paths from a manifest body: strings only, relative, no parent references. */
export function parseArtManifest(json: unknown): Set<string> {
  const files = (json as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return new Set();
  return new Set(files.filter((f): f is string => typeof f === 'string' && f.length > 0 && !f.startsWith('/') && !f.includes('..') && !/^[a-z]+:/i.test(f)));
}

class Art {
  files = $state<Set<string>>(new Set());
  private started = false;

  /** Load the manifest once (on first use). Failures leave every slot on its fallback. */
  load(fetcher: typeof fetch = fetch, base: string = import.meta.env.BASE_URL): Promise<void> {
    if (this.started) return Promise.resolve();
    this.started = true;
    return fetcher(`${base}art/manifest.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const files = parseArtManifest(json);
        if (files.size) this.files = files;
      })
      .catch(() => {
        /* offline or no manifest: fallbacks */
      });
  }

  /** URL of an art file when the manifest lists it, else undefined. Reactive: the first read starts the load. */
  url(name: string, base: string = import.meta.env.BASE_URL): string | undefined {
    if (!this.started && typeof window !== 'undefined') void this.load();
    return this.files.has(name) ? `${base}art/${name}` : undefined;
  }

  /** Tests only. */
  reset(): void {
    this.started = false;
    this.files = new Set();
  }
}

export const art = new Art();

/** `${BASE_URL}art/<name>` if the manifest lists it; undefined otherwise (use the drawn fallback). */
export function artUrl(name: string): string | undefined {
  return art.url(name);
}
