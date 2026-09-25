// AI helper. Anthropic goes through the official SDK; every other provider speaks the OpenAI-compatible chat API.
import type Anthropic from '@anthropic-ai/sdk';
import { store } from './store.svelte';
import type { Found } from './syllabus';
import type { AiProvider, TaskType } from './types';
import { chatOpenAICompatible, cleanKey, listModelsOpenAICompatible, ModelNotFoundError, providerInfo, type ChatImage, type ChatRequest } from './ai-providers';
import { hasSecret, secret, useSecret, type SecretSlot } from './secrets.svelte';

export function currentProvider(): AiProvider {
  return store.settings.aiProvider || 'anthropic';
}

/** The provider's key slots (the old single Anthropic key field still counts). */
function keySlots(provider: AiProvider): SecretSlot[] {
  return provider === 'anthropic' ? ['aiKeys.anthropic', 'aiApiKey'] : [`aiKeys.${provider}`];
}

export function currentKey(provider: AiProvider = currentProvider()): string {
  return cleanKey(keySlots(provider).map(secret).find(Boolean) ?? '');
}

/** A key is saved for this provider (it may still be locked behind the passphrase). */
export function hasKey(provider: AiProvider = currentProvider()): boolean {
  return keySlots(provider).some(hasSecret);
}

/** Ask for the passphrase first if this provider's key is locked. */
async function unlockKey(provider: AiProvider): Promise<void> {
  for (const slot of keySlots(provider)) await useSecret(slot, { reason: 'Enter your passphrase to use your AI key.' });
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
  return hasKey(p);
}

export function aiSupportsVision(): boolean {
  const p = currentProvider();
  const info = providerInfo(p);
  const m = info.models.find((x) => x.id === currentModel(p));
  return m ? m.vision : p === 'custom' || p === 'ollama';
}

// The SDK is loaded on first use so it stays out of the main bundle.
let sdk: Promise<typeof import('@anthropic-ai/sdk')> | null = null;
function loadSdk(): Promise<typeof import('@anthropic-ai/sdk')> {
  return (sdk ??= import('@anthropic-ai/sdk'));
}

async function anthropicClient(): Promise<Anthropic> {
  await unlockKey('anthropic');
  const apiKey = currentKey('anthropic');
  if (!apiKey) throw new Error('Add an Anthropic API key in Settings → AI helper first.');
  const { default: AnthropicClient } = await loadSdk();
  return new AnthropicClient({ apiKey, dangerouslyAllowBrowser: true });
}

/** Models that get server-side refusal fallbacks (the API re-runs a declined request on another model). */
function wantsFallbacks(model: string): boolean {
  return model === 'claude-opus-5' || model === 'claude-fable-5-1';
}

async function askAnthropic(req: ChatRequest): Promise<string> {
  const { default: SDK } = await loadSdk();
  const model = currentModel('anthropic');
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of req.images ?? []) {
    const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.*)$/.exec(img.dataUrl);
    if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: m[2] } });
  }
  content.push({ type: 'text', text: req.user });
  const base: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model,
    // Current models think before answering, and thinking counts against max_tokens. A small cap
    // (the old 16 for the key test, 2048 for answers) left nothing for the answer itself.
    max_tokens: Math.max(req.maxTokens ?? 0, 16000),
    system: req.system,
    messages: [{ role: 'user', content }],
    // effort isn't accepted by Haiku 4.5
    ...(req.effort && !/haiku/.test(model) ? { output_config: { effort: req.effort } } : {}),
  };
  const client = await anthropicClient();
  const send = (withFallbacks: boolean) => client.beta.messages.create(withFallbacks ? { ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : base);
  try {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await send(wantsFallbacks(model));
    } catch (e) {
      // if this key can't use the fallback beta, retry once without it
      if (wantsFallbacks(model) && e instanceof SDK.BadRequestError && /fallback|beta/i.test(e.message)) res = await send(false);
      else throw e;
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (res.stop_reason === 'refusal') throw new Error('The model declined this request.');
    if (!text && res.stop_reason === 'max_tokens') throw new Error('The response was cut off before any answer. Try a shorter request.');
    return text;
  } catch (e) {
    if (e instanceof SDK.AuthenticationError || e instanceof SDK.PermissionDeniedError) throw new Error('API key rejected. Check it in Settings → AI helper.');
    if (e instanceof SDK.NotFoundError) throw new ModelNotFoundError(`Model “${model}” isn't available to this key.`);
    if (e instanceof SDK.RateLimitError) throw new Error('Rate limited. Try again in a moment.');
    if (e instanceof SDK.APIConnectionError) throw new Error('Could not reach api.anthropic.com. Check your connection.');
    if (e instanceof SDK.APIError) throw new Error(`API error ${e.status}: ${e.message}`);
    throw e;
  }
}

