<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { ui } from '../lib/ui.svelte';
  import { t } from '../lib/i18n/index.svelte';
  const groups: { title: string; keys: [string, string][] }[] = $derived([
    {
      title: t('keys.global'),
      keys: [
        ['n', t('keys.new')],
        ['/', t('keys.search')],
        ['Ctrl K', t('nav.palette')],
        ['Ctrl Z', t('keys.undo')],
        ['1 – 9', t('keys.views')],
        ['?', t('keys.sheet')],
        ['Esc', t('keys.esc')],
      ],
    },
    {
      title: t('keys.tasks'),
      keys: [
        ['j / k', t('keys.move')],
        ['Enter', t('keys.open')],
        ['e', t('editor.label')],
        [t('keys.spaceKey'), t('keys.complete')],
        ['s', t('keys.snooze')],
        ['w', t('cmd.whatNow')],
        ['[ / ]', t('keys.shift')],
        ['x', t('keys.bulk')],
        ['f', t('keys.focus')],
        ['d', t('keys.duplicate')],
        ['Del', t('keys.delete')],
        [t('keys.shiftClick'), t('keys.range')],
      ],
    },
    {
      title: t('keys.syntax'),
      keys: [
        [t('keys.exDate'), t('keys.date')],
        [t('keys.exCourse'), t('keys.course')],
        [t('keys.exPriority'), t('keys.priority')],
        ['~45m', t('keys.estimate')],
        [t('keys.exRepeat'), t('keys.repeat')],
        [t('keys.exTemplate'), t('keys.template')],
      ],
    },
  ]);
</script>

<div class="modal-backdrop" onclick={() => (ui.shortcuts = false)} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal sheet" role="dialog" aria-modal="true" aria-label={t('keys.title')} tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h2>{t('keys.title')}</h2>
    <div class="cols">
      {#each groups as g}
        <section>
          <h3>{g.title}</h3>
          <dl>
            {#each g.keys as [k, d]}
              <div>
                <dt>
                  {#each k.split(' ') as part}<span class="kbd">{part}</span>{/each}
                </dt>
                <dd>{d}</dd>
              </div>
            {/each}
          </dl>
        </section>
      {/each}
    </div>
    <div class="actions"><button class="btn" onclick={() => (ui.shortcuts = false)}>{t('common.close')} <span class="kbd">Esc</span></button></div>
  </div>
</div>

<style>
  .sheet {
    max-width: 760px;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  dl > div {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-size: 13px;
  }
  dt {
    min-width: 92px;
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }
  dd {
    margin: 0;
    color: var(--text-muted);
  }
</style>
