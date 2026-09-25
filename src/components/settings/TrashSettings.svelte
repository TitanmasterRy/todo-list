<script lang="ts">
  // Settings → Trash: deleted tasks kept for 30 days.
  import { store } from '../../lib/store.svelte';
</script>

<section class="card">
  <h2>Trash <span class="muted">{store.trash.length}</span></h2>
  <p class="help">Deleted tasks stay here for 30 days. Deletions also sync, so a task deleted on one device is removed on the others.</p>
  {#if store.trash.length}
    <ul class="trash">
      {#each store.trash.slice(0, 50) as t (t.id)}
        <li>
          <span class="t-title">{t.task.title}</span>
          <span class="muted">{new Date(t.deletedAt).toLocaleDateString()}</span>
          <button class="btn sm" onclick={() => store.restoreFromTrash(t.id)}>Restore</button>
        </li>
      {/each}
    </ul>
    <div class="btns"><button class="btn ghost sm" onclick={() => store.emptyTrash()}>Empty trash</button></div>
  {:else}
    <p class="muted">Nothing here.</p>
  {/if}
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  .trash {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    max-height: 260px;
    overflow: auto;
  }
  .trash li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .t-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
</style>
