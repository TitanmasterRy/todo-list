<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { parsePowerSchoolHTML, parsePowerSchoolText, matchToCourses, latestGrade, type PSCourse } from '../../lib/powerschool';
  import { COURSE_COLORS, COURSE_EMOJIS } from '../../lib/colors';
  import { t } from '../../lib/i18n/index.svelte';

  let raw = $state('');
  let parsed = $state<{ courses: PSCourse[]; terms: string[]; student?: string } | null>(null);
  let term = $state('');
  let fileInput: HTMLInputElement | undefined = $state();
  let mapping = $state<Record<string, string>>({}); // ps course name -> course id | '__new' | ''

  function parse(text: string) {
    const looksHtml = /<table|<td|<html/i.test(text);
    const r = looksHtml ? parsePowerSchoolHTML(text) : parsePowerSchoolText(text);
    if (!r.courses.length) {
      toasts.push({
        message: t('ps.none'),
        detail: t('ps.noneDetail'),
        kind: 'warn',
        timeout: 9000,
      });
      return;
    }
    parsed = r;
    term = r.terms[r.terms.length - 1] ?? '';
    const m = matchToCourses(
      r.courses,
      store.activeCourses.map((c) => ({ id: c.id, name: c.name })),
    );
    mapping = Object.fromEntries(m.map((x) => [x.ps.name, x.courseId ?? '__new']));
  }
  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    parse(await f.text());
    if (fileInput) fileInput.value = '';
  }
  function apply() {
    if (!parsed) return;
    let updated = 0;
    let created = 0;
    parsed.courses.forEach((c, i) => {
      const g = latestGrade(c, term || undefined);
      if (!g || g.percent === undefined) return;
      let id = mapping[c.name];
      if (id === '') return;
      if (id === '__new' || !id) {
        const nc = store.addCourse({ name: c.name, color: COURSE_COLORS[(i * 3) % COURSE_COLORS.length], emoji: COURSE_EMOJIS[i % COURSE_EMOJIS.length] });
        id = nc.id;
        created++;
      }
      store.updateCourse(id, { finalGrade: g.percent, term: store.courseById(id)?.term || g.term });
      updated++;
    });
    toasts.push({
      message: t('ps.updated', { count: updated }),
      detail: created ? `${t('ps.created', { count: created })} ${t('ps.see')}` : t('ps.see'),
      kind: 'success',
      emoji: '🏫',
    });
    parsed = null;
    raw = '';
  }
</script>

<section class="card">
  <h2>{t('ps.title')}</h2>
  <p class="help">
    {t('ps.help')}
  </p>
  <ol class="steps">
    <li>{t('ps.step1')}</li>
    <li>
      {t('ps.step2')}
    </li>
  </ol>
  <div class="btns">
    <button class="btn" onclick={() => fileInput?.click()}>{t('ps.upload')}</button>
    <input type="file" accept=".html,.htm,text/html,.txt" class="visually-hidden" bind:this={fileInput} onchange={onFile} aria-label={t('ps.uploadLabel')} />
  </div>
  <textarea class="textarea" bind:value={raw} placeholder={t('ps.pastePh')} rows="5"></textarea>
  <div class="btns"><button class="btn primary" onclick={() => parse(raw)} disabled={!raw.trim()}>{t('ps.read')}</button></div>

  {#if parsed}
    <div class="result">
      <div class="row-head">
        <h3>{parsed.student ? `${parsed.student} · ` : ''}{t('ps.courses', { count: parsed.courses.length })}</h3>
        <label class="term"
          >{t('ps.term')}
          <select class="select" bind:value={term}
            >{#each parsed.terms as t}<option value={t}>{t}</option>{/each}</select
          ></label
        >
      </div>
      <table>
        <thead><tr><th>{t('ps.course')}</th><th>{t('ps.teacher')}</th><th>{t('gpa.grade')}</th><th>{t('ps.applyTo')}</th></tr></thead>
        <tbody>
          {#each parsed.courses as c, ci (ci)}
            {@const g = latestGrade(c, term || undefined)}
            <tr>
              <td>{c.name}</td>
              <td class="muted">{c.teacher ?? ''}</td>
              <td>{g && g.percent !== undefined ? `${g.percent}%${g.letter ? ` (${g.letter})` : ''}` : '—'}</td>
              <td>
                <select class="select" bind:value={mapping[c.name]}>
                  <option value="__new">{t('ps.create', { name: c.name })}</option>
                  {#each store.activeCourses as course (course.id)}<option value={course.id}>{course.emoji ?? ''} {course.name}</option>{/each}
                  <option value="">{t('common.skip')}</option>
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="btns">
        <button class="btn primary" onclick={apply}>{t('ps.apply')}</button><button class="btn ghost" onclick={() => (parsed = null)}>{t('common.cancel')}</button>
      </div>
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  h3 {
    font-size: 14px;
    margin: 0;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
  }
  .steps {
    font-size: 13px;
    color: var(--text-muted);
    padding-left: 20px;
    margin: 0 0 8px;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .result {
    margin-top: 12px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .row-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .term {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .term .select {
    width: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
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
    padding: 5px 6px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  td .select {
    width: auto;
    padding: 4px 8px;
    font-size: 12px;
  }
</style>
