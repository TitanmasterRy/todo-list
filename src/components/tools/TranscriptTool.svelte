<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { letterOn, scaleFor, summarize } from '../../lib/grades';
  import { gpa, groupByTerm, pointsFor, transcriptCSV, type TranscriptRow } from '../../lib/gpa';
  import { downloadText } from '../../lib/download';
  import { t } from '../../lib/i18n/index.svelte';

  const rows = $derived.by((): TranscriptRow[] =>
    store.courses.map((c) => {
      const items = store.tasks.filter((t) => t.courseId === c.id && (t.weight ?? 0) > 0 && !t.archived).map((t) => ({ weight: t.weight!, score: t.score }));
      const calc = summarize(items).current;
      const grade = typeof c.finalGrade === 'number' ? c.finalGrade : calc;
      return {
        courseId: c.id,
        name: `${c.emoji ? c.emoji + ' ' : ''}${c.name}${c.archived ? ` ${t('inbox.archived')}` : ''}`,
        term: c.term ?? '',
        credits: c.credits ?? 1,
        grade,
        letter: grade === null ? null : letterOn(grade, scaleFor(c)),
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
      <h2>{t('tools.transcript')}</h2>
      <p class="help">{t('gpa.help')}</p>
    </div>
    <div class="btns no-print">
      <button class="btn sm" onclick={() => downloadText('transcript.csv', transcriptCSV(rows), 'text/csv')} disabled={!rows.length}>{t('gpa.csv')}</button>
      <button class="btn sm" onclick={() => window.print()} disabled={!rows.length}>{t('gpa.print')}</button>
    </div>
  </div>
  {#if !rows.length}
    <p class="help">{t('courses.none')}.</p>
  {/if}
  {#each terms as tm (tm.term)}
    {@const g = gpa(tm.rows)}
    <h3>{tm.term} <span class="muted">{g.gpa === null ? t('gpa.noGrades') : `GPA ${g.gpa.toFixed(2)}`} · {t('gpa.credits', { count: g.credits })}</span></h3>
    <table>
      <thead><tr><th>{t('inbox.course')}</th><th>{t('gpa.creditsCol')}</th><th>{t('gpa.grade')}</th><th>{t('gpa.letter')}</th><th>{t('gpa.points')}</th></tr></thead>
      <tbody>
        {#each tm.rows as r (r.courseId)}
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
      <span>{t('gpa.cumulative')}</span>
      <strong>{overall.gpa === null ? '—' : overall.gpa.toFixed(2)}</strong>
      <span class="muted">{t('gpa.graded', { n: overall.gradedCredits, total: overall.credits })}</span>
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
    color: var(--accent-text);
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
