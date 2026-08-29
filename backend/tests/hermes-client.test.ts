import { describe, expect, it, vi } from "vitest";
import {
  JOY_RUNTIME_INSTRUCTIONS,
  FastVoiceLlmClient,
  HermesChatCompletionsClient,
  HermesClientError,
  HermesResponsesClient,
  detectProviderError,
  parseChatCompletionsText,
  parseResponsesText,
  sanitizeHermesOutput,
} from "../src/services/hermes.client.js";

const completedFixture = {
  id: "resp_1",
  status: "completed",
  output: [
    { type: "function_call", name: "ignored_tool", arguments: "{\"secret\":\"nope\"}" },
    {
      type: "message",
      content: [
        { type: "refusal", refusal: "ignored" },
        { type: "output_text", text: "Hi! Joy is right here with you." },
      ],
    },
  ],
};

describe("Hermes Responses parser", () => {
  it("extracts output_text from message items without relying on output[0]", () => {
    expect(parseResponsesText(completedFixture)).toBe("Hi! Joy is right here with you.");
  });

  it("rejects incomplete responses, empty output, and tool-only payloads", () => {
    expect(() => parseResponsesText({ status: "in_progress", output: [] })).toThrow(HermesClientError);
    expect(() => parseResponsesText({ status: "completed", output: [] })).toThrow(HermesClientError);
    expect(() => parseResponsesText({ status: "completed", output: [{ type: "function_call" }] })).toThrow(
      HermesClientError,
    );
  });

  it("parses chat-completions fallback separately", () => {
    expect(
      parseChatCompletionsText({
        choices: [{ message: { content: "Hello from chat fallback." } }],
      }),
    ).toBe("Hello from chat fallback.");
  });
});

describe("Hermes output sanitizer", () => {
  it("removes markdown, URLs, code fences, extra whitespace, and keeps three short sentences", () => {
    const output = sanitizeHermesOutput(
      "```md\n# Hello **friend**\nVisit https://example.com now.\nOne. Two. Three. Four.\n```",
    );
    expect(output).toBe("Hello friend Visit now. One. Two.");
  });

  it("detects provider/internal errors defensively", () => {
    expect(detectProviderError("Provider request failed: unauthorized")).toBe(true);
    expect(detectProviderError("Joy can help after a timeout game.")).toBe(false);
  });
});

