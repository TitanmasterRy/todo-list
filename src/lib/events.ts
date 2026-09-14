import type { XpBreakdown } from './gamification';
import type { Task } from './types';

export interface AppEvents {
  completed: { task: Task; xp: XpBreakdown; leveledUp: boolean; newLevel: number; ringClosed: boolean; newBadges: string[]; streakCurrent: number; freezeEarned: boolean };
  uncompleted: { task: Task };
  levelup: { level: number };
  badge: { id: string };
  ringClosed: { day: string };
  changed: { reason: string };
  pomodoroDone: { day: string; count: number };
  navigate: { view: string; courseId?: string; taskId?: string };
}

type Handler<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

const handlers: { [K in keyof AppEvents]?: Set<Handler<K>> } = {};

export function on<K extends keyof AppEvents>(name: K, fn: Handler<K>): () => void {
  let set = handlers[name] as Set<Handler<K>> | undefined;
  if (!set) {
    set = new Set();
    (handlers as Record<string, unknown>)[name] = set;
  }
  set.add(fn);
  return () => set!.delete(fn);
}

export function emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
  const set = handlers[name] as Set<Handler<K>> | undefined;
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(payload);
    } catch (e) {
      console.error(`event handler for ${name} failed`, e);
    }
  }
}
