<script lang="ts">
  import { analyzeEssay, easeLabel } from '../../lib/essay';
  import { formatNumber, t } from '../../lib/i18n/index.svelte';

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
  <h2>{t('tools.essay')}</h2>
  <p class="help">{t('essay.help')}</p>
  <textarea class="textarea" rows="12" bind:value={text} oninput={onInput} placeholder={t('essay.placeholder')} aria-label={t('essay.text')}></textarea>
  <div class="goal">
    <label>{t('essay.goal')} <input class="input num" type="number" min="0" step="50" bind:value={goal} /></label>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={goal} aria-valuenow={s.words} aria-label={t('essay.progress')}>
      <div class="fill" style="width:{pct}%"></div>
    </div>
    <span class="muted">{formatNumber(s.words)} / {formatNumber(goal)}</span>
  </div>
  <div class="stats">
    <div><b>{formatNumber(s.words)}</b><span>{t('essay.words', { count: s.words })}</span></div>
    <div><b>{formatNumber(s.characters)}</b><span>{t('essay.chars', { n: formatNumber(s.charactersNoSpaces) })}</span></div>
    <div><b>{s.sentences}</b><span>{t('essay.sentences', { n: s.avgSentenceWords })}</span></div>
    <div><b>{s.paragraphs}</b><span>{t('essay.paragraphs')}</span></div>
    <div><b>{s.pagesDouble}</b><span>{t('essay.pages', { n: s.pagesSingle })}</span></div>
    <div><b>{s.readingMin} min</b><span>{t('essay.read', { n: s.speakingMin })}</span></div>
    <div><b>{s.fleschEase}</b><span>{t('essay.ease', { label: easeLabel(s.fleschEase) })}</span></div>
    <div><b>{s.gradeLevel}</b><span>{t('essay.grade')}</span></div>
  </div>
  {#if s.words}
    <div class="flags">
      {#if s.topWords.length}<p><strong>{t('essay.most')}</strong> {s.topWords.map((w) => `${w.word} (${w.count})`).join(', ')}</p>{/if}
      {#if s.fillers.length}<p><strong>{t('essay.fillers')}</strong> {s.fillers.map((w) => `${w.word} ×${w.count}`).join(', ')}. {t('essay.fillersTip')}</p>{/if}
      {#if s.longSentences.length}
        <details>
          <summary><strong>{t('essay.long', { count: s.longSentences.length })}</strong> {t('essay.over30')}</summary>
          <ul>
            {#each s.longSentences as l, i (i)}<li>{l}</li>{/each}
          </ul>
        </details>
      {/if}
      {#if s.passive.length}
        <details>
          <summary><strong>{t('essay.passive', { count: s.passive.length })}</strong></summary>
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
