<script lang="ts">
  import AiUsage from './AiUsage.svelte';
  // Settings → AI helper: provider, key, endpoint and model.
  import { store } from '../../lib/store.svelte';
  import { toasts } from '../../lib/toast.svelte';
  import { testKey, currentProvider, currentModel, listModels, setModel as setAiModel, hasKey } from '../../lib/ai';
  import { forgetSecret, setSecrets } from '../../lib/secrets.svelte';
  import { PROVIDERS, providerInfo, cleanKey } from '../../lib/ai-providers';
  import type { AiProvider } from '../../lib/types';
  import { set } from './settings';
  import { t } from '../../lib/i18n/index.svelte';
  const s = $derived(store.settings);
  const provider = $derived(currentProvider());
  const pInfo = $derived(providerInfo(provider));
  let providerKey = $state('');
  function setProvider(p: AiProvider) {
    store.updateSettings({ aiProvider: p });
    providerKey = '';
  }
  function saveKey() {
    const key = cleanKey(providerKey);
    if (!key) return;
    setSecrets({ [`aiKeys.${provider}`]: key, ...(provider === 'anthropic' ? { aiApiKey: '' } : {}) });
    providerKey = '';
    void connectAI();
  }
  function removeKey() {
    if (provider === 'anthropic') forgetSecret('aiKeys.anthropic', 'aiApiKey');
    else forgetSecret(`aiKeys.${provider}`);
  }
  function setModel(m: string) {
    setAiModel(provider, m);
  }
  /** Built-in models first, then any others the provider reported (live list, cached). */
  const modelOptions = $derived.by(() => {
    const builtIn = pInfo.models.map((m) => ({ id: m.id, label: `${m.label}${m.vision ? ' · vision' : ''}` }));
    const live = (store.settings.aiModelCache[provider] ?? []).map((x) => {
      const [id, free] = x.split('|');
      return { id, label: `${id}${free ? ' (free)' : ''}` };
    });
    const known = new Set(builtIn.map((m) => m.id));
    const liveIds = new Set(live.map((m) => m.id));
    // hide built-ins the provider says don't exist (retired models), once we have a live list
    const kept = live.length ? builtIn.filter((m) => liveIds.has(m.id)) : builtIn;
    const extra = live.filter((m) => !known.has(m.id)).sort((a, b) => a.id.localeCompare(b.id));
    const all = [...kept, ...extra];
    const cur = currentModel();
    if (!all.some((m) => m.id === cur)) all.unshift({ id: cur, label: `${cur} (current)` });
    return all;
  });
  let modelsBusy = $state(false);
  async function loadModels() {
    modelsBusy = true;
    try {
      const list = await listModels();
      toasts.push({ message: `${list.length} models available`, kind: 'success' });
    } catch (err) {
      toasts.push({ message: 'Could not load models', detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 9000 });
    } finally {
      modelsBusy = false;
    }
  }
  let aiBusy = $state(false);
  async function connectAI() {
    aiBusy = true;
    try {
      const note = await testKey();
      toasts.push({ message: `${pInfo.name} connected`, detail: note || `Model: ${currentModel()}`, kind: 'success', emoji: '✨', timeout: note ? 8000 : 4000 });
    } catch (err) {
      toasts.push({ message: 'Check failed', detail: err instanceof Error ? err.message : String(err), kind: 'warn', timeout: 9000 });
    } finally {
      aiBusy = false;
    }
  }
</script>

