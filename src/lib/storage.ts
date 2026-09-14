import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Course, DayNote, Stats, Task, Template, Settings } from './types';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from './types';

interface TodoDB extends DBSchema {
  tasks: { key: string; value: Task; indexes: { byDue: string; byCourse: string } };
  courses: { key: string; value: Course };
  templates: { key: string; value: Template };
  meta: { key: string; value: unknown };
  dayNotes: { key: string; value: DayNote };
}

export const DB_NAME = 'homework-todo';
export const DB_VERSION = 1;
const SETTINGS_KEY = 'homework-todo:settings';

let dbPromise: Promise<IDBPDatabase<TodoDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TodoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TodoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
        tasks.createIndex('byDue', 'dueAt');
        tasks.createIndex('byCourse', 'courseId');
        db.createObjectStore('courses', { keyPath: 'id' });
        db.createObjectStore('templates', { keyPath: 'id' });
        db.createObjectStore('meta');
        db.createObjectStore('dayNotes', { keyPath: 'date' });
      },
    });
  }
  return dbPromise;
}

/** For tests: drop the cached connection so a fresh DB can be opened. */
export function resetDBCache(): void {
  dbPromise = null;
}

// ---------- Tasks ----------
export async function getAllTasks(): Promise<Task[]> {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function putTask(task: Task): Promise<void> {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function putTasks(tasks: Task[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all([...tasks.map((t) => tx.store.put(t)), tx.done]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function deleteTasks(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

// ---------- Courses ----------
export async function getAllCourses(): Promise<Course[]> {
  const db = await getDB();
  return db.getAll('courses');
}

export async function putCourse(course: Course): Promise<void> {
  const db = await getDB();
  await db.put('courses', course);
}

export async function deleteCourse(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('courses', id);
}

// ---------- Templates ----------
export async function getAllTemplates(): Promise<Template[]> {
  const db = await getDB();
  return db.getAll('templates');
}

export async function putTemplate(t: Template): Promise<void> {
  const db = await getDB();
  await db.put('templates', t);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

// ---------- Day notes ----------
export async function getAllDayNotes(): Promise<DayNote[]> {
  const db = await getDB();
  return db.getAll('dayNotes');
}

export async function putDayNote(n: DayNote): Promise<void> {
  const db = await getDB();
  await db.put('dayNotes', n);
}

// ---------- Stats (meta) ----------
export async function getStats(): Promise<Stats> {
  const db = await getDB();
  const s = (await db.get('meta', 'stats')) as Partial<Stats> | undefined;
  return { ...structuredClone(DEFAULT_STATS), ...(s ?? {}) };
}

export async function putStats(stats: Stats): Promise<void> {
  const db = await getDB();
  await db.put('meta', stats, 'stats');
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}

export async function putMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

// ---------- Wipe ----------
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tasks', 'courses', 'templates', 'meta', 'dayNotes'], 'readwrite');
  await Promise.all([
    tx.objectStore('tasks').clear(),
    tx.objectStore('courses').clear(),
    tx.objectStore('templates').clear(),
    tx.objectStore('meta').clear(),
    tx.objectStore('dayNotes').clear(),
    tx.done,
  ]);
}

/** Replace the whole dataset atomically (used by import and Gist sync). */
export async function replaceAll(data: {
  tasks: Task[];
  courses: Course[];
  templates: Template[];
  stats: Stats;
  dayNotes: DayNote[];
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tasks', 'courses', 'templates', 'meta', 'dayNotes'], 'readwrite');
  const tasks = tx.objectStore('tasks');
  const courses = tx.objectStore('courses');
  const templates = tx.objectStore('templates');
  const meta = tx.objectStore('meta');
  const notes = tx.objectStore('dayNotes');
  await Promise.all([tasks.clear(), courses.clear(), templates.clear(), notes.clear()]);
  await Promise.all([
    ...data.tasks.map((t) => tasks.put(t)),
    ...data.courses.map((c) => courses.put(c)),
    ...data.templates.map((t) => templates.put(t)),
    ...data.dayNotes.map((n) => notes.put(n)),
    meta.put(data.stats, 'stats'),
    tx.done,
  ]);
}

// ---------- Settings (localStorage) ----------
export function loadSettings(): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* ignore */
  }
}
