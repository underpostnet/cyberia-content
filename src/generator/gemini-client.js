/**
 * Minimal Google Gemini (Generative Language API) client: one structured JSON completion per
 * request, on the `:generateContent` endpoint. The key comes from `GEMINI_API_KEY` and goes only
 * into the `x-goog-api-key` header.
 *
 * @module src/generator/gemini-client.js
 */

/** Generative Language API model base. `<model>:generateContent` is appended. */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GEMINI_DEFAULT_MODEL = 'gemma-4-26b-a4b-it';

/**
 * One JSON object from a model answer: tolerates markdown fences and prose around it.
 * @param {string} text
 * @returns {Object}
 */
export function parseJsonLoose(text) {
  let candidate = String(text || '').trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('Failed to parse JSON from Gemini response.');
  }
}

export class GeminiClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey] - `GEMINI_API_KEY` by default.
   * @param {string} [options.model]
   * @param {number} [options.timeout] - Request timeout in ms.
   * @param {number} [options.maxRetries] - Retries after a transient failure.
   * @param {(line:string)=>void} [options.log]
   */
  constructor({ apiKey, model = GEMINI_DEFAULT_MODEL, timeout = 300000, maxRetries = 2, log = console.log } = {}) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.model = model;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.log = log;
    if (!this.apiKey) throw new Error('GEMINI_API_KEY is not set. Export it or add it to the --env-file file.');
  }

  /**
   * The answer text of one request, without the thinking parts.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {Object} [params.generationConfig]
   * @returns {Promise<string>}
   */
  async generateContent({ prompt, generationConfig = {} }) {
    this.log(`Gemini request → model=${this.model}`);
    const response = await fetch(`${GEMINI_API_BASE}/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) throw new Error(`Gemini answered ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .filter((part) => part && typeof part.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('');
    if (!text) throw new Error('Gemini returned an empty completion.');
    const usage = data?.usageMetadata;
    if (usage)
      this.log(
        `Gemini usage → prompt=${usage.promptTokenCount} candidates=${usage.candidatesTokenCount} ` +
          `total=${usage.totalTokenCount}`,
      );
    return text;
  }

  /**
   * One completion, parsed as JSON. The schema is asked for in the prompt, because Gemma models
   * have no JSON response mode. A transient failure is retried with backoff.
   * @param {Object} params
   * @param {string} params.system - The output ontology and schema.
   * @param {string} params.user - The theme and the ids to use.
   * @param {string} [params.thinkingLevel='high']
   * @param {number} [params.temperature]
   * @returns {Promise<Object>}
   */
  async chatJson({ system, user, thinkingLevel = 'high', temperature }) {
    const prompt = [
      system,
      '',
      user,
      '',
      'Respond with ONLY a single valid JSON object. Do not wrap it in markdown fences and do not add any prose.',
    ].join('\n');
    const generationConfig = { thinkingConfig: { thinkingLevel } };
    if (typeof temperature === 'number') generationConfig.temperature = temperature;
    for (let attempt = 0; ; attempt++) {
      try {
        return parseJsonLoose(await this.generateContent({ prompt, generationConfig }));
      } catch (error) {
        if (attempt >= this.maxRetries) throw error;
        const backoffMs = 1000 * (attempt + 1);
        this.log(
          `Gemini attempt ${attempt + 1}/${this.maxRetries + 1} failed (${error.message}); retry in ${backoffMs}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
}