<section class="card">
  <h2>{t('settings.ai')} <span class="chip optional">{t('settings.optional')}</span></h2>
  <p class="help">
    Powers “Ask the tutor”, notecard generation, photo transcription and answer keys. Keys stay in this browser and go only to the provider you pick. <strong>Free options:</strong> Google
    Gemini and Groq have free tiers, OpenRouter has free models, and Ollama runs on your own computer.
  </p>
  <div class="providers" role="radiogroup" aria-label="AI provider">
    {#each PROVIDERS as p (p.id)}
      <button class="prov" class:on={provider === p.id} role="radio" aria-checked={provider === p.id} onclick={() => setProvider(p.id)}>
        <span class="pn">{p.name}</span>
        {#if p.free}<span class="free">free{p.needsKey ? ' tier' : ''}</span>{/if}
        {#if hasKey(p.id)}<span class="ok">● key saved</span>{/if}
      </button>
    {/each}
  </div>
  <p class="help">
    {pInfo.note}{#if pInfo.keyUrl}
      <a href={pInfo.keyUrl} target="_blank" rel="noopener noreferrer">Get a key ↗</a>{/if}
  </p>
  {#if provider === 'custom' || provider === 'ollama'}
    <div class="row">
      <label for="aibase">Endpoint URL</label>
      <input
        id="aibase"
        class="input"
        value={s.aiBaseUrl || (provider === 'ollama' ? 'http://localhost:11434/v1' : '')}
        placeholder="https://host/v1"
        onchange={(e) => set('aiBaseUrl', (e.target as HTMLInputElement).value.trim())}
      />
    </div>
  {/if}
  <div class="row">
    <label for="aimodel">Model</label>
    {#if provider === 'custom'}
      <input id="aimodel" class="input" value={currentModel()} placeholder="model name" onchange={(e) => setModel((e.target as HTMLInputElement).value.trim())} />
    {:else}
      <span class="model-pick">
        <select id="aimodel" class="select" value={currentModel()} onchange={(e) => setModel((e.target as HTMLSelectElement).value)}>
          {#each modelOptions as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
        </select>
        <button
          class="btn ghost sm"
          onclick={() => void loadModels()}
          disabled={modelsBusy || (pInfo.needsKey && !hasKey(provider))}
          title="Fetch the current model list from the provider">{modelsBusy ? '…' : '↻ Load models'}</button
        >
      </span>
    {/if}
  </div>
  {#if pInfo.needsKey}
    {#if hasKey(provider)}
      <div class="btns">
        <span class="status ok">Key saved</span>
        <button class="btn sm" onclick={() => void connectAI()} disabled={aiBusy}>{aiBusy ? 'Testing…' : 'Test'}</button>
        <button class="btn danger sm" onclick={removeKey}>Remove key</button>
      </div>
    {:else}
      <form
        class="btns"
        onsubmit={(e) => {
          e.preventDefault();
          saveKey();
        }}
      >
        <input class="input" type="password" bind:value={providerKey} placeholder="Paste API key" aria-label="API key" autocomplete="off" />
        <button class="btn primary" type="submit" disabled={aiBusy || !providerKey.trim()}>{aiBusy ? 'Checking…' : 'Save and test'}</button>
      </form>
    {/if}
  {:else}
    <div class="btns"><button class="btn sm" onclick={() => void connectAI()} disabled={aiBusy}>{aiBusy ? 'Testing…' : 'Test connection'}</button></div>
  {/if}
  <AiUsage />
</section>

<style>
  section {
    margin-bottom: 12px;
  }
  .model-pick {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }
  .model-pick .select {
    max-width: 260px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .row label {
    color: var(--text);
  }
  .select {
    width: auto;
    min-width: 90px;
  }
  .help {
    font-size: 13px;
    color: var(--text-muted);
    margin: 6px 0;
  }
  .btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin: 8px 0;
  }
  .btns .input {
    flex: 1;
    min-width: 200px;
  }
  .status.ok {
    color: var(--success-text);
  }
  .chip.optional {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .providers {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 6px 0;
  }
  .prov {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-size: 13px;
    color: var(--text);
    min-width: 120px;
    text-align: left;
  }
  .prov.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .pn {
    font-weight: 600;
  }
  .free {
    font-size: 11px;
    color: var(--success-text);
    font-weight: 600;
  }
  .ok {
    font-size: 11px;
    color: var(--text-muted);
  }
  .row .input:not(.num) {
    max-width: 320px;
  }
</style>
