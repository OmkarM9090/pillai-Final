// ============================================================
// FEATURE 5 (core) — LLM LAYER
// A provider-agnostic LLM client with an always-available on-board
// reasoning fallback, so the AI features work with *or* without an
// internet-reachable model endpoint.
//
// Supported providers (auto-detected from env, first match wins):
//   GEMINI_API_KEY / GOOGLE_API_KEY  → Google Gemini 2.0 Flash
//   OPENAI_API_KEY                   → OpenAI gpt-4o-mini
//   GROQ_API_KEY                     → Groq llama-3.3-70b-versatile
//   OPENROUTER_API_KEY               → OpenRouter (configurable model)
//   OLLAMA_URL                       → local Ollama server
// ============================================================

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  mode: 'CLOUD' | 'ONBOARD';
  latencyMs: number;
  note?: string;
}

interface ProviderDef {
  id: string;
  model: string;
  enabled: boolean;
  call: (system: string, messages: LlmMessage[], temperature: number) => Promise<string>;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

function providers(): ProviderDef[] {
  const gemKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  const orKey = process.env.OPENROUTER_API_KEY || '';
  const ollama = process.env.OLLAMA_URL || '';

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const orModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-70b-instruct';
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';

  const chatStyle = (url: string, key: string, model: string, extra: Record<string, string> = {}) =>
    async (system: string, messages: LlmMessage[], temperature: number) => {
      const json = await postJson(
        url,
        { model, temperature, max_tokens: 900, messages: [{ role: 'system', content: system }, ...messages] },
        { authorization: `Bearer ${key}`, ...extra },
      );
      return json?.choices?.[0]?.message?.content ?? '';
    };

  return [
    {
      id: 'google-gemini',
      model: geminiModel,
      enabled: !!gemKey,
      call: async (system, messages, temperature) => {
        const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const json = await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(gemKey)}`,
          { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature, maxOutputTokens: 900 } },
          {},
        );
        return json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      },
    },
    { id: 'openai', model: openaiModel, enabled: !!openaiKey, call: chatStyle('https://api.openai.com/v1/chat/completions', openaiKey, openaiModel) },
    { id: 'groq', model: groqModel, enabled: !!groqKey, call: chatStyle('https://api.groq.com/openai/v1/chat/completions', groqKey, groqModel) },
    {
      id: 'openrouter', model: orModel, enabled: !!orKey,
      call: chatStyle('https://openrouter.ai/api/v1/chat/completions', orKey, orModel, { 'http-referer': 'https://smart-resort-360.local', 'x-title': 'Smart Resort 360' }),
    },
    {
      id: 'ollama',
      model: ollamaModel,
      enabled: !!ollama,
      call: async (system, messages, temperature) => {
        const json = await postJson(
          `${ollama.replace(/\/$/, '')}/api/chat`,
          { model: ollamaModel, stream: false, options: { temperature }, messages: [{ role: 'system', content: system }, ...messages] },
          {},
        );
        return json?.message?.content ?? '';
      },
    },
  ];
}

export function llmStatus() {
  const list = providers();
  const active = list.find((p) => p.enabled);
  return {
    cloudConfigured: !!active,
    activeProvider: active?.id ?? 'onboard-reasoner',
    activeModel: active?.model ?? 'Smart Resort 360 Reasoning Engine v2',
    available: list.filter((p) => p.enabled).map((p) => ({ id: p.id, model: p.model })),
    onboardFallback: true,
    hint: active
      ? undefined
      : 'No cloud LLM key detected — the deterministic on-board reasoning engine is answering. Add GEMINI_API_KEY (or OPENAI_API_KEY / GROQ_API_KEY) to server/.env to switch to a cloud model instantly; no code change needed.',
  };
}

/**
 * Run a completion. `fallback` is the on-board answer that will be used when
 * no cloud provider is configured or the provider call fails.
 */
export async function llmComplete(opts: {
  system: string;
  messages: LlmMessage[];
  fallback: () => string;
  temperature?: number;
}): Promise<LlmResult> {
  const started = Date.now();
  const active = providers().find((p) => p.enabled);
  if (active) {
    try {
      const text = await active.call(opts.system, opts.messages, opts.temperature ?? 0.4);
      if (text && text.trim()) {
        return { text: text.trim(), provider: active.id, model: active.model, mode: 'CLOUD', latencyMs: Date.now() - started };
      }
      throw new Error('empty completion');
    } catch (err: any) {
      return {
        text: opts.fallback(),
        provider: 'onboard-reasoner',
        model: 'Smart Resort 360 Reasoning Engine v2',
        mode: 'ONBOARD',
        latencyMs: Date.now() - started,
        note: `Cloud provider ${active.id} failed (${err?.message ?? err}); answered with the on-board grounded reasoner.`,
      };
    }
  }
  return {
    text: opts.fallback(),
    provider: 'onboard-reasoner',
    model: 'Smart Resort 360 Reasoning Engine v2',
    mode: 'ONBOARD',
    latencyMs: Date.now() - started,
    note: 'Answered by the on-board grounded reasoner (no cloud LLM key configured).',
  };
}
