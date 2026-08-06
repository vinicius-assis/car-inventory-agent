import { describe, it, expect, vi } from "vitest";
import { AnthropicLlmClient } from "../llm/client.js";

function fakeAnthropicClient(responseContent: unknown[], usage = { input_tokens: 10, output_tokens: 5 }) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: responseContent, usage }),
    },
  };
}

describe("AnthropicLlmClient", () => {
  it("extracts the tool_use input and returns it", async () => {
    const fake = fakeAnthropicClient([
      { type: "text", text: "thinking..." },
      { type: "tool_use", name: "emit_thing", input: { content: "hello" } },
    ]);
    const client = new AnthropicLlmClient(fake.messages as never, "claude-sonnet-5");

    const result = await client.callStructured<{ content: string }>({
      system: "sys",
      user: "user",
      toolName: "emit_thing",
      toolDescription: "desc",
      inputSchema: { type: "object", properties: { content: { type: "string" } } },
    });

    expect(result).toEqual({ content: "hello" });
    expect(fake.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        tool_choice: { type: "tool", name: "emit_thing" },
      }),
    );
  });

  it("throws if no tool_use block is returned", async () => {
    const fake = fakeAnthropicClient([{ type: "text", text: "no tool call" }]);
    const client = new AnthropicLlmClient(fake.messages as never, "claude-sonnet-5");

    await expect(
      client.callStructured({
        system: "sys",
        user: "user",
        toolName: "emit_thing",
        toolDescription: "desc",
        inputSchema: {},
      }),
    ).rejects.toThrow(/tool_use/);
  });

  it("accumulates token usage across calls", async () => {
    const fake = fakeAnthropicClient([{ type: "tool_use", name: "t", input: {} }], {
      input_tokens: 100,
      output_tokens: 50,
    });
    const client = new AnthropicLlmClient(fake.messages as never, "claude-sonnet-5");

    await client.callStructured({ system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: {} });
    await client.callStructured({ system: "s", user: "u", toolName: "t", toolDescription: "d", inputSchema: {} });

    expect(client.getUsage()).toEqual({ calls: 2, inputTokens: 200, outputTokens: 100 });
  });
});
