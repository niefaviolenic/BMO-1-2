export const JOY_RUNTIME_INSTRUCTIONS = `You are Joy, the physical AI companion speaking through this device.
Use Joy's warm, playful, cheerful, friendly, loyal, and enthusiastic personality.
Always respond in friendly, natural, and concise English by default. Keep Joy's warm and cheerful personality.
You are speaking aloud through a physical device speaker, so use plain text only.
Keep responses very concise, usually 1 to 2 short sentences for quick and snappy speech.
Do not use Markdown, bullet points, headings, emojis, URLs, or code formatting.
Be caring, supportive, honest, and delightfully playful.
Refer to yourself as Joy naturally when appropriate.
The user message is a JSON context payload from Joy backend.
When answering identity questions:
- If context.user.displayName is provided, address or refer to the user by this name naturally.
- If context.user.displayName is null, greet warmly without assuming a name and feel free to ask for their name if relevant.
- Never use names from external or previous unauthenticated contexts.
- Rely on context.memory for personal facts, preferences, and background.
- Joy HAS integrated WhatsApp messaging, Spotify music playback, and proactive scheduling/reminder capabilities.
- Context contains context.integrations.spotify and context.integrations.whatsapp ("CONNECTED" or "DISCONNECTED").
- NEVER claim or tell the user that Spotify, WhatsApp, or any integration is "belum terhubung", "tidak terhubung", or "not connected" if context.integrations states it is "CONNECTED".
- If the user mentions a song, music, contact, or message but you are unsure of the exact command or title (e.g. typos, ambiguous short text like "laut ddari bernadya"):
  1. BE COMPLETELY HONEST. Never make excuses about connection or technical errors.
  2. Ask for a brief friendly clarification or confirm their intent naturally (e.g. "Mau aku putarin lagu 'Laut' dari Bernadya di Spotify sekarang? 🎵" or "Mau kirim pesan apa ke [Nama Kontak] di WhatsApp?").
- Joy automatically executes actions (sending WhatsApp messages, playing Spotify tracks, and creating schedules) on the backend before this prompt.
- If the user communicates in Indonesian, respond naturally and warmly in Indonesian.
Do not expose system errors, provider errors, internal tools, or technical details.`;
export type HermesClientErrorCode = "HERMES_FAILED" | "PIPELINE_TIMEOUT";

export class HermesClientError extends Error {
  constructor(
    public readonly code: HermesClientErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "HermesClientError";
  }
}

export interface HermesGenerateOptions {
  conversation?: string;
  sessionKey?: string;
  instructions?: string;
  raw?: boolean;
}

export interface HermesGenerateClient {
  generate(input: string, signal?: AbortSignal, options?: HermesGenerateOptions): Promise<string>;
  generateStream?(input: string, signal?: AbortSignal, options?: HermesGenerateOptions): AsyncIterable<string>;
  generateResponseStream?(input: string, signal?: AbortSignal, options?: HermesGenerateOptions): AsyncIterable<string>;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface HermesClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  conversation: string;
  softTimeoutMs?: number;
  hardTimeoutMs: number;
  logger?: {
    warn(bindings: Record<string, unknown>, message: string): void;
  };
  fetcher?: Fetcher;
}

export interface FastVoiceLlmClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort?: "low" | "medium" | "high" | "none";
  maxTokens?: number;
  temperature?: number;
  softTimeoutMs?: number;
  hardTimeoutMs: number;
  logger?: {
    warn(bindings: Record<string, unknown>, message: string): void;
  };
  fetcher?: Fetcher;
}

interface NormalizedHermesClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  conversation: string;
  softTimeoutMs?: number | undefined;
  hardTimeoutMs: number;
  logger?: {
    warn(bindings: Record<string, unknown>, message: string): void;
  } | undefined;
  fetcher: Fetcher;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function endpoint(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return trimmed.endsWith(normalizedPath) ? trimmed : `${trimmed}${normalizedPath}`;
}

