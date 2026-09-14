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
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vision: true },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free tier)', vision: true, free: true },
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
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)', vision: true, free: true },
      { id: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick (free, vision)', vision: true, free: true },
      { id: 'qwen/qwen2.5-vl-72b-instruct:free', label: 'Qwen 2.5 VL 72B (free, vision)', vision: true, free: true },
      { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (paid)', vision: true },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (paid)', vision: true },
    ],
    note: 'One key for many models; the “:free” models cost nothing (rate limited).',
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
}

/** OpenAI-compatible /chat/completions call. */
export async function chatOpenAICompatible(cfg: { baseUrl: string; apiKey?: string; model: string; provider: AiProvider }, req: ChatRequest): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const content: unknown[] = [];
  for (const img of req.images ?? []) content.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  content.push({ type: 'text', text: req.user });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
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
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.3,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.images?.length ? content : req.user },
        ],
      }),
    });
  } catch (e) {
    throw new Error(
      cfg.provider === 'ollama'
        ? 'Could not reach Ollama. Is it running with OLLAMA_ORIGINS="*"?'
        : `Network error calling ${base}: ${e instanceof Error ? e.message : String(e)}`,
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
    if (res.status === 401) throw new Error('API key rejected (401). Check it in Settings → AI helper.');
    if (res.status === 429) throw new Error('Rate limited (429). Free tiers have per-minute limits; try again in a bit.');
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string | { type: string; text?: string }[] } }[] };
  const c = json.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c)) return c.map((p) => p.text ?? '').join('\n').trim();
  throw new Error('Empty response');
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
