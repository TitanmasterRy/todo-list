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
    | 'matrix'
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
    { id: 'matrix', label: t('tools.matrix'), icon: '🧭', group: 'plan' },
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
    {#each tabs.filter((t) => t.group === group) as t, i (t.id)}
      <button role="tab" aria-selected={tab === t.id} class:on={tab === t.id} style="--hue:{(i * 47 + 210) % 360}" onclick={() => (tab = t.id)}
        ><span class="ico" aria-hidden="true">{t.icon}</span> {t.label}</button
      >
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
  {:else if tab === 'matrix'}
    {#await import('../components/tools/MatrixTool.svelte')}
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
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px;
    width: fit-content;
    max-width: 100%;
    overflow-x: auto;
    margin: 4px 0 10px;
  }
  .groups button {
    padding: 5px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    transition:
      background var(--dur),
      color var(--dur),
      box-shadow var(--dur),
      transform var(--dur) var(--spring);
  }
  .groups button:hover {
    color: var(--text);
    transform: translateY(-1px);
  }
  .groups button.on {
    background: var(--grad-accent);
    color: var(--accent-contrast, #fff);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 2px 10px -3px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  /* tool tiles: small cards, each with its own hue pool that brightens on hover */
  .tabs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    margin: 4px 0 14px;
  }
  .tabs button {
    --hue: 250;
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    text-align: start;
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: radial-gradient(90% 80% at 0% 0%, hsl(var(--hue) 80% 60% / 0.12), transparent 70%), var(--bg-elev);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow-sm);
    overflow: hidden;
    animation: rise-in 320ms var(--ease) backwards;
    transition:
      transform var(--dur-slow) var(--spring),
      border-color var(--dur),
      box-shadow var(--dur-slow) var(--ease),
      color var(--dur);
  }
  .tabs button:nth-child(2) {
    animation-delay: 30ms;
  }
  .tabs button:nth-child(3) {
    animation-delay: 60ms;
  }
  .tabs button:nth-child(4) {
    animation-delay: 90ms;
  }
  .tabs button:nth-child(5) {
    animation-delay: 120ms;
  }
  .tabs button:nth-child(n + 6) {
    animation-delay: 150ms;
  }
  /* sheen that sweeps across the tile on hover */
  .tabs button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.18) 50%, transparent 65%);
    transform: translateX(-130%);
    pointer-events: none;
  }
  .tabs button:hover {
    color: var(--text);
    transform: translateY(-2px);
    border-color: hsl(var(--hue) 70% 60% / 0.6);
    box-shadow:
      inset 0 1px 0 var(--sheen),
      var(--shadow),
      0 0 24px -6px hsl(var(--hue) 80% 60% / 0.5);
    background: radial-gradient(90% 80% at 0% 0%, hsl(var(--hue) 80% 60% / 0.24), transparent 70%), var(--bg-elev);
  }
  .tabs button:hover::after {
    animation: sheen 700ms var(--ease);
  }
  .tabs button:active {
    transform: translateY(0) scale(0.97);
  }
  .tabs .ico {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    font-size: 16px;
    border-radius: 9px;
    background: hsl(var(--hue) 80% 60% / 0.16);
    box-shadow: inset 0 1px 0 var(--sheen);
    transition: transform var(--dur-slow) var(--spring);
  }
  .tabs button:hover .ico {
    transform: scale(1.25) rotate(-8deg);
  }
  .tabs button.on {
    color: var(--text);
    border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
    background:
      radial-gradient(90% 80% at 0% 0%, hsl(var(--hue) 80% 60% / 0.2), transparent 70%),
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--bg-elev)), var(--bg-elev));
    box-shadow:
      inset 0 1px 0 var(--sheen),
      0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),
      var(--glow);
  }
  .tabs button.on .ico {
    background: var(--grad-accent);
    color: #fff;
    box-shadow: 0 2px 10px -3px color-mix(in srgb, var(--accent) 80%, transparent);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
