// hls.js, loaded on first use from jsDelivr (already allowed by the page's script-src), for HLS streams in browsers
// that can't play them natively (everything but Safari). Its segment requests are fetches, so the stream's server
// must be in connect-src (VITE_MEDIA_SERVERS); media from blob: (Media Source Extensions) is allowed.

export const HLS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';

/** The parts of hls.js the player uses. */
export interface HlsInstance {
  loadSource(src: string): void;
  attachMedia(video: HTMLVideoElement): void;
  on(event: string, cb: (event: string, data: { fatal?: boolean; type?: string; details?: string }) => void): void;
  destroy(): void;
}
export interface HlsStatic {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: { ERROR: string; MANIFEST_PARSED: string };
}

/** Safari (and some others) play HLS in <video> by themselves. */
export function nativeHls(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

let loading: Promise<HlsStatic> | null = null;

export function loadHls(): Promise<HlsStatic> {
  const w = window as unknown as { Hls?: HlsStatic };
  if (w.Hls) return Promise.resolve(w.Hls);
  loading ??= new Promise<HlsStatic>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = HLS_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => (w.Hls ? resolve(w.Hls) : reject(new Error('hls.js did not load')));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't download the HLS player (offline?)."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
