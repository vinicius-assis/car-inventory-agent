import "dotenv/config";

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxFixCycles: number;
}

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_FIX_CYCLES = 3;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Copy agent/.env.example to agent/.env and set it.");
  }
  return {
    apiKey,
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    maxFixCycles: DEFAULT_MAX_FIX_CYCLES,
  };
}
