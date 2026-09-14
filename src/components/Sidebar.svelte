<script lang="ts">
  import { store, VIEWS } from '../lib/store.svelte';
  import { levelProgress, levelTitle } from '../lib/gamification';
  import { ui } from '../lib/ui.svelte';

  const lp = $derived(levelProgress(store.stats.xp));
</script>

<nav class="sidebar" aria-label="Main">
  <div class="brand">
    <span class="logo" aria-hidden="true">✓</span>
    <span>Homework</span>
  </div>
  <ul>
    {#each VIEWS as v (v.id)}
      <li>
        <button class:active={store.view === v.id} onclick={() => store.go(v.id)} aria-current={store.view === v.id ? 'page' : undefined}>
          <span class="ico" aria-hidden="true">{v.icon}</span>
          <span class="lbl">{v.label}</span>
          {#if v.key}<span class="kbd">{v.key}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
  {#if store.activeCourses.length}
    <div class="courses">
      <div class="head">Courses</div>
      {#each store.activeCourses as c (c.id)}
        <button class="course" class:active={store.view === 'courses' && store.courseFilter === c.id} onclick={() => store.go('courses', { courseId: c.id })}>
          <span class="dot" style="background:{c.color}"></span>
          <span class="lbl">{c.emoji ? c.emoji + ' ' : ''}{c.name}</span>
          <span class="n">{store.openTasks.filter((t) => t.courseId === c.id).length}</span>
        </button>
      {/each}
    </div>
  {/if}
  <div class="grow"></div>
  {#if store.settings.gamification}
    <div class="level" title="{store.stats.xp} XP">
      <div class="lvl-row"><span>Lv {lp.level} · {levelTitle(lp.level)}</span><span class="muted">{lp.into}/{lp.needed}</span></div>
      <div class="bar"><div class="fill" style="width:{lp.pct * 100}%"></div></div>
    </div>
  {/if}
  <button class="btn ghost sm palette" onclick={() => (ui.palette = true)}>
    <span>Command palette</span><span class="kbd">⌘K</span>
  </button>
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-w);
    background: var(--bg-elev);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 10px;
    gap: 4px;
    z-index: 10;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    padding: 4px 8px 14px;
    font-size: 16px;
  }
  .logo {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 15px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  li button,
  .course {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--text-muted);
    font-weight: 500;
    text-align: left;
    transition: background var(--dur), color var(--dur);
  }
  li button:hover,
  .course:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  li button.active,
  .course.active {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--text);
  }
  .ico {
    width: 20px;
    text-align: center;
  }
  .lbl {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .courses {
    margin-top: 16px;
  }
  .courses .head {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    padding: 0 10px 6px;
    font-weight: 600;
  }
  .course {
    font-size: 14px;
    padding: 6px 10px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .n {
    font-size: 12px;
    color: var(--text-faint);
  }
  .grow {
    flex: 1;
  }
  .level {
    padding: 8px 10px;
    font-size: 13px;
  }
  .lvl-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .muted {
    color: var(--text-faint);
  }
  .bar {
    height: 6px;
    background: var(--bg-elev-2);
    border-radius: 3px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 400ms var(--ease);
  }
  .palette {
    justify-content: space-between;
    width: 100%;
  }
  @media (max-width: 720px) {
    .sidebar {
      display: none;
    }
  }
</style>
