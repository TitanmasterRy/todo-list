<script lang="ts">
  import CalculatorTool from '../components/tools/CalculatorTool.svelte';
  import GraphTool from '../components/tools/GraphTool.svelte';
  import NotecardsTool from '../components/tools/NotecardsTool.svelte';
  import TranscriptTool from '../components/tools/TranscriptTool.svelte';
  import PlannerTool from '../components/tools/PlannerTool.svelte';
  import GradesTool from '../components/tools/GradesTool.svelte';
  import ReadingTool from '../components/tools/ReadingTool.svelte';
  import CalendarExportTool from '../components/tools/CalendarExportTool.svelte';
  import { ui } from '../lib/ui.svelte';
  import { t } from '../lib/i18n/index.svelte';

  import ScanTool from '../components/tools/ScanTool.svelte';

  type Tab =
    | 'grades'
    | 'timetable'
    | 'syllabus'
    | 'week'
    | 'practice'
    | 'elements'
    | 'canvas'
    | 'planner'
    | 'calendar'
    | 'reading'
    | 'calculator'
    | 'graph'
    | 'notecards'
    | 'study'
    | 'transcript'
    | 'scan'
    | 'reader'
    | 'code'
    | 'google'
    | 'quiz'
    | 'powerschool'
    | 'essay'
    | 'citations'
    | 'units'
    | 'class';
  type Group = 'plan' | 'grades' | 'study' | 'compute' | 'connect';
  let tab = $state<Tab>((ui.toolsTab as Tab) || 'planner');
  $effect(() => {
    ui.toolsTab = tab;
  });
  // and follow it when another part of the app switches tools (e.g. "Study this deck")
  $effect(() => {
    if (ui.toolsTab && ui.toolsTab !== tab) tab = ui.toolsTab as Tab;
  });
  // labels follow the app language
  const tabs: { id: Tab; label: string; icon: string; group: Group }[] = $derived([
    { id: 'planner', label: t('tools.planner'), icon: '🗓️', group: 'plan' },
    { id: 'week', label: t('tools.week'), icon: '📅', group: 'plan' },
    { id: 'timetable', label: t('tools.timetable'), icon: '🏫', group: 'plan' },
    { id: 'syllabus', label: t('tools.syllabus'), icon: '📋', group: 'plan' },
    { id: 'reading', label: t('tools.reading'), icon: '📖', group: 'plan' },
    { id: 'calendar', label: t('tools.calendar'), icon: '📆', group: 'plan' },
    { id: 'grades', label: t('tools.grades'), icon: '🎯', group: 'grades' },
    { id: 'transcript', label: t('tools.transcript'), icon: '🎓', group: 'grades' },
    { id: 'powerschool', label: t('tools.powerschool'), icon: '🏫', group: 'grades' },
    { id: 'notecards', label: t('tools.notecards'), icon: '🃏', group: 'study' },
    { id: 'quiz', label: t('tools.quiz'), icon: '🎮', group: 'study' },
    { id: 'practice', label: t('tools.practice'), icon: '📝', group: 'study' },
    { id: 'scan', label: t('tools.scan'), icon: '📷', group: 'study' },
    { id: 'reader', label: t('tools.reader'), icon: '📚', group: 'study' },
    { id: 'study', label: t('tools.study'), icon: '💡', group: 'study' },
    { id: 'essay', label: t('tools.essay'), icon: '📝', group: 'study' },
    { id: 'citations', label: t('tools.citations'), icon: '🔖', group: 'study' },
    { id: 'calculator', label: t('tools.calculator'), icon: '🧮', group: 'compute' },
    { id: 'graph', label: t('tools.graph'), icon: '📈', group: 'compute' },
    { id: 'units', label: t('tools.units'), icon: '📏', group: 'compute' },
    { id: 'elements', label: t('tools.elements'), icon: '⚗️', group: 'compute' },
    { id: 'code', label: t('tools.code'), icon: '💻', group: 'compute' },
    { id: 'google', label: t('tools.google'), icon: '🟢', group: 'connect' },
    { id: 'canvas', label: t('tools.canvas'), icon: '🎨', group: 'connect' },
    { id: 'class', label: t('tools.class'), icon: '🧑‍🏫', group: 'connect' },
  ]);
  const groups: { id: Group; label: string }[] = $derived([
    { id: 'plan', label: t('tools.gPlan') },
    { id: 'grades', label: t('tools.gGrades') },
    { id: 'study', label: t('tools.gStudy') },
    { id: 'compute', label: t('tools.gCompute') },
    { id: 'connect', label: t('tools.gConnect') },
  ]);
  const currentGroup = $derived(tabs.find((t) => t.id === tab)?.group ?? 'plan');
  // follows the selected tab, and can also be set directly by the group buttons
  let group = $derived<Group>(currentGroup);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <h1>{t('nav.tools')}</h1>
      <div class="sub">{t('tools.sub')}</div>
    </div>
  </header>

  <div class="groups" role="tablist" aria-label={t('tools.groups')}>
    {#each groups as g (g.id)}
      <button
        role="tab"
        aria-selected={group === g.id}
        class:on={group === g.id}
        onclick={() => {
          group = g.id;
          const first = tabs.find((t) => t.group === g.id);
          if (first && tabs.find((t) => t.id === tab)?.group !== g.id) tab = first.id;
        }}>{g.label}</button
      >
    {/each}
  </div>
  <div class="tabs" role="tablist" aria-label={t('nav.tools')}>
    {#each tabs.filter((t) => t.group === group) as t (t.id)}
      <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => (tab = t.id)}><span aria-hidden="true">{t.icon}</span> {t.label}</button>
    {/each}
  </div>

  {#if tab === 'planner'}
    <PlannerTool />
  {:else if tab === 'grades'}
    <GradesTool />
  {:else if tab === 'calculator'}
    <CalculatorTool />
  {:else if tab === 'graph'}
    <GraphTool />
  {:else if tab === 'notecards'}
    <NotecardsTool />
  {:else if tab === 'study'}
    {#await import('../components/tools/StudyHelpTool.svelte')}
      <div class="card muted">{t('tools.loadingStudy')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'timetable'}
    {#await import('../components/tools/TimetableTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'canvas'}
    {#await import('../components/tools/CanvasTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'elements'}
    {#await import('../components/tools/PeriodicTableTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'practice'}
    {#await import('../components/tools/PracticeTestTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'week'}
    {#await import('../components/tools/WeekPlanTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'syllabus'}
    {#await import('../components/tools/SyllabusTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'essay'}
    {#await import('../components/tools/EssayTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'citations'}
    {#await import('../components/tools/CitationTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'units'}
    {#await import('../components/tools/UnitTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'transcript'}
    <TranscriptTool />
  {:else if tab === 'scan'}
    <ScanTool />
  {:else if tab === 'reader'}
    {#await import('../components/tools/ReaderTool.svelte')}
      <div class="card muted">{t('tools.loadingReader')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'code'}
    {#await import('../components/tools/CodeTool.svelte')}
      <div class="card muted">{t('tools.loadingEditor')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'google'}
    {#await import('../components/GoogleTools.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'quiz'}
    {#await import('../components/tools/QuizMakerTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'powerschool'}
    {#await import('../components/tools/PowerSchoolTool.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'class'}
    {#await import('../components/social/ClassMode.svelte')}
      <div class="card muted">{t('common.loading')}</div>
    {:then m}
      <m.default />
    {/await}
  {:else if tab === 'reading'}
    <ReadingTool />
  {:else}
    <CalendarExportTool />
  {/if}
</div>

<style>
  .groups {
    display: flex;
    gap: 2px;
    background: var(--bg-elev-2);
    border-radius: 999px;
    padding: 3px;
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
    margin: 4px 0 8px;
  }
  .groups button {
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .groups button.on {
    background: var(--bg-elev);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin: 4px 0 12px;
  }
  .tabs button {
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .tabs button.on {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--text);
    border-color: var(--accent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
