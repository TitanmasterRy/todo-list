<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { ui } from '../lib/ui.svelte';
  const groups: { title: string; keys: [string, string][] }[] = [
    {
      title: 'Global',
      keys: [
        ['n', 'New task (focus quick add)'],
        ['/', 'Search'],
        ['Ctrl K', 'Command palette'],
        ['Ctrl Z', 'Undo last action'],
        ['1 – 9', 'Switch view (Today, Upcoming, Courses, Inbox, Focus, Stats, Tools, Schoology, Play)'],
        ['?', 'This sheet'],
        ['Esc', 'Close / clear selection'],
      ],
    },
    {
      title: 'Tasks',
      keys: [
        ['j / k', 'Move down / up'],
        ['Enter', 'Open task'],
        ['e', 'Edit task'],
        ['Space', 'Complete task'],
        ['s', 'Snooze menu'],
        ['w', 'What should I do now?'],
        ['[ / ]', 'Move selected task a day earlier / later'],
        ['x', 'Select for bulk actions'],
        ['f', 'Focus on task'],
        ['d', 'Duplicate task'],
        ['Del', 'Delete task'],
        ['Shift click', 'Select a range'],
      ],
    },
    {
      title: 'Quick add syntax',
      keys: [
        ['tomorrow 8pm', 'Due date and time (today, mon, next fri, in 3 days, 9/21, sep 21)'],
        ['#calc', 'Course (falls back to a tag)'],
        ['!high', 'Priority: !low !high !urgent'],
        ['~45m', 'Estimate: ~30m ~2h'],
        ['every mon wed', 'Repeat: every day, every 3 days, weekdays'],
        ['@name', 'New from template'],
      ],
    },
  ];
</script>

<div class="modal-backdrop" onclick={() => (ui.shortcuts = false)} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div use:focusTrap class="modal sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1" onclick={(e) => e.stopPropagation()}>
    <h2>Keyboard shortcuts</h2>
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
    <div class="actions"><button class="btn" onclick={() => (ui.shortcuts = false)}>Close <span class="kbd">Esc</span></button></div>
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
