// Keeps the slow transports (WebSocket and HTTP) close to live. MoonlightWeb hands over frames as fast as the PC
// encodes them; when the browser's link is slower they used to queue in the gateway (up to 32 MB), so the picture,
// and with it the effect of every key press, fell seconds behind. Now, once the queue passes about a quarter second
// of video, frames are dropped up to the next keyframe, which is asked for only after the queue has drained: the
// picture skips ahead instead of lagging. Audio and text notices always pass; they're tiny.
//
// The gateway only sees its own queue, though. The kernel's socket buffers and a reverse proxy in front can hold
// megabytes more, seconds of video on a slow link, so the browser measures the real delay too (from the gateway's
// clock notices, see `clockNotice`) and reports it with `gw-lag`; `drain` then stops video for about that long.

/** One MoonlightWeb `wss` binary frame: `[0x01][flags][H.264 AU]` (flags bit 0 = keyframe) or `[0x02][0x00][Opus]`. */
const VIDEO = 1;

/** Bytes of queue allowed for a bitrate (kbps): about 250 ms of video, at least 128 KB. */
export function backlogBudget(kbps: number): number {
  return Math.max(128 * 1024, Math.round(((kbps * 1000) / 8) * 0.25));
}

export class VideoGate {
  private dropping = false;
  private lastAsk = -Infinity;
  /** a keyframe is many times a normal frame; the queue may hold the last one on top of the budget */
  private keySize = 0;
  /** no video at all until then (ms), while a backlog the gateway can't see drains */
  private drainUntil = -Infinity;

  constructor(
    private budget: number,
    /** ask MoonlightWeb for a keyframe */
    private requestKey: () => void,
    private now: () => number = Date.now,
  ) {}

  /** Whether to forward `frame`, given `queued` bytes still waiting to reach the browser. */
  pass(frame: Uint8Array, queued: number): boolean {
    if (frame[0] !== VIDEO || frame.length < 2) return true;
    const key = (frame[1] & 1) === 1;
    if (this.now() < this.drainUntil) return false;
    if (!this.dropping) {
      if (queued <= this.budget + this.keySize) {
        if (key) this.keySize = frame.length;
        return true;
      }
      this.dropping = true;
    }
    // resume only at a keyframe, and only once the queue has drained, so the keyframe isn't stale on arrival
    if (queued > this.budget / 2) return false;
    if (key) {
      this.dropping = false;
      this.keySize = frame.length;
      return true;
    }
    const t = this.now();
    if (t - this.lastAsk >= 500) {
      this.lastAsk = t;
      this.requestKey();
    }
    return false;
  }

  /**
   * The browser says video reaches it `ms` late. Nothing new joins the queue for that long, which is about how long a
   * queue that deep takes to empty at the link's own speed, then video resumes at a fresh keyframe. A report while one
   * drain is still running is ignored: it measured the same backlog.
   */
  drain(ms: number): void {
    const t = this.now();
    if (!Number.isFinite(ms) || ms <= 0 || t < this.drainUntil) return;
    this.drainUntil = t + Math.min(ms, MAX_DRAIN_MS);
    this.dropping = true;
    this.lastAsk = -Infinity;
  }
}

/** the longest one lag report may pause video for; a deeper backlog takes a second report */
export const MAX_DRAIN_MS = 3_000;

/** A text notice the gateway mixes into the media stream every CLOCK_MS, stamped as it's queued. It waits in the same
 *  buffers as the video, so the browser can tell from its arrival how far behind the stream is. */
export const CLOCK_MS = 100;
export function clockNotice(now: number): string {
  return JSON.stringify({ type: 'gw-clock', t: now });
}

/**
 * A message from the browser meant for the gateway itself (`gw-…`), which is never forwarded to MoonlightWeb.
 * Returns true when the line was one, after acting on it.
 */
export function gatewayMessage(line: string, gate: VideoGate | null): boolean {
  if (!line.startsWith('{"type":"gw-')) return false;
  try {
    const m = JSON.parse(line) as { type?: unknown; ms?: unknown };
    if (m.type === 'gw-lag' && typeof m.ms === 'number') gate?.drain(m.ms);
  } catch {
    /* malformed: dropped all the same */
  }
  return true;
}

/**
 * The HTTP transport keeps several input POSTs in flight, and behind a reverse proxy they can reach the gateway out
 * of order. Each carries the browser's sequence number; batches are applied in that order, waiting a short moment
 * for a missing one before moving on without it. A batch that turns up after that keeps only what can't be stale: a
 * lost key-up would leave the key stuck on the PC, but a key-down (or held-key heartbeat) landing after its own
 * key-up would press the key again, and Apollo repeats a held key, so it typed twice.
 */
/** input that a later batch may already have undone, so a late copy must not be applied */
const PRESSES = new Set(['keydown', 'mousedown', 'inputstate']);

function typeOf(line: string): string {
  try {
    const t = (JSON.parse(line) as { type?: unknown }).type;
    return typeof t === 'string' ? t : '';
  } catch {
    return '';
  }
}

export class InputOrder {
  private next = 1;
  private held = new Map<number, string[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private apply: (msgs: string[]) => void,
    private waitMs = 60,
  ) {}

  /** `seq` 0 (a page from before sequence numbers) is applied straight away. */
  push(seq: number, msgs: string[]): void {
    if (seq === 0) return void (msgs.length && this.apply(msgs));
    if (seq < this.next) {
      const late = msgs.filter((line) => !PRESSES.has(typeOf(line)));
      return void (late.length && this.apply(late));
    }
    this.held.set(seq, msgs);
    // something is badly out of step: don't hold an unbounded backlog
    if (this.held.size > 32) this.next = Math.min(...this.held.keys());
    this.flush();
  }

  private flush(): void {
    for (let m = this.held.get(this.next); m; m = this.held.get(this.next)) {
      this.held.delete(this.next++);
      this.apply(m);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.held.size) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.next = Math.min(...this.held.keys());
      this.flush();
    }, this.waitMs);
    this.timer.unref?.();
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.held.clear();
  }
}
