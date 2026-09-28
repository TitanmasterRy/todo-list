// Tiny bridge (in the main bundle): banks homework events for the factory game in localStorage, so rewards
// arrive even when the game has never been opened. The game itself (a lazy chunk) takes them with takePending().
import { on } from '../events';

export const PENDING_KEY = 'homework-todo:factory-pending';
const MAX_PENDING = 50;

export interface Pending {
  tasks: number;
  study: number;
  /** Tasks already rewarded (so re-completing one doesn't pay twice). */
  ids: string[];
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function readPending(storage: Pick<Storage, 'getItem'> | undefined): Pending {
  try {
    const p = JSON.parse(storage?.getItem(PENDING_KEY) || '{}') as Partial<Pending>;
    return { tasks: Math.max(0, Number(p.tasks) || 0), study: Math.max(0, Number(p.study) || 0), ids: Array.isArray(p.ids) ? p.ids.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { tasks: 0, study: 0, ids: [] };
  }
}

function write(storage: Pick<Storage, 'setItem'> | undefined, p: Pending): void {
  try {
    storage?.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked: the reward is lost, nothing else breaks */
  }
}

export function bankTask(storage: Store | undefined, taskId: string): void {
  const p = readPending(storage);
  if (p.ids.includes(taskId)) return;
  p.ids = [...p.ids, taskId].slice(-300);
  p.tasks = Math.min(MAX_PENDING, p.tasks + 1);
  write(storage, p);
}

export function bankStudy(storage: Store | undefined): void {
  const p = readPending(storage);
  p.study = Math.min(MAX_PENDING, p.study + 1);
  write(storage, p);
}

/** Take the banked rewards (the counts reset; the rewarded task ids are kept). */
export function takePending(storage: Store | undefined): { tasks: number; study: number } {
  const p = readPending(storage);
  if (p.tasks || p.study) write(storage, { ...p, tasks: 0, study: 0 });
  return { tasks: p.tasks, study: p.study };
}

let started = false;
export function startFactoryBridge(): void {
  if (started) return;
  started = true;
  const ls = (): Storage | undefined => {
    try {
      return localStorage;
    } catch {
      return undefined;
    }
  };
  on('completed', ({ task }) => bankTask(ls(), task.id));
  on('studied', () => bankStudy(ls()));
  on('pomodoroDone', () => bankStudy(ls()));
}
