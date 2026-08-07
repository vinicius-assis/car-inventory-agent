// agent/src/__tests__/config.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("defaults to the anthropic provider and throws when ANTHROPIC_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("uses the default anthropic model and fix-cycle limit when not overridden", () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: "test-key" });
    expect(config.provider).toBe("anthropic");
    expect(config.apiKey).toBe("test-key");
    expect(config.model).toBe("claude-sonnet-5");
    expect(config.maxFixCycles).toBe(3);
  });

  it("respects an ANTHROPIC_MODEL override", () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "claude-opus-5" });
    expect(config.model).toBe("claude-opus-5");
  });

  it("switches to the openai provider when LLM_PROVIDER=openai, and throws when OPENAI_API_KEY is missing", () => {
    expect(() => loadConfig({ LLM_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
  });

  it("uses the default openai model when LLM_PROVIDER=openai", () => {
    const config = loadConfig({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "test-key" });
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("test-key");
    expect(config.model).toBe("gpt-4o");
  });

  it("respects an OPENAI_MODEL override", () => {
    const config = loadConfig({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-4.1" });
    expect(config.model).toBe("gpt-4.1");
  });
});
