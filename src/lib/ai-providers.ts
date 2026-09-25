// Provider catalog + an OpenAI-compatible chat client (fetch, browser-side). Anthropic goes through the official SDK in ai.ts.
import type { AiProvider } from './types';

export interface ProviderInfo {
  id: AiProvider;
  name: string;
  free: boolean; // has a free tier / is free to run
  keyUrl?: string;
  baseUrl: string;
  models: { id: string; label: string; vision: boolean; free?: boolean }[];
  note: string;
  needsKey: boolean;
  cors: 'yes' | 'proxy' | 'local';
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    free: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5 (best)', vision: true },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', vision: true },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fast, cheap)', vision: true },
    ],
    note: 'Pay-as-you-go. Best quality for tutoring, transcription and answer keys.',
    needsKey: true,
    cors: 'yes',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    free: true,
    keyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (free tier)', vision: true, free: true },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (free tier, fastest)', vision: true, free: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vision: true },
    ],
    note: 'Free tier with daily limits from Google AI Studio. Reads photos well.',
    needsKey: true,
    cors: 'yes',
  },
  {
    id: 'groq',
    name: 'Groq',
    free: true,
    keyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (free)', vision: false, free: true },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (vision, free)', vision: true, free: true },
      { id: 'qwen/qwen3-32b', label: 'Qwen3 32B (free)', vision: false, free: true },
    ],
    note: 'Free tier, very fast. Pick the Llama 4 Scout model for photos.',
    needsKey: true,
    cors: 'yes',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    free: true,
    keyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openrouter/auto', label: 'Auto (OpenRouter picks)', vision: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', vision: false, free: true },
      { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5 (paid)', vision: true },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (paid)', vision: true },
    ],
    note: 'One key for many models; the “:free” models cost nothing (rate limited). Free models change often, so press “Load models” for the current list.',
    needsKey: true,
    cors: 'yes',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    free: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheap, vision)', vision: true },
      { id: 'gpt-4.1', label: 'GPT-4.1', vision: true },
      { id: 'o4-mini', label: 'o4-mini (reasoning)', vision: true },
    ],
    note: 'Pay-as-you-go.',
    needsKey: true,
    cors: 'yes',
  },
  {
    id: 'ollama',
    name: 'Ollama (local, free)',
    free: true,
    keyUrl: 'https://ollama.com/download',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3.2', label: 'llama3.2', vision: false, free: true },
      { id: 'llama3.2-vision', label: 'llama3.2-vision (photos)', vision: true, free: true },
      { id: 'qwen2.5:7b', label: 'qwen2.5 7B', vision: false, free: true },
      { id: 'gemma3', label: 'gemma3', vision: true, free: true },
    ],
    note: 'Runs on your own computer, no key. Start Ollama with OLLAMA_ORIGINS="*" so the browser may call it.',
    needsKey: false,
    cors: 'local',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    free: true,
    baseUrl: '',
    models: [{ id: 'default', label: 'Model name (type it below)', vision: false }],
    note: 'LM Studio, Jan, vLLM, Together, Mistral… any /v1/chat/completions endpoint.',
    needsKey: false,
    cors: 'yes',
  },
];

export function providerInfo(id: AiProvider): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface ChatImage {
  dataUrl: string; // data:image/jpeg;base64,...
}

export interface ChatRequest {
  system: string;
  user: string;
  images?: ChatImage[];
  maxTokens?: number;
  temperature?: number;
  /** How hard the model should think. Short, simple tasks use 'low'. */
  effort?: 'low' | 'medium' | 'high';
}

/** Clean up a pasted API key: whitespace, surrounding quotes, a leading "Bearer ". */
export function cleanKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
}

/** Error for a model id the provider doesn't know (retired, renamed, or not available to this key). */
export class ModelNotFoundError extends Error {}

/** Reasoning models on OpenAI's API take max_completion_tokens and no temperature. */
function isOpenAIReasoning(provider: AiProvider, model: string): boolean {
  return provider === 'openai' && /^(o\d|gpt-5)/.test(model);
}

