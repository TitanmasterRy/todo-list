import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the Supabase client: auth + one `user_data` table with the query
// shapes account.svelte.ts uses (select/maybeSingle, insert, conditional update, delete).
const db = new Map<string, { data: unknown; version: number }>();
let beforeUpdate: (() => void) | null = null;
const users = new Map<string, { id: string; password: string }>();
let session: { user: { id: string; email: string } } | null = null;

function table() {
  const filters: Record<string, unknown> = {};
  let op: 'select' | 'update' | 'delete' = 'select';
  let patch: { data: unknown; version: number } | null = null;
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => ((filters[k] = v), q),
    maybeSingle: async () => {
      const row = db.get(filters.user_id as string);
      return { data: row ? structuredClone(row) : null, error: null };
    },
    insert: async (r: { user_id: string; data: unknown; version: number }) => {
      if (db.has(r.user_id)) return { error: { message: 'duplicate key value violates unique constraint' } };
      db.set(r.user_id, { data: structuredClone(r.data), version: r.version });
      return { error: null };
    },
    update: (p: { data: unknown; version: number }) => ((op = 'update'), (patch = p), q),
    delete: () => ((op = 'delete'), q),
    then: (resolve: (v: unknown) => void) => {
      const id = filters.user_id as string;
      if (op === 'delete') {
        db.delete(id);
        return resolve({ error: null });
      }
      if (op === 'update') {
        beforeUpdate?.();
        beforeUpdate = null;
        const row = db.get(id);
        if (!row || row.version !== filters.version) return resolve({ data: [], error: null });
        db.set(id, { data: structuredClone(patch!.data), version: patch!.version });
        return resolve({ data: [{ version: patch!.version }], error: null });
      }
      resolve({ data: [], error: null });
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => table(),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session } }),
      signUp: async ({ email, password }: { email: string; password: string }) => {
        if (users.has(email)) return { data: { user: { identities: [] }, session: null }, error: null };
        const id = `u_${users.size + 1}`;
        users.set(email, { id, password });
        session = { user: { id, email } };
        return { data: { user: { id, email, identities: [{}] }, session }, error: null };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const u = users.get(email);
        if (!u || u.password !== password) return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        session = { user: { id: u.id, email } };
        return { data: { session }, error: null };
      },
      signOut: async () => ((session = null), { error: null }),
    },
  }),
}));

vi.stubGlobal('location', { origin: 'http://localhost:5173' });
const { store } = await import('./store.svelte');
const acct = await import('./account.svelte');

describe('email/password accounts', () => {
  beforeEach(() => {
    db.clear();
    users.clear();
    session = null;
    store.updateSettings({ accountUrl: 'https://example.supabase.co', accountAnonKey: 'anon' });
  });

  it('validates credentials', () => {
    expect(acct.validateCredentials('nope', 'longenough')).toMatch(/email/);
    expect(acct.validateCredentials('a@b.co', 'short')).toMatch(/8 characters/);
    expect(acct.validateCredentials('a@b.co', 'longenough')).toBeNull();
  });

  it('signs up, rejects duplicates and wrong passwords', async () => {
    await acct.reconfigure();
    expect(await acct.signUp('me@school.edu', 'correct horse')).toBe('signedIn');
    expect(acct.account.email).toBe('me@school.edu');
    await expect(acct.signUp('me@school.edu', 'correct horse')).rejects.toThrow(/already has an account/);
    await acct.signOut();
    await expect(acct.signIn('me@school.edu', 'wrong password')).rejects.toThrow(/Wrong email or password/);
    await acct.signIn('me@school.edu', 'correct horse');
    expect(acct.account.userId).toBe('u_1');
  });

  it('first sync uploads, later syncs merge the server copy in', async () => {
    await acct.reconfigure();
    await acct.signUp('sync@school.edu', 'password123');
    store.addTask({ title: 'Local task' }, { undoable: false, describe: false });
    await acct.syncNow();
    const row = db.get(acct.account.userId!)!;
    expect(row.version).toBe(1);
    expect((row.data as { tasks: { title: string }[] }).tasks.map((t) => t.title)).toContain('Local task');

    // another device adds a task on the server
    const other = structuredClone(row.data) as { tasks: { id: string; title: string }[] };
    other.tasks.push({ ...other.tasks[0], id: 't_other', title: 'From phone' });
    db.set(acct.account.userId!, { data: other, version: 2 });
    await acct.syncNow();
    expect(store.tasks.map((t) => t.title)).toContain('From phone');
    expect(acct.account.status).toBe('ok');
  });

  it('retries instead of overwriting when another device writes mid-sync', async () => {
    await acct.reconfigure();
    await acct.signUp('race@school.edu', 'password123');
    await acct.syncNow();
    const uid = acct.account.userId!;
    store.addTask({ title: 'Laptop edit' }, { undoable: false, describe: false });
    // just before our conditional update lands, the phone writes a new version with its own task
    beforeUpdate = () => {
      const cur = db.get(uid)!;
      const d = structuredClone(cur.data) as { tasks: { id: string; title: string }[] };
      d.tasks.push({ ...(d.tasks[0] ?? store.snapshotBundle().tasks[0]), id: 't_phone', title: 'Phone edit' });
      db.set(uid, { data: d, version: cur.version + 1 });
    };
    await acct.syncNow();
    const titles = (db.get(uid)!.data as { tasks: { title: string }[] }).tasks.map((t) => t.title);
    expect(titles).toContain('Laptop edit');
    expect(titles).toContain('Phone edit');
  });
});
