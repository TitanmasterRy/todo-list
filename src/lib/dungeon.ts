// Homework dungeon (Play → Dungeon): each course is a floor and each of its tasks a room. Finishing a task opens its
// room; open tasks are locked doors ahead. Rooms run in a snake across the floor so every room touches the next one.
// Pure mapping from courses and tasks to a map, unit-tested.
import type { Course, Task } from './types';

export type RoomKind = 'boss' | 'library' | 'forge' | 'treasure' | 'hall';

export const ROOM_ICON: Record<RoomKind, string> = { boss: '🐉', library: '📚', forge: '⚒️', treasure: '💎', hall: '🕯️' };
export const ROOM_LABEL: Record<RoomKind, string> = { boss: 'Boss lair', library: 'Library', forge: 'Forge', treasure: 'Treasure room', hall: 'Hall' };

export interface Room {
  taskId: string;
  title: string;
  kind: RoomKind;
  open: boolean;
  col: number;
  row: number;
  due?: string;
  completedAt?: string;
}

export interface Floor {
  id: string; // course id, or 'commons'
  level: number; // 1 = ground floor
  name: string;
  emoji: string;
  color: string;
  rooms: Room[];
  opened: number;
  cleared: boolean;
  cols: number;
  rows: number;
  hidden: number; // older open rooms left off the map
}

export const COLS = 6;
export const MAX_ROOMS = 48;

export function roomKind(t: Pick<Task, 'type' | 'priority'>): RoomKind {
  if (t.type === 'exam' || t.type === 'quiz') return 'boss';
  if (t.type === 'reading') return 'library';
  if (t.type === 'project') return 'forge';
  if (t.priority === 'high' || t.priority === 'urgent') return 'treasure';
  return 'hall';
}

/** Where room `i` sits: left to right on even rows, right to left on odd rows. */
export function snake(i: number, cols = COLS): { col: number; row: number } {
  const row = Math.floor(i / cols);
  const k = i % cols;
  return { row, col: row % 2 === 0 ? k : cols - 1 - k };
}

const byTime = (a?: string, b?: string) => (a ?? '9999').localeCompare(b ?? '9999');

/** One floor per active course (in course order), plus the Commons for tasks without a course. */
export function buildDungeon(courses: Course[], tasks: Task[], opts: { cols?: number; maxRooms?: number } = {}): Floor[] {
  const cols = opts.cols ?? COLS;
  const max = opts.maxRooms ?? MAX_ROOMS;
  const active = courses.filter((c) => !c.archived);
  const known = new Set(active.map((c) => c.id));
  const groups: { id: string; name: string; emoji: string; color: string; tasks: Task[] }[] = active.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji ?? '🏰',
    color: c.color,
    tasks: tasks.filter((t) => t.courseId === c.id),
  }));
  const loose = tasks.filter((t) => !t.courseId || !known.has(t.courseId));
  if (loose.length) groups.push({ id: 'commons', name: 'The Commons', emoji: '🏚️', color: '#8e7cc3', tasks: loose });
  return groups.map((g, level) => {
    // explored rooms first (in the order you opened them), then the locked doors ahead (soonest due first)
    const done = g.tasks.filter((t) => t.completedAt).sort((a, b) => byTime(a.completedAt, b.completedAt));
    const todo = g.tasks.filter((t) => !t.completedAt).sort((a, b) => byTime(a.dueAt, b.dueAt) || byTime(a.createdAt, b.createdAt));
    let list = [...done, ...todo];
    let hidden = 0;
    if (list.length > max) {
      // keep the newest explored rooms and as many doors ahead as fit
      const ahead = todo.slice(0, Math.min(todo.length, Math.ceil(max / 3)));
      const behind = done.slice(-(max - ahead.length));
      hidden = list.length - ahead.length - behind.length;
      list = [...behind, ...ahead];
    }
    const rooms = list.map((t, i) => ({
      taskId: t.id,
      title: t.title,
      kind: roomKind(t),
      open: !!t.completedAt,
      ...snake(i, cols),
      due: t.dueAt,
      completedAt: t.completedAt,
    }));
    const opened = g.tasks.filter((t) => t.completedAt).length;
    return {
      id: g.id,
      level: level + 1,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      rooms,
      opened,
      cleared: g.tasks.length > 0 && opened === g.tasks.length,
      cols,
      rows: Math.max(1, Math.ceil(rooms.length / cols)),
      hidden,
    };
  });
}

/** Totals for the header: rooms opened, floors cleared. */
export function dungeonSummary(floors: Floor[]): { opened: number; rooms: number; cleared: number } {
  return {
    opened: floors.reduce((a, f) => a + f.opened, 0),
    rooms: floors.reduce((a, f) => a + f.rooms.length + f.hidden, 0),
    cleared: floors.filter((f) => f.cleared).length,
  };
}
