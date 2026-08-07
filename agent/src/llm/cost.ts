import type { UsageStats } from "../types.js";

// Approximate pricing (USD per million tokens) at time of writing.
// Verify against https://www.anthropic.com/pricing and https://openai.com/api/pricing
// before relying on this for budgeting.
const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
};

const DEFAULT_PRICING_KEY = "claude-sonnet-5";

export function estimateCostUsd(usage: UsageStats, model: string = DEFAULT_PRICING_KEY): number {
  const pricing = PRICING[model] ?? PRICING[DEFAULT_PRICING_KEY]!;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}
