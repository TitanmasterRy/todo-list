<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { TOPICS, searchTopics, type Topic } from '../../lib/studyhelp';
  import { aiAvailable, explain } from '../../lib/ai';
  import { renderMarkdown } from '../../lib/markdown';

  let q = $state('');
  let open = $state<string | null>(null);
  let question = $state('');
  let answer = $state('');
  let busy = $state(false);
  let subject = $state<'' | Topic['subject']>('');
  const results = $derived(searchTopics(q).filter((t) => !subject || t.subject === subject));
  const subjects: { id: Topic['subject']; label: string }[] = [
    { id: 'math', label: 'Math' },
    { id: 'science', label: 'Science' },
    { id: 'writing', label: 'Writing' },
    { id: 'study', label: 'Study skills' },
    { id: 'language', label: 'Languages' },
    { id: 'cs', label: 'CS' },
  ];
  function inlineMd(s: string): string {
    return renderMarkdown(s).replace(/^<p>|<\/p>$/g, '');
  }
  async function ask() {
    if (!question.trim()) return;
    busy = true;
    answer = '';
    try {
      const topic = open ? TOPICS.find((t) => t.id === open)?.title : undefined;
      answer = await explain(question, { topic, courseName: store.courseById(store.courseFilter ?? undefined)?.name });
    } catch (e) {
      toasts.push({ message: 'Could not get an answer', detail: e instanceof Error ? e.message : String(e), kind: 'warn' });
    } finally {
      busy = false;
    }
  }
</script>

<section class="card">
  <h2>Study help</h2>
  <p class="help">Quick reference sheets for common topics. Search, then open a sheet. {aiAvailable() ? 'Ask the tutor below for anything else.' : 'Add an API key in Settings → AI helper to ask questions in your own words.'}</p>
  <div class="search">
    <input class="input" bind:value={q} placeholder="Search: derivatives, quadratic, MLA, stoichiometry…" aria-label="Search topics" data-study-search />
    <div class="subs">
      <button class="chip" class:on={subject === ''} onclick={() => (subject = '')}>All</button>
      {#each subjects as s}<button class="chip" class:on={subject === s.id} onclick={() => (subject = subject === s.id ? '' : s.id)}>{s.label}</button>{/each}
    </div>
  </div>
  <div class="topics">
    {#each results as t (t.id)}
      <article class="topic" class:open={open === t.id}>
        <button class="t-head" onclick={() => (open = open === t.id ? null : t.id)} aria-expanded={open === t.id}>
          <span class="emoji">{t.emoji}</span>
          <span class="title">{t.title}</span>
          <span class="tags">{t.tags.slice(0, 3).join(' · ')}</span>
          <span class="chev">{open === t.id ? '▾' : '▸'}</span>
        </button>
        {#if open === t.id}
          <div class="body">
            {#each t.sections as s}
              <h4>{s.heading}</h4>
              <ul>{#each s.items as item}<li>{@html inlineMd(item)}</li>{/each}</ul>
            {/each}
          </div>
        {/if}
      </article>
    {/each}
    {#if !results.length}<p class="help">No sheet matches. Try a broader word, or ask below.</p>{/if}
  </div>
</section>

<section class="card ask">
  <h2>Ask the tutor {#if !aiAvailable()}<span class="muted">(optional AI)</span>{/if}</h2>
  <form onsubmit={(e) => { e.preventDefault(); void ask(); }}>
    <textarea class="textarea" bind:value={question} placeholder={aiAvailable() ? 'Explain how to find the derivative of x² sin(x), then give me one to try' : 'Add your Anthropic API key in Settings → AI helper to enable this'} disabled={!aiAvailable()}></textarea>
    <div class="btns">
      <button class="btn primary" type="submit" disabled={!aiAvailable() || !question.trim() || busy}>{busy ? 'Thinking…' : 'Ask'}</button>
      {#if open}<span class="muted">Context: {TOPICS.find((t) => t.id === open)?.title}</span>{/if}
    </div>
  </form>
  {#if answer}
    <div class="answer">{@html renderMarkdown(answer)}</div>
  {/if}
</section>

<style>
  section { margin-bottom: 12px; }
  h2 { font-size: 16px; margin: 0 0 6px; }
  .help, .muted { font-size: 13px; color: var(--text-muted); font-weight: 400; }
  .search { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 12px; }
  .subs { display: flex; gap: 4px; flex-wrap: wrap; }
  .subs .chip { cursor: pointer; }
  .subs .chip.on { border-color: var(--accent); color: var(--accent); }
  .topics { display: flex; flex-direction: column; gap: 6px; }
  .topic { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .topic.open { border-color: var(--accent); }
  .t-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left; color: var(--text); }
  .t-head:hover { background: var(--bg-hover); }
  .emoji { font-size: 18px; }
  .title { font-weight: 600; flex: 1; }
  .tags { font-size: 11px; color: var(--text-faint); }
  .body { padding: 4px 14px 12px; font-size: 14px; }
  .body h4 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .body ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
  .body :global(code) { font-family: var(--mono); font-size: 12px; background: var(--bg-elev-2); padding: 1px 4px; border-radius: 4px; }
  .ask .textarea { min-height: 70px; }
  .btns { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
  .answer { margin-top: 12px; padding: 12px; background: var(--bg-elev-2); border-radius: 10px; font-size: 14px; }
  .answer :global(p) { margin: 0 0 8px; }
  .answer :global(code) { font-family: var(--mono); font-size: 12px; }
</style>