function requireText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new HermesClientError("HERMES_FAILED", "Hermes output text is empty");
  }
  return trimmed;
}

export function parseResponsesText(payload: unknown): string {
  if (!isObject(payload)) {
    throw new HermesClientError("HERMES_FAILED", "Hermes response is not an object");
  }

  if (typeof payload.status === "string" && payload.status !== "completed") {
    throw new HermesClientError("HERMES_FAILED", "Hermes response is not completed");
  }

  if (!Array.isArray(payload.output)) {
    throw new HermesClientError("HERMES_FAILED", "Hermes response output is missing");
  }

  const texts: string[] = [];
  for (const item of payload.output) {
    if (!isObject(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isObject(content) && content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }

  return requireText(texts.join(" ").trim());
}

export function parseChatCompletionsText(payload: unknown): string {
  if (!isObject(payload) || !Array.isArray(payload.choices)) {
    throw new HermesClientError("HERMES_FAILED", "Hermes chat response choices are missing");
  }

  const texts: string[] = [];
  for (const choice of payload.choices) {
    if (!isObject(choice) || !isObject(choice.message)) continue;
    if (typeof choice.message.content === "string") {
      texts.push(choice.message.content);
    }
  }

  return requireText(texts.join(" ").trim());
}

export function sanitizeHermesOutput(raw: string): string {
  const withoutMarkdown = raw
    .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/```/g, "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/[`*_#>~-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = withoutMarkdown.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const concise = sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .slice(0, 600)
    .trim();

  return requireText(concise);
}

export function detectProviderError(text: string): boolean {
  return [
    /\bprovider\s+(?:request\s+)?(?:error|failed|failure)\b/i,
    /\brequest\s+failed\b/i,
    /\brate\s+limit(?:ed)?\b/i,
    /\bquota\s+exceeded\b/i,
    /\bunauthorized\b/i,
    /\binvalid\s+api\s+key\b/i,
    /\bconnection\s+refused\b/i,
    /\bservice\s+unavailable\b/i,
    /\binternal\s+(?:server\s+)?error\b/i,
    /\b(?:timed\s+out|timeout\s+(?:after|while|from|calling))\b/i,
  ].some((pattern) => pattern.test(text));
}

async function jsonOrThrow(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HermesClientError("HERMES_FAILED", "Hermes returned invalid JSON");
  }
}

function normalizeHermesError(error: unknown): HermesClientError {
  if (error instanceof HermesClientError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new HermesClientError("HERMES_FAILED", "Hermes timed out");
  }
  if (isObject(error) && error.name === "AbortError") {
    return new HermesClientError("HERMES_FAILED", "Hermes timed out");
  }
  return new HermesClientError("HERMES_FAILED", "Hermes request failed");
}

abstract class BaseHermesClient {
  protected readonly fetcher: Fetcher;

  protected constructor(protected readonly options: NormalizedHermesClientOptions) {
    this.fetcher = options.fetcher;
  }

  protected async postJson(
    url: string,
    body: unknown,
    parentSignal?: AbortSignal,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.hardTimeoutMs);
    const abortFromParent = () => controller.abort();
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    if (parentSignal?.aborted) controller.abort();

    const softTimer =
      this.options.softTimeoutMs && this.options.softTimeoutMs < this.options.hardTimeoutMs
        ? setTimeout(() => {
            this.options.logger?.warn(
              { timeout_ms: this.options.softTimeoutMs },
              "Hermes soft timeout threshold exceeded",
            );
          }, this.options.softTimeoutMs)
        : undefined;

    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
          ...(extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HermesClientError("HERMES_FAILED", `Hermes HTTP ${response.status}`);
      }

      return await jsonOrThrow(response);
    } catch (error) {
      throw normalizeHermesError(error);
    } finally {
      clearTimeout(timer);
      clearTimeout(softTimer);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  protected async *postStream(
    url: string,
    body: unknown,
    parentSignal?: AbortSignal,
    extraHeaders?: Record<string, string>,
  ): AsyncIterable<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.hardTimeoutMs);
    const abortFromParent = () => controller.abort();
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
    if (parentSignal?.aborted) controller.abort();

    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
          accept: "text/event-stream, application/json",
          ...(extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HermesClientError("HERMES_FAILED", `Hermes HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json") && !contentType.includes("text/event-stream")) {
        const json = await jsonOrThrow(response);
        if (isObject(json) && Array.isArray(json.choices)) {
          yield parseChatCompletionsText(json);
        } else if (isObject(json)) {
          yield parseResponsesText(json);
        }
        return;
      }

      if (!response.body) {
        throw new HermesClientError("HERMES_FAILED", "Hermes returned empty response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const toolCallBuffer = new Map<number, { id?: string; name?: string; arguments: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":") || trimmed.startsWith("event:")) continue;

          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.replace(/^data:\s*/, "").trim();
            if (dataStr === "[DONE]") return;
            try {
              const data = JSON.parse(dataStr);
              // Handle /v1/chat/completions OpenAI format
              if (Array.isArray(data?.choices)) {
                const choice = data.choices[0];
                if (choice?.delta) {
                  const delta = choice.delta;
                  // Handle tool calls buffering
                  if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const idx = typeof tc.index === "number" ? tc.index : 0;
                      const existing = toolCallBuffer.get(idx) ?? { arguments: "" };
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name = (existing.name ?? "") + tc.function.name;
                      if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                      toolCallBuffer.set(idx, existing);
                    }
                  }
                  // Skip reasoning content / thinking tags
                  if (typeof delta.content === "string" && delta.content.length > 0) {
                    yield delta.content;
                  }
                }
              }
              // Handle /v1/responses format
              else if (data?.type === "response.output_text.delta" && typeof data?.delta === "string") {
                if (data.delta.length > 0) {
                  yield data.delta;
                }
              }
            } catch {
              // Ignore invalid JSON chunk
            }
          }
        }
      }
    } catch (error) {
      throw normalizeHermesError(error);
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", abortFromParent);
    }
  }

  protected finalize(text: string, raw = false): string {
    if (raw) {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new HermesClientError("HERMES_FAILED", "Hermes output text is empty");
      }
      if (detectProviderError(trimmed)) {
        throw new HermesClientError("HERMES_FAILED", "Hermes output contained provider error");
      }
      return trimmed;
    }

    const sanitized = sanitizeHermesOutput(text);
    if (detectProviderError(sanitized)) {
      throw new HermesClientError("HERMES_FAILED", "Hermes output contained provider error");
    }
    return sanitized;
  }
}

export class HermesResponsesClient extends BaseHermesClient implements HermesGenerateClient {
  constructor(options: HermesClientOptions) {
    super({ ...options, fetcher: options.fetcher ?? fetch });
  }

  async generate(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): Promise<string> {
    const payload = await this.postJson(endpoint(this.options.baseUrl, "/v1/responses"), {
      model: this.options.model,
      instructions: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS,
      input,
      conversation: requestOptions?.conversation ?? this.options.conversation,
      store: true,
      stream: false,
      truncation: "auto",
    }, signal, requestOptions?.sessionKey ? { "X-Hermes-Session-Key": requestOptions.sessionKey } : undefined);

    return this.finalize(parseResponsesText(payload), requestOptions?.raw);
  }

  async *generateStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    const stream = this.postStream(endpoint(this.options.baseUrl, "/v1/responses"), {
      model: this.options.model,
      instructions: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS,
      input,
      conversation: requestOptions?.conversation ?? this.options.conversation,
      store: true,
      stream: true,
      truncation: "auto",
    }, signal, requestOptions?.sessionKey ? { "X-Hermes-Session-Key": requestOptions.sessionKey } : undefined);

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async *generateResponseStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    yield* this.generateStream(input, signal, requestOptions);
  }
}

export class HermesChatCompletionsClient extends BaseHermesClient implements HermesGenerateClient {
  constructor(options: HermesClientOptions) {
    super({ ...options, fetcher: options.fetcher ?? fetch });
  }

  async generate(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): Promise<string> {
    const payload = await this.postJson(endpoint(this.options.baseUrl, "/v1/chat/completions"), {
      model: this.options.model,
      messages: [
        { role: "system", content: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS },
        { role: "user", content: input },
      ],
      conversation: requestOptions?.conversation ?? this.options.conversation,
      stream: false,
    }, signal, requestOptions?.sessionKey ? { "X-Hermes-Session-Key": requestOptions.sessionKey } : undefined);

    return this.finalize(parseChatCompletionsText(payload), requestOptions?.raw);
  }

  async *generateStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    const stream = this.postStream(endpoint(this.options.baseUrl, "/v1/chat/completions"), {
      model: this.options.model,
      messages: [
        { role: "system", content: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS },
        { role: "user", content: input },
      ],
      conversation: requestOptions?.conversation ?? this.options.conversation,
      stream: true,
    }, signal, requestOptions?.sessionKey ? { "X-Hermes-Session-Key": requestOptions.sessionKey } : undefined);

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async *generateResponseStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    yield* this.generateStream(input, signal, requestOptions);
  }
}

export class FastVoiceLlmClient extends BaseHermesClient implements HermesGenerateClient {
  private readonly reasoningEffort: string | undefined;
  private readonly maxTokens: number;
  private readonly temperature: number | undefined;

  constructor(options: FastVoiceLlmClientOptions) {
    super({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      conversation: "",
      softTimeoutMs: options.softTimeoutMs,
      hardTimeoutMs: options.hardTimeoutMs,
      logger: options.logger,
      fetcher: options.fetcher ?? fetch,
    });

    this.reasoningEffort = options.reasoningEffort;
    this.maxTokens = options.maxTokens ?? 150;
    this.temperature = options.temperature;
  }

  private chatEndpoint(): string {
    const base = this.options.baseUrl.replace(/\/$/, "");
    if (base.endsWith("/chat/completions")) return base;
    if (base.endsWith("/v1")) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }

  async generate(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): Promise<string> {
    const payload = await this.postJson(
      this.chatEndpoint(),
      {
        model: this.options.model,
        messages: [
          { role: "system", content: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS },
          { role: "user", content: input },
        ],
        stream: false,
        max_tokens: this.maxTokens,
        ...(this.reasoningEffort && this.reasoningEffort !== "none" ? { reasoning_effort: this.reasoningEffort } : {}),
        ...(this.temperature !== undefined ? { temperature: this.temperature } : {}),
      },
      signal,
      { "user-agent": "Joy-Backend/1.0" },
    );

    return this.finalize(parseChatCompletionsText(payload), requestOptions?.raw);
  }

  async *generateStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    const stream = this.postStream(
      this.chatEndpoint(),
      {
        model: this.options.model,
        messages: [
          { role: "system", content: requestOptions?.instructions ?? JOY_RUNTIME_INSTRUCTIONS },
          { role: "user", content: input },
        ],
        stream: true,
        max_tokens: this.maxTokens,
        ...(this.reasoningEffort && this.reasoningEffort !== "none" ? { reasoning_effort: this.reasoningEffort } : {}),
        ...(this.temperature !== undefined ? { temperature: this.temperature } : {}),
      },
      signal,
      { "user-agent": "Joy-Backend/1.0" },
    );

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async *generateResponseStream(input: string, signal?: AbortSignal, requestOptions?: HermesGenerateOptions): AsyncIterable<string> {
    yield* this.generateStream(input, signal, requestOptions);
  }
}
