// How far behind live the slow transports (WebSocket and HTTP) really are. The gateway stamps a `gw-clock` notice into
// the media stream every 100 ms; it waits in the same buffers as the video (the gateway's, the kernel's, any proxy's),
// so arrival time minus stamp is the one-way delay plus a fixed clock offset. The lowest value lately is the delay
// with empty buffers, and anything above it is backlog. A backlog that lasts is reported to the gateway, which pauses
// video for about that long so the buffers empty and the picture (and the effect of every key press) is live again.

/** the baseline is the lowest delay per window of this long (ms) */
const WINDOW_MS = 5_000;
/** how many windows the baseline remembers: long enough to see an empty buffer, short enough that clock drift doesn't build up */
const WINDOWS = 6;
/** a backlog has to last this long before it's reported, so one big keyframe passing through isn't mistaken for one */
const SUSTAIN_MS = 300;
/** this many reports within CONGESTED_MS means the link can't carry the bitrate at all */
const CONGESTED_REPORTS = 3;
const CONGESTED_MS = 15_000;

export class LagMeter {
  private mins: number[] = [];
  private windowAt = -Infinity;
  private overSince: number | null = null;
  private quietUntil = -Infinity;
  private reports: number[] = [];
  /** the backlog at the last sample, ms */
  behind: number | null = null;

  constructor(
    /** tell the gateway the stream is `ms` behind */
    private report: (ms: number) => void,
    /** backlog (ms) worth a report */
    private threshold = 200,
    private now: () => number = () => performance.now(),
  ) {}

  /** A `gw-clock` notice arrived, stamped `t` by the gateway's clock. */
  sample(t: number): void {
    if (!Number.isFinite(t)) return;
    const at = this.now();
    const offset = at - t;
    if (at - this.windowAt >= WINDOW_MS) {
      this.windowAt = at;
      this.mins.push(offset);
      if (this.mins.length > WINDOWS) this.mins.shift();
    } else this.mins[this.mins.length - 1] = Math.min(this.mins[this.mins.length - 1], offset);
    const behind = Math.max(0, Math.round(offset - Math.min(...this.mins)));
    this.behind = behind;
    if (behind < this.threshold) return void (this.overSince = null);
    this.overSince ??= at;
    if (at - this.overSince < SUSTAIN_MS || at < this.quietUntil) return;
    // the gateway pauses for `behind`; samples queued before the pause keep reading high until it has taken effect
    this.quietUntil = at + behind + 750;
    this.overSince = null;
    this.reports = [...this.reports.filter((x) => at - x < CONGESTED_MS), at];
    this.report(behind);
  }

  /** The stream keeps falling behind: the network can't carry this bitrate, and a lower one would play smoother. */
  congested(): boolean {
    const at = this.now();
    return this.reports.filter((x) => at - x < CONGESTED_MS).length >= CONGESTED_REPORTS;
  }
}
