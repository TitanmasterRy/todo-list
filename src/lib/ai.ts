// AI helper. Anthropic goes through the official SDK; every other provider speaks the OpenAI-compatible chat API.
import Anthropic from '@anthropic-ai/sdk';
import { store } from './store.svelte';
import type { AiProvider, TaskType } from './types';
import { chatOpenAICompatible, providerInfo, type ChatImage, type ChatRequest } from './ai-providers';

export function currentProvider(): AiProvider {
  return store.settings.aiProvider || 'anthropic';
}

export function currentKey(provider: AiProvider = currentProvider()): string {
  if (provider === 'anthropic') return store.settings.aiKeys.anthropic || store.settings.aiApiKey || '';
  return store.settings.aiKeys[provider] || '';
}

export function currentModel(provider: AiProvider = currentProvider()): string {
  const chosen = store.settings.aiModels[provider];
  if (chosen) return chosen;
  if (provider === 'anthropic') return store.settings.aiModel || 'claude-opus-5';
  return providerInfo(provider).models[0]?.id ?? 'default';
}

export function aiAvailable(): boolean {
  const p = currentProvider();
  if (p === 'ollama') return true;
  if (p === 'custom') return !!store.settings.aiBaseUrl;
  return !!currentKey(p);
}

export function aiSupportsVision(): boolean {
  const p = currentProvider();
  const info = providerInfo(p);
  const m = info.models.find((x) => x.id === currentModel(p));
  return m ? m.vision : p === 'custom' || p === 'ollama';
}

