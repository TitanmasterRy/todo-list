// Store methods: files on tasks. The files live in IndexedDB on this device; the task's `attachments`
// list (names, sizes) syncs, so other devices know a file exists somewhere.
// Attached to Store.prototype in store.svelte.ts, so they're called as store.method(...) like the rest.
import * as db from '../storage';
import type { AttachmentMeta } from '../types';
import { uid } from '../id';
import { isoNow } from '../dates';
import { MAX_ATTACHMENT_BYTES, prepareFile } from '../attachments';
import type { Store } from '../store.svelte';

export const attachmentMethods = {
  /** Add files to a task. Big photos are shrunk first. Returns how many were added and which were too big. */
  async attachFiles(this: Store, taskId: string, files: File[]): Promise<{ added: number; tooBig: string[] }> {
    const tooBig: string[] = [];
    const metas: AttachmentMeta[] = [];
    for (const f of files) {
      const p = await prepareFile(f);
      if (p.blob.size > MAX_ATTACHMENT_BYTES) {
        tooBig.push(f.name);
        continue;
      }
      const meta: AttachmentMeta = { id: uid('att'), name: p.name.slice(0, 120) || 'file', type: p.type || 'application/octet-stream', size: p.blob.size, addedAt: isoNow() };
      await db.putAttachment({ id: meta.id, taskId, blob: p.blob });
      metas.push(meta);
    }
    const task = this.taskById(taskId);
    if (metas.length && task) {
      this.updateTask(taskId, { attachments: [...(task.attachments ?? []), ...metas] });
      // ask the browser not to evict our storage now that it holds files the user can't re-download
      void navigator.storage?.persist?.().catch(() => false);
    }
    return { added: metas.length, tooBig };
  },

  removeAttachment(this: Store, taskId: string, attachmentId: string): void {
    const task = this.taskById(taskId);
    if (!task) return;
    const rest = (task.attachments ?? []).filter((a) => a.id !== attachmentId);
    this.updateTask(taskId, { attachments: rest.length ? rest : undefined });
    void db.deleteAttachments([attachmentId]).catch(() => {});
  },

  /** An object URL for a stored file, or null when it's on another device. Revoke it when done. */
  async attachmentUrl(this: Store, attachmentId: string): Promise<string | null> {
    const a = await db.getAttachment(attachmentId).catch(() => undefined);
    return a ? URL.createObjectURL(a.blob) : null;
  },

  /** Delete stored files no task (or task in the trash) points to any more. */
  async collectAttachmentGarbage(this: Store): Promise<number> {
    const live = new Set<string>();
    for (const t of this.tasks) for (const a of t.attachments ?? []) live.add(a.id);
    for (const tb of this.tombstones) for (const a of tb.task?.attachments ?? []) live.add(a.id);
    const stored = await db.listAttachments().catch(() => []);
    const dead = stored.filter((s) => !live.has(s.id)).map((s) => s.id);
    if (dead.length) await db.deleteAttachments(dead).catch(() => {});
    return dead.length;
  },
};