/** Route a request to the configured provider. */
export async function ask(system: string, user: string, maxTokens = 2048, images?: ChatImage[], effort?: ChatRequest['effort']): Promise<string> {
  const provider = currentProvider();
  const req: ChatRequest = { system, user, maxTokens, images, effort };
  if (provider === 'anthropic') return askAnthropic(req);
  const info = providerInfo(provider);
  await unlockKey(provider);
  if (info.needsKey && !currentKey(provider)) throw new Error(`Add a ${info.name} API key in Settings → AI helper first.`);
  return chatOpenAICompatible({ baseUrl: baseUrlFor(provider), apiKey: currentKey(provider) || undefined, model: currentModel(provider), provider }, req);
}

function baseUrlFor(provider: AiProvider): string {
  const info = providerInfo(provider);
  const baseUrl = provider === 'custom' ? store.settings.aiBaseUrl : provider === 'ollama' && store.settings.aiBaseUrl ? store.settings.aiBaseUrl : info.baseUrl;
  if (!baseUrl) throw new Error('Set the endpoint URL for your custom provider in Settings → AI helper.');
  return baseUrl;
}

/** Live model list for the current provider (also proves the key works). Cached in settings. */
export async function listModels(provider: AiProvider = currentProvider()): Promise<{ id: string; free?: boolean }[]> {
  let models: { id: string; free?: boolean }[];
  if (provider === 'anthropic') {
    const { default: SDK } = await loadSdk();
    try {
      const page = await (await anthropicClient()).models.list({ limit: 100 });
      models = page.data.map((m) => ({ id: m.id }));
    } catch (e) {
      if (e instanceof SDK.AuthenticationError || e instanceof SDK.PermissionDeniedError) throw new Error('API key rejected. Check it in Settings → AI helper.');
      if (e instanceof SDK.APIConnectionError) throw new Error('Could not reach api.anthropic.com. Check your connection.');
      throw e;
    }
  } else {
    await unlockKey(provider);
    models = await listModelsOpenAICompatible({ baseUrl: baseUrlFor(provider), apiKey: currentKey(provider) || undefined, provider });
  }
  if (models.length) store.updateSettings({ aiModelCache: { ...store.settings.aiModelCache, [provider]: models.map((m) => (m.free ? `${m.id}|free` : m.id)) } });
  return models;
}

