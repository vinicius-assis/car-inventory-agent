// agent/src/__tests__/cost.test.ts
import { describe, it, expect } from "vitest";
import { estimateCostUsd } from "../llm/cost.js";

describe("estimateCostUsd", () => {
  it("computes cost from input and output tokens using the default (Claude Sonnet) pricing", () => {
    const cost = estimateCostUsd({ calls: 1, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(18, 5);
  });

  it("returns 0 for no usage", () => {
    expect(estimateCostUsd({ calls: 0, inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("uses gpt-4o pricing when that model is passed", () => {
    const cost = estimateCostUsd({ calls: 1, inputTokens: 1_000_000, outputTokens: 1_000_000 }, "gpt-4o");
    expect(cost).toBeCloseTo(12.5, 5);
  });

  it("falls back to the default pricing for an unrecognized model", () => {
    const cost = estimateCostUsd({ calls: 1, inputTokens: 1_000_000, outputTokens: 1_000_000 }, "some-future-model");
    expect(cost).toBeCloseTo(18, 5);
  });
});
