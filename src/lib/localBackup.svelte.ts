// "Never lose data": persistent storage + automatic JSON backups into a folder the user picks (File System Access API).
import { openDB } from 'idb';
import { store } from './store.svelte';
import { on } from './events';

type DirHandle = FileSystemDirectoryHandle;

const HANDLE_DB = 'homework-todo-handles';
let handle: DirHandle | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

export function folderBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export async function isPersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

async function handleStore() {
  return openDB(HANDLE_DB, 1, {
    upgrade(db) {
      db.createObjectStore('handles');
    },
  });
}

export async function loadHandle(): Promise<DirHandle | null> {
  if (!folderBackupSupported()) return null;
  try {
    const db = await handleStore();
    handle = ((await db.get('handles', 'backupDir')) as DirHandle | undefined) ?? null;
    return handle;
  } catch {
    return null;
  }
}

export async function chooseFolder(): Promise<string> {
  const picker = (window as unknown as { showDirectoryPicker: (o?: { mode?: string }) => Promise<DirHandle> }).showDirectoryPicker;
  const h = await picker({ mode: 'readwrite' });
  const db = await handleStore();
  await db.put('handles', h, 'backupDir');
  handle = h;
  store.updateSettings({ localBackupEnabled: true });
  await writeBackup();
  return h.name;
}

export async function forgetFolder(): Promise<void> {
  const db = await handleStore();
  await db.delete('handles', 'backupDir');
  handle = null;
  store.updateSettings({ localBackupEnabled: false });
}

export function folderName(): string | null {
  return handle?.name ?? null;
}

async function ensurePermission(): Promise<boolean> {
  if (!handle) return false;
  const h = handle as unknown as { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
  const q = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  if (q === 'granted') return true;
  return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

/** Write homework-todo-backup.json (and a dated copy once per day) into the chosen folder. */
export async function writeBackup(): Promise<boolean> {
  if (!handle || !(await ensurePermission())) return false;
  const bundle = store.snapshotBundle();
  const json = JSON.stringify(bundle, null, 2);
  const write = async (name: string) => {
    const f = await handle!.getFileHandle(name, { create: true });
    const w = await f.createWritable();
    await w.write(json);
    await w.close();
  };
  await write('homework-todo-backup.json');
  const day = store.today;
  const last = store.settings.lastLocalBackupAt?.slice(0, 10);
  if (last !== day) await write(`homework-todo-${day}.json`);
  store.updateSettings({ lastLocalBackupAt: new Date().toISOString(), lastExportAt: new Date().toISOString() });
  return true;
}

export function scheduleBackup(): void {
  if (!handle) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void writeBackup().catch((e) => console.warn('local backup failed', e)), 5000);
}

export async function startLocalBackup(): Promise<void> {
  if (started) return;
  started = true;
  await loadHandle();
  on('changed', () => scheduleBackup());
}