/** Pick a sensible replacement when the chosen model id no longer exists. */
function pickReplacement(provider: AiProvider, models: { id: string; free?: boolean }[]): string | undefined {
  const ids = models.map((m) => m.id);
  const known = providerInfo(provider)
    .models.map((m) => m.id)
    .find((id) => ids.includes(id));
  if (known) return known;
  if (provider === 'openrouter') return models.find((m) => m.free)?.id ?? ids[0];
  if (provider === 'gemini') return ids.find((id) => /gemini-.*flash/.test(id) && !/image|tts|audio|live|embedding/.test(id)) ?? ids[0];
  if (provider === 'anthropic') return ids.find((id) => id.startsWith('claude-sonnet')) ?? ids[0];
  return ids.find((id) => !/embed|whisper|tts|guard|audio|image/i.test(id)) ?? ids[0];
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

/**
 * Connectivity check: list models (proves the key), then send a tiny prompt (proves the model).
 * If the chosen model has been retired or isn't available to this key, switch to one that is.
 * Returns a note about what changed, if anything.
 */
export async function testKey(): Promise<string> {
  const provider = currentProvider();
  let models: { id: string; free?: boolean }[] = [];
  try {
    models = await listModels(provider);
  } catch (e) {
    // some OpenAI-compatible servers don't implement /models; a rejected key is still fatal
    if (e instanceof Error && /rejected/i.test(e.message)) throw e;
  }
  let note = '';
  const chosen = currentModel(provider);
  if (models.length && provider !== 'custom' && !models.some((m) => m.id === chosen)) {
    const next = pickReplacement(provider, models);
    if (next) {
      setModel(provider, next);
      note = `“${chosen}” isn't available, switched to ${next}.`;
    }
  }
  try {
    await ask('Reply with the single word OK.', 'ping', 64, undefined, 'low');
  } catch (e) {
    if (!(e instanceof ModelNotFoundError) || !models.length) throw e;
    const next = pickReplacement(
      provider,
      models.filter((m) => m.id !== currentModel(provider)),
    );
    if (!next) throw e;
    setModel(provider, next);
    note = `${e.message} Switched to ${next}.`;
    await ask('Reply with the single word OK.', 'ping', 64, undefined, 'low');
  }
  return note;
}

export function setModel(provider: AiProvider, model: string): void {
  store.updateSettings({ aiModels: { ...store.settings.aiModels, [provider]: model }, aiModel: provider === 'anthropic' ? model : store.settings.aiModel });
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
    o.audience === 'teacher'
      ? 'Audience: teacher building a graded quiz; questions should be assessment quality with clear, defensible answers.'
      : 'Audience: student studying; questions should teach the key ideas.',
    o.source ? `Base the questions on this material:\n${o.source.slice(0, 12000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const text = await ask(system, user, 6000);
  const arr = parseJSON<GeneratedQuestion[]>(text);
  if (!Array.isArray(arr)) throw new Error('Unexpected response');
  return arr.filter((q) => q && typeof q.prompt === 'string');
}

/** Syllabus box with AI: pull dated work and breaks out of messy syllabus text (or a transcribed photo). */
export async function extractSyllabusAI(text: string, today: string): Promise<Found[]> {
  const system =
    'You read school syllabi and course schedules. Output ONLY a JSON array. For each assignment, test, quiz, project, reading or deadline with a date, output ' +
    '{"kind":"task","title": short title without the date,"date":"YYYY-MM-DD","type": one of "homework","reading","exam","project","quiz","other"}. ' +
    'For breaks, holidays or days without class output {"kind":"break","name": string,"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}. ' +
    `Dates without a year belong to the school year around ${today}. Skip anything without a date. No markdown fences, no commentary.`;
  const out = await ask(system, text.slice(0, 20000), 8192);
  const rows = parseJSON<Record<string, unknown>[]>(out);
  if (!Array.isArray(rows)) throw new Error('Unexpected response');
  const types: TaskType[] = ['homework', 'reading', 'exam', 'project', 'quiz', 'other'];
  const isKey = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const found: Found[] = [];
  for (const r of rows) {
    if (r?.kind === 'break' && isKey(r.from) && isKey(r.to)) found.push({ kind: 'break', name: String(r.name ?? 'Break').slice(0, 60), from: r.from, to: r.to, line: '' });
    else if (typeof r?.title === 'string' && isKey(r.date))
      found.push({ kind: 'task', title: r.title.slice(0, 140), dateKey: r.date, type: types.includes(r.type as TaskType) ? (r.type as TaskType) : 'homework', line: '' });
  }
  return found.sort((a, b) => ((a.kind === 'task' ? a.dateKey : a.from) < (b.kind === 'task' ? b.dateKey : b.from) ? -1 : 1));
}
