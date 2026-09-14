import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as lib from './library';

function pdfFile(name: string, bytes = 'hello', over: { type?: string } = {}): File {
  return new File([bytes], name, { type: over.type ?? 'application/pdf' });
}

describe('library', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    lib.resetLibraryDBCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives a stable id from name and size', () => {
    expect(lib.bookId('a.pdf', 10)).toBe(lib.bookId('a.pdf', 10));
    expect(lib.bookId('a.pdf', 10)).not.toBe(lib.bookId('a.pdf', 11));
    expect(lib.bookId('a.pdf', 10)).not.toBe(lib.bookId('b.pdf', 10));
    expect(lib.bookId('a.pdf', 10)).toMatch(/^book_[0-9a-f]{16}$/);
  });

  it('adds a book and lists it without the blob', async () => {
    const added = await lib.addBook(pdfFile('chem.pdf', 'abcdef'), 'course1');
    expect(added.id).toBe(lib.bookId('chem.pdf', 6));
    expect(added.name).toBe('chem.pdf');
    expect(added.size).toBe(6);
    expect(added.type).toBe('application/pdf');
    expect(added.lastPage).toBe(1);
    expect(added.bookmarks).toEqual([]);
    expect(added.courseId).toBe('course1');
    expect(added.blob).toBeInstanceOf(Blob);

    const list = await lib.listBooks();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(added.id);
    expect('blob' in list[0]).toBe(false);
  });

  it('getBook returns the blob intact', async () => {
    const added = await lib.addBook(pdfFile('notes.pdf', 'PDF-BYTES'));
    const got = await lib.getBook(added.id);
    expect(got).toBeDefined();
    expect(await got!.blob.text()).toBe('PDF-BYTES');
    expect(await lib.getBook('nope')).toBeUndefined();
  });

  it('dedupes the same file by name and size', async () => {
    const a = await lib.addBook(pdfFile('same.pdf', '12345'));
    await lib.updateBook(a.id, { lastPage: 7 });
    const b = await lib.addBook(pdfFile('same.pdf', 'ABCDE'));
    expect(b.id).toBe(a.id);
    expect(b.lastPage).toBe(7); // existing entry is kept, not replaced
    expect(await lib.listBooks()).toHaveLength(1);
  });

  it('lists newest first', async () => {
    const old = await lib.addBook(pdfFile('old.pdf'));
    const fresh = await lib.addBook(pdfFile('new.pdf'));
    await lib.updateBook(old.id, { addedAt: '2026-09-01T00:00:00.000Z' });
    await lib.updateBook(fresh.id, { addedAt: '2026-09-02T00:00:00.000Z' });
    expect((await lib.listBooks()).map((b) => b.name)).toEqual(['new.pdf', 'old.pdf']);
  });

  it('updates a book and keeps its blob', async () => {
    const a = await lib.addBook(pdfFile('u.pdf', 'xyz'));
    const meta = await lib.updateBook(a.id, { lastPage: 12, pageCount: 40, bookmarks: [3, 12] });
    expect(meta).toMatchObject({ id: a.id, lastPage: 12, pageCount: 40, bookmarks: [3, 12] });
    expect(meta && 'blob' in meta).toBe(false);
    const got = await lib.getBook(a.id);
    expect(got?.lastPage).toBe(12);
    expect(await got!.blob.text()).toBe('xyz');
    expect(await lib.updateBook('missing', { lastPage: 2 })).toBeUndefined();
  });

  it('stores, lists and deletes highlights per file', async () => {
    const a = await lib.addBook(pdfFile('a.pdf'));
    const b = await lib.addBook(pdfFile('b.pdf'));
    await lib.addHighlight({ id: 'h2', fileId: a.id, page: 5, text: 'later', createdAt: '2026-09-01T00:00:01Z' });
    await lib.addHighlight({ id: 'h1', fileId: a.id, page: 2, text: 'earlier', createdAt: '2026-09-01T00:00:02Z' });
    await lib.addHighlight({ id: 'h3', fileId: b.id, page: 1, text: 'other book', createdAt: '2026-09-01T00:00:03Z' });

    const forA = await lib.listHighlights(a.id);
    expect(forA.map((h) => h.id)).toEqual(['h1', 'h2']); // sorted by page
    expect((await lib.listHighlights(b.id)).map((h) => h.id)).toEqual(['h3']);
    expect(await lib.listHighlights('none')).toEqual([]);

    await lib.deleteHighlight('h1');
    expect((await lib.listHighlights(a.id)).map((h) => h.id)).toEqual(['h2']);
  });

  it('deleting a book removes its highlights only', async () => {
    const a = await lib.addBook(pdfFile('a.pdf'));
    const b = await lib.addBook(pdfFile('b.pdf'));
    await lib.addHighlight({ id: 'h1', fileId: a.id, page: 1, text: 'x', createdAt: '2026-09-01T00:00:00Z' });
    await lib.addHighlight({ id: 'h2', fileId: b.id, page: 1, text: 'y', createdAt: '2026-09-01T00:00:00Z' });
    await lib.deleteBook(a.id);
    expect(await lib.getBook(a.id)).toBeUndefined();
    expect(await lib.listHighlights(a.id)).toEqual([]);
    expect((await lib.listHighlights(b.id)).map((h) => h.id)).toEqual(['h2']);
    expect((await lib.listBooks()).map((x) => x.id)).toEqual([b.id]);
    await expect(lib.deleteBook('missing')).resolves.toBeUndefined();
  });

  it('requestPersistentStorage uses navigator.storage.persist when available', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn(async () => true), persisted: vi.fn(async () => false) } });
    expect(await lib.requestPersistentStorage()).toBe(true);
    vi.stubGlobal('navigator', { storage: { persist: vi.fn(async () => false), persisted: vi.fn(async () => true) } });
    expect(await lib.requestPersistentStorage()).toBe(true); // already persisted
    vi.stubGlobal('navigator', {});
    expect(await lib.requestPersistentStorage()).toBe(false);
  });

  it('estimateUsage reports usage and quota or null', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: vi.fn(async () => ({ usage: 1234, quota: 5678 })) } });
    expect(await lib.estimateUsage()).toEqual({ usage: 1234, quota: 5678 });
    vi.stubGlobal('navigator', {});
    expect(await lib.estimateUsage()).toBeNull();
  });

  it('formats bytes', () => {
    expect(lib.formatBytes(512)).toBe('512 B');
    expect(lib.formatBytes(2048)).toBe('2 KB');
    expect(lib.formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(lib.formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
  });
});
