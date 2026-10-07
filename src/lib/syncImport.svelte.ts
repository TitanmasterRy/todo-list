// Imported assignments (Schoology, Canvas, a class list): turn a feed's diff into tasks. Loaded with the sync
// code, not the first paint.
import type { Store } from './store.svelte';
import type { Stats, Task } from './types';
import type { ExternalAssignment, SyncDiff } from './schoology';
import { externalTaskId } from './id';
import { addDaysKey, dueKey, fromKey, isoNow } from './dates';
import { evaluateBadges } from './gamification';
import { emit } from './events';

/** A feed lists the whole year: assignments this far past due arrive as done (the feed can't say what was turned in). */
export const PAST_DUE_DAYS = 14;

/** Apply a sync diff: create new assignment tasks, update changed ones. Returns counts. `source` marks where they came from (Schoology, a class list). */
export function applySyncDiff(
  store: Store,
  diff: SyncDiff,
  resolveCourse: (a: ExternalAssignment) => string | undefined,
  describe?: (a: ExternalAssignment) => Partial<Task>,
  source: Task['source'] = 'schoology',
): { created: number; updated: number } {
  const now = isoNow();
  const created: Task[] = [];
  let order = store.nextOrder();
  // deleted on any device (the tombstone syncs, the per-device ignore list doesn't): don't bring it back
  const buried = new Set(store.tombstones.filter((t) => t.kind === 'task').flatMap((t) => [t.id, t.task?.externalId ? `ext:${t.task.externalId}` : '']));
  const ignore: string[] = [];
  for (const a of diff.create) {
    const id = externalTaskId(a.externalId);
    if (buried.has(id) || buried.has(`ext:${a.externalId}`)) ignore.push(a.externalId); // and remember it past the tombstone's 60 days
    if (buried.has(id) || buried.has(`ext:${a.externalId}`) || store.tasks.some((t) => t.id === id)) continue;
    const extra = describe?.(a) ?? {};
    const day = a.dueAt ? dueKey(a.dueAt) : undefined;
    // done without XP or coins; rewardedAt so reopening and finishing it doesn't pay either
    const doneAt = day && day < addDaysKey(store.today, -PAST_DUE_DAYS) ? new Date(fromKey(day).getTime() + 12 * 3_600_000).toISOString() : undefined;
    const task: Task = {
      id,
      title: a.title,
      notes: a.notes || extra.notes,
      courseId: resolveCourse(a),
      tags: extra.tags ?? [],
      priority: a.type === 'exam' ? 'high' : 'normal',
      dueAt: a.dueAt,
      estimateMin: extra.estimateMin,
      type: a.type,
      subtasks: (extra.subtasks ?? []).map((s, i) => ({ id: `${id}_s${i}`, title: s.title, done: false })),
      createdAt: now,
      updatedAt: now,
      order: order++,
      deferredCount: 0,
      source,
      externalId: a.externalId,
      url: a.url,
      syncedAt: now,
      autoDescribed: !!extra.notes,
      ...(doneAt ? { completedAt: doneAt, rewardedAt: doneAt, subtasks: [] } : {}),
    };
    created.push(task);
  }
  const byExt = new Map(store.tasks.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  const updated: Task[] = [];
  for (const u of diff.update) {
    const t = byExt.get(u.externalId);
    if (!t) continue;
    updated.push({ ...t, ...u.patch, syncedAt: now, updatedAt: now });
  }
  const map = new Map(updated.map((t) => [t.id, t]));
  store.tasks = [...store.tasks.map((t) => map.get(t.id) ?? t), ...created];
  if (ignore.length) store.updateSettings({ schoologyIgnored: [...(store.settings.schoologyIgnored ?? []), ...ignore] });
  const all = [...created, ...updated];
  if (all.length) store.persistTasks(all);
  if (created.length || updated.length) {
    const stats = structuredClone($state.snapshot(store.stats)) as Stats;
    stats.syncedCount = (stats.syncedCount ?? 0) + created.length;
    const newBadges = evaluateBadges(stats, { openTasksRemaining: store.openTasks.length, today: store.today });
    stats.badges = [...stats.badges, ...newBadges];
    store.stats = stats;
    store.persistStats();
    for (const b of newBadges) emit('badge', { id: b });
  }
  emit('synced', { created: created.length, updated: updated.length });
  return { created: created.length, updated: updated.length };
}
