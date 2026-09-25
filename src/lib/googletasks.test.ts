import { describe, expect, it } from 'vitest';
import { importGoogleTasks } from './googletasks';

const TAKEOUT = JSON.stringify({
  kind: 'tasks#taskLists',
  items: [
    {
      kind: 'tasks#taskList',
      title: 'My Tasks',
      items: [
        { kind: 'tasks#task', id: 'a', title: 'Essay draft', notes: 'Three sources', status: 'needsAction', due: '2026-10-09T00:00:00.000Z' },
        { kind: 'tasks#task', id: 'b', title: 'Outline', status: 'completed', parent: 'a' },
        { kind: 'tasks#task', id: 'c', title: '', status: 'needsAction' },
      ],
    },
    { kind: 'tasks#taskList', title: 'AP Bio', items: [{ kind: 'tasks#task', id: 'd', title: 'Lab 3', status: 'completed' }] },
  ],
});

describe('Google Tasks import', () => {
  it('reads a Takeout Tasks.json', () => {
    const r = importGoogleTasks(TAKEOUT)!;
    expect(r.lists).toEqual(['My Tasks', 'AP Bio']);
    expect(r.skipped).toBe(1);
    expect(r.tasks).toEqual([
      { title: 'Essay draft', notes: 'Three sources', dueAt: '2026-10-09', priority: 'normal', tags: [], done: false, subtasks: ['Outline'] },
      { title: 'Lab 3', notes: undefined, dueAt: undefined, priority: 'normal', tags: ['ap-bio'], done: true, subtasks: [] },
    ]);
  });
  it('says no to other JSON', () => {
    expect(importGoogleTasks('{"tasks":[]}')).toBeNull();
    expect(importGoogleTasks('not json')).toBeNull();
    expect(importGoogleTasks(JSON.stringify({ kind: 'drive#file', items: [] }))).toBeNull();
  });
});
