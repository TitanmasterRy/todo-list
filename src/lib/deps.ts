// Task dependencies: a task can wait on other tasks ("Outline" before "Draft essay").
import type { Task } from './types';

/** Blockers that still exist and aren't done. Deleted blockers no longer block. */
export function openBlockers(t: Task, byId: Map<string, Task>): Task[] {
  return (t.blockedBy ?? []).map((id) => byId.get(id)).filter((b): b is Task => !!b && !b.completedAt);
}

export function isBlocked(t: Task, byId: Map<string, Task>): boolean {
  return !t.completedAt && openBlockers(t, byId).length > 0;
}

/** Would making `taskId` wait on `blockerId` create a loop (blocker already depends on the task)? */
export function wouldCycle(taskId: string, blockerId: string, byId: Map<string, Task>): boolean {
  if (taskId === blockerId) return true;
  const seen = new Set<string>();
  const stack = [blockerId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const b of byId.get(id)?.blockedBy ?? []) stack.push(b);
  }
  return false;
}

/** Tasks that wait on `id` (to show "unblocks 2 tasks"). */
export function dependents(id: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.completedAt && t.blockedBy?.includes(id));
}
