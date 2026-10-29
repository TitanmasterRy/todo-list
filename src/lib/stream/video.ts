// Video for both Play → Stream transports: MoonlightWeb sends H.264 Annex-B access units (in DataChannel chunks on
// WebRTC, whole on the WebSocket), and the browser decodes them with WebCodecs onto a canvas. A lost frame breaks
// every frame after it until the next keyframe, so a gap stops decoding and asks the PC for one.

/** The NAL units of an Annex-B access unit (start codes removed). */
export function nalUnits(au: Uint8Array): Uint8Array[] {
  const starts: [number, number][] = [];
  for (let i = 0; i + 2 < au.length; i++) {
    if (au[i] === 0 && au[i + 1] === 0 && au[i + 2] === 1) {
      starts.push([i, i + 3]);
      i += 2;
    }
  }
  return starts.map(([, from], k) => {
    let to = k + 1 < starts.length ? starts[k + 1][0] : au.length;
    // a 4-byte start code leaves its leading zero on the previous unit
    if (k + 1 < starts.length && to > from && au[to - 1] === 0) to--;
    return au.subarray(from, to);
  });
}

/** `avc1.PPCCLL` from the access unit's SPS, or null when it carries none. */
export function avcCodec(au: Uint8Array): string | null {
  const sps = nalUnits(au).find((n) => (n[0] & 0x1f) === 7);
  if (!sps || sps.length < 4) return null;
  return `avc1.${[sps[1], sps[2], sps[3]].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Both transports decode video with WebCodecs; the WebSocket one decodes audio with it too. */
export function supportsWebCodecs(): boolean {
  return typeof VideoDecoder !== 'undefined' && typeof AudioDecoder !== 'undefined' && typeof AudioContext !== 'undefined';
}

export interface Chunk {
  frameId: number;
  index: number;
  total: number;
  key: boolean;
  data: Uint8Array;
}

export const CHUNK_HEADER = 17;

/** One video DataChannel message: `[frame_id:4][chunk_index:2][total_chunks:2][is_keyframe:1][payload_size:4][backend_ts:4]` + payload, big endian. */
export function parseChunk(buf: ArrayBuffer): Chunk | null {
  if (buf.byteLength < CHUNK_HEADER) return null;
  const v = new DataView(buf);
  const index = v.getUint16(4);
  const total = v.getUint16(6);
  const size = v.getUint32(9);
  if (!total || index >= total || size !== buf.byteLength - CHUNK_HEADER) return null;
  return { frameId: v.getUint32(0), index, total, key: v.getUint8(8) === 1, data: new Uint8Array(buf, CHUNK_HEADER) };
}

/**
 * Puts chunks back together into access units. The channel is ordered but may drop chunks (a 500 ms lifetime), so
 * a frame that never completes, or a frame id that was skipped, is reported as `lost`.
 */
export class Reassembler {
  private id = -1;
  private parts: Uint8Array[] = [];
  private got = 0;
  private total = 0;
  private key = false;

  push(c: Chunk): { frame?: { key: boolean; data: Uint8Array }; lost: boolean } {
    let lost = false;
    if (c.frameId !== this.id) {
      if (this.id !== -1) {
        // older than the frame in progress: a late leftover, ignore it
        if (((c.frameId - this.id) | 0) < 0) return { lost: false };
        lost = this.got < this.total || c.frameId !== (this.id + 1) >>> 0;
      }
      this.id = c.frameId;
      this.parts = new Array(c.total);
      this.got = 0;
      this.total = c.total;
      this.key = c.key;
    }
    if (c.total !== this.total || this.parts[c.index]) return { lost };
    this.parts[c.index] = c.data;
    this.got++;
    if (this.got < this.total) return { lost };
    const size = this.parts.reduce((n, p) => n + p.length, 0);
    const data = new Uint8Array(size);
    let at = 0;
    for (const p of this.parts) {
      data.set(p, at);
      at += p.length;
    }
    this.parts = [];
    return { frame: { key: this.key, data }, lost };
  }
}

/** Decodes access units onto a canvas, waiting for a keyframe after a gap, and counts frames for the stats. */
export class VideoSink {
  private decoder: VideoDecoder | null = null;
  private draw: CanvasRenderingContext2D | null;
  private needKey = true;
  private lastAsk = -Infinity;
  private shown = false;
  private frames = 0;
  private bytes = 0;
  private window = { at: performance.now(), frames: 0, bytes: 0, fps: 0, kbps: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    /** ask the PC for a keyframe */
    private requestKey: () => void,
    private onFirstFrame: () => void = () => {},
  ) {
    this.draw = canvas.getContext('2d', { alpha: false, desynchronized: true });
  }

  /** Bytes received for video (for the bitrate). */
  count(n: number): void {
    this.bytes += n;
  }

  push(au: Uint8Array, key: boolean): void {
    if (this.needKey && !key) return this.askKey();
    if (!this.decoder || this.decoder.state !== 'configured') {
      const codec = key ? avcCodec(au) : null;
      if (!codec) return this.askKey();
      this.decoder?.close();
      this.decoder = new VideoDecoder({ output: (f) => this.show(f), error: () => this.reset() });
      // not 'prefer-hardware': Chrome reads it as "hardware only" and fails on machines without an H.264 decoder chip
      this.decoder.configure({ codec, optimizeForLatency: true, hardwareAcceleration: 'no-preference' });
    }
    // behind by more than a few frames: skip to the next keyframe instead of drifting further back
    if (!key && this.decoder.decodeQueueSize > 4) return this.lost();
    this.needKey = false;
    this.decoder.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: Math.round(performance.now() * 1000), data: au }));
  }

  /**
   * A frame went missing (or the decoder fell behind): skip deltas until the next keyframe. The decoder stays open,
   * so frames it is still working on are shown; a keyframe doesn't depend on anything before it.
   */
  lost(): void {
    this.needKey = true;
    this.askKey();
  }

  /** The decoder failed: start a new one at the next keyframe. */
  private reset(): void {
    try {
      this.decoder?.close();
    } catch {
      /* already closed */
    }
    this.decoder = null;
    this.lost();
  }

  private askKey(): void {
    // the PC throttles keyframes too; one request every quarter second is plenty
    const now = performance.now();
    if (now - this.lastAsk < 250) return;
    this.lastAsk = now;
    this.requestKey();
  }

  private show(frame: VideoFrame): void {
    const c = this.canvas;
    if (c.width !== frame.displayWidth || c.height !== frame.displayHeight) {
      c.width = frame.displayWidth;
      c.height = frame.displayHeight;
    }
    this.draw?.drawImage(frame, 0, 0);
    frame.close();
    this.frames++;
    if (!this.shown) {
      this.shown = true;
      this.onFirstFrame();
    }
  }

  /** Frames and kbps over the last second or so, and the picture size. */
  rates(): { fps: number; kbps: number; width: number; height: number } {
    const w = this.window;
    const now = performance.now();
    if (now - w.at >= 900) {
      w.fps = Math.round(((this.frames - w.frames) * 1000) / (now - w.at));
      w.kbps = Math.round(((this.bytes - w.bytes) * 8) / (now - w.at));
      Object.assign(w, { at: now, frames: this.frames, bytes: this.bytes });
    }
    return { fps: w.fps, kbps: w.kbps, width: this.canvas.width, height: this.canvas.height };
  }

  close(): void {
    try {
      this.decoder?.close();
    } catch {
      /* already closed */
    }
    this.decoder = null;
  }
}
