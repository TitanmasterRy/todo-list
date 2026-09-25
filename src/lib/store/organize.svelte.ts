// Store methods: Courses, templates, day notes.
// Attached to Store.prototype in store.svelte.ts, so they're called as store.method(...) like the rest.
import * as db from '../storage';
import type { Course, DayNote, Task, Template } from '../types';
import { uid } from '../id';
import { isoNow } from '../dates';
import { undo } from '../undo.svelte';
import { emit } from '../events';
import type { Store } from '../store.svelte';
import { t as tr } from '../i18n/index.svelte';

export const organizeMethods = {
  // ---------- courses ----------
  addCourse(this: Store, input: { name: string; color: string; emoji?: string }): Course {
    const c: Course = { id: uid('c'), name: input.name.trim(), color: input.color, emoji: input.emoji, archived: false, updatedAt: isoNow() };
    this.courses = [...this.courses, c];
    db.putCourse(c).catch((e) => console.error(e));
    emit('changed', { reason: 'course' });
    return c;
  },
  updateCourse(this: Store, id: string, patch: Partial<Course>): void {
    const prev = this.courses.find((c) => c.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, updatedAt: isoNow() };
    this.courses = this.courses.map((c) => (c.id === id ? next : c));
    db.putCourse(next).catch((e) => console.error(e));
    emit('changed', { reason: 'course' });
  },
  deleteCourse(this: Store, id: string): void {
    const course = this.courses.find((c) => c.id === id);
    if (!course) return;
    const affected = this.tasks.filter((t) => t.courseId === id).map((t) => structuredClone($state.snapshot(t)) as Task);
    this.courses = this.courses.filter((c) => c.id !== id);
    db.deleteCourse(id).catch((e) => console.error(e));
    this.bury('course', [id]);
    const now = isoNow();
    const updated = affected.map((t) => ({ ...t, courseId: undefined, updatedAt: now }));
    const map = new Map(updated.map((t) => [t.id, t]));
    this.tasks = this.tasks.map((t) => map.get(t.id) ?? t);
    if (updated.length) this.persistTasks(updated);
    emit('changed', { reason: 'course' });
    if (this.courseFilter === id) this.courseFilter = null;
    undo.push(
      {
        label: tr('toast.deletedCourse', { name: course.name }),
        undo: () => {
          const back = { ...course, updatedAt: isoNow() };
          this.unbury('course', [id]);
          this.courses = [...this.courses, back];
          db.putCourse(back).catch(() => {});
          const restored = affected.map((t) => ({ ...t, updatedAt: back.updatedAt! }));
          const m = new Map(restored.map((t) => [t.id, t]));
          this.tasks = this.tasks.map((t) => m.get(t.id) ?? t);
          if (restored.length) this.persistTasks(restored);
        },
      },
      { kind: 'warn' },
    );
  },
  findCourseByName(this: Store, name: string): Course | undefined {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      this.activeCourses.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === n) ??
      this.activeCourses.find(
        (c) =>
          c.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .startsWith(n) && n.length >= 3,
      )
    );
  },

  // ---------- templates ----------
  saveTemplate(this: Store, task: Task, name: string): Template {
    const t: Template = {
      id: uid('tpl'),
      name: name.trim().replace(/\s+/g, '-').toLowerCase(),
      task: {
        title: task.title,
        notes: task.notes,
        courseId: task.courseId,
        tags: [...task.tags],
        priority: task.priority,
        estimateMin: task.estimateMin,
        type: task.type,
        weight: task.weight,
        subtasks: task.subtasks.map((s) => s.title),
      },
    };
    const replaced = this.templates.filter((x) => x.name === t.name);
    for (const r of replaced) db.deleteTemplate(r.id).catch(() => {});
    this.bury(
      'template',
      replaced.map((r) => r.id),
    );
    this.templates = [...this.templates.filter((x) => x.name !== t.name), t];
    db.putTemplate(t).catch((e) => console.error(e));
    emit('changed', { reason: 'template' });
    return t;
  },
  deleteTemplate(this: Store, id: string): void {
    const t = this.templates.find((x) => x.id === id);
    if (!t) return;
    this.templates = this.templates.filter((x) => x.id !== id);
    db.deleteTemplate(id).catch((e) => console.error(e));
    this.bury('template', [id]);
    undo.push({
      label: tr('toast.deletedTemplate', { name: t.name }),
      undo: () => {
        this.unbury('template', [id]);
        this.templates = [...this.templates, t];
        db.putTemplate(t).catch(() => {});
      },
    });
  },
  findTemplate(this: Store, name: string): Template | undefined {
    const n = name.toLowerCase();
    return this.templates.find((t) => t.name === n) ?? this.templates.find((t) => t.name.startsWith(n));
  },

  // ---------- day notes ----------
  saveDayNote(this: Store, date: string, note: string): void {
    const n: DayNote = { date, note };
    this.dayNotes = [...this.dayNotes.filter((x) => x.date !== date), n];
    db.putDayNote(n).catch((e) => console.error(e));
    emit('changed', { reason: 'note' });
  },
  dayNote(this: Store, date: string): string {
    return this.dayNotes.find((n) => n.date === date)?.note ?? '';
  },

  markRingCelebrated(this: Store, day: string): void {
    this.stats = { ...this.stats, ringCelebratedDate: day };
    this.persistStats();
  },
};
