<script lang="ts">
  import { analyzeEssay, easeLabel } from '../../lib/essay';

  const KEY = 'homework-todo:essay-draft';
  let text = $state(
    (() => {
      try {
        return localStorage.getItem(KEY) ?? '';
      } catch {
        return '';
      }
    })(),
  );
  let goal = $state(500);
  const s = $derived(analyzeEssay(text));
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function onInput() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, text);
      } catch {
        /* ignore */
      }
    }, 400);
  }
  const pct = $derived(goal > 0 ? Math.min(100, (s.words / goal) * 100) : 0);
</script>

<section class="card">
  <h2>Essay tools</h2>
  <p class="help">Paste or write your draft. Counts, page estimates and readability update as you type. The draft stays in this browser only.</p>
  <textarea class="textarea" rows="12" bind:value={text} oninput={onInput} placeholder="Paste your essay here…" aria-label="Essay text"></textarea>
  <div class="goal">
    <label>Word goal <input class="input num" type="number" min="0" step="50" bind:value={goal} /></label>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={goal} aria-valuenow={s.words} aria-label="Progress to word goal">
      <div class="fill" style="width:{pct}%"></div>
    </div>
    <span class="muted">{s.words.toLocaleString()} / {goal.toLocaleString()}</span>
  </div>
  <div class="stats">
    <div><b>{s.words.toLocaleString()}</b><span>words</span></div>
    <div><b>{s.characters.toLocaleString()}</b><span>characters ({s.charactersNoSpaces.toLocaleString()} no spaces)</span></div>
    <div><b>{s.sentences}</b><span>sentences · {s.avgSentenceWords} words avg</span></div>
    <div><b>{s.paragraphs}</b><span>paragraphs</span></div>
    <div><b>{s.pagesDouble}</b><span>pages double-spaced ({s.pagesSingle} single)</span></div>
    <div><b>{s.readingMin} min</b><span>to read · {s.speakingMin} min to say aloud</span></div>
    <div><b>{s.fleschEase}</b><span>reading ease: {easeLabel(s.fleschEase)}</span></div>
    <div><b>{s.gradeLevel}</b><span>grade level (Flesch–Kincaid)</span></div>
  </div>
  {#if s.words}
    <div class="flags">
      {#if s.topWords.length}<p><strong>Most used:</strong> {s.topWords.map((w) => `${w.word} (${w.count})`).join(', ')}</p>{/if}
      {#if s.fillers.length}<p><strong>Filler words:</strong> {s.fillers.map((w) => `${w.word} ×${w.count}`).join(', ')}. Cutting them usually makes writing stronger.</p>{/if}
      {#if s.longSentences.length}
        <details>
          <summary><strong>{s.longSentences.length} long sentence{s.longSentences.length > 1 ? 's' : ''}</strong> (over 30 words)</summary>
          <ul>
            {#each s.longSentences as l, i (i)}<li>{l}</li>{/each}
          </ul>
        </details>
      {/if}
      {#if s.passive.length}
        <details>
          <summary><strong>{s.passive.length} possible passive-voice sentence{s.passive.length > 1 ? 's' : ''}</strong></summary>
          <ul>
            {#each s.passive as l, i (i)}<li>{l}</li>{/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}
</section>

<style>
  h2 {
    font-size: 16px;
    margin: 0 0 6px;
  }
  .help,
  .muted {
    font-size: 13px;
    color: var(--text-muted);
  }
  textarea {
    width: 100%;
    font-family: inherit;
    line-height: 1.6;
  }
  .goal {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0;
    flex-wrap: wrap;
  }
  .goal label {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
  }
  .num {
    width: 90px;
  }
  .bar {
    flex: 1;
    min-width: 140px;
    height: 8px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--dur);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
  }
  .stats div {
    display: grid;
    background: var(--bg-elev-2);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
  }
  .stats b {
    font-size: 18px;
  }
  .stats span {
    font-size: 12px;
    color: var(--text-muted);
  }
  .flags {
    font-size: 14px;
    margin-top: 10px;
  }
  .flags ul {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
