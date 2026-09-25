<script lang="ts">
  // Tools → Timetable: your class schedule. Week view, plus setup for bell schedules, A/B rotation,
  // classes (course + period + room) and one-off days (no school, early release, forced A/B day).
  import { store } from '../../lib/store.svelte';
  import { uid } from '../../lib/id';
  import { addDaysKey, DAY_NAMES, DAY_SHORT, fromKey, MONTH_SHORT, startOfWeekKey } from '../../lib/dates';
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
  const md = (k: string) => `${MONTH_SHORT[fromKey(k).getMonth()]} ${fromKey(k).getDate()}`;
  const course = (id: string) => store.courseById(id);

  // ---------- attendance (always read from / written to the store, not the draft) ----------
  const live = $derived(store.schedule);
  const summary = $derived(live ? attendanceSummary(live) : []);
  const recent = $derived(live ? recentMeetings(live, store.today, 14, breaks) : []);
  const recentDays = $derived([...new Set(recent.map((r) => r.key))]);

  // ---------- setup helpers ----------
  const ROTATIONS: { label: string; days: string[] }[] = [
    { label: 'No rotation (same every day)', days: [] },
    { label: 'A / B days', days: ['A', 'B'] },
    { label: 'Day 1–4', days: ['1', '2', '3', '4'] },
    { label: 'Day 1–6', days: ['1', '2', '3', '4', '5', '6'] },
  ];
  const rotationPreset = $derived(ROTATIONS.findIndex((r) => r.days.join() === draft.rotation.join()));
  function setRotation(i: number) {
    draft.rotation = [...ROTATIONS[i].days];
    if (draft.rotation.length && !draft.rotationStart) draft.rotationStart = store.today;
    if (!draft.rotation.length) for (const m of draft.classes) m.rotationDays = undefined;
  }
  function addBell() {
    const b: BellSchedule = { id: uid('bell'), name: 'Early release', periods: draft.bells[0].periods.map((p) => ({ ...p, id: uid('per') })) };
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
    b.periods.push({ id: uid('per'), name: `Period ${b.periods.filter((p) => /^period/i.test(p.name)).length + 1}`, start, end });
  }
  function addClass() {
    const firstClassPeriod = draft.bells[0]?.periods.find((p) => !draft.classes.some((m) => m.periodId === p.id) && !/lunch|break|homeroom/i.test(p.name));
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
    return [o.noSchool && 'No school', o.bellId && `${draft.bells.find((b) => b.id === o.bellId)?.name ?? 'Other'} bell`, o.rotation && `${o.rotation} day`]
      .filter(Boolean)
      .join(' · ');
  }
</script>

