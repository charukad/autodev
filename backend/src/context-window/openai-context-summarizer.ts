import type { ContextModelId, SummarizerRequest, SummarizerResult } from "./types";
import type { ContextSummarizer } from "./summarizer";
import { HeuristicTokenCounter, type TokenCounter } from "./token-counter";

export type OpenAIContextSummarizerOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  counter?: TokenCounter;
};

export class OpenAIContextSummarizer implements ContextSummarizer {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly counter: TokenCounter;

  constructor(options: OpenAIContextSummarizerOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = options.model ?? process.env.OPENAI_SUMMARIZER_MODEL ?? "gpt-4o-mini";
    this.baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.counter = options.counter ?? new HeuristicTokenCounter();
  }

  async summarize(request: SummarizerRequest): Promise<SummarizerResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          max_tokens: Math.max(64, request.targetTokens),
          messages: [
            {
              role: "system",
              content:
                "You compress developer context for another model. Preserve identifiers, file paths, APIs, and decisions. Respond with plain text only.",
            },
            {
              role: "user",
              content: buildPrompt(
                request.model,
                request.item.content,
                request.targetTokens,
                request.purpose
              ),
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI summarization failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI summarization returned an empty response.");
    }

    return {
      content,
      tokenCount: this.counter.countText(request.model, content),
      strategy: `openai:${this.model}`,
    };
  }
}

function buildPrompt(
  model: ContextModelId,
  content: string,
  targetTokens: number,
  purpose?: string
): string {
  return [
    `Target model: ${model}`,
    `Target token budget: ${targetTokens}`,
    purpose ? `Purpose: ${purpose}` : undefined,
    "",
    "Summarize the following context to fit the target budget while preserving the most important technical details:",
    "",
    content,
  ]
    .filter(Boolean)
    .join("\n");
}
