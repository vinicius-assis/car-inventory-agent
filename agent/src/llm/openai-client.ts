import OpenAI from "openai";
import type { LlmClient, CallStructuredParams } from "./client.js";
import type { UsageStats } from "../types.js";

interface MinimalChatApi {
  create(params: Record<string, unknown>): Promise<{
    choices: Array<{
      message: {
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  }>;
}

export class OpenAiLlmClient implements LlmClient {
  private usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 };

  constructor(
    private readonly client: MinimalChatApi,
    private readonly model: string,
  ) {}

  async callStructured<T>(params: CallStructuredParams): Promise<T> {
    const response = await this.client.create({
      model: this.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: params.toolName,
            description: params.toolDescription,
            parameters: params.inputSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: params.toolName } },
    });

    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    this.usage.calls += 1;
    this.usage.inputTokens += usage.prompt_tokens;
    this.usage.outputTokens += usage.completion_tokens;

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error(
        `Expected a tool call from tool "${params.toolName}", got: ${JSON.stringify(response.choices[0]?.message)}`,
      );
    }
    return JSON.parse(toolCall.function.arguments) as T;
  }

  getUsage(): UsageStats {
    return { ...this.usage };
  }
}

export function createOpenAiLlmClient(apiKey: string, model: string): OpenAiLlmClient {
  const raw = new OpenAI({ apiKey });
  return new OpenAiLlmClient(raw.chat.completions as unknown as MinimalChatApi, model);
}
