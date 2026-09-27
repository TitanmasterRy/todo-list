// Focus-mode companion: a small friend that naps while the focus timer runs and wakes up for breaks.
export type CompanionId = 'cat' | 'dog' | 'fox' | 'owl' | 'bunny' | 'off';
export type CompanionState = 'sleeping' | 'playing' | 'waiting';

export const COMPANIONS: { id: Exclude<CompanionId, 'off'>; name: string; emoji: string }[] = [
  { id: 'cat', name: 'Cat', emoji: '🐱' },
  { id: 'dog', name: 'Puppy', emoji: '🐶' },
  { id: 'fox', name: 'Fox', emoji: '🦊' },
  { id: 'owl', name: 'Owl', emoji: '🦉' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰' },
];

/** Asleep while you focus (work, custom timer, stopwatch), up and playing on a running break, waiting when paused. */
export function companionState(mode: string, running: boolean): CompanionState {
  if (!running) return 'waiting';
  return mode === 'break' || mode === 'long' ? 'playing' : 'sleeping';
}

export const COMPANION_TEXT: Record<CompanionState, string> = {
  sleeping: 'is napping while you focus',
  playing: 'is awake: break time!',
  waiting: 'is waiting for you to start',
};
