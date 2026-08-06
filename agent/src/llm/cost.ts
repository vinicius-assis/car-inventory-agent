import type { UsageStats } from "../types.js";

// Approximate Claude Sonnet pricing (USD per million tokens) at time of writing.
// Verify against https://www.anthropic.com/pricing before relying on this for budgeting.
const INPUT_PRICE_PER_MILLION = 3;
const OUTPUT_PRICE_PER_MILLION = 15;

export function estimateCostUsd(usage: UsageStats): number {
  const inputCost = (usage.inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION;
  const outputCost = (usage.outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION;
  return inputCost + outputCost;
}
