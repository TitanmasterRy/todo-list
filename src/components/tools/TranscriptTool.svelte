<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { summarize, letterGrade } from '../../lib/grades';
  import { gpa, groupByTerm, pointsFor, transcriptCSV, type TranscriptRow } from '../../lib/gpa';
  import { downloadText } from '../../lib/download';

  const rows = $derived.by((): TranscriptRow[] =>
    store.courses.map((c) => {
      const items = store.tasks.filter((t) => t.courseId === c.id && (t.weight ?? 0) > 0 && !t.archived).map((t) => ({ weight: t.weight!, score: t.score }));
      const calc = summarize(items).current;
      const grade = typeof c.finalGrade === 'number' ? c.finalGrade : calc;
      return {
        courseId: c.id,
        name: `${c.emoji ? c.emoji + ' ' : ''}${c.name}${c.archived ? ' (archived)' : ''}`,
        term: c.term ?? '',
        credits: c.credits ?? 1,
        grade,
        letter: grade === null ? null : letterGrade(grade),
        points: grade === null ? null : pointsFor(grade),
      };
    }),
  );
  const terms = $derived(groupByTerm(rows));
  const overall = $derived(gpa(rows));
</script>

<section class="card transcript" id="transcript">
  <div class="head">
    <div>
      <h2>Transcript</h2>
      <p class="help">Grades come from the grade calculator, or a final-grade override set on the course. Set credits and term on each course (Courses → edit).</p>
    </div>
    <div class="btns no-print">
      <button class="btn sm" onclick={() => downloadText('transcript.csv', transcriptCSV(rows), 'text/csv')} disabled={!rows.length}>Export CSV</button>
      <button class="btn sm" onclick={() => window.print()} disabled={!rows.length}>Print / PDF</button>
    </div>
  </div>
  {#if !rows.length}
    <p class="help">No courses yet.</p>
  {/if}
  {#each terms as t (t.term)}
    {@const g = gpa(t.rows)}
    <h3>{t.term} <span class="muted">{g.gpa === null ? 'no grades yet' : `GPA ${g.gpa.toFixed(2)}`} · {g.credits} credit{g.credits === 1 ? '' : 's'}</span></h3>
    <table>
      <thead><tr><th>Course</th><th>Credits</th><th>Grade</th><th>Letter</th><th>Points</th></tr></thead>
      <tbody>
        {#each t.rows as r (r.courseId)}
          <tr>
            <td><button class="link no-print" onclick={() => (ui.courseEditor = r.courseId)}>{r.name}</button><span class="print-only">{r.name}</span></td>
            <td>{r.credits}</td>
            <td>{r.grade === null ? '—' : r.grade.toFixed(1) + '%'}</td>
            <td class="letter">{r.letter ?? '—'}</td>
            <td>{r.points === null ? '—' : r.points.toFixed(1)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/each}
  {#if rows.length}
    <div class="summary">
      <span>Cumulative GPA</span>
      <strong>{overall.gpa === null ? '—' : overall.gpa.toFixed(2)}</strong>
      <span class="muted">{overall.gradedCredits} of {overall.credits} credits graded · 4.0 scale (A 4.0, A− 3.7, B+ 3.3 …)</span>
    </div>
  {/if}
</section>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 4px;
  }
  h3 {
    font-size: 14px;
    margin: 14px 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 400;
  }
  .btns {
    display: flex;
    gap: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 6px;
    border-bottom: 1px solid var(--border);
  }
  .letter {
    font-weight: 700;
  }
  .link {
    color: var(--text);
    text-align: left;
  }
  .link:hover {
    color: var(--accent);
  }
  .print-only {
    display: none;
  }
  .summary {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 14px;
    flex-wrap: wrap;
  }
  .summary strong {
    font-size: 24px;
  }
  @media print {
    :global(body *) {
      visibility: hidden;
    }
    :global(#transcript),
    :global(#transcript *) {
      visibility: visible;
    }
    :global(#transcript) {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      border: none;
    }
    .no-print {
      display: none !important;
    }
    .print-only {
      display: inline;
    }
  }
</style>
