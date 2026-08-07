import "dotenv/config";

export interface AgentConfig {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  maxFixCycles: number;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_OPENAI_MODEL = "gpt-4o";
const DEFAULT_MAX_FIX_CYCLES = 3;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const provider: "anthropic" | "openai" = env.LLM_PROVIDER === "openai" ? "openai" : "anthropic";

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing OPENAI_API_KEY. Copy agent/.env.example to agent/.env, set LLM_PROVIDER=openai and OPENAI_API_KEY.",
      );
    }
    return {
      provider,
      apiKey,
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      maxFixCycles: DEFAULT_MAX_FIX_CYCLES,
    };
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Copy agent/.env.example to agent/.env and set it.");
  }
  return {
    provider,
    apiKey,
    model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    maxFixCycles: DEFAULT_MAX_FIX_CYCLES,
  };
}