<section class="card">
  <div class="head">
    <h2>🏫 Timetable</h2>
    <div class="seg" role="radiogroup" aria-label="Timetable mode">
      <button role="radio" aria-checked={mode === 'week'} class:on={mode === 'week'} onclick={() => (mode = 'week')}>Week</button>
      <button role="radio" aria-checked={mode === 'attendance'} class:on={mode === 'attendance'} onclick={() => (mode = 'attendance')}>Attendance</button>
      <button role="radio" aria-checked={mode === 'setup'} class:on={mode === 'setup'} onclick={() => (mode = 'setup')}>Setup</button>
    </div>
  </div>

  {#if mode === 'week'}
    <div class="weeknav">
      <button class="btn sm ghost" onclick={() => weekOffset--} aria-label="Previous week">←</button>
      <strong>Week of {md(weekStart)}</strong>
      <button class="btn sm ghost" onclick={() => weekOffset++} aria-label="Next week">→</button>
      {#if weekOffset}<button class="btn sm ghost" onclick={() => (weekOffset = 0)}>This week</button>{/if}
    </div>
    {#if !draft.classes.length}
      <p class="muted">No classes yet. Open <button class="link" onclick={() => (mode = 'setup')}>Setup</button> to add your periods and classes.</p>
    {/if}
    <div class="week" style="--cols:{weekDays.length || 1}">
      {#each weekDays as k (k)}
        {@const slots = daySlots(draft, k, breaks)}
        {@const rot = rotationDay(draft, k, breaks)}
        <div class="day" class:today={k === store.today} aria-label="{DAY_NAMES[fromKey(k).getDay()]} {md(k)}">
          <h3>
            {DAY_SHORT[fromKey(k).getDay()]} <small>{md(k)}</small>
            {#if rot}<span class="rot">{rot}</span>{/if}
          </h3>
          {#if !slots.length}
            <p class="off">No school</p>
          {:else}
            <ul>
              {#each slots as s (s.period.id)}
                {#if s.meetings.length}
                  {#each s.meetings as m (m.id)}
                    {@const c = course(m.courseId)}
                    <li class="cls" style="--c:{c?.color ?? 'var(--accent)'}">
                      <span class="t">{fmt(s.period.start)}</span>
                      <span class="n">{c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : 'Class'}</span>
                      {#if m.room}<span class="r">{m.room}</span>{/if}
                    </li>
                  {/each}
                {:else if /lunch|break/i.test(s.period.name)}
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
      <p class="muted">Add classes in Setup, and the last two weeks of classes show up here to mark.</p>
    {:else}
      {#if summary.length}
        <table class="att-sum">
          <thead><tr><th>Class</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Attendance</th></tr></thead>
          <tbody>
            {#each summary as r (r.courseId)}
              <tr>
                <td>{course(r.courseId)?.name ?? 'Class'}</td>
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
        <h3 class="sh">{DAY_NAMES[fromKey(k).getDay()]} {md(k)}{k === store.today ? ' · today' : ''}</h3>
        <ul class="att">
          {#each recent.filter((r) => r.key === k) as r (r.meeting.id)}
            {@const cur = live?.attendance?.[k]?.[r.meeting.id]}
            <li>
              <span class="n">{course(r.meeting.courseId)?.name ?? 'Class'} <span class="muted">{fmt(r.slot.period.start)}</span></span>
              <span class="marks" role="group" aria-label="Attendance for {course(r.meeting.courseId)?.name ?? 'class'} on {md(k)}">
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
    <h3 class="sh">School days</h3>
    <div class="chips" role="group" aria-label="School days">
      {#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
        <button
          class="chip pick"
          class:on={draft.schoolDays.includes(d)}
          aria-pressed={draft.schoolDays.includes(d)}
          onclick={() => (draft.schoolDays = toggle(draft.schoolDays, d) ?? [])}>{DAY_SHORT[d]}</button
        >
      {/each}
    </div>

    <h3 class="sh">Rotation</h3>
    <div class="row">
      <select class="select" value={rotationPreset < 0 ? '' : String(rotationPreset)} onchange={(e) => setRotation(Number(e.currentTarget.value))} aria-label="Rotation">
        {#each ROTATIONS as r, i (r.label)}<option value={String(i)}>{r.label}</option>{/each}
      </select>
      {#if draft.rotation.length}
        <label>Day {draft.rotation[0]} was on <input class="input" type="date" bind:value={draft.rotationStart} aria-label="Rotation start date" /></label>
        {#if rotationDay(draft, store.today, breaks)}<span class="muted">Today is {rotationDay(draft, store.today, breaks)} day.</span>{/if}
      {/if}
    </div>
    <p class="muted">The rotation counts school days only, so weekends, breaks and days marked "no school" are skipped.</p>

    <h3 class="sh">Bell schedules</h3>
    {#each draft.bells as b, bi (b.id)}
      {@const problems = bellProblems(b)}
      <div class="bell">
        <div class="row">
          <input class="input name" bind:value={b.name} aria-label="Bell schedule name" />
          {#if bi === 0}<span class="muted">Regular (default)</span>{:else}<button class="btn sm ghost" onclick={() => removeBell(b.id)}>Remove</button>{/if}
        </div>
        <table>
          <thead><tr><th>Period</th><th>Start</th><th>End</th><th><span class="sr">Remove</span></th></tr></thead>
          <tbody>
            {#each b.periods as p, pi (p.id)}
              <tr>
                <td><input class="input" bind:value={p.name} aria-label="Period name" /></td>
                <td><input class="input" type="time" bind:value={p.start} aria-label="{p.name} start" /></td>
                <td><input class="input" type="time" bind:value={p.end} aria-label="{p.name} end" /></td>
                <td><button class="x" onclick={() => b.periods.splice(pi, 1)} aria-label="Remove {p.name}">×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if problems.length}<p class="warn" role="status">⚠ {problems.join(' ')}</p>{/if}
        <button class="btn sm ghost" onclick={() => addPeriod(b)}>+ Period</button>
      </div>
    {/each}
    <div class="row">
      <button class="btn sm" onclick={addBell}>+ Another bell schedule</button>
      {#if !draft.bells.length}<button class="btn sm" onclick={() => (draft.bells = [defaultBell()])}>Add a regular schedule</button>{/if}
    </div>
    {#if draft.bells.length > 1}
      <div class="row wrap">
        <span class="muted">Every week:</span>
        {#each [...draft.schoolDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) as d (d)}
          <label class="wd"
            >{DAY_SHORT[d]}
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
              aria-label="{DAY_NAMES[d]} bell schedule"
            >
              <option value="">{draft.bells[0].name}</option>
              {#each draft.bells.slice(1) as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
            </select></label
          >
        {/each}
      </div>
    {/if}

    <h3 class="sh">Classes</h3>
    {#if !store.activeCourses.length}<p class="muted">Add courses first (Courses → New course), then put them in periods here.</p>{/if}
    <ul class="classes">
      {#each draft.classes as m, i (m.id)}
        <li>
          <select class="select" bind:value={m.courseId} aria-label="Course">
            {#each store.activeCourses as c (c.id)}<option value={c.id}>{c.emoji ? c.emoji + ' ' : ''}{c.name}</option>{/each}
          </select>
          <select class="select" bind:value={m.periodId} aria-label="Period">
            {#each draft.bells[0]?.periods ?? [] as p (p.id)}<option value={p.id}>{p.name} · {fmt(p.start)}</option>{/each}
          </select>
          {#if draft.rotation.length}
            <span class="chips" role="group" aria-label="Rotation days">
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
          <input class="input room" bind:value={m.room} placeholder="Room" aria-label="Room" />
          <input class="input room" bind:value={m.teacher} placeholder="Teacher" aria-label="Teacher" />
          <button class="x" onclick={() => (draft.classes = draft.classes.filter((_, k) => k !== i))} aria-label="Remove class">×</button>
        </li>
      {/each}
    </ul>
    <button class="btn sm" onclick={addClass} disabled={!store.activeCourses.length || !draft.bells.length}>+ Class</button>
    {#if draft.rotation.length}<p class="muted">Leave all rotation days off for a class that meets every day.</p>{/if}

    <h3 class="sh">Special days</h3>
    <form class="row wrap" onsubmit={addOverride}>
      <input class="input" type="date" bind:value={ovDate} aria-label="Special day date" required />
      <select class="select" bind:value={ovKind} aria-label="What happens that day">
        <option value="noSchool">No school</option>
        {#each draft.bells as b (b.id)}<option value="bell:{b.id}">{b.name} bell</option>{/each}
        {#each draft.rotation as r (r)}<option value="rot:{r}">Make it {r} day</option>{/each}
      </select>
      <button class="btn sm" type="submit" disabled={!ovDate}>Add</button>
    </form>
    {#if overrideList.length}
      <ul class="ovs">
        {#each overrideList as [k, o] (k)}
          <li>
            <span>{DAY_SHORT[fromKey(k).getDay()]} {md(k)}: {describeOverride(o)}</span>
            <button
              class="x"
              onclick={() => {
                const next = { ...draft.overrides };
                delete next[k];
                draft.overrides = next;
              }}
              aria-label="Remove {md(k)}">×</button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <p class="muted">School breaks from Settings → Break mode count as days off automatically.</p>
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
