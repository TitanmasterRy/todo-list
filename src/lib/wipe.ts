// "Delete everything": this device's data, and (if asked) the synced copies on GitHub, Google Drive and the
// account server. Remote deletions run first, while the tokens still exist; each one is best effort and
// reports its own result, and the local wipe happens whatever they return.
import { store } from './store.svelte';
import { hasSecret } from './secrets.svelte';
import { deleteGist, disconnect as disconnectGist } from './gist.svelte';
import { deleteDriveFile, signOut as googleSignOut } from './google.svelte';
import { account, deleteServerData, signOut as accountSignOut } from './account.svelte';
import { logout as spotifyLogout } from './spotify.svelte';
import { t } from './i18n/index.svelte';

export type RemoteId = 'gist' | 'drive' | 'account';

export interface RemoteCopy {
  id: RemoteId;
  label: string;
  detail: string;
}

export interface WipeResult {
  id: RemoteId | 'local';
  label: string;
  ok: boolean;
  message: string;
}

/** The synced copies that exist for this device's connections. */
export function remoteCopies(): RemoteCopy[] {
  const s = store.settings;
  const out: RemoteCopy[] = [];
  if (hasSecret('gistToken') && s.gistId) out.push({ id: 'gist', label: 'GitHub Gist', detail: t('wipe.gist', { id: s.gistId.slice(0, 8) }) });
  if (s.googleSyncEnabled || s.googleDriveFileId) out.push({ id: 'drive', label: t('wipe.driveLabel'), detail: t('wipe.drive') });
  if (account.userId) out.push({ id: 'account', label: t('wipe.accountLabel'), detail: t('wipe.account', { email: account.email ?? t('wipe.yourAccount') }) });
  return out;
}

async function removeRemote(id: RemoteId): Promise<boolean> {
  if (id === 'gist') return deleteGist();
  if (id === 'drive') return deleteDriveFile();
  await deleteServerData();
  return true;
}

const LABEL: Record<RemoteId, () => string> = { gist: () => 'GitHub Gist', drive: () => t('wipe.driveLabel'), account: () => t('wipe.accountLabel') };

/** Delete the chosen remote copies, then everything on this device. */
export async function deleteEverything(remote: RemoteId[]): Promise<WipeResult[]> {
  const results: WipeResult[] = [];
  for (const id of remote) {
    try {
      const existed = await removeRemote(id);
      results.push({ id, label: LABEL[id](), ok: true, message: existed ? t('wipe.deleted') : t('wipe.nothing') });
    } catch (e) {
      results.push({ id, label: LABEL[id](), ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  }
  // stop every connection so nothing syncs the (now empty) data back up
  disconnectGist();
  googleSignOut();
  spotifyLogout();
  if (account.userId) await accountSignOut().catch(() => undefined);
  try {
    await store.resetAll();
    // tool drafts, arcade scores, reminder bookkeeping, the account session, the key vault…
    for (const k of Object.keys(localStorage)) if (k.startsWith('homework-todo:') && k !== 'homework-todo:settings') localStorage.removeItem(k);
    results.push({ id: 'local', label: t('wipe.local'), ok: true, message: t('wipe.deleted') });
  } catch (e) {
    results.push({ id: 'local', label: t('wipe.local'), ok: false, message: e instanceof Error ? e.message : String(e) });
  }
  return results;
}
