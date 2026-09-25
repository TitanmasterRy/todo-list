<script lang="ts">
  // Settings → Templates: saved task templates for @name in quick add.
  import { store } from '../../lib/store.svelte';
  import { t } from '../../lib/i18n/index.svelte';
</script>

<section class="card">
  <h2>{t('settings.templates')} <span class="muted">{store.templates.length}</span></h2>
  {#if !store.templates.length}
    <p class="help">Save any task as a template from the task editor, then type <code>@name</code> in quick add.</p>
  {/if}
  <ul class="list">
    {#each store.templates as t (t.id)}
      <li>
        <span class="mono">@{t.name}</span>
        <span class="muted grow">{t.task.title}{t.task.subtasks.length ? ` · ${t.task.subtasks.length} subtasks` : ''}</span>
        <button
          class="btn ghost sm"
          onclick={() => {
            store.addTask({
              title: t.task.title,
              notes: t.task.notes,
              courseId: t.task.courseId,
              tags: [...t.task.tags],
              priority: t.task.priority,
              estimateMin: t.task.estimateMin,
              type: t.task.type,
              weight: t.task.weight,
              subtasks: [...t.task.subtasks],
              templateId: t.id,
            });
            store.go('inbox');
          }}>Use</button
        >
        <button class="btn ghost sm" onclick={() => store.deleteTemplate(t.id)}>Delete</button>
      </li>
    {/each}
  </ul>
</section>

<style>
  section {
    margin-bottom: 12px;
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
  .help code,
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 13px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
</style>
