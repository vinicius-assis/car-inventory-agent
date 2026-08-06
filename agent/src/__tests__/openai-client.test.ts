import { describe, it, expect, vi } from "vitest";
import { OpenAiLlmClient } from "../llm/openai-client.js";

function fakeOpenAiClient(
  toolCallArgs: string | undefined,
  usage = { prompt_tokens: 10, completion_tokens: 5 },
) {
  return {
    create: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: toolCallArgs === undefined ? undefined : [{ function: { name: "emit_thing", arguments: toolCallArgs } }],
          },
        },
      ],
      usage,
    }),
  };
}

describe("OpenAiLlmClient", () => {
  it("parses the tool call arguments JSON and returns it", async () => {
    const fake = fakeOpenAiClient(JSON.stringify({ content: "hello" }));
    const client = new OpenAiLlmClient(fake as never, "gpt-4o");

    const result = await client.callStructured<{ content: string }>({
      system: "sys",
      user: "user",
      toolName: "emit_thing",
      toolDescription: "desc",
      inputSchema: { type: "object", properties: { content: { type: "string" } } },
    });

    expect(result).toEqual({ content: "hello" });
    expect(fake.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        tool_choice: { type: "function", function: { name: "emit_thing" } },
      }),
    );
  });

  it("throws if no tool call is returned", async () => {
    const fake = fakeOpenAiClient(undefined);
    const client = new OpenAiLlmClient(fake as never, "gpt-4o");

    await expect(
      client.callStructured({
        system: "sys",
        user: "user",
        toolName: "emit_thing",
        toolDescription: "desc",
        inputSchema: {},
      }),
    ).rejects.toThrow(/tool call/);
  });

  it("accumulates token usage across calls using prompt_tokens/completion_tokens", async () => {
    const fake = fakeOpenAiClient(JSON.stringify({}), { prompt_tokens: 100, completion_tokens: 50 });
    const client = new OpenAiLlmClient(fake as never, "gpt-4o");

    await client.callStructured({ system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: {} });
    await client.callStructured({ system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: {} });

    expect(client.getUsage()).toEqual({ calls: 2, inputTokens: 200, outputTokens: 100 });
  });
});
