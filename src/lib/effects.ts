// Visual effects level. "Lite" keeps the app's look but drops what costs the most on a weak device: glass blur,
// the drifting background light, coin rain, and most of the confetti. "Auto" picks lite on phones that report little
// memory or few cores, on a data-saver connection, or once a celebration has visibly dropped frames.

export type EffectsLevel = 'auto' | 'full' | 'lite';

export interface DeviceHints {
  memoryGb?: number; // navigator.deviceMemory (Chromium only)
  cores?: number; // navigator.hardwareConcurrency
  saveData?: boolean; // navigator.connection.saveData
}

/** The device looks too weak for the full effects. */
export function weakDevice(h: DeviceHints): boolean {
  if (h.saveData) return true;
  if (h.memoryGb !== undefined && h.memoryGb <= 2) return true;
  if (h.cores !== undefined && h.cores <= 2) return true;
  return false;
}

/** Whether lite effects apply for a setting, the device and what the frame meter has seen. */
export function liteEffects(level: EffectsLevel | undefined, hints: DeviceHints, sawJank = false): boolean {
  if (level === 'lite') return true;
  if (level === 'full') return false;
  return sawJank || weakDevice(hints);
}

/** Frame times from a celebration: did enough of them miss the 60 Hz budget to call the device slow? */
export function framesJanky(frameMs: number[], budgetMs = 28, minFrames = 20, share = 0.25): boolean {
  if (frameMs.length < minFrames) return false;
  const slow = frameMs.filter((ms) => ms > budgetMs).length;
  return slow / frameMs.length >= share;
}

/** Read the browser's hints (all optional; missing on Safari and Firefox). */
export function readDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { memoryGb: n.deviceMemory, cores: n.hardwareConcurrency, saveData: n.connection?.saveData };
}

// Remembered for the session: once a celebration stuttered, "auto" stays lite until the next launch.
let jankSeen = false;
export function noteJank(janky: boolean): void {
  if (janky) jankSeen = true;
}
export function sawJank(): boolean {
  return jankSeen;
}
/** @internal tests */
export function resetJank(): void {
  jankSeen = false;
}