function anthropicClient(): Anthropic {
  const apiKey = currentKey('anthropic');
  if (!apiKey) throw new Error('Add an Anthropic API key in Settings → AI helper first.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function askAnthropic(req: ChatRequest): Promise<string> {
  try {
    const content: Anthropic.ContentBlockParam[] = [];
    for (const img of req.images ?? []) {
      const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.*)$/.exec(img.dataUrl);
      if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: m[2] } });
    }
    content.push({ type: 'text', text: req.user });
    const res = await anthropicClient().messages.create({
      model: currentModel('anthropic'),
      max_tokens: req.maxTokens ?? 2048,
      system: req.system,
      messages: [{ role: 'user', content }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The model declined this request.');
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API key rejected. Check it in Settings → AI helper.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited. Try again in a moment.');
    if (e instanceof Anthropic.APIError) throw new Error(`API error ${e.status}: ${e.message}`);
    throw e;
  }
}

/** Route a request to the configured provider. */
export async function ask(system: string, user: string, maxTokens = 2048, images?: ChatImage[]): Promise<string> {
  const provider = currentProvider();
  const req: ChatRequest = { system, user, maxTokens, images };
  if (provider === 'anthropic') return askAnthropic(req);
  const info = providerInfo(provider);
  const baseUrl = provider === 'custom' ? store.settings.aiBaseUrl : provider === 'ollama' && store.settings.aiBaseUrl ? store.settings.aiBaseUrl : info.baseUrl;
  if (!baseUrl) throw new Error('Set the endpoint URL for your custom provider in Settings → AI helper.');
  if (info.needsKey && !currentKey(provider)) throw new Error(`Add a ${info.name} API key in Settings → AI helper first.`);
  return chatOpenAICompatible({ baseUrl, apiKey: currentKey(provider) || undefined, model: currentModel(provider), provider }, req);
}

function parseJSON<T>(text: string): T {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (m ? m[1] : text).trim();
  const start = raw.search(/[[{]/);
  return JSON.parse(start > 0 ? raw.slice(start) : raw) as T;
}

/** Explain a topic or answer a question at a student's level, in markdown. */
export async function explain(question: string, context?: { courseName?: string; topic?: string }): Promise<string> {
  const system =
    'You are a patient tutor for a high school / early college student. Explain clearly and concretely, with a worked example when it helps. ' +
    'Use short paragraphs and markdown. Do not do graded work for the student; teach the method and check understanding with one quick practice question at the end.';
  const ctx = [context?.courseName && `Course: ${context.courseName}`, context?.topic && `Topic: ${context.topic}`].filter(Boolean).join('\n');
  return ask(system, `${ctx ? ctx + '\n\n' : ''}${question}`);
}

/** Turn notes or a topic into flashcards. */
export async function makeNotecards(source: string, count = 12): Promise<{ front: string; back: string }[]> {
  const system =
    'You write study flashcards. Output ONLY a JSON array of objects with "front" and "back" strings. Fronts are questions or terms; backs are concise answers (max 2 sentences). ' +
    'Cover the most testable ideas first. No markdown fences, no commentary.';
  const text = await ask(system, `Make ${count} flashcards from this:\n\n${source.slice(0, 12000)}`, 4096);
  const cards = parseJSON<{ front: string; back: string }[]>(text);
  if (!Array.isArray(cards)) throw new Error('Unexpected response');
  return cards.filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string').map((c) => ({ front: c.front.trim(), back: c.back.trim() }));
}

export interface AiTaskPlan {
  notes: string;
  subtasks: string[];
  estimateMin: number;
  type: TaskType;
}

/** Describe a task: a short plan, steps, and an estimate. */
export async function planTask(title: string, courseName?: string): Promise<AiTaskPlan> {
  const system =
    'You help a student plan a homework task. Output ONLY JSON: {"notes": string (2-3 short markdown lines: what it is, a plan, a tip), "subtasks": string[] (2-5 concrete steps), "estimateMin": number, "type": one of "homework","reading","exam","project","quiz","other"}.';
  const text = await ask(system, `Task: ${title}${courseName ? `\nCourse: ${courseName}` : ''}`, 1024);
  const p = parseJSON<Partial<AiTaskPlan>>(text);
  const types: TaskType[] = ['homework', 'reading', 'exam', 'project', 'quiz', 'other'];
  return {
    notes: String(p.notes ?? '').trim(),
    subtasks: Array.isArray(p.subtasks) ? p.subtasks.map(String).slice(0, 6) : [],
    estimateMin: Math.max(5, Math.min(600, Number(p.estimateMin) || 30)),
    type: types.includes(p.type as TaskType) ? (p.type as TaskType) : 'homework',
  };
}

/** Transcribe photos of paper (worksheets, notes, textbook pages) to markdown that keeps the structure. */
export async function transcribeImages(images: ChatImage[], hint?: string): Promise<string> {
  const system =
    'You transcribe photos of documents for a student. Output the full text as clean markdown that preserves the original structure: headings, numbered questions, bullet lists, tables (as markdown tables), blanks as "____", checkboxes as "[ ]", and math as readable inline expressions (fractions like 3/4, exponents like x^2, sqrt(...)). ' +
    'Keep the original order and wording exactly; do not solve anything, do not add commentary. If part is unreadable write [unreadable]. If there are multiple pages, separate them with a line "---".';
  return ask(system, `${hint ? hint + '\n\n' : ''}Transcribe these ${images.length} image${images.length > 1 ? 's' : ''}.`, 8000, images);
}

/** Make an answer key for a transcribed worksheet. */
export async function answerKey(text: string, opts?: { showWork?: boolean; courseName?: string }): Promise<string> {
  const system =
    'You are a teacher writing an answer key. For each numbered question or blank in the worksheet, give the answer in a markdown list in the same order and numbering. ' +
    (opts?.showWork ? 'Show brief work or reasoning (1–3 lines) under each answer. ' : 'Answers only, one line each, no extra commentary. ') +
    'If a question is ambiguous, state the assumption in brackets.';
  return ask(system, `${opts?.courseName ? `Course: ${opts.courseName}\n\n` : ''}${text.slice(0, 20000)}`, 6000);
}

/** Summarize notes into a compact study sheet. */
export async function summarizeNotes(text: string): Promise<string> {
  const system =
    'Summarize the student’s notes into a compact study sheet in markdown: a 2-sentence overview, then "Key ideas" (bullets), "Definitions" (term: meaning), "Formulas / rules" if any, and "Likely test questions" (3–5). Keep it faithful to the notes; do not invent facts.';
  return ask(system, text.slice(0, 20000), 3000);
}

/** Quick connectivity check. */
export async function testKey(): Promise<string> {
  return ask('Reply with the single word OK.', 'ping', 16);
}

export interface QuizGenOptions {
  subject: string;
  topic: string;
  count: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  gradeLevel?: string;
  types: ('mc' | 'tf' | 'short' | 'fill')[];
  source?: string; // notes / text to base questions on
  audience?: 'student' | 'teacher';
}

export interface GeneratedQuestion {
  type: 'mc' | 'tf' | 'short' | 'fill';
  prompt: string;
  options?: string[];
  correct?: number[];
  answer?: string;
  explanation?: string;
}

/** Generate quiz questions as JSON. */
export async function generateQuiz(o: QuizGenOptions): Promise<GeneratedQuestion[]> {
  const system =
    'You write accurate, well-formed quiz questions for a class. Output ONLY a JSON array. Each item: {"type": "mc"|"tf"|"short"|"fill", "prompt": string, "options": string[] (mc: exactly 4 plausible options; tf: ["True","False"]), "correct": number[] (indexes into options for mc/tf), "answer": string (short/fill only), "explanation": string (one sentence)}. ' +
    'Vary phrasing, avoid "all of the above", keep one unambiguous correct answer, spread difficulty as requested, and never repeat a question. No markdown, no commentary.';
  const user = [
    `Subject: ${o.subject}`,
    o.topic && `Topic: ${o.topic}`,
    o.gradeLevel && `Level: ${o.gradeLevel}`,
    `Count: ${o.count}`,
    `Difficulty: ${o.difficulty}`,
    `Question types to use: ${o.types.join(', ')}`,
    o.audience === 'teacher' ? 'Audience: teacher building a graded quiz; questions should be assessment quality with clear, defensible answers.' : 'Audience: student studying; questions should teach the key ideas.',
    o.source ? `Base the questions on this material:\n${o.source.slice(0, 12000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const text = await ask(system, user, 6000);
  const arr = parseJSON<GeneratedQuestion[]>(text);
  if (!Array.isArray(arr)) throw new Error('Unexpected response');
  return arr.filter((q) => q && typeof q.prompt === 'string');
}
