import { describe, it, expect } from "vitest";
import { estimateCostUsd } from "../llm/cost.js";

describe("estimateCostUsd", () => {
  it("computes cost from input and output tokens", () => {
    const cost = estimateCostUsd({ calls: 1, inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(18, 5);
  });

  it("returns 0 for no usage", () => {
    expect(estimateCostUsd({ calls: 0, inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
