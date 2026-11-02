// Keeps the slow transports (WebSocket and HTTP) close to live. MoonlightWeb hands over frames as fast as the PC
// encodes them; when the browser's link is slower they used to queue in the gateway (up to 32 MB), so the picture,
// and with it the effect of every key press, fell seconds behind. Now, once the queue passes about a quarter second
// of video, frames are dropped up to the next keyframe, which is asked for only after the queue has drained: the
// picture skips ahead instead of lagging. Audio and text notices always pass; they're tiny.

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
}

/**
 * The HTTP transport keeps several input POSTs in flight, and behind a reverse proxy they can reach the gateway out
 * of order. Each carries the browser's sequence number; batches are applied in that order, waiting a short moment
 * for a missing one before moving on without it. A batch that turns up after that is still applied (a lost key-up
 * would leave the key stuck on the PC).
 */
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
    if (seq < this.next) return void (msgs.length && this.apply(msgs));
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
