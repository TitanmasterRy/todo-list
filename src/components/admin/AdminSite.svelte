<script lang="ts">
  // Admin → Site: the announcement banner and feature switches everyone sees (public/site.json), and the GitHub
  // token that publishes it. Publishing commits the file to the repo; the deploy workflow rebuilds the site.
  import { adminAuth } from '../../lib/adminAuth.svelte';
  import { parseSite, repoFromLocation, siteJson, type AnnouncementLevel, type SiteFlags } from '../../lib/admin';
  import { site } from '../../lib/site.svelte';
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';

  const guess = repoFromLocation(location.hostname, location.pathname);
  let owner = $state(adminAuth.publishing.owner ?? guess.owner ?? '');
  let repo = $state(adminAuth.publishing.repo ?? guess.repo ?? '');
  let branch = $state(adminAuth.publishing.branch ?? guess.branch ?? 'main');
  let token = $state(adminAuth.publishing.token ?? '');
  let showToken = $state(false);

  const cur = site.config;
  let text = $state(cur.announcement?.text ?? '');
  let level = $state<AnnouncementLevel>(cur.announcement?.level ?? 'info');
  let link = $state(cur.announcement?.link ?? '');
  let until = $state(cur.announcement?.until ?? '');
  let flags = $state<Required<SiteFlags>>({
    casino: cur.flags.casino !== false,
    arcade: cur.flags.arcade !== false,
    shop: cur.flags.shop !== false,
    ai: cur.flags.ai !== false,
  });
  let busy = $state('');

  const FLAG_LABELS: Record<keyof SiteFlags, string> = {
    casino: '🎰 Casino',
    arcade: '🕹️ Arcade',
    shop: '🛍️ Item shop',
    ai: '✨ AI helper',
  };

  function config() {
    const offFlags: SiteFlags = {};
    for (const [k, v] of Object.entries(flags) as [keyof SiteFlags, boolean][]) if (!v) offFlags[k] = false;
    const keepId = cur.announcement && cur.announcement.text === text.trim() ? cur.announcement.id : `a${Date.now().toString(36)}`;
    return parseSite({ flags: offFlags, announcement: text.trim() ? { id: keepId, text, level, link: link || undefined, until: until || undefined } : undefined });
  }
  const json = $derived(siteJson(config()));

  const persist = () => adminAuth.savePublishing({ owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main', token: token.trim() });

  async function savePublishing() {
    busy = 'save';
    try {
      await persist();
      toasts.push({ message: 'Publishing settings saved (sealed with your admin passphrase)', kind: 'success' });
    } catch (e) {
      toasts.push({ message: 'Couldn’t save', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = '';
    }
  }

  async function testToken() {
    busy = 'test';
    try {
      await persist();
      const now = await adminAuth.read('public/site.json');
      toasts.push({
        message: 'The token works',
        detail: now === undefined ? 'public/site.json doesn’t exist yet; publishing will create it.' : 'It can read public/site.json.',
        kind: 'success',
      });
    } catch (e) {
      toasts.push({ message: 'The token didn’t work', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      busy = '';
    }
  }

  async function publish() {
    busy = 'publish';
    try {
      const url = await adminAuth.publish('public/site.json', json, text.trim() ? `Site announcement: ${text.trim().slice(0, 60)}` : 'Update site settings');
      site.config = config();
      toasts.push({ message: 'Published. The site redeploys in a minute or two.', detail: url || undefined, kind: 'success', emoji: '🚀', timeout: 10000 });
    } catch (e) {
      toasts.push({ message: 'Publishing failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 10000 });
    } finally {
      busy = '';
    }
  }

  function tryHere() {
    site.config = config();
    site.dismissed = null;
    toasts.push({ message: 'Applied on this device until the next reload', kind: 'info' });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      toasts.push({ message: 'Copied site.json', detail: 'Save it as public/site.json and redeploy.', kind: 'success' });
    } catch {
      prompt('Save this as public/site.json', json);
    }
  }
</script>

<section class="card">
  <h3>📣 Announcement</h3>
  <p class="muted">A banner at the top of the app for everyone. Each new text shows again, even to people who closed the last one.</p>
  <textarea
    class="input"
    rows="2"
    maxlength="300"
    bind:value={text}
    placeholder="e.g. New: Three Card Poker in the casino! (leave empty for no banner)"
    aria-label="Announcement text"
  ></textarea>
  <div class="row">
    <select class="select" bind:value={level} aria-label="Banner style">
      <option value="info">📣 Info</option>
      <option value="warn">⚠️ Warning</option>
      <option value="party">🎉 Celebration</option>
    </select>
    <input class="input grow" bind:value={link} placeholder="Link (https://…, optional)" aria-label="Announcement link" />
    <label>Until <input class="input" type="date" bind:value={until} min={store.today} aria-label="Show until" /></label>
  </div>
</section>

<section class="card">
  <h3>Feature switches</h3>
  <p class="muted">Turn a feature off for everyone (it's hidden in the app; people's coins and data are kept).</p>
  <div class="flags">
    {#each Object.keys(FLAG_LABELS) as k (k)}
      <label class="flag"><input type="checkbox" class="switch" bind:checked={flags[k as keyof SiteFlags]} /> {FLAG_LABELS[k as keyof SiteFlags]}</label>
    {/each}
  </div>
</section>

<section class="card">
  <h3>Publish</h3>
  <details>
    <summary class="muted">site.json preview</summary>
    <pre>{json}</pre>
  </details>
  <div class="row">
    <button class="btn sm" onclick={tryHere}>Try on this device</button>
    <button class="btn sm" onclick={() => void copy()}>Copy JSON</button>
    <span class="grow"></span>
    <button class="btn primary sm" onclick={() => void publish()} disabled={!adminAuth.canPublish || !!busy}>{busy === 'publish' ? 'Publishing…' : '🚀 Publish to the site'}</button
    >
  </div>
  {#if !adminAuth.canPublish}<p class="muted">Set up publishing below to publish in one click, or copy the JSON into <code>public/site.json</code> yourself.</p>{/if}
</section>

<section class="card">
  <h3>Publishing (GitHub)</h3>
  <p class="muted">
    A fine-grained token for just this repository with <strong>Contents: read and write</strong> (github.com → Settings → Developer settings → Fine-grained tokens). It's sealed with
    your admin passphrase, stays on this device and is never synced. Anyone with this token can change your site, so don't share it.
  </p>
  <div class="row">
    <input class="input" bind:value={owner} placeholder="owner" aria-label="Repository owner" />
    <span>/</span>
    <input class="input" bind:value={repo} placeholder="repo" aria-label="Repository name" />
    <label>Branch <input class="input br" bind:value={branch} aria-label="Branch" /></label>
  </div>
  <div class="row">
    <input class="input grow" type={showToken ? 'text' : 'password'} bind:value={token} placeholder="github_pat_…" aria-label="GitHub token" autocomplete="off" />
    <button class="btn ghost sm" onclick={() => (showToken = !showToken)}>{showToken ? 'Hide' : 'Show'}</button>
    <button class="btn sm" onclick={() => void savePublishing()} disabled={!!busy}>Save</button>
    <button class="btn sm" onclick={() => void testToken()} disabled={!!busy || !token}>{busy === 'test' ? 'Testing…' : 'Test'}</button>
  </div>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
    margin: 4px 0 8px;
  }
  textarea {
    width: 100%;
    font-family: inherit;
    resize: vertical;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    font-size: 13px;
  }
  .row label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }
  .row .select,
  .row .input {
    width: auto;
  }
  .row .grow,
  .grow {
    flex: 1;
    min-width: 160px;
  }
  .br {
    width: 110px;
  }
  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .flag {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px;
    font-size: 12px;
    overflow: auto;
    max-height: 240px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
  }
</style>
