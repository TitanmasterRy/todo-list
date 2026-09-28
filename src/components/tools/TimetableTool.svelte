<script lang="ts">
  // Tools → Timetable: your class schedule. Week view, plus setup for bell schedules, A/B rotation,
  // classes (course + period + room) and one-off days (no school, early release, forced A/B day).
  import { store } from '../../lib/store.svelte';
  import { uid } from '../../lib/id';
  import { addDaysKey, dayName, formatMonthDay, fromKey, startOfWeekKey } from '../../lib/dates';
  import { t } from '../../lib/i18n/index.svelte';
  import { ATTENDANCE, attendanceSummary, bellProblems, daySlots, defaultBell, emptySchedule, formatHM, recentMeetings, rotationDay } from '../../lib/timetable';
  import type { BellSchedule, ClassMeeting, DayOverride, SchoolSchedule } from '../../lib/types';

  let mode = $state<'week' | 'attendance' | 'setup'>(store.schedule?.classes.length ? 'week' : 'setup');
  // the editor works on a copy and saves it (debounced) whenever it changes
  let draft = $state<SchoolSchedule>(structuredClone($state.snapshot(store.schedule) ?? emptySchedule()) as SchoolSchedule);
  let saved = JSON.stringify(draft);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const snap = JSON.stringify(draft);
    if (snap === saved) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saved = snap;
      // attendance is marked through the store (Today, the Attendance tab), so never overwrite it from this copy
      store.saveSchedule({ ...draft, attendance: store.schedule?.attendance });
    }, 400);
  });

  const breaks = $derived(store.stats.breaks);
  let weekOffset = $state(0);
  const weekStart = $derived(addDaysKey(startOfWeekKey(store.today, store.settings.weekStart), weekOffset * 7));
  const weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i)).filter((k) => draft.schoolDays.includes(fromKey(k).getDay())));
  const fmt = (t: string) => formatHM(t, store.settings.timeFormat);
  const md = (k: string) => formatMonthDay(fromKey(k), fromKey(k));
  const course = (id: string) => store.courseById(id);

  // ---------- attendance (always read from / written to the store, not the draft) ----------
  const live = $derived(store.schedule);
  const summary = $derived(live ? attendanceSummary(live) : []);
  const recent = $derived(live ? recentMeetings(live, store.today, 14, breaks) : []);
  const recentDays = $derived([...new Set(recent.map((r) => r.key))]);

  // ---------- setup helpers ----------
  const ROTATIONS: { label: string; days: string[] }[] = $derived([
    { label: t('tt.noRotation'), days: [] },
    { label: t('tt.ab'), days: ['A', 'B'] },
    { label: t('tt.day14'), days: ['1', '2', '3', '4'] },
    { label: t('tt.day16'), days: ['1', '2', '3', '4', '5', '6'] },
  ]);
  const rotationPreset = $derived(ROTATIONS.findIndex((r) => r.days.join() === draft.rotation.join()));
  function setRotation(i: number) {
    draft.rotation = [...ROTATIONS[i].days];
    if (draft.rotation.length && !draft.rotationStart) draft.rotationStart = store.today;
    if (!draft.rotation.length) for (const m of draft.classes) m.rotationDays = undefined;
  }
  function addBell() {
    const b: BellSchedule = { id: uid('bell'), name: t('tt.earlyRelease'), periods: draft.bells[0].periods.map((p) => ({ ...p, id: uid('per') })) };
    draft.bells = [...draft.bells, b];
  }
  function removeBell(id: string) {
    draft.bells = draft.bells.filter((b) => b.id !== id);
    for (const [k, o] of Object.entries(draft.overrides)) if (o.bellId === id) delete draft.overrides[k];
    for (const [d, b] of Object.entries(draft.weekdayBells ?? {})) if (b === id) delete draft.weekdayBells![Number(d)];
  }
  function addPeriod(b: BellSchedule) {
    const last = [...b.periods].sort((x, y) => (x.end < y.end ? -1 : 1)).pop();
    const start = last?.end ?? '08:00';
    const [h, m] = start.split(':').map(Number);
    const endMin = h * 60 + m + 50;
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    b.periods.push({ id: uid('per'), name: t('tt.period', { n: b.periods.filter((p) => /^(period|hora)/i.test(p.name)).length + 1 }), start, end });
  }
  function addClass() {
    const firstClassPeriod = draft.bells[0]?.periods.find((p) => !draft.classes.some((m) => m.periodId === p.id) && !/lunch|break|homeroom|almuerzo|recreo|tutoría/i.test(p.name));
    const c: ClassMeeting = { id: uid('cls'), courseId: store.activeCourses[0]?.id ?? '', periodId: firstClassPeriod?.id ?? draft.bells[0]?.periods[0]?.id ?? '' };
    draft.classes = [...draft.classes, c];
  }
  function toggle<T>(list: T[] | undefined, x: T): T[] | undefined {
    const next = list?.includes(x) ? list.filter((y) => y !== x) : [...(list ?? []), x];
    return next.length ? next : undefined;
  }

  let ovDate = $state('');
  let ovKind = $state('noSchool');
  function addOverride(e: SubmitEvent) {
    e.preventDefault();
    if (!ovDate) return;
    const o: DayOverride = ovKind === 'noSchool' ? { noSchool: true } : ovKind.startsWith('bell:') ? { bellId: ovKind.slice(5) } : { rotation: ovKind.slice(4) };
    draft.overrides = { ...draft.overrides, [ovDate]: { ...draft.overrides[ovDate], ...o } };
    ovDate = '';
  }
  const overrideList = $derived(
    Object.entries(draft.overrides)
      .filter(([k]) => k >= addDaysKey(store.today, -7))
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  function describeOverride(o: DayOverride): string {
    return [
      o.noSchool && t('tt.noSchool'),
      o.bellId && t('tt.bell', { name: draft.bells.find((b) => b.id === o.bellId)?.name ?? t('tt.other') }),
      o.rotation && t('tt.rotDay', { day: o.rotation }),
    ]
      .filter(Boolean)
      .join(' · ');
  }
</script>

<section class="card">
  <div class="head">
    <h2>🏫 {t('tools.timetable')}</h2>
    <div class="seg" role="radiogroup" aria-label={t('tt.mode')}>
      <button role="radio" aria-checked={mode === 'week'} class:on={mode === 'week'} onclick={() => (mode = 'week')}>{t('tt.week')}</button>
      <button role="radio" aria-checked={mode === 'attendance'} class:on={mode === 'attendance'} onclick={() => (mode = 'attendance')}>{t('tt.attendance')}</button>
      <button role="radio" aria-checked={mode === 'setup'} class:on={mode === 'setup'} onclick={() => (mode = 'setup')}>{t('tt.setup')}</button>
    </div>
  </div>

  {#if mode === 'week'}
    <div class="weeknav">
      <button class="btn sm ghost" onclick={() => weekOffset--} aria-label={t('tt.prevWeek')}>←</button>
      <strong>{t('tt.weekOf', { date: md(weekStart) })}</strong>
      <button class="btn sm ghost" onclick={() => weekOffset++} aria-label={t('tt.nextWeek')}>→</button>
      {#if weekOffset}<button class="btn sm ghost" onclick={() => (weekOffset = 0)}>{t('tt.thisWeek')}</button>{/if}
    </div>
    {#if !draft.classes.length}
      <p class="muted">
        {t('tt.noClasses')} <button class="link" onclick={() => (mode = 'setup')}>{t('tt.setup')}</button>
        {t('tt.noClasses2')}
      </p>
    {/if}
    <div class="week" style="--cols:{weekDays.length || 1}">
      {#each weekDays as k (k)}
        {@const slots = daySlots(draft, k, breaks)}
        {@const rot = rotationDay(draft, k, breaks)}
        <div class="day" class:today={k === store.today} aria-label="{dayName(fromKey(k).getDay(), 'long')} {md(k)}">
          <h3>
            {dayName(fromKey(k).getDay())} <small>{md(k)}</small>
            {#if rot}<span class="rot">{rot}</span>{/if}
          </h3>
          {#if !slots.length}
            <p class="off">{t('tt.noSchool')}</p>
          {:else}
            <ul>
              {#each slots as s (s.period.id)}
                {#if s.meetings.length}
                  {#each s.meetings as m (m.id)}
                    {@const c = course(m.courseId)}
                    <li class="cls" style="--c:{c?.color ?? 'var(--accent)'}">
                      <span class="t">{fmt(s.period.start)}</span>
                      <span class="n">{c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : t('tt.class')}</span>
                      {#if m.room}<span class="r">{m.room}</span>{/if}
                    </li>
                  {/each}
                {:else if /lunch|break|almuerzo|recreo/i.test(s.period.name)}
                  <li class="free"><span class="t">{fmt(s.period.start)}</span><span class="n">{s.period.name}</span></li>
                {/if}
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </div>
  {:else if mode === 'attendance'}
    {#if !recent.length}
      <p class="muted">{t('tt.attEmpty')}</p>
    {:else}
      {#if summary.length}
        <table class="att-sum">
          <thead
            ><tr><th>{t('tt.class')}</th><th>{t('att.present')}</th><th>{t('att.late')}</th><th>{t('att.absent')}</th><th>{t('att.excused')}</th><th>{t('tt.attendance')}</th></tr
            ></thead
          >
          <tbody>
            {#each summary as r (r.courseId)}
              <tr>
                <td>{course(r.courseId)?.name ?? t('tt.class')}</td>
                <td>{r.present}</td>
                <td>{r.late}</td>
                <td>{r.absent}</td>
                <td>{r.excused}</td>
                <td><strong>{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</strong></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      {#each recentDays as k (k)}
        <h3 class="sh">{dayName(fromKey(k).getDay(), 'long')} {md(k)}{k === store.today ? ` · ${t('task.planned')}` : ''}</h3>
        <ul class="att">
          {#each recent.filter((r) => r.key === k) as r (r.meeting.id)}
            {@const cur = live?.attendance?.[k]?.[r.meeting.id]}
            <li>
              <span class="n">{course(r.meeting.courseId)?.name ?? t('tt.class')} <span class="muted">{fmt(r.slot.period.start)}</span></span>
              <span class="marks" role="group" aria-label={t('tt.attFor', { name: course(r.meeting.courseId)?.name ?? t('tt.class'), date: md(k) })}>
                {#each ATTENDANCE as a (a.id)}
                  <button
                    class="chip pick {a.id}"
                    class:on={cur === a.id}
                    aria-pressed={cur === a.id}
                    onclick={() => store.markAttendance(k, r.meeting.id, cur === a.id ? undefined : a.id)}>{a.emoji} {a.label}</button
                  >
                {/each}
              </span>
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  {:else}
    <h3 class="sh">{t('tt.schoolDays')}</h3>
    <div class="chips" role="group" aria-label={t('tt.schoolDays')}>
      {#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
        <button
          class="chip pick"
          class:on={draft.schoolDays.includes(d)}
          aria-pressed={draft.schoolDays.includes(d)}
          onclick={() => (draft.schoolDays = toggle(draft.schoolDays, d) ?? [])}>{dayName(d)}</button
        >
      {/each}
    </div>

    <h3 class="sh">{t('tt.rotation')}</h3>
    <div class="row">
      <select class="select" value={rotationPreset < 0 ? '' : String(rotationPreset)} onchange={(e) => setRotation(Number(e.currentTarget.value))} aria-label={t('tt.rotation')}>
        {#each ROTATIONS as r, i (r.label)}<option value={String(i)}>{r.label}</option>{/each}
      </select>
      {#if draft.rotation.length}
        <label>{t('tt.dayWasOn', { day: draft.rotation[0] })} <input class="input" type="date" bind:value={draft.rotationStart} aria-label={t('tt.rotStart')} /></label>
        {#if rotationDay(draft, store.today, breaks)}<span class="muted">{t('tt.todayIs', { day: rotationDay(draft, store.today, breaks) ?? '' })}</span>{/if}
      {/if}
    </div>
    <p class="muted">{t('tt.rotHelp')}</p>

    <h3 class="sh">{t('tt.bells')}</h3>
    {#each draft.bells as b, bi (b.id)}
      {@const problems = bellProblems(b)}
      <div class="bell">
        <div class="row">
          <input class="input name" bind:value={b.name} aria-label={t('tt.bellName')} />
          {#if bi === 0}<span class="muted">{t('tt.regularDefault')}</span>{:else}<button class="btn sm ghost" onclick={() => removeBell(b.id)}>{t('editor.remove')}</button>{/if}
        </div>
        <table>
          <thead><tr><th>{t('tt.periodCol')}</th><th>{t('tt.start')}</th><th>{t('tt.end')}</th><th><span class="sr">{t('editor.remove')}</span></th></tr></thead>
          <tbody>
            {#each b.periods as p, pi (p.id)}
              <tr>
                <td><input class="input" bind:value={p.name} aria-label={t('tt.periodName')} /></td>
                <td><input class="input" type="time" bind:value={p.start} aria-label={t('tt.startOf', { name: p.name })} /></td>
                <td><input class="input" type="time" bind:value={p.end} aria-label={t('tt.endOf', { name: p.name })} /></td>
                <td><button class="x" onclick={() => b.periods.splice(pi, 1)} aria-label={t('editor.removeBlocker', { title: p.name })}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if problems.length}<p class="warn" role="status">⚠ {problems.join(' ')}</p>{/if}
        <button class="btn sm ghost" onclick={() => addPeriod(b)}>+ {t('tt.periodCol')}</button>
      </div>
    {/each}
    <div class="row">
      <button class="btn sm" onclick={addBell}>{t('tt.addBell')}</button>
      {#if !draft.bells.length}<button class="btn sm" onclick={() => (draft.bells = [defaultBell()])}>{t('tt.addRegular')}</button>{/if}
    </div>
    {#if draft.bells.length > 1}
      <div class="row wrap">
        <span class="muted">{t('tt.everyWeek')}</span>
        {#each [...draft.schoolDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) as d (d)}
          <label class="wd"
            >{dayName(d)}
            <select
              class="select"
              value={draft.weekdayBells?.[d] ?? ''}
              onchange={(e) => {
                const v = e.currentTarget.value;
                const wb = { ...(draft.weekdayBells ?? {}) };
                if (v) wb[d] = v;
                else delete wb[d];
                draft.weekdayBells = wb;
              }}
              aria-label={t('tt.bellFor', { day: dayName(d, 'long') })}
            >
              <option value="">{draft.bells[0].name}</option>
              {#each draft.bells.slice(1) as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
            </select></label
          >
        {/each}
      </div>
    {/if}

    <h3 class="sh">{t('tt.classes')}</h3>
    {#if !store.activeCourses.length}<p class="muted">{t('tt.coursesFirst')}</p>{/if}
    <ul class="classes">
      {#each draft.classes as m, i (m.id)}
        <li>
          <select class="select" bind:value={m.courseId} aria-label={t('inbox.course')}>
            {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>{/each}
          </select>
          <select class="select" bind:value={m.periodId} aria-label={t('tt.periodCol')}>
            {#each draft.bells[0]?.periods ?? [] as p (p.id)}<option value={p.id}>{p.name} · {fmt(p.start)}</option>{/each}
          </select>
          {#if draft.rotation.length}
            <span class="chips" role="group" aria-label={t('tt.rotDays')}>
              {#each draft.rotation as r (r)}
                <button
                  class="chip pick"
                  class:on={m.rotationDays?.includes(r)}
                  aria-pressed={!!m.rotationDays?.includes(r)}
                  onclick={() => (m.rotationDays = toggle(m.rotationDays, r))}>{r}</button
                >
              {/each}
            </span>
          {/if}
          <input class="input room" bind:value={m.room} placeholder={t('tt.room')} aria-label={t('tt.room')} />
          <input class="input room" bind:value={m.teacher} placeholder={t('ps.teacher')} aria-label={t('ps.teacher')} />
          <button class="x" onclick={() => (draft.classes = draft.classes.filter((_, k) => k !== i))} aria-label={t('tt.removeClass')}>×</button>
        </li>
      {/each}
    </ul>
    <button class="btn sm" onclick={addClass} disabled={!store.activeCourses.length || !draft.bells.length}>+ {t('tt.class')}</button>
    {#if draft.rotation.length}<p class="muted">{t('tt.everyDayHint')}</p>{/if}

    <h3 class="sh">{t('tt.special')}</h3>
    <form class="row wrap" onsubmit={addOverride}>
      <input class="input" type="date" bind:value={ovDate} aria-label={t('tt.specialDate')} required />
      <select class="select" bind:value={ovKind} aria-label={t('tt.whatHappens')}>
        <option value="noSchool">{t('tt.noSchool')}</option>
        {#each draft.bells as b (b.id)}<option value="bell:{b.id}">{t('tt.bell', { name: b.name })}</option>{/each}
        {#each draft.rotation as r (r)}<option value="rot:{r}">{t('tt.makeIt', { day: r })}</option>{/each}
      </select>
      <button class="btn sm" type="submit" disabled={!ovDate}>{t('common.add')}</button>
    </form>
    {#if overrideList.length}
      <ul class="ovs">
        {#each overrideList as [k, o] (k)}
          <li>
            <span>{dayName(fromKey(k).getDay())} {md(k)}: {describeOverride(o)}</span>
            <button
              class="x"
              onclick={() => {
                const next = { ...draft.overrides };
                delete next[k];
                draft.overrides = next;
              }}
              aria-label={t('editor.removeBlocker', { title: md(k) })}>×</button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <p class="muted">{t('tt.breaksHint')}</p>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .sh {
    font-size: 14px;
    margin: 18px 0 6px;
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    background: var(--bg-sunken, var(--bg-elev));
    border-radius: 8px;
    padding: 2px;
  }
  .seg button {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .seg button.on {
    background: var(--bg-elev);
    color: var(--text);
    font-weight: 600;
  }
  .muted {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .link {
    color: var(--accent-text);
    padding: 0;
    font-size: inherit;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
    font-size: 13px;
  }
  .row.wrap {
    flex-wrap: wrap;
  }
  .row .select,
  .row .input {
    width: auto;
  }
  .weeknav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .week {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 8px;
  }
  @media (max-width: 720px) {
    .week {
      grid-template-columns: 1fr;
    }
  }
  .day {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px;
    min-height: 120px;
  }
  .day.today {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .day h3 {
    font-size: 13px;
    margin: 0 0 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .day h3 small {
    color: var(--text-muted);
    font-weight: 400;
  }
  .rot {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent-text);
  }
  .day ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .day li {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 6px;
  }
  .cls {
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border-left: 3px solid var(--c);
  }
  .free {
    color: var(--text-muted);
  }
  .t {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    min-width: 54px;
  }
  .n {
    flex: 1;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .free .n {
    font-weight: 400;
  }
  .r {
    color: var(--text-muted);
  }
  .off {
    color: var(--text-muted);
    font-size: 12px;
    margin: 4px 0;
  }
  .bell {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    margin-bottom: 8px;
  }
  .bell .name {
    font-weight: 600;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    max-width: 520px;
    font-size: 13px;
  }
  th {
    text-align: left;
    color: var(--text-muted);
    font-weight: 500;
    font-size: 12px;
    padding: 2px 4px;
  }
  td {
    padding: 2px 4px;
  }
  td .input {
    padding: 4px 6px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .warn {
    color: var(--warn-text);
    font-size: 12px;
    margin: 4px 0;
  }
  .x {
    color: var(--text-muted);
    font-size: 18px;
    padding: 0 6px;
  }
  .chips {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .classes,
  .ovs {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .classes li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .classes .select {
    width: auto;
  }
  .room {
    width: 110px;
  }
  .ovs li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    max-width: 420px;
  }
  .wd {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .att-sum {
    max-width: 640px;
    margin-bottom: 8px;
  }
  .att-sum td {
    padding: 4px;
    border-top: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  .att {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .att li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: 13px;
  }
  .marks {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }
</style>