/** Thinking models spend output tokens on reasoning first, so a tiny max_tokens returns nothing. */
function minTokens(provider: AiProvider): number {
  if (provider === 'gemini' || provider === 'openrouter') return 8192;
  if (provider === 'ollama' || provider === 'custom') return 1024;
  return 4096;
}

/** Strip <think>…</think> reasoning some models (Qwen3, DeepSeek R1) put inline. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/** List model ids from an OpenAI-compatible /models endpoint. `free` marks zero-priced OpenRouter models. */
export async function listModelsOpenAICompatible(cfg: { baseUrl: string; apiKey?: string; provider: AiProvider }): Promise<{ id: string; free?: boolean }[]> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  let res: Response;
  try {
    res = await fetch(`${base}/models`, { headers });
  } catch (e) {
    throw new Error(
      cfg.provider === 'ollama' ? 'Could not reach Ollama. Is it running with OLLAMA_ORIGINS="*"?' : `Network error calling ${base}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (res.status === 401 || res.status === 403) throw new Error(`API key rejected (${res.status}). Check it in Settings → AI helper.`);
  if (!res.ok) throw new Error(`Could not list models (${res.status}).`);
  const json = (await res.json()) as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[]; models?: { name: string }[] };
  type Row = { id: string; pricing?: { prompt?: string; completion?: string } };
  const list: Row[] = json.data ?? json.models?.map((m) => ({ id: m.name })) ?? [];
  return list
    .filter((m) => m && typeof m.id === 'string')
    .map((m) => ({
      id: m.id.replace(/^models\//, ''),
      free: cfg.provider === 'openrouter' ? m.id.endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0') : undefined,
    }));
}

/** OpenAI-compatible /chat/completions call. */
export async function chatOpenAICompatible(cfg: { baseUrl: string; apiKey?: string; model: string; provider: AiProvider }, req: ChatRequest): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const content: unknown[] = [];
  for (const img of req.images ?? []) content.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  content.push({ type: 'text', text: req.user });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const reasoning = isOpenAIReasoning(cfg.provider, cfg.model);
  const maxTokens = Math.max(req.maxTokens ?? 2048, minTokens(cfg.provider));
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://homework-todo';
    headers['X-Title'] = 'Homework To-Do';
  }
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        ...(reasoning ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens, temperature: req.temperature ?? 0.3 }),
        ...(reasoning && req.effort ? { reasoning_effort: req.effort } : {}),
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.images?.length ? content : req.user },
        ],
      }),
    });
  } catch (e) {
    throw new Error(
      cfg.provider === 'ollama' ? 'Could not reach Ollama. Is it running with OLLAMA_ORIGINS="*"?' : `Network error calling ${base}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } | string };
      msg = typeof j.error === 'string' ? j.error : (j.error?.message ?? msg);
    } catch {
      /* ignore */
    }
    if (res.status === 401 || res.status === 403) throw new Error(`API key rejected (${res.status}). Check it in Settings → AI helper.`);
    if (res.status === 404 || /model.*(not[ _]found|does not exist|not supported|invalid|decommissioned|no endpoints)/i.test(msg)) {
      throw new ModelNotFoundError(`Model “${cfg.model}” isn't available: ${msg}`);
    }
    if (res.status === 429) throw new Error('Rate limited (429). Free tiers have per-minute limits; try again in a bit.');
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  const json = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string | { type: string; text?: string }[] | null } }[] };
  const choice = json.choices?.[0];
  const c = choice?.message?.content;
  const text = typeof c === 'string' ? stripThinking(c) : Array.isArray(c) ? stripThinking(c.map((p) => p.text ?? '').join('\n')) : '';
  if (text) return text;
  if (choice?.finish_reason === 'length') throw new Error('The model used up its token budget before answering. Try a non-thinking model or a shorter request.');
  if (choice?.finish_reason === 'content_filter') throw new Error('The provider filtered this response.');
  throw new Error('The model returned an empty response.');
}

/** Downscale an image file to a JPEG data URL (max side px) for vision requests. */
export async function imageToDataUrl(file: Blob, maxSide = 1600, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
