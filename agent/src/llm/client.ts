import Anthropic from "@anthropic-ai/sdk";
import type { UsageStats } from "../types.js";

export interface CallStructuredParams {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmClient {
  callStructured<T>(params: CallStructuredParams): Promise<T>;
  getUsage(): UsageStats;
}

interface MinimalMessagesApi {
  create(params: Record<string, unknown>): Promise<{
    content: Array<{ type: string; [key: string]: unknown }>;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

export class AnthropicLlmClient implements LlmClient {
  private usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 };

  constructor(
    private readonly client: MinimalMessagesApi,
    private readonly model: string,
  ) {}

  async callStructured<T>(params: CallStructuredParams): Promise<T> {
    const response = await this.client.create({
      model: this.model,
      max_tokens: 8192,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: params.toolName,
          description: params.toolDescription,
          input_schema: params.inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: params.toolName },
    });

    this.usage.calls += 1;
    this.usage.inputTokens += response.usage.input_tokens;
    this.usage.outputTokens += response.usage.output_tokens;

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error(
        `Expected a tool_use block from tool "${params.toolName}", got: ${JSON.stringify(response.content)}`,
      );
    }
    return toolUse.input as T;
  }

  getUsage(): UsageStats {
    return { ...this.usage };
  }
}

export function createAnthropicLlmClient(apiKey: string, model: string): AnthropicLlmClient {
  const raw = new Anthropic({ apiKey });
  return new AnthropicLlmClient(raw.messages as unknown as MinimalMessagesApi, model);
}
