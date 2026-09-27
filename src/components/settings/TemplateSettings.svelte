<script lang="ts">
  // Settings → Templates: saved task templates for @name in quick add.
  import { store } from '../../lib/store.svelte';
  import { t } from '../../lib/i18n/index.svelte';
</script>

<section class="card">
  <h2>{t('settings.templates')} <span class="muted">{store.templates.length}</span></h2>
  {#if !store.templates.length}
    <p class="help">{t('tpl.help')} <code>@name</code> {t('tpl.help2')}</p>
  {/if}
  <ul class="list">
    {#each store.templates as tpl (tpl.id)}
      <li>
        <span class="mono">@{tpl.name}</span>
        <span class="muted grow">{tpl.task.title}{tpl.task.subtasks.length ? ` · ${t('tpl.subtasks', { count: tpl.task.subtasks.length })}` : ''}</span>
        <button
          class="btn ghost sm"
          onclick={() => {
            store.addTask({
              title: tpl.task.title,
              notes: tpl.task.notes,
              courseId: tpl.task.courseId,
              tags: [...tpl.task.tags],
              priority: tpl.task.priority,
              estimateMin: tpl.task.estimateMin,
              type: tpl.task.type,
              weight: tpl.task.weight,
              subtasks: [...tpl.task.subtasks],
              templateId: tpl.id,
            });
            store.go('inbox');
          }}>{t('tpl.use')}</button
        >
        <button class="btn ghost sm" onclick={() => store.deleteTemplate(tpl.id)}>{t('common.delete')}</button>
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