describe("Hermes clients", () => {
  it("sends canonical /v1/responses body with Joy instructions every request", async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({
        model: "hermes-agent",
        instructions: JOY_RUNTIME_INSTRUCTIONS,
        input: "halo joy",
        conversation: "joy-001",
        store: true,
        stream: false,
        truncation: "auto",
      });
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-hermes-key");
      return new Response(JSON.stringify(completedFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = new HermesResponsesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "test-hermes-key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher,
    });

    await expect(client.generate("halo joy")).resolves.toBe("Hi! Joy is right here with you.");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("accepts a server-owned per-chat conversation without changing the default voice conversation", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const client = new HermesResponsesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "test-hermes-key",
      model: "hermes-agent",
      conversation: "voice-joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async (_url, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(JSON.stringify(completedFixture), { status: 200 });
      },
    });

    await client.generate("mobile", undefined, { conversation: "chat-user-session" });
    await client.generate("voice");

    expect(bodies.map((body) => body.conversation)).toEqual(["chat-user-session", "voice-joy-001"]);
  });

  it("preserves markdown and headings when raw option is enabled", async () => {
    const markdownOutput = "## Profile & Identity\nUser is Rangga.\n\n## Preferences\nLikes robotics.";
    const client = new HermesResponsesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "test-hermes-key",
      model: "hermes-agent",
      conversation: "dream-test",
      hardTimeoutMs: 1_000,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [{ type: "message", content: [{ type: "output_text", text: markdownOutput }] }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });

    await expect(client.generate("dream payload", undefined, { raw: true })).resolves.toBe(markdownOutput);
  });

  it("maps non-2xx, invalid JSON, provider error output, and timeout to HERMES_FAILED", async () => {
    const non2xx = new HermesResponsesClient({
      baseUrl: "http://local",
      apiKey: "key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async () => new Response("bad", { status: 503 }),
    });
    await expect(non2xx.generate("hi")).rejects.toMatchObject({ code: "HERMES_FAILED" });

    const invalidJson = new HermesResponsesClient({
      baseUrl: "http://local",
      apiKey: "key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async () => new Response("{", { status: 200 }),
    });
    await expect(invalidJson.generate("hi")).rejects.toMatchObject({ code: "HERMES_FAILED" });

    const providerError = new HermesResponsesClient({
      baseUrl: "http://local",
      apiKey: "key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [{ type: "message", content: [{ type: "output_text", text: "Provider request failed: rate limit" }] }],
          }),
          { status: 200 },
        ),
    });
    await expect(providerError.generate("hi")).rejects.toMatchObject({ code: "HERMES_FAILED" });

    const timeout = new HermesResponsesClient({
      baseUrl: "http://local",
      apiKey: "key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1,
      fetcher: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    });
    await expect(timeout.generate("hi")).rejects.toMatchObject({ code: "HERMES_FAILED" });
  });

  it("HermesChatCompletionsClient streams SSE delta chunks and buffers tool calls", async () => {
    const client = new HermesChatCompletionsClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "test-hermes-key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init.body));
        expect(body.stream).toBe(true);
        expect(body.model).toBe("hermes-agent");

        const sse = [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\\"city\\":"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Jakarta\\"}"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Halo! "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Aku Joy!"}}]}\n\n',
          "data: [DONE]\n\n",
        ].join("");

        return new Response(sse, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        });
      },
    });

    const chunks: string[] = [];
    for await (const chunk of client.generateStream("halo")) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toBe("Halo! Aku Joy!");

    const aliasChunks: string[] = [];
    for await (const chunk of client.generateResponseStream("halo")) {
      aliasChunks.push(chunk);
    }
    expect(aliasChunks.join("")).toBe("Halo! Aku Joy!");
  });

  it("HermesResponsesClient streams SSE output_text deltas and handles JSON fallback", async () => {
    const client = new HermesResponsesClient({
      baseUrl: "http://127.0.0.1:8642",
      apiKey: "test-hermes-key",
      model: "hermes-agent",
      conversation: "joy-001",
      hardTimeoutMs: 1_000,
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init.body));
        if (body.input === "stream-test") {
          const sse = [
            'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hai "}\n\n',
            'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"kawan!"}\n\n',
            "data: [DONE]\n\n",
          ].join("");
          return new Response(sse, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }

        return new Response(JSON.stringify(completedFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const streamChunks: string[] = [];
    for await (const chunk of client.generateStream("stream-test")) {
      streamChunks.push(chunk);
    }
    expect(streamChunks.join("")).toBe("Hai kawan!");

    const fallbackChunks: string[] = [];
    for await (const chunk of client.generateStream("fallback-test")) {
      fallbackChunks.push(chunk);
    }
    expect(fallbackChunks.join("")).toBe("Hi! Joy is right here with you.");
  });

  it("FastVoiceLlmClient sends standard OpenAI chat completions request and streams tokens", async () => {
    const requestedUrls: string[] = [];
    const client = new FastVoiceLlmClient({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "gsk_test",
      model: "openai/gpt-oss-120b",
      reasoningEffort: "low",
      maxTokens: 100,
      hardTimeoutMs: 1_000,
      fetcher: async (url, init) => {
        requestedUrls.push(url);
        const body = JSON.parse(String(init.body));
        expect(body.model).toBe("openai/gpt-oss-120b");
        expect(body.max_tokens).toBe(100);
        expect(body.reasoning_effort).toBe("low");
        expect(body.conversation).toBeUndefined();
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer gsk_test");
        expect(new Headers(init.headers).get("user-agent")).toBe("Joy-Backend/1.0");

        if (body.stream) {
          const sse = [
            'data: {"choices":[{"delta":{"content":"Halo "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"sahabat!"}}]}\n\n',
            "data: [DONE]\n\n",
          ].join("");
          return new Response(sse, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }

        return new Response(
          JSON.stringify({ choices: [{ message: { content: "Halo sahabat!" } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await expect(client.generate("hi")).resolves.toBe("Halo sahabat!");
    expect(requestedUrls[0]).toBe("https://api.groq.com/openai/v1/chat/completions");

    const tokens: string[] = [];
    for await (const chunk of client.generateStream("hi")) {
      tokens.push(chunk);
    }
    expect(tokens.join("")).toBe("Halo sahabat!");
  });
});
