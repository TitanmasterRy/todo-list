import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatOpenAICompatible, cleanKey, listModelsOpenAICompatible, ModelNotFoundError, stripThinking } from './ai-providers';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const sentBody = (fn: ReturnType<typeof mockFetch>) => JSON.parse((fn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

afterEach(() => vi.unstubAllGlobals());

describe('cleanKey', () => {
  it('strips whitespace, quotes and Bearer', () => {
    expect(cleanKey('  sk-abc123 \n')).toBe('sk-abc123');
    expect(cleanKey('"sk-abc"')).toBe('sk-abc');
    expect(cleanKey('Bearer gsk_xyz')).toBe('gsk_xyz');
    expect(cleanKey('sk-ab c1')).toBe('sk-abc1');
  });
});

describe('chatOpenAICompatible', () => {
  it('uses max_completion_tokens and no temperature for OpenAI reasoning models', async () => {
    const fn = mockFetch(200, { choices: [{ message: { content: 'OK' } }] });
    await chatOpenAICompatible({ baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'o4-mini', provider: 'openai' }, { system: 's', user: 'u', maxTokens: 16 });
    const body = sentBody(fn);
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(4096);
  });
  it('gives thinking models room to answer', async () => {
    const fn = mockFetch(200, { choices: [{ message: { content: 'OK' } }] });
    await chatOpenAICompatible({ baseUrl: 'https://g/v1', apiKey: 'k', model: 'gemini-2.5-flash', provider: 'gemini' }, { system: 's', user: 'u', maxTokens: 16 });
    expect(sentBody(fn).max_tokens).toBeGreaterThanOrEqual(8192);
  });
  it('strips inline <think> blocks', async () => {
    mockFetch(200, { choices: [{ message: { content: '<think>hmm</think>\nOK' } }] });
    expect(await chatOpenAICompatible({ baseUrl: 'https://x/v1', model: 'qwen', provider: 'groq' }, { system: 's', user: 'u' })).toBe('OK');
    expect(stripThinking('<think>a\nb</think>hi')).toBe('hi');
  });
  it('explains an empty answer cut off by the token limit', async () => {
    mockFetch(200, { choices: [{ finish_reason: 'length', message: { content: '' } }] });
    await expect(chatOpenAICompatible({ baseUrl: 'https://x/v1', model: 'm', provider: 'groq' }, { system: 's', user: 'u' })).rejects.toThrow(/token budget/);
  });
  it('reports retired models as ModelNotFoundError', async () => {
    mockFetch(404, { error: { message: 'model not found' } });
    await expect(chatOpenAICompatible({ baseUrl: 'https://x/v1', model: 'old', provider: 'openrouter' }, { system: 's', user: 'u' })).rejects.toBeInstanceOf(ModelNotFoundError);
    mockFetch(400, { error: { message: 'The model `llama-3.1` has been decommissioned' } });
    await expect(chatOpenAICompatible({ baseUrl: 'https://x/v1', model: 'llama-3.1', provider: 'groq' }, { system: 's', user: 'u' })).rejects.toBeInstanceOf(ModelNotFoundError);
  });
  it('rejects bad keys clearly', async () => {
    mockFetch(401, { error: { message: 'invalid api key' } });
    await expect(chatOpenAICompatible({ baseUrl: 'https://x/v1', model: 'm', provider: 'groq' }, { system: 's', user: 'u' })).rejects.toThrow(/rejected/);
  });
});

describe('listModelsOpenAICompatible', () => {
  it('normalizes Gemini ids and marks free OpenRouter models', async () => {
    mockFetch(200, { data: [{ id: 'models/gemini-2.5-flash' }] });
    expect(await listModelsOpenAICompatible({ baseUrl: 'https://g', apiKey: 'k', provider: 'gemini' })).toEqual([{ id: 'gemini-2.5-flash' }]);
    mockFetch(200, { data: [{ id: 'a/b:free' }, { id: 'c/d', pricing: { prompt: '0', completion: '0' } }, { id: 'e/f', pricing: { prompt: '0.1', completion: '0.2' } }] });
    const list = await listModelsOpenAICompatible({ baseUrl: 'https://o', apiKey: 'k', provider: 'openrouter' });
    expect(list.map((m) => m.free)).toEqual([true, true, false]);
  });
});
