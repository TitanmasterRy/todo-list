<script lang="ts">
  import { focusTrap } from '../lib/focusTrap';
  import { store } from '../lib/store.svelte';
  import { ui } from '../lib/ui.svelte';

  import { COURSE_COLORS, COURSE_EMOJIS as EMOJIS } from '../lib/colors';

  const editing = $derived(ui.courseEditor && ui.courseEditor !== 'new' ? store.courseById(ui.courseEditor) : undefined);
  // svelte-ignore state_referenced_locally
  let name = $state(editing?.name ?? '');
  // svelte-ignore state_referenced_locally
  let color = $state(editing?.color ?? COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)]);
  // svelte-ignore state_referenced_locally
  let emoji = $state(editing?.emoji ?? '');
  // svelte-ignore state_referenced_locally
  let archived = $state(editing?.archived ?? false);
  // svelte-ignore state_referenced_locally
  let credits = $state(editing?.credits ? String(editing.credits) : '');
  // svelte-ignore state_referenced_locally
  let term = $state(editing?.term ?? '');
  // svelte-ignore state_referenced_locally
  let finalGrade = $state(typeof editing?.finalGrade === 'number' ? String(editing.finalGrade) : '');
  // svelte-ignore state_referenced_locally
  let schoologyName = $state(editing?.schoologyName ?? '');
  let input: HTMLInputElement | undefined = $state();
  $effect(() => input?.focus());

  function close() {
    ui.courseEditor = null;
  }
  function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    const extra = {
      credits: credits ? parseFloat(credits) || undefined : undefined,
      term: term.trim() || undefined,
      finalGrade: finalGrade !== '' ? Math.max(0, Math.min(120, parseFloat(finalGrade))) || undefined : undefined,
      schoologyName: schoologyName.trim() || undefined,
    };
    if (editing) store.updateCourse(editing.id, { name: name.trim(), color, emoji: emoji || undefined, archived, ...extra });
    else {
      const c = store.addCourse({ name: name.trim(), color, emoji: emoji || undefined });
      store.updateCourse(c.id, extra);
      store.go('courses', { courseId: c.id });
    }
    close();
  }
  function del() {
    if (!editing) return;
    store.deleteCourse(editing.id);
    close();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={close} onkeydown={onKey} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form use:focusTrap class="modal" aria-label={editing ? 'Edit course' : 'New course'} onclick={(e) => e.stopPropagation()} onsubmit={save}>
    <h2>{editing ? 'Edit course' : 'New course'}</h2>
    <div class="field">
      <label for="c-name">Name</label>
      <input id="c-name" class="input" bind:this={input} bind:value={name} placeholder="Calc II" />
    </div>
    <div class="field">
      <label for="c-color">Color</label>
      <div class="swatches" id="c-color">
        {#each COURSE_COLORS as c}
          <button type="button" class="sw" class:on={color === c} style="background:{c}" onclick={() => (color = c)} aria-label="Color {c}" aria-pressed={color === c}></button>
        {/each}
        <input type="color" bind:value={color} aria-label="Custom color" class="custom" />
      </div>
    </div>
    <div class="field">
      <label for="c-emoji">Emoji</label>
      <div class="emojis">
        {#each EMOJIS as e}
          <button type="button" class="em" class:on={emoji === e} onclick={() => (emoji = emoji === e ? '' : e)} aria-pressed={emoji === e}>{e}</button>
        {/each}
        <input id="c-emoji" class="input em-input" bind:value={emoji} placeholder="or type" maxlength="4" />
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label for="c-term">Term</label>
        <input id="c-term" class="input" bind:value={term} placeholder="Fall 2026" />
      </div>
      <div class="field">
        <label for="c-credits">Credits</label>
        <input id="c-credits" class="input" type="number" min="0" step="0.5" bind:value={credits} placeholder="1" />
      </div>
      <div class="field">
        <label for="c-final">Final grade % (override)</label>
        <input id="c-final" class="input" type="number" min="0" max="120" step="0.1" bind:value={finalGrade} placeholder="from calculator" />
      </div>
    </div>
    <div class="field">
      <label for="c-schoology">Name in Schoology (for sync matching)</label>
      <input id="c-schoology" class="input" bind:value={schoologyName} placeholder="AP Calculus BC - Period 3" />
    </div>
    {#if editing}
      <label class="check"><input type="checkbox" bind:checked={archived} /> Archived (hidden from lists, tasks kept)</label>
    {/if}
    <div class="actions">
      {#if editing}<button type="button" class="btn danger" onclick={del}>Delete course</button>{/if}
      <span class="grow"></span>
      <button type="button" class="btn" onclick={close}>Cancel</button>
      <button type="submit" class="btn primary">{editing ? 'Save' : 'Create'}</button>
    </div>
  </form>
</div>

<style>
  .swatches,
  .emojis {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .sw {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: transform var(--dur) var(--spring);
  }
  .sw.on {
    border-color: var(--text);
    transform: scale(1.15);
  }
  .custom {
    width: 28px;
    height: 28px;
    border: none;
    background: none;
    padding: 0;
  }
  .em {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 18px;
    border: 1px solid var(--border);
  }
  .em.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .em-input {
    width: 80px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin: 6px 0 12px;
    text-transform: none;
    color: var(--text);
    font-weight: 400;
  }
  .grow {
    flex: 1;
  }
</style>
