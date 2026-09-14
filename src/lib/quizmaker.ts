// Quiz sets: manual or AI-made, exported to Quizlet, Blooket, Gimkit, Kahoot, printable worksheets, notecards, and QTI 1.2 (Schoology).
import { buildZip } from './zip';

export type QuestionType = 'mc' | 'tf' | 'short' | 'fill';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[]; // mc: 2–4 options; tf: ['True','False']; short/fill: [] (answer in `answer`)
  correct: number[]; // indexes into options for mc/tf
  answer?: string; // short / fill
  explanation?: string;
  points?: number;
  timeSec?: number;
}

export interface QuizSet {
  id: string;
  title: string;
  subject: string;
  topic?: string;
  difficulty: Difficulty;
  gradeLevel?: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

export const SUBJECTS = ['Math', 'Science', 'Biology', 'Chemistry', 'Physics', 'English', 'History', 'Geography', 'Spanish', 'French', 'Computer Science', 'Health', 'Art', 'Music', 'Other'];

let n = 0;
export function newQuestion(type: QuestionType = 'mc'): Question {
  const id = `q_${Date.now().toString(36)}_${++n}`;
  if (type === 'tf') return { id, type, prompt: '', options: ['True', 'False'], correct: [0] };
  if (type === 'mc') return { id, type, prompt: '', options: ['', '', '', ''], correct: [0] };
  return { id, type, prompt: '', options: [], correct: [], answer: '' };
}

export function correctText(q: Question): string {
  if (q.type === 'short' || q.type === 'fill') return q.answer ?? '';
  return q.correct.map((i) => q.options[i] ?? '').filter(Boolean).join(' / ');
}

export function isComplete(q: Question): boolean {
  if (!q.prompt.trim()) return false;
  if (q.type === 'short' || q.type === 'fill') return !!q.answer?.trim();
  return q.options.filter((o) => o.trim()).length >= 2 && q.correct.length > 0 && q.correct.every((i) => q.options[i]?.trim());
}

function csvCell(s: string | number | undefined): string {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function csv(rows: (string | number | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Quizlet: paste into Import with "Tab" between term and definition, "New line" between cards. */
export function toQuizlet(qs: Question[]): string {
  return qs
    .filter(isComplete)
    .map((q) => `${q.prompt.replace(/\t|\n/g, ' ')}\t${correctText(q).replace(/\t|\n/g, ' ')}`)
    .join('\n');
}

/** Blooket import template (Question Set → Import → Spreadsheet): Question #, Question Text, Answer 1–4, Time Limit (sec), Correct Answer(s) (1-based, comma-separated). */
export function toBlooket(qs: Question[]): string {
  const rows: (string | number | undefined)[][] = [['Question #', 'Question Text', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time Limit (sec) (Max: 300 seconds)', 'Correct Answer(s) (Only include Answer #)']];
  let i = 1;
  for (const q of qs.filter(isComplete)) {
    const { options, correct } = asChoice(q);
    rows.push([i++, q.prompt, options[0] ?? '', options[1] ?? '', options[2] ?? '', options[3] ?? '', q.timeSec ?? 20, correct.map((c) => c + 1).join(',')]);
  }
  return csv(rows);
}

/** Gimkit import (Kit → Import → Spreadsheet): Question, Correct Answer, Incorrect Answer 1–3. */
export function toGimkit(qs: Question[]): string {
  const rows: (string | number | undefined)[][] = [['Question', 'Correct Answer', 'Incorrect Answer 1', 'Incorrect Answer 2', 'Incorrect Answer 3']];
  for (const q of qs.filter(isComplete)) {
    const { options, correct } = asChoice(q);
    const good = options[correct[0]] ?? '';
    const bad = options.filter((_, i) => !correct.includes(i));
    rows.push([q.prompt, good, bad[0] ?? '', bad[1] ?? '', bad[2] ?? '']);
  }
  return csv(rows);
}

/** Kahoot spreadsheet template: Question, Answer 1–4, Time limit, Correct answer(s). */
export function toKahoot(qs: Question[]): string {
  const rows: (string | number | undefined)[][] = [['Question - max 120 characters', 'Answer 1 - max 75 characters', 'Answer 2 - max 75 characters', 'Answer 3 - max 75 characters', 'Answer 4 - max 75 characters', 'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs', 'Correct answer(s) - choose at least one']];
  for (const q of qs.filter(isComplete)) {
    const { options, correct } = asChoice(q);
    rows.push([q.prompt.slice(0, 120), (options[0] ?? '').slice(0, 75), (options[1] ?? '').slice(0, 75), (options[2] ?? '').slice(0, 75), (options[3] ?? '').slice(0, 75), q.timeSec && [5, 10, 20, 30, 60, 90, 120, 240].includes(q.timeSec) ? q.timeSec : 20, correct.map((c) => c + 1).join(',')]);
  }
  return csv(rows);
}

/** Turn short-answer questions into 1-option choice rows for game platforms (they need options): uses the answer plus distractors from other questions. */
export function asChoice(q: Question, pool: Question[] = []): { options: string[]; correct: number[] } {
  if (q.type === 'mc' || q.type === 'tf') return { options: q.options.slice(0, 4), correct: q.correct.filter((i) => i < 4) };
  const distractors = pool.filter((p) => p.id !== q.id && (p.type === 'short' || p.type === 'fill') && p.answer).map((p) => p.answer!).slice(0, 3);
  return { options: [q.answer ?? '', ...distractors], correct: [0] };
}

/** Printable worksheet + answer key in markdown. */
export function toWorksheet(set: QuizSet, opts: { key?: boolean } = { key: true }): string {
  const lines: string[] = [`# ${set.title}`, `${set.subject}${set.topic ? ` · ${set.topic}` : ''} · ${set.questions.length} questions · ${set.difficulty}`, '', 'Name: ______________________   Date: __________', ''];
  set.questions.forEach((q, i) => {
    lines.push(`**${i + 1}.** ${q.prompt}${q.type === 'fill' ? '' : ''}`);
    if (q.type === 'mc' || q.type === 'tf') q.options.filter((o) => o.trim()).forEach((o, j) => lines.push(`   ${String.fromCharCode(65 + j)}) ${o}`));
    else lines.push('   ______________________________________________');
    lines.push('');
  });
  if (opts.key) {
    lines.push('---', '', '## Answer key', '');
    set.questions.forEach((q, i) => {
      const ans = q.type === 'mc' || q.type === 'tf' ? q.correct.map((c) => String.fromCharCode(65 + c)).join(', ') + ` (${correctText(q)})` : correctText(q);
      lines.push(`${i + 1}. ${ans}${q.explanation ? ` — ${q.explanation}` : ''}`);
    });
  }
  return lines.join('\n') + '\n';
}

/** Notecards (front = prompt, back = answer). */
export function toCards(qs: Question[]): { front: string; back: string }[] {
  return qs.filter(isComplete).map((q) => ({ front: q.prompt, back: correctText(q) }));
}

/** Build questions from notecards: each card's back is the answer; other cards' backs become distractors. */
export function fromCards(cards: { front: string; back: string }[]): Question[] {
  return cards.map((c, i) => {
    const others = cards.filter((_, j) => j !== i).map((o) => o.back);
    const distractors = shuffleDet(others, i).slice(0, 3);
    const options = shuffleDet([c.back, ...distractors], i * 7 + 3);
    return { id: `q_card_${i}`, type: 'mc', prompt: c.front, options, correct: [options.indexOf(c.back)] } as Question;
  });
}

function shuffleDet<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed + 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- QTI 1.2 package (Schoology: Test/Quiz → Add Question → Import → QTI) ----------
function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function toQTI(set: QuizSet): string {
  const items = set.questions.filter(isComplete).map((q, i) => {
    const ident = `item_${i + 1}`;
    const pts = q.points ?? 1;
    if (q.type === 'mc' || q.type === 'tf') {
      const opts = q.options.map((o, j) => ({ id: `${ident}_${j}`, text: o })).filter((o) => o.text.trim());
      const multi = q.correct.length > 1;
      const conditions = multi
        ? `<respcondition continue="No"><conditionvar><and>${q.correct.map((c) => `<varequal respident="response1">${ident}_${c}</varequal>`).join('')}</and></conditionvar><setvar action="Set" varname="SCORE">${pts}</setvar></respcondition>`
        : q.correct.map((c) => `<respcondition continue="No"><conditionvar><varequal respident="response1">${ident}_${c}</varequal></conditionvar><setvar action="Set" varname="SCORE">${pts}</setvar></respcondition>`).join('');
      return `<item ident="${ident}" title="${xml(q.prompt.slice(0, 60))}">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${q.type === 'tf' ? 'true_false_question' : multi ? 'multiple_answers_question' : 'multiple_choice_question'}</fieldentry></qtimetadatafield>
    <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pts}</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/html">${xml(`<p>${q.prompt}</p>`)}</mattext></material>
    <response_lid ident="response1" rcardinality="${multi ? 'Multiple' : 'Single'}"><render_choice>
      ${opts.map((o) => `<response_label ident="${o.id}"><material><mattext texttype="text/plain">${xml(o.text)}</mattext></material></response_label>`).join('\n      ')}
    </render_choice></response_lid>
  </presentation>
  <resprocessing><outcomes><decvar maxvalue="${pts}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>${conditions}</resprocessing>
  ${q.explanation ? `<itemfeedback ident="general_fb"><flow_mat><material><mattext texttype="text/plain">${xml(q.explanation)}</mattext></material></flow_mat></itemfeedback>` : ''}
</item>`;
    }
    // short answer / fill in the blank
    return `<item ident="${ident}" title="${xml(q.prompt.slice(0, 60))}">
  <itemmetadata><qtimetadata>
    <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>short_answer_question</fieldentry></qtimetadatafield>
    <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${pts}</fieldentry></qtimetadatafield>
  </qtimetadata></itemmetadata>
  <presentation>
    <material><mattext texttype="text/html">${xml(`<p>${q.prompt}</p>`)}</mattext></material>
    <response_str ident="response1" rcardinality="Single"><render_fib><response_label ident="answer1" rshuffle="No"/></render_fib></response_str>
  </presentation>
  <resprocessing><outcomes><decvar maxvalue="${pts}" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No"><conditionvar><varequal respident="response1" case="No">${xml(q.answer ?? '')}</varequal></conditionvar><setvar action="Set" varname="SCORE">${pts}</setvar></respcondition>
  </resprocessing>
</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
<assessment ident="${xml(set.id)}" title="${xml(set.title)}">
  <qtimetadata><qtimetadatafield><fieldlabel>qmd_assessmenttype</fieldlabel><fieldentry>Assessment</fieldentry></qtimetadatafield></qtimetadata>
  <section ident="root_section">
${items.join('\n')}
  </section>
</assessment>
</questestinterop>
`;
}

export function toQTIManifest(set: QuizSet): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(set.id)}_manifest" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
  <metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata>
  <organizations/>
  <resources>
    <resource identifier="${xml(set.id)}" type="imsqti_xmlv1p2" href="${xml(set.id)}.xml"><file href="${xml(set.id)}.xml"/></resource>
  </resources>
</manifest>
`;
}

/** QTI package as a zip (imsmanifest.xml + <id>.xml). */
export function toQTIZip(set: QuizSet): Uint8Array {
  return buildZip([
    { name: 'imsmanifest.xml', data: toQTIManifest(set) },
    { name: `${set.id}.xml`, data: toQTI(set) },
  ]);
}

/** Parse a pasted plain-text quiz: "1. Question?\nA) x\nB) y*\n..." where * marks correct; or "Q: … / A: …" pairs. */
export function parseQuizText(text: string): Question[] {
  const out: Question[] = [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const prompt = lines[0].replace(/^\d+[.)]\s*/, '').replace(/^q(?:uestion)?\s*[:.)-]\s*/i, '');
    const opts = lines.slice(1).filter((l) => /^[A-Da-d][.)]\s*/.test(l));
    if (opts.length >= 2) {
      const options = opts.map((l) => l.replace(/^[A-Da-d][.)]\s*/, '').replace(/\s*\*$/, ''));
      const correct = opts.map((l, i) => (/\*$/.test(l) ? i : -1)).filter((i) => i >= 0);
      out.push({ id: `q_p_${out.length}`, type: 'mc', prompt, options, correct: correct.length ? correct : [0] });
    } else {
      const a = lines.slice(1).find((l) => /^a(?:nswer)?\s*[:.)-]/i.test(l));
      if (a) out.push({ id: `q_p_${out.length}`, type: 'short', prompt, options: [], correct: [], answer: a.replace(/^a(?:nswer)?\s*[:.)-]\s*/i, '') });
    }
  }
  return out;
}

export function download(name: string, data: string | Uint8Array, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
