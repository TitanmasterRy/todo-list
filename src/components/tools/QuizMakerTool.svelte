<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { aiAvailable, generateQuiz } from '../../lib/ai';
  import { uid } from '../../lib/id';
  import {
    SUBJECTS, newQuestion, isComplete, correctText, toQuizlet, toBlooket, toGimkit, toKahoot, toWorksheet, toCards, fromCards, toQTIZip, parseQuizText, download,
    type QuizSet, type Question, type QuestionType, type Difficulty,
  } from '../../lib/quizmaker';

  const KEY = 'homework-todo:quizsets';
  function load(): QuizSet[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QuizSet[];
    } catch {
      return [];
    }
  }
  let sets = $state<QuizSet[]>(load());
  let currentId = $state<string | null>(null);
  const current = $derived(sets.find((s) => s.id === currentId) ?? null);
  function persist() {
    localStorage.setItem(KEY, JSON.stringify(sets));
  }
  function touch() {
    if (!current) return;
    current.updatedAt = new Date().toISOString();
    persist();
  }

  // ---- new set / generator ----
  let title = $state('');
  let subject = $state('Math');
  let topic = $state('');
  let count = $state(10);
  let difficulty = $state<Difficulty>('medium');
  let gradeLevel = $state('');
  let types = $state<QuestionType[]>(['mc']);
  let audience = $state<'student' | 'teacher'>('student');
  let source = $state('');
  let busy = $state(false);
  let pasteText = $state('');
  let deckId = $state('');

  function toggleType(t: QuestionType) {
    types = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    if (!types.length) types = ['mc'];
  }
  function createSet(questions: Question[] = []): QuizSet {
    const s: QuizSet = { id: uid('set'), title: title.trim() || `${subject}${topic ? ': ' + topic : ''}`, subject, topic: topic.trim() || undefined, difficulty, gradeLevel: gradeLevel || undefined, questions, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    sets = [s, ...sets];
    currentId = s.id;
    persist();
    return s;
  }
  async function generate() {
    busy = true;
    try {
      const gen = await generateQuiz({ subject, topic, count: Math.max(1, Math.min(50, count)), difficulty, gradeLevel, types, source: source.trim() || undefined, audience });
      const qs: Question[] = gen.map((g, i) => ({
        id: `q_${Date.now().toString(36)}_${i}`,
        type: g.type,
        prompt: g.prompt,
        options: g.type === 'tf' ? ['True', 'False'] : g.type === 'mc' ? (g.options ?? []).slice(0, 4) : [],
        correct: g.type === 'mc' || g.type === 'tf' ? (g.correct ?? [0]).filter((c) => c >= 0 && c < 4) : [],
        answer: g.answer,
        explanation: g.explanation,
      }));
      const s = current && !current.questions.length ? current : createSet();
      s.questions = [...s.questions, ...qs];
      touch();
      toasts.push({ message: `Generated ${qs.length} questions`, kind: 'success', emoji: '✨' });
    } catch (e) {
      toasts.push({ message: 'Generation failed', detail: e instanceof Error ? e.message : String(e), kind: 'warn', timeout: 9000 });
    } finally {
      busy = false;
    }
  }
  function startManual() {
    createSet([newQuestion('mc')]);
  }
  function importPaste() {
    const qs = parseQuizText(pasteText);
    if (!qs.length) return toasts.push({ message: 'No questions found', detail: 'Use "1. Question" then "A) option" lines, mark the right one with *', kind: 'warn' });
    const s = current ?? createSet();
    s.questions = [...s.questions, ...qs];
    touch();
    pasteText = '';
    toasts.push({ message: `Imported ${qs.length} questions`, kind: 'success' });
  }
  function importDeck() {
    const cards = store.cards.filter((c) => c.deckId === deckId);
    if (!cards.length) return;
    const s = current ?? createSet();
    s.questions = [...s.questions, ...fromCards(cards.map((c) => ({ front: c.front, back: c.back })))];
    touch();
    toasts.push({ message: `Made ${cards.length} questions from the deck`, kind: 'success' });
  }

  // ---- editor ----
  function addQ(t: QuestionType) {
    if (!current) return;
    current.questions = [...current.questions, newQuestion(t)];
    touch();
  }
  function removeQ(id: string) {
    if (!current) return;
    current.questions = current.questions.filter((q) => q.id !== id);
    touch();
  }
  function setType(q: Question, t: QuestionType) {
    q.type = t;
    if (t === 'tf') {
      q.options = ['True', 'False'];
      q.correct = [0];
    } else if (t === 'mc') {
      q.options = q.options.length >= 2 ? q.options : ['', '', '', ''];
      q.correct = q.correct.length ? q.correct : [0];
    } else {
      q.options = [];
      q.correct = [];
    }
    touch();
  }
  function toggleCorrect(q: Question, i: number, multi: boolean) {
    q.correct = multi ? (q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i].sort()) : [i];
    touch();
  }
  function move(i: number, d: number) {
    if (!current) return;
    const j = i + d;
    if (j < 0 || j >= current.questions.length) return;
    const qs = [...current.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    current.questions = qs;
    touch();
  }
  function deleteSet(id: string) {
    sets = sets.filter((s) => s.id !== id);
    if (currentId === id) currentId = null;
    persist();
  }
  const complete = $derived(current ? current.questions.filter(isComplete).length : 0);

  // ---- exports ----
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ message: `${what} copied`, kind: 'success', timeout: 2000 });
    } catch {
      toasts.push({ message: 'Copy failed', kind: 'warn' });
    }
  }
  const slug = $derived((current?.title ?? 'quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  function exportCards() {
    if (!current) return;
    const deck = store.addDeck(current.title, undefined);
    const added = store.addCards(deck.id, toCards(current.questions));
    toasts.push({ message: `${added.length} notecards added to “${deck.name}”`, kind: 'success', emoji: '🃏' });
  }
</script>

{#if !current}
  <section class="card">
    <h2>Quiz maker</h2>
    <p class="help">Build a question set by hand, from a prompt, from your notes, or from a notecard deck. Then export it to <strong>Quizlet</strong>, <strong>Blooket</strong>, <strong>Gimkit</strong>, <strong>Kahoot</strong>, a printable worksheet with answer key, or a <strong>QTI package for Schoology tests and quizzes</strong> (teachers).</p>
    <div class="grid">
      <label>Title <input class="input" bind:value={title} placeholder="Unit 3 review" /></label>
      <label>Subject <select class="select" bind:value={subject}>{#each SUBJECTS as s}<option value={s}>{s}</option>{/each}</select></label>
      <label>Topic <input class="input" bind:value={topic} placeholder="Photosynthesis, quadratic equations…" /></label>
      <label>Level <input class="input" bind:value={gradeLevel} placeholder="9th grade, AP, college…" /></label>
      <label>Questions <input class="input" type="number" min="1" max="50" bind:value={count} /></label>
      <label>Difficulty <select class="select" bind:value={difficulty}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option></select></label>
    </div>
    <div class="types">
      <span class="lbl">Types:</span>
      {#each [['mc', 'Multiple choice'], ['tf', 'True / false'], ['short', 'Short answer'], ['fill', 'Fill in the blank']] as [t, l]}
        <button class="chip" class:on={types.includes(t as QuestionType)} onclick={() => toggleType(t as QuestionType)}>{l}</button>
      {/each}
      <span class="lbl">For:</span>
      <button class="chip" class:on={audience === 'student'} onclick={() => (audience = 'student')}>Studying</button>
      <button class="chip" class:on={audience === 'teacher'} onclick={() => (audience = 'teacher')}>Teacher quiz/test</button>
    </div>
    <details class="more"><summary>Base it on my notes or a passage (optional)</summary><textarea class="textarea" bind:value={source} placeholder="Paste notes, a chapter summary, or a transcription from Scan paper…"></textarea></details>
    <div class="btns">
      <button class="btn primary" onclick={generate} disabled={busy || !aiAvailable()} title={aiAvailable() ? '' : 'Add an AI key in Settings (free options available)'}>{busy ? 'Generating…' : '✨ Generate with AI'}</button>
      <button class="btn" onclick={startManual}>✍️ Make it by hand</button>
    </div>
    {#if !aiAvailable()}<p class="help">AI generation needs a key in Settings → AI helper. Gemini and Groq have free tiers.</p>{/if}
    <details class="more"><summary>Import questions from text</summary>
      <textarea class="textarea" bind:value={pasteText} placeholder={'1. Capital of France?\nA) Berlin\nB) Paris*\nC) Rome\n\nQ: 2 + 2\nA: 4'}></textarea>
      <button class="btn sm" onclick={importPaste} disabled={!pasteText.trim()}>Import</button>
    </details>
    {#if store.decks.length}
      <details class="more"><summary>Turn a notecard deck into a quiz</summary>
        <div class="btns"><select class="select" bind:value={deckId}><option value="">Pick a deck</option>{#each store.decks as d (d.id)}<option value={d.id}>{d.name}</option>{/each}</select><button class="btn sm" onclick={importDeck} disabled={!deckId}>Make quiz</button></div>
      </details>
    {/if}
    {#if sets.length}
      <h3>Saved sets</h3>
      <ul class="sets">
        {#each sets as s (s.id)}
          <li><button class="set" onclick={() => (currentId = s.id)}><strong>{s.title}</strong><span class="muted">{s.subject} · {s.questions.length} q · {s.difficulty}</span></button><button class="btn ghost sm" onclick={() => deleteSet(s.id)}>Delete</button></li>
        {/each}
      </ul>
    {/if}
  </section>
{:else}
  <section class="card">
    <div class="head">
      <button class="btn ghost sm" onclick={() => (currentId = null)}>← Sets</button>
      <input class="input title" bind:value={current.title} onchange={touch} aria-label="Set title" />
      <span class="muted">{complete}/{current.questions.length} complete</span>
    </div>
    <div class="exports">
      <span class="lbl">Export:</span>
      <button class="btn sm" onclick={() => copy(toQuizlet(current!.questions), 'Quizlet text')} title="Quizlet → Create set → Import → paste; separators: Tab / New line">Quizlet (copy)</button>
      <button class="btn sm" onclick={() => download(`${slug}-blooket.csv`, toBlooket(current!.questions), 'text/csv')} title="Blooket → My sets → Create → Import from spreadsheet">Blooket .csv</button>
      <button class="btn sm" onclick={() => download(`${slug}-gimkit.csv`, toGimkit(current!.questions), 'text/csv')} title="Gimkit → New kit → Import from spreadsheet">Gimkit .csv</button>
      <button class="btn sm" onclick={() => download(`${slug}-kahoot.csv`, toKahoot(current!.questions), 'text/csv')} title="Kahoot → Create → Import spreadsheet (open the CSV in Excel/Sheets and save as .xlsx if required)">Kahoot .csv</button>
      <button class="btn sm" onclick={() => download(`${slug}-worksheet.md`, toWorksheet(current!), 'text/markdown')}>Worksheet + key</button>
      <button class="btn sm" onclick={exportCards}>Notecards</button>
      <button class="btn sm primary" onclick={() => download(`${slug}-qti.zip`, toQTIZip(current!), 'application/zip')} title="Schoology → course → Add Materials → Test/Quiz → Add Question → Import → QTI (also works in Canvas, Moodle, Blackboard)">Schoology QTI .zip</button>
    </div>
    <p class="help">Teachers: in Schoology open the Test/Quiz → <strong>Add Question → Import → QTI</strong> and upload the zip; questions land in the test with points and feedback. The same file imports into Canvas, Moodle and Blackboard.</p>
    <ol class="qs">
      {#each current.questions as q, i (q.id)}
        <li class="q" class:incomplete={!isComplete(q)}>
          <div class="qhead">
            <span class="num">{i + 1}</span>
            <select class="select sm" value={q.type} onchange={(e) => setType(q, (e.target as HTMLSelectElement).value as QuestionType)} aria-label="Question type">
              <option value="mc">Multiple choice</option><option value="tf">True/false</option><option value="short">Short answer</option><option value="fill">Fill in blank</option>
            </select>
            <span class="grow"></span>
            <button class="btn ghost sm icon" onclick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button class="btn ghost sm icon" onclick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button class="btn ghost sm icon" onclick={() => removeQ(q.id)} aria-label="Delete question">×</button>
          </div>
          <textarea class="textarea prompt" bind:value={q.prompt} onchange={touch} placeholder={q.type === 'fill' ? 'The powerhouse of the cell is the ____.' : 'Question'} rows="2"></textarea>
          {#if q.type === 'mc' || q.type === 'tf'}
            <div class="opts">
              {#each q.options as _, j (j)}
                <label class="opt" class:right={q.correct.includes(j)}>
                  <input type={q.type === 'tf' ? 'radio' : 'checkbox'} checked={q.correct.includes(j)} onchange={() => toggleCorrect(q, j, q.type === 'mc')} aria-label="Correct" />
                  <span class="letter">{String.fromCharCode(65 + j)}</span>
                  {#if q.type === 'tf'}<span>{q.options[j]}</span>{:else}<input class="input" bind:value={q.options[j]} onchange={touch} placeholder="Option {String.fromCharCode(65 + j)}" />{/if}
                </label>
              {/each}
            </div>
          {:else}
            <input class="input" bind:value={q.answer} onchange={touch} placeholder="Correct answer" />
          {/if}
          <input class="input expl" bind:value={q.explanation} onchange={touch} placeholder="Explanation (optional, shown in answer key / feedback)" />
        </li>
      {/each}
    </ol>
    <div class="btns">
      <button class="btn" onclick={() => addQ('mc')}>+ Multiple choice</button>
      <button class="btn" onclick={() => addQ('tf')}>+ True/false</button>
      <button class="btn" onclick={() => addQ('short')}>+ Short answer</button>
      <button class="btn" onclick={() => addQ('fill')}>+ Fill in blank</button>
      {#if aiAvailable()}<button class="btn ghost" onclick={generate} disabled={busy}>{busy ? 'Generating…' : '✨ Add more with AI'}</button>{/if}
    </div>
  </section>
{/if}

<style>
  h2 { font-size: 16px; margin: 0 0 6px; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 14px 0 6px; }
  .help, .muted { font-size: 13px; color: var(--text-muted); font-weight: 400; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin: 8px 0; }
  .grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-muted); }
  .types { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
  .types .chip { cursor: pointer; }
  .types .chip.on { border-color: var(--accent); color: var(--accent); }
  .lbl { font-size: 12px; color: var(--text-muted); }
  .more { margin: 8px 0; font-size: 13px; color: var(--text-muted); }
  .more .textarea { margin: 6px 0; min-height: 70px; }
  .btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
  .btns .select { width: auto; }
  .sets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .sets li { display: flex; align-items: center; gap: 8px; }
  .set { flex: 1; display: flex; flex-direction: column; align-items: flex-start; padding: 8px 10px; border-radius: 8px; background: var(--bg-elev-2); text-align: left; color: var(--text); }
  .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .title { flex: 1; min-width: 160px; font-weight: 600; }
  .exports { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; background: var(--bg-elev-2); border-radius: 10px; }
  .qs { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .q { border: 1px solid var(--border); border-radius: 12px; padding: 10px; }
  .q.incomplete { border-color: color-mix(in srgb, var(--warn) 50%, var(--border)); }
  .qhead { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .num { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; }
  .select.sm { width: auto; padding: 4px 8px; font-size: 13px; }
  .grow { flex: 1; }
  .prompt { min-height: 44px; margin-bottom: 6px; }
  .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; }
  .opt { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px; border: 1px solid transparent; }
  .opt.right { border-color: var(--success); background: color-mix(in srgb, var(--success) 10%, transparent); }
  .opt input[type='radio'], .opt input[type='checkbox'] { accent-color: var(--success); }
  .letter { width: 20px; font-weight: 700; font-size: 12px; color: var(--text-muted); }
  .expl { margin-top: 6px; font-size: 13px; }
</style>
