<script lang="ts">
  // Calendar export: download due dates as an .ics file.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { addDaysKey, dueKey } from '../../lib/dates';
  import { buildICS } from '../../lib/ics';
  import { downloadText } from '../../lib/download';

  let includeDone = $state(false);
  let horizon = $state<'all' | '30' | '90'>('all');
  const calTasks = $derived(
    store.tasks.filter((t) => {
      if (!t.dueAt || t.archived) return false;
      if (!includeDone && t.completedAt) return false;
      if (horizon !== 'all' && dueKey(t.dueAt) > addDaysKey(store.today, Number(horizon))) return false;
      return true;
    }),
  );
  function exportICS() {
    downloadText('homework-todo.ics', buildICS(calTasks, store.courses), 'text/calendar');
    toasts.push({
      message: `Exported ${calTasks.length} event${calTasks.length === 1 ? '' : 's'}`,
      detail: 'Import homework-todo.ics into your calendar app.',
      kind: 'success',
      emoji: '📆',
    });
  }
</script>

<section class="card">
  <h2>Calendar export</h2>
  <p class="help">
    Download an <code>.ics</code> file of your due dates and import it into Google Calendar, Apple Calendar, or Outlook. Exams and quizzes get a reminder one day before. Re-export after
    changes; most calendars update events with the same id on re-import.
  </p>
  <div class="grid2">
    <label
      >Range
      <select class="select" bind:value={horizon}>
        <option value="30">Next 30 days</option>
        <option value="90">Next 90 days</option>
        <option value="all">Everything</option>
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={includeDone} /> Include completed tasks</label>
  </div>
  <p class="muted">{calTasks.length} event{calTasks.length === 1 ? '' : 's'} will be exported.</p>
  <button class="btn primary" onclick={exportICS} disabled={!calTasks.length}>Download homework-todo.ics</button>
  <details class="how">
    <summary>How to import</summary>
    <ul>
      <li><strong>Google Calendar:</strong> Settings → Import &amp; export → Import → choose the file and a calendar.</li>
      <li><strong>Apple Calendar:</strong> File → Import, or open the file on iPhone and tap Add All.</li>
      <li><strong>Outlook:</strong> File → Open &amp; Export → Import/Export → Import an iCalendar file.</li>
    </ul>
  </details>
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 8px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 10px;
  }
  .help code {
    font-family: var(--mono);
    font-size: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
  }
  .grid2 label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }
  .grid2 label.check {
    flex-direction: row;
    align-items: center;
    align-self: end;
    padding-bottom: 8px;
  }
  .how {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .how ul {
    padding-left: 18px;
  }
</style>
