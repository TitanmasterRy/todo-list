// Optional AI helper backed by the user's own Anthropic API key (stored only in localStorage).
import Anthropic from '@anthropic-ai/sdk';
import { store } from './store.svelte';
import type { TaskType } from './types';

export function aiAvailable(): boolean {
  return !!store.settings.aiApiKey;
}

function client(): Anthropic {
  const apiKey = store.settings.aiApiKey;
  if (!apiKey) throw new Error('Add an Anthropic API key in Settings → AI helper first.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function model(): string {
  return store.settings.aiModel || 'claude-opus-5';
}

async function ask(system: string, user: string, maxTokens = 2048): Promise<string> {
  try {
    const res = await client().messages.create({
      model: model(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
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

/** Quick connectivity check. */
export async function testKey(): Promise<string> {
  const text = await ask('Reply with the single word OK.', 'ping', 16);
  return text;
}
