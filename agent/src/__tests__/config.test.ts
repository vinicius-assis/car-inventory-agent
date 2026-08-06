import { describe, it, expect } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
  it("throws when ANTHROPIC_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("uses the default model and fix-cycle limit when not overridden", () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: "test-key" });
    expect(config.apiKey).toBe("test-key");
    expect(config.model).toBe("claude-sonnet-5");
    expect(config.maxFixCycles).toBe(3);
  });

  it("respects an ANTHROPIC_MODEL override", () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "claude-opus-5" });
    expect(config.model).toBe("claude-opus-5");
  });
});
