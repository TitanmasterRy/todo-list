// Opus audio for the TCP-based transports (the WebSocket fallback and the HTTP transport): decode each packet with
// WebCodecs and schedule it a little ahead, so network jitter doesn't crackle. The AudioContext is made during the
// click that starts the stream, so the browser allows sound.
export class OpusPlayer {
  private ctx: AudioContext;
  private gain: GainNode;
  private decoder: AudioDecoder | null = null;
  private playAt = 0;
  private volume = 1;
  private muted = false;

  /** `leadMs` is how far ahead audio is scheduled: a smaller cushion is lower latency but less jitter-proof. */
  constructor(private leadMs = 60) {
    this.ctx = new AudioContext({ sampleRate: 48_000, latencyHint: 'interactive' });
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = volume;
    this.muted = muted;
    this.gain.gain.value = muted ? 0 : volume;
  }

  push(data: Uint8Array): void {
    if (!this.decoder) {
      this.decoder = new AudioDecoder({ output: (a) => this.play(a), error: () => (this.decoder = null) });
      this.decoder.configure({ codec: 'opus', sampleRate: 48_000, numberOfChannels: 2 });
    }
    if (this.decoder.state === 'configured') this.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(performance.now() * 1000), data }));
  }

  private play(a: AudioData): void {
    const buf = this.ctx.createBuffer(a.numberOfChannels, a.numberOfFrames, a.sampleRate);
    for (let ch = 0; ch < a.numberOfChannels; ch++) {
      const plane = new Float32Array(a.numberOfFrames);
      a.copyTo(plane, { planeIndex: ch, format: 'f32-planar' });
      buf.copyToChannel(plane, ch);
    }
    a.close();
    const now = this.ctx.currentTime;
    const lead = this.leadMs / 1000;
    // keep ~lead queued; if the queue grew past a quarter second (a stall), start over from now
    if (this.playAt < now || this.playAt - now > 0.25) this.playAt = now + lead;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    src.start(this.playAt);
    this.playAt += buf.duration;
  }

  /** a user gesture arrived: let a context that autoplay suspended start */
  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  close(): void {
    try {
      this.decoder?.close();
    } catch {
      /* already closed */
    }
    void this.ctx.close();
  }
}
