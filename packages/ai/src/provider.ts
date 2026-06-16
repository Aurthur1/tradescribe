import type { ZodSchema } from "zod";

export type LLMProviderName = "anthropic" | "openai";
export type LLMRole = "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface GenerateStructuredInput<T> {
  system: string;
  messages: LLMMessage[];
  schema: ZodSchema<T>;
  maxTokens: number;
}

export interface GenerateTextInput {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  readonly model: string;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<{ data: T; tokensUsed: number }>;
  generateText(input: GenerateTextInput): Promise<{ text: string; tokensUsed: number }>;
}

export interface HttpClient {
  (url: string, init: RequestInit): Promise<Response>;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function configuredFetch(): HttpClient {
  return fetch;
}

function tokenCountFromPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return 0;
  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage) return 0;
  const total = usage.total_tokens ?? usage.totalTokens;
  if (typeof total === "number") return total;
  const input = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const output = usage.output_tokens ?? usage.completion_tokens ?? 0;
  return (typeof input === "number" ? input : 0) + (typeof output === "number" ? output : 0);
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

function issuesToText(error: unknown) {
  if (typeof error === "object" && error !== null && "issues" in error) {
    return JSON.stringify((error as { issues: unknown }).issues);
  }
  return error instanceof Error ? error.message : String(error);
}

abstract class BaseProvider implements LLMProvider {
  abstract readonly name: LLMProviderName;
  abstract readonly model: string;

  protected constructor(protected readonly http: HttpClient = configuredFetch()) {}

  abstract generateText(input: GenerateTextInput): Promise<{ text: string; tokensUsed: number }>;

  async generateStructured<T>(input: GenerateStructuredInput<T>): Promise<{ data: T; tokensUsed: number }> {
    const first = await this.generateText({
      maxTokens: input.maxTokens,
      messages: [
        ...input.messages,
        {
          role: "user",
          content:
            "Return only a JSON object that matches the required schema. Do not wrap it in Markdown or add commentary."
        }
      ],
      system: input.system
    });
    const firstParsed = input.schema.safeParse(parseJsonObject(first.text));
    if (firstParsed.success) return { data: firstParsed.data, tokensUsed: first.tokensUsed };

    const retry = await this.generateText({
      maxTokens: input.maxTokens,
      messages: [
        ...input.messages,
        {
          role: "assistant",
          content: first.text
        },
        {
          role: "user",
          content: `Your previous output didn't match the required schema: ${issuesToText(firstParsed.error)}. Try again. Return only valid JSON.`
        }
      ],
      system: input.system
    });
    const retryParsed = input.schema.parse(parseJsonObject(retry.text));
    return { data: retryParsed, tokensUsed: first.tokensUsed + retry.tokensUsed };
  }
}

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic" as const;
  readonly model = process.env.AI_MODEL_ANTHROPIC ?? DEFAULT_ANTHROPIC_MODEL;

  constructor(http?: HttpClient) {
    super(http);
  }

  async generateText(input: GenerateTextInput): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const response = await this.http("https://api.anthropic.com/v1/messages", {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: input.messages,
        model: this.model,
        system: input.system
      }),
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": apiKey
      },
      method: "POST"
    });
    if (!response.ok) throw new Error(`Anthropic request failed with ${response.status}`);
    const payload = (await response.json()) as { content?: Array<{ text?: string; type?: string }>; usage?: unknown };
    const text = payload.content?.find((item) => item.type === "text" || item.text)?.text ?? "";
    return { text, tokensUsed: tokenCountFromPayload(payload) };
  }
}

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai" as const;
  readonly model = process.env.AI_MODEL_OPENAI ?? DEFAULT_OPENAI_MODEL;

  constructor(http?: HttpClient) {
    super(http);
  }

  async generateText(input: GenerateTextInput): Promise<{ text: string; tokensUsed: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const response = await this.http("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: input.maxTokens,
        messages: [{ role: "system", content: input.system }, ...input.messages],
        model: this.model
      }),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      method: "POST"
    });
    if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
    return { text: payload.choices?.[0]?.message?.content ?? "", tokensUsed: tokenCountFromPayload(payload) };
  }
}

export function getConfiguredProviderName(): LLMProviderName {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic";
}

export function getProvider(): LLMProvider {
  return getConfiguredProviderName() === "openai" ? new OpenAIProvider() : new AnthropicProvider();
}
