<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { parsePowerSchoolHTML, parsePowerSchoolText, matchToCourses, latestGrade, type PSCourse } from '../../lib/powerschool';
  import { COURSE_COLORS, COURSE_EMOJIS } from '../../lib/colors';

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
        message: 'No grades found',
        detail: 'Save the “Grades and Attendance” page as HTML (Ctrl+S → Webpage, complete) or select the whole table and paste it.',
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
      message: `Updated ${updated} course grade${updated === 1 ? '' : 's'}`,
      detail: created ? `${created} course${created > 1 ? 's' : ''} created. See Tools → Transcript.` : 'See Tools → Transcript.',
      kind: 'success',
      emoji: '🏫',
    });
    parsed = null;
    raw = '';
  }
</script>

<section class="card">
  <h2>PowerSchool grades import</h2>
  <p class="help">
    PowerSchool gives students no API, so this reads the <strong>Grades and Attendance</strong> page you save or copy from the portal and fills course final grades for the transcript
    and GPA. Nothing is sent anywhere.
  </p>
  <ol class="steps">
    <li>Log in to PowerSchool and open <strong>Grades and Attendance</strong>.</li>
    <li>
      Either save the page (<span class="kbd">Ctrl</span>+<span class="kbd">S</span> → “Webpage, complete” or “HTML only”) and upload it, or select the whole grades table, copy, and
      paste below.
    </li>
  </ol>
  <div class="btns">
    <button class="btn" onclick={() => fileInput?.click()}>Upload saved page (.html)</button>
    <input type="file" accept=".html,.htm,text/html,.txt" class="visually-hidden" bind:this={fileInput} onchange={onFile} aria-label="Upload PowerSchool page" />
  </div>
  <textarea class="textarea" bind:value={raw} placeholder="…or paste the copied grades table / page source here" rows="5"></textarea>
  <div class="btns"><button class="btn primary" onclick={() => parse(raw)} disabled={!raw.trim()}>Read grades</button></div>

  {#if parsed}
    <div class="result">
      <div class="row-head">
        <h3>{parsed.student ? `${parsed.student} · ` : ''}{parsed.courses.length} courses</h3>
        <label class="term"
          >Term <select class="select" bind:value={term}
            >{#each parsed.terms as t}<option value={t}>{t}</option>{/each}</select
          ></label
        >
      </div>
      <table>
        <thead><tr><th>PowerSchool course</th><th>Teacher</th><th>Grade</th><th>Apply to</th></tr></thead>
        <tbody>
          {#each parsed.courses as c, ci (ci)}
            {@const g = latestGrade(c, term || undefined)}
            <tr>
              <td>{c.name}</td>
              <td class="muted">{c.teacher ?? ''}</td>
              <td>{g && g.percent !== undefined ? `${g.percent}%${g.letter ? ` (${g.letter})` : ''}` : '—'}</td>
              <td>
                <select class="select" bind:value={mapping[c.name]}>
                  <option value="__new">Create “{c.name}”</option>
                  {#each store.activeCourses as course (course.id)}<option value={course.id}>{course.emoji ?? ''} {course.name}</option>{/each}
                  <option value="">Skip</option>
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="btns"><button class="btn primary" onclick={apply}>Apply grades</button><button class="btn ghost" onclick={() => (parsed = null)}>Cancel</button></div>
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
