# Agentic Code Generation Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI agent in `agent/` that reads a natural-language spec, plans a task graph, generates a React + TypeScript "Car Inventory Manager" into a copy of the existing boilerplate, self-validates with `tsc`/`vitest`, and fixes failures in a bounded retry loop.

**Architecture:** A single Node.js/TypeScript orchestrator with four sequential phases (plan → generate → validate → fix), calling the Anthropic API directly via a small `LlmClient` interface (no agent framework). All I/O (LLM calls, file writes, shell commands) is injected through interfaces so every phase is unit-testable without network access or a real npm/tsc/vitest toolchain, except for the final live end-to-end task.

**Tech Stack:** Node.js + TypeScript (ESM/NodeNext), `@anthropic-ai/sdk`, `zod` + `zod-to-json-schema` for schema-enforced tool-use, `vitest` for the agent's own tests, `dotenv` for config.

## Global Constraints

- LLM provider: Anthropic Claude, called directly via `@anthropic-ai/sdk` — no LangChain/LangGraph/CrewAI.
- Agent code lives entirely under `agent/` at the repo root; it must never modify or delete the existing boilerplate at the repo root (`src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `public/`, `README.md`) — only read from it and copy it into `generated-app/`.
- No backend, database, auth, deployment, or CI/CD work of any kind.
- Final generated app must work with `cd generated-app && npm install && npm run dev`.
- Fix loop is capped at 3 cycles (configurable, default 3); on exhaustion the agent exits non-zero and writes `generated-app/report.json` describing what still fails — never a silent failure.
- Every phase (`plan`, `generate`, `validate`, `fix`) takes its LLM client and shell runner as constructor/function arguments (dependency injection) so it can be unit-tested with fakes — no phase reaches into `process.env` or spawns processes on its own.
- TypeScript strict mode (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`) for the agent's own code, mirroring the boilerplate's rigor.
- Git commits: Conventional Commits format (`type: subject`), written in English, no co-author trailer.

---

### Task 1: Scaffold the agent package

**Files:**
- Create: `agent/package.json`
- Create: `agent/tsconfig.json`
- Create: `agent/.gitignore`
- Create: `agent/.env.example`
- Create: `agent/src/index.ts` (placeholder, replaced in Task 11)

**Interfaces:**
- Produces: a working `npm install` / `npm run typecheck` / `npm test` toolchain inside `agent/` that every later task builds on.

- [ ] **Step 1: Create `agent/package.json`**

```json
{
  "name": "car-inventory-agent",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "dotenv": "^16.4.5",
    "zod": "^3.24.1",
    "zod-to-json-schema": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "~5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `agent/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agent/.gitignore`**

```
node_modules
dist
.env
```

- [ ] **Step 4: Create `agent/.env.example`**

```
# Anthropic API key used by the agent to plan, generate, and fix code.
ANTHROPIC_API_KEY=

# Optional: override the default model (see agent/src/config.ts for the default).
ANTHROPIC_MODEL=
```

- [ ] **Step 5: Create placeholder `agent/src/index.ts`**

```ts
export {};
```

- [ ] **Step 6: Install dependencies**

Run: `cd agent && npm install`
Expected: installs without errors, creates `agent/package-lock.json`.

- [ ] **Step 7: Verify typecheck passes**

Run: `cd agent && npm run typecheck`
Expected: exits 0, no errors (nothing to check yet beyond the placeholder file).

- [ ] **Step 8: Commit**

```bash
git add agent/package.json agent/package-lock.json agent/tsconfig.json agent/.gitignore agent/.env.example agent/src/index.ts
git commit -m "chore: scaffold agent package"
```

---

### Task 2: Domain types and schemas

**Files:**
- Create: `agent/src/types.ts`
- Test: `agent/src/__tests__/types.test.ts`

**Interfaces:**
- Produces: `Task`, `TaskKind`, `TaskSchema`, `TaskGraphSchema`, `UsageStats`, `ValidationError`, `ValidationResult`, `FixResult`, `RunReport` — used by every later task.

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/types.test.ts
import { describe, it, expect } from "vitest";
import { TaskGraphSchema } from "../types.js";

describe("TaskGraphSchema", () => {
  it("accepts a valid task graph", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [
        { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "Fetch cars.", dependsOn: [] },
        { id: "App", file: "src/App.tsx", kind: "component", description: "Renders the app.", dependsOn: ["useCars"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a task missing required fields", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [{ id: "useCars", file: "src/hooks/useCars.ts", dependsOn: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown task kind", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [{ id: "x", file: "src/x.ts", kind: "service", description: "d", dependsOn: [] }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/types.test.ts`
Expected: FAIL — `../types.js` has no exported member `TaskGraphSchema` (file doesn't exist yet).

- [ ] **Step 3: Write `agent/src/types.ts`**

```ts
import { z } from "zod";

export const TaskKindSchema = z.enum(["hook", "component", "test"]);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  kind: TaskKindSchema,
  description: z.string().min(1),
  dependsOn: z.array(z.string()),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskGraphSchema = z.object({
  tasks: z.array(TaskSchema).min(1),
});
export type TaskGraph = z.infer<typeof TaskGraphSchema>;

export interface UsageStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ValidationError {
  file: string;
  message: string;
}

export interface ValidationResult {
  typecheckPassed: boolean;
  testsPassed: boolean;
  errors: ValidationError[];
}

export interface FixResult {
  success: boolean;
  cyclesUsed: number;
  remainingErrors: ValidationError[];
}

export interface RunReport {
  success: boolean;
  tasksGenerated: number;
  fix: FixResult;
  usage: UsageStats;
  estimatedCostUsd: number;
  durationMs: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/types.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add agent/src/types.ts agent/src/__tests__/types.test.ts
git commit -m "feat: add agent domain types and task graph schema"
```

---

### Task 3: LLM client with structured tool-use and cost tracking

**Files:**
- Create: `agent/src/llm/client.ts`
- Create: `agent/src/llm/cost.ts`
- Test: `agent/src/__tests__/llm-client.test.ts`
- Test: `agent/src/__tests__/cost.test.ts`

**Interfaces:**
- Consumes: `UsageStats` from Task 2 (`../types.js`).
- Produces: `LlmClient` interface with `callStructured<T>(params): Promise<T>` and `getUsage(): UsageStats`; `AnthropicLlmClient` class implementing it; `createAnthropicLlmClient(apiKey, model): AnthropicLlmClient`; `estimateCostUsd(usage): number`. Every later phase (`plan`, `generate`, `fix`) depends only on the `LlmClient` interface, never on `AnthropicLlmClient` directly.

- [ ] **Step 1: Write the failing test for the LLM client**

```ts
// agent/src/__tests__/llm-client.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/llm-client.test.ts`
Expected: FAIL — `../llm/client.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/llm/client.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { UsageStats } from "../types.js";

export interface CallStructuredParams {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmClient {
  callStructured<T>(params: CallStructuredParams): Promise<T>;
  getUsage(): UsageStats;
}

interface MinimalMessagesApi {
  create(params: Record<string, unknown>): Promise<{
    content: Array<{ type: string; [key: string]: unknown }>;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

export class AnthropicLlmClient implements LlmClient {
  private usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 };

  constructor(
    private readonly client: MinimalMessagesApi,
    private readonly model: string,
  ) {}

  async callStructured<T>(params: CallStructuredParams): Promise<T> {
    const response = await this.client.create({
      model: this.model,
      max_tokens: 8192,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      tools: [
        {
          name: params.toolName,
          description: params.toolDescription,
          input_schema: params.inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: params.toolName },
    });

    this.usage.calls += 1;
    this.usage.inputTokens += response.usage.input_tokens;
    this.usage.outputTokens += response.usage.output_tokens;

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error(
        `Expected a tool_use block from tool "${params.toolName}", got: ${JSON.stringify(response.content)}`,
      );
    }
    return toolUse.input as T;
  }

  getUsage(): UsageStats {
    return { ...this.usage };
  }
}

export function createAnthropicLlmClient(apiKey: string, model: string): AnthropicLlmClient {
  const raw = new Anthropic({ apiKey });
  return new AnthropicLlmClient(raw.messages as unknown as MinimalMessagesApi, model);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/llm-client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for cost estimation**

```ts
// agent/src/__tests__/cost.test.ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/cost.test.ts`
Expected: FAIL — `../llm/cost.js` does not exist yet.

- [ ] **Step 7: Write `agent/src/llm/cost.ts`**

```ts
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
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `cd agent && npx vitest run src/__tests__/llm-client.test.ts src/__tests__/cost.test.ts`
Expected: PASS (5 tests total)

- [ ] **Step 9: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 10: Commit**

```bash
git add agent/src/llm agent/src/__tests__/llm-client.test.ts agent/src/__tests__/cost.test.ts
git commit -m "feat: add Anthropic LLM client with structured tool-use and cost estimation"
```

---

### Task 4: Filesystem tools (generated-file store + boilerplate copy)

**Files:**
- Create: `agent/src/tools/fs.ts`
- Test: `agent/src/__tests__/fs.test.ts`

**Interfaces:**
- Produces: `GeneratedFileStore` interface (`write`, `read`, `has`), `createFileStore(rootDir): GeneratedFileStore`, and `copyBoilerplate(srcDir, destDir): Promise<void>`. Used by `generate.ts`, `fix.ts`, and `index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/fs.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFileStore, copyBoilerplate } from "../tools/fs.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-fs-test-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("createFileStore", () => {
  it("writes and reads a nested file, creating directories as needed", async () => {
    const store = createFileStore(tmpRoot);
    await store.write("src/hooks/useCars.ts", "export const x = 1;");
    expect(await store.read("src/hooks/useCars.ts")).toBe("export const x = 1;");
  });

  it("reports whether a file exists", async () => {
    const store = createFileStore(tmpRoot);
    expect(await store.has("src/App.tsx")).toBe(false);
    await store.write("src/App.tsx", "export {};");
    expect(await store.has("src/App.tsx")).toBe(true);
  });
});

describe("copyBoilerplate", () => {
  async function writeFixture(root: string) {
    await fs.mkdir(path.join(root, "src", "components"), { recursive: true });
    await fs.mkdir(path.join(root, "src", "__tests__"), { recursive: true });
    await fs.mkdir(path.join(root, "node_modules", "some-dep"), { recursive: true });
    await fs.mkdir(path.join(root, "agent"), { recursive: true });
    await fs.writeFile(path.join(root, "package.json"), "{}");
    await fs.writeFile(path.join(root, "take-home.pdf"), "pdf");
    await fs.writeFile(path.join(root, "src", "App.tsx"), "export {};");
    await fs.writeFile(path.join(root, "src", "components", "Example.tsx"), "export {};");
    await fs.writeFile(path.join(root, "src", "__tests__", "Example.test.tsx"), "export {};");
    await fs.writeFile(path.join(root, "node_modules", "some-dep", "index.js"), "module.exports = {};");
    await fs.writeFile(path.join(root, "agent", "index.ts"), "export {};");
  }

  it("copies real project files but excludes node_modules, agent/, and take-home.pdf", async () => {
    const src = path.join(tmpRoot, "src-project");
    const dest = path.join(tmpRoot, "dest-project");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "package.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "App.tsx"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "agent"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "take-home.pdf"))).rejects.toThrow();
  });

  it("drops the placeholder Example files after copying", async () => {
    const src = path.join(tmpRoot, "src-project-2");
    const dest = path.join(tmpRoot, "dest-project-2");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "src", "components", "Example.tsx"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "src", "__tests__", "Example.test.tsx"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: FAIL — `../tools/fs.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/tools/fs.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";

export interface GeneratedFileStore {
  write(relativePath: string, content: string): Promise<void>;
  read(relativePath: string): Promise<string>;
  has(relativePath: string): Promise<boolean>;
}

export function createFileStore(rootDir: string): GeneratedFileStore {
  return {
    async write(relativePath, content) {
      const target = path.join(rootDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");
    },
    async read(relativePath) {
      return fs.readFile(path.join(rootDir, relativePath), "utf-8");
    },
    async has(relativePath) {
      try {
        await fs.access(path.join(rootDir, relativePath));
        return true;
      } catch {
        return false;
      }
    },
  };
}

const EXCLUDED_TOP_LEVEL = new Set(["node_modules", ".git", "agent", "docs", "generated-app", "take-home.pdf"]);

const PLACEHOLDER_FILES = ["src/components/Example.tsx", "src/__tests__/Example.test.tsx"];

export async function copyBoilerplate(srcDir: string, destDir: string): Promise<void> {
  await fs.cp(srcDir, destDir, {
    recursive: true,
    filter: (source) => {
      const rel = path.relative(srcDir, source);
      if (rel === "") return true;
      const topLevel = rel.split(path.sep)[0];
      return !EXCLUDED_TOP_LEVEL.has(topLevel as string);
    },
  });

  for (const relPath of PLACEHOLDER_FILES) {
    await fs.rm(path.join(destDir, relPath), { force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/fs.ts agent/src/__tests__/fs.test.ts
git commit -m "feat: add generated-file store and boilerplate copy tool"
```

---

### Task 5: Shell command tool

**Files:**
- Create: `agent/src/tools/shell.ts`
- Test: `agent/src/__tests__/shell.test.ts`

**Interfaces:**
- Produces: `ShellResult` interface, `ShellRunner` type (`(cmd, args, cwd, timeoutMs?) => Promise<ShellResult>`), and `runCommand: ShellRunner` (real implementation via `child_process.spawn`). Used by `validate.ts`, `fix.ts`, `index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/shell.test.ts
import { describe, it, expect } from "vitest";
import { runCommand } from "../tools/shell.js";

describe("runCommand", () => {
  it("captures stdout and exit code 0 on success", async () => {
    const result = await runCommand("node", ["-e", "console.log('hello')"], process.cwd());
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  it("captures a non-zero exit code", async () => {
    const result = await runCommand("node", ["-e", "process.exit(2)"], process.cwd());
    expect(result.code).toBe(2);
  });

  it("kills the process and returns code 124 on timeout", async () => {
    const result = await runCommand("node", ["-e", "setTimeout(() => {}, 5000)"], process.cwd(), 200);
    expect(result.code).toBe(124);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/shell.test.ts`
Expected: FAIL — `../tools/shell.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/tools/shell.ts`**

```ts
import { spawn } from "node:child_process";

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type ShellRunner = (cmd: string, args: string[], cwd: string, timeoutMs?: number) => Promise<ShellResult>;

export const runCommand: ShellRunner = (cmd, args, cwd, timeoutMs = 120_000) => {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({ code: 124, stdout, stderr: stderr + "\n[timed out]" });
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: stderr + "\n" + err.message });
    });
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/shell.test.ts`
Expected: PASS (3 tests, completes in well under a second beyond the ~200ms timeout test)

- [ ] **Step 5: Commit**

```bash
git add agent/src/tools/shell.ts agent/src/__tests__/shell.test.ts
git commit -m "feat: add shell command tool with timeout handling"
```

---

### Task 6: Plan phase (spec → ordered task graph)

**Files:**
- Create: `agent/src/prompts/boilerplateContext.ts`
- Create: `agent/src/prompts/plan.prompt.ts`
- Create: `agent/src/phases/plan.ts`
- Test: `agent/src/__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `LlmClient` from Task 3 (`../llm/client.js`); `Task`, `TaskGraphSchema` from Task 2 (`../types.js`).
- Produces: `planFromSpec(spec: string, llm: LlmClient): Promise<Task[]>` and `topologicalSort(tasks: Task[]): Task[]`, both used by `index.ts` (Task 11); `FIXED_BOILERPLATE_CONTEXT` string reused by Task 7 and Task 9's prompts.

- [ ] **Step 1: Write `agent/src/prompts/boilerplateContext.ts`**

```ts
export const FIXED_BOILERPLATE_CONTEXT = `
The target project already provides these fixed pieces — do not redefine them, only import and use them:

- \`Car\` type (import from "@/types"):
  \`\`\`ts
  export interface Car {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    mobile: string;
    tablet: string;
    desktop: string;
  }
  \`\`\`
- GraphQL operations (import from "@/graphql/queries"): \`GET_CARS\`, \`GET_CAR\`, \`ADD_CAR\`.
  - \`GET_CARS\` takes no arguments and returns \`{ cars: Car[] }\`.
  - \`GET_CAR\` takes \`$id: ID!\` and returns \`{ car: Car | null }\`.
  - \`ADD_CAR\` takes \`$make: String!, $model: String!, $year: Int!, $color: String!\` and returns the newly created \`Car\` (the server assigns id and image URLs).
- Apollo Client is already configured at "@/graphql/client"; "@/main.tsx" already wraps the app in \`ApolloProvider\`, MUI's \`ThemeProvider\`, and MSW mocking. Generated code must not touch main.tsx.
- The path alias \`@/*\` maps to \`src/*\` (already configured in tsconfig and vite).
`.trim();
```

- [ ] **Step 2: Write the failing test for `plan.ts`**

```ts
// agent/src/__tests__/plan.test.ts
import { describe, it, expect } from "vitest";
import { planFromSpec, topologicalSort } from "../phases/plan.js";
import type { LlmClient, CallStructuredParams } from "../llm/client.js";
import type { Task } from "../types.js";

class FakeLlmClient implements LlmClient {
  constructor(private readonly response: unknown) {}
  async callStructured<T>(_params: CallStructuredParams): Promise<T> {
    return this.response as T;
  }
  getUsage() {
    return { calls: 1, inputTokens: 10, outputTokens: 10 };
  }
}

describe("planFromSpec", () => {
  it("returns tasks ordered so dependencies come before dependents", async () => {
    const llm = new FakeLlmClient({
      tasks: [
        { id: "App", file: "src/App.tsx", kind: "component", description: "d", dependsOn: ["CarList"] },
        { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "d", dependsOn: [] },
        { id: "CarList", file: "src/components/CarList.tsx", kind: "component", description: "d", dependsOn: ["useCars"] },
      ],
    });

    const tasks = await planFromSpec("Build a car list.", llm);
    const order = tasks.map((t) => t.id);

    expect(order.indexOf("useCars")).toBeLessThan(order.indexOf("CarList"));
    expect(order.indexOf("CarList")).toBeLessThan(order.indexOf("App"));
  });
});

describe("topologicalSort", () => {
  it("throws on circular dependencies", () => {
    const tasks: Task[] = [
      { id: "a", file: "a.ts", kind: "hook", description: "d", dependsOn: ["b"] },
      { id: "b", file: "b.ts", kind: "hook", description: "d", dependsOn: ["a"] },
    ];
    expect(() => topologicalSort(tasks)).toThrow(/Circular/);
  });

  it("throws when a task depends on an unknown task id", () => {
    const tasks: Task[] = [{ id: "a", file: "a.ts", kind: "hook", description: "d", dependsOn: ["missing"] }];
    expect(() => topologicalSort(tasks)).toThrow(/unknown task/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/plan.test.ts`
Expected: FAIL — `../phases/plan.js` does not exist yet.

- [ ] **Step 4: Write `agent/src/prompts/plan.prompt.ts`**

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { TaskGraphSchema } from "../types.js";
import { FIXED_BOILERPLATE_CONTEXT } from "./boilerplateContext.js";

export const PLAN_TOOL_NAME = "emit_task_graph";
export const PLAN_TOOL_DESCRIPTION =
  "Emit the ordered list of file-level implementation tasks needed to build the app described in the specification.";
export const PLAN_INPUT_JSON_SCHEMA = zodToJsonSchema(TaskGraphSchema, { name: "TaskGraph" }).definitions
  ?.TaskGraph as Record<string, unknown>;

const FEW_SHOT_EXAMPLE = `
Example specification: "Build a simple product catalog: list products, let users search by name."

Example task graph:
\`\`\`json
{
  "tasks": [
    { "id": "useProducts", "file": "src/hooks/useProducts.ts", "kind": "hook", "description": "Custom hook wrapping the GetProducts query, returning { products, loading, error }.", "dependsOn": [] },
    { "id": "SearchBar", "file": "src/components/SearchBar.tsx", "kind": "component", "description": "Controlled text input that calls onChange(value) as the user types.", "dependsOn": [] },
    { "id": "ProductList", "file": "src/components/ProductList.tsx", "kind": "component", "description": "Uses useProducts and SearchBar to render a filtered list of products.", "dependsOn": ["useProducts", "SearchBar"] },
    { "id": "App", "file": "src/App.tsx", "kind": "component", "description": "Renders ProductList inside the page shell.", "dependsOn": ["ProductList"] },
    { "id": "ProductList.test", "file": "src/__tests__/ProductList.test.tsx", "kind": "test", "description": "Renders ProductList with MockedProvider and asserts search filters the visible items.", "dependsOn": ["ProductList"] }
  ]
}
\`\`\`
`.trim();

export function buildPlanPrompt(spec: string): { system: string; user: string } {
  const system = `You are a senior frontend engineer planning the implementation of a React + TypeScript app.
Break the specification into a small, ordered set of file-level tasks. Each task produces exactly one file.
Prefer small, focused files: one hook, one component, or one test per task. A component that composes others
should depend on them via "dependsOn". Every "component" task that renders meaningful behavior should have a
matching "test" task depending on it.

${FIXED_BOILERPLATE_CONTEXT}

${FEW_SHOT_EXAMPLE}

Respond only by calling the ${PLAN_TOOL_NAME} tool.`;

  const user = `Specification:\n${spec}`;

  return { system, user };
}
```

- [ ] **Step 5: Write `agent/src/phases/plan.ts`**

```ts
import { TaskGraphSchema, type Task } from "../types.js";
import { buildPlanPrompt, PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, PLAN_INPUT_JSON_SCHEMA } from "../prompts/plan.prompt.js";
import type { LlmClient } from "../llm/client.js";

export async function planFromSpec(spec: string, llm: LlmClient): Promise<Task[]> {
  const { system, user } = buildPlanPrompt(spec);
  const raw = await llm.callStructured<unknown>({
    system,
    user,
    toolName: PLAN_TOOL_NAME,
    toolDescription: PLAN_TOOL_DESCRIPTION,
    inputSchema: PLAN_INPUT_JSON_SCHEMA,
  });
  const graph = TaskGraphSchema.parse(raw);
  return topologicalSort(graph.tasks);
}

export function topologicalSort(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Task[] = [];

  function visit(task: Task, stack: string[]): void {
    if (visited.has(task.id)) return;
    if (stack.includes(task.id)) {
      throw new Error(`Circular dependency detected: ${[...stack, task.id].join(" -> ")}`);
    }
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Task "${task.id}" depends on unknown task "${depId}"`);
      }
      visit(dep, [...stack, task.id]);
    }
    visited.add(task.id);
    result.push(task);
  }

  for (const task of tasks) visit(task, []);
  return result;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/plan.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 8: Commit**

```bash
git add agent/src/prompts/boilerplateContext.ts agent/src/prompts/plan.prompt.ts agent/src/phases/plan.ts agent/src/__tests__/plan.test.ts
git commit -m "feat: add plan phase with dependency-ordered task graph"
```

---

### Task 7: Generate phase (task → file content)

**Files:**
- Create: `agent/src/prompts/generate.prompt.ts`
- Create: `agent/src/phases/generate.ts`
- Test: `agent/src/__tests__/generate.test.ts`

**Interfaces:**
- Consumes: `Task` from Task 2; `LlmClient` from Task 3; `GeneratedFileStore` from Task 4; `FIXED_BOILERPLATE_CONTEXT` from Task 6.
- Produces: `generateFile(task, allTasks, fileStore, boilerplateReferences, llm): Promise<{task: Task; content: string}>` and `generateAll(tasks, fileStore, boilerplateReferences, llm): Promise<GenerateFileResult[]>`, used by `index.ts` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/generate.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateAll } from "../phases/generate.js";
import { createFileStore } from "../tools/fs.js";
import type { LlmClient, CallStructuredParams } from "../llm/client.js";
import type { Task } from "../types.js";

class RecordingFakeLlmClient implements LlmClient {
  public seenUserPrompts: string[] = [];
  constructor(private readonly contents: string[]) {}

  async callStructured<T>(params: CallStructuredParams): Promise<T> {
    this.seenUserPrompts.push(params.user);
    const content = this.contents[this.seenUserPrompts.length - 1];
    return { content } as T;
  }

  getUsage() {
    return { calls: this.seenUserPrompts.length, inputTokens: 0, outputTokens: 0 };
  }
}

describe("generateAll", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-generate-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("writes each task's file and includes dependency content in later prompts", async () => {
    const tasks: Task[] = [
      { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "Fetch cars.", dependsOn: [] },
      {
        id: "CarList",
        file: "src/components/CarList.tsx",
        kind: "component",
        description: "List cars.",
        dependsOn: ["useCars"],
      },
    ];
    const llm = new RecordingFakeLlmClient(["export function useCars() {}", "export default function CarList() {}"]);
    const fileStore = createFileStore(tmpRoot);

    const results = await generateAll(
      tasks,
      fileStore,
      { hook: "reference hook", component: "reference component", test: "reference test" },
      llm,
    );

    expect(results).toHaveLength(2);
    expect(await fileStore.read("src/hooks/useCars.ts")).toBe("export function useCars() {}");
    expect(await fileStore.read("src/components/CarList.tsx")).toBe("export default function CarList() {}");

    const carListPrompt = llm.seenUserPrompts[1];
    expect(carListPrompt).toContain("export function useCars() {}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/generate.test.ts`
Expected: FAIL — `../phases/generate.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/prompts/generate.prompt.ts`**

```ts
import type { Task } from "../types.js";
import { FIXED_BOILERPLATE_CONTEXT } from "./boilerplateContext.js";

export const GENERATE_TOOL_NAME = "emit_file";
export const GENERATE_TOOL_DESCRIPTION = "Emit the full contents of the file for this task.";
export const GENERATE_INPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "string", description: "Full source code of the file, ready to write to disk." },
  },
  required: ["content"],
  additionalProperties: false,
} as const;

export interface DependencyFile {
  path: string;
  content: string;
}

export interface GenerateContext {
  task: Task;
  dependencyFiles: DependencyFile[];
  boilerplateReference: string;
}

const KIND_GUIDANCE: Record<Task["kind"], string> = {
  hook: 'Export a single custom hook. Use Apollo\'s useQuery/useMutation from "@apollo/client". Do not use JSX in this file.',
  component:
    "Export a single default React function component. Use MUI components from \"@mui/material\" for UI. Keep it focused on the task description — do not reimplement logic that belongs to a dependency.",
  test: 'Use Vitest ("describe"/"it"/"expect" globals are enabled) and Testing Library. If the unit under test uses Apollo hooks, wrap it in <MockedProvider mocks={...}> exactly like the reference test below, including `__typename: "Car" as const` on mocked data.',
};

export function buildGeneratePrompt(ctx: GenerateContext): { system: string; user: string } {
  const depsSection = ctx.dependencyFiles.length
    ? ctx.dependencyFiles.map((f) => `File: ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``).join("\n\n")
    : "(no dependencies)";

  const system = `You are generating one file of a React 19 + TypeScript app that uses Apollo Client and MUI.

${FIXED_BOILERPLATE_CONTEXT}

Rules:
- Output ONLY the file described below — no other files, no explanations.
- Use the "@/..." path alias for imports from within src/ (e.g. "@/types", "@/graphql/queries").
- Only use the Car type and GraphQL operations exactly as given — do not invent fields or operations.
- The TypeScript compiler runs with strict mode, noUnusedLocals, and noUnusedParameters — do not leave unused imports or variables.
- ${KIND_GUIDANCE[ctx.task.kind]}

Reference example (for style/API usage only — do not copy its content verbatim):
\`\`\`tsx
${ctx.boilerplateReference}
\`\`\`

Files this task depends on (already generated, exact current content):
${depsSection}

Respond only by calling the ${GENERATE_TOOL_NAME} tool.`;

  const user = `Task: ${ctx.task.id}
File to produce: ${ctx.task.file}
Kind: ${ctx.task.kind}
Description: ${ctx.task.description}`;

  return { system, user };
}
```

- [ ] **Step 4: Write `agent/src/phases/generate.ts`**

```ts
import type { Task } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import type { GeneratedFileStore } from "../tools/fs.js";
import {
  buildGeneratePrompt,
  GENERATE_TOOL_NAME,
  GENERATE_TOOL_DESCRIPTION,
  GENERATE_INPUT_JSON_SCHEMA,
} from "../prompts/generate.prompt.js";

export interface GenerateFileResult {
  task: Task;
  content: string;
}

export async function generateFile(
  task: Task,
  allTasks: Task[],
  fileStore: GeneratedFileStore,
  boilerplateReferences: Record<Task["kind"], string>,
  llm: LlmClient,
): Promise<GenerateFileResult> {
  const dependencyFiles = await Promise.all(
    task.dependsOn.map(async (depId) => {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask) throw new Error(`Unknown dependency "${depId}" for task "${task.id}"`);
      return { path: depTask.file, content: await fileStore.read(depTask.file) };
    }),
  );

  const { system, user } = buildGeneratePrompt({
    task,
    dependencyFiles,
    boilerplateReference: boilerplateReferences[task.kind],
  });

  const { content } = await llm.callStructured<{ content: string }>({
    system,
    user,
    toolName: GENERATE_TOOL_NAME,
    toolDescription: GENERATE_TOOL_DESCRIPTION,
    inputSchema: GENERATE_INPUT_JSON_SCHEMA,
  });

  await fileStore.write(task.file, content);
  return { task, content };
}

export async function generateAll(
  tasks: Task[],
  fileStore: GeneratedFileStore,
  boilerplateReferences: Record<Task["kind"], string>,
  llm: LlmClient,
): Promise<GenerateFileResult[]> {
  const results: GenerateFileResult[] = [];
  for (const task of tasks) {
    results.push(await generateFile(task, tasks, fileStore, boilerplateReferences, llm));
  }
  return results;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/generate.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add agent/src/prompts/generate.prompt.ts agent/src/phases/generate.ts agent/src/__tests__/generate.test.ts
git commit -m "feat: add generate phase with dependency-scoped context"
```

---

### Task 8: Validate phase (typecheck + test parsing)

**Files:**
- Create: `agent/src/phases/validate.ts`
- Test: `agent/src/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `ShellRunner` from Task 5 (`../tools/shell.js`); `ValidationError`, `ValidationResult` from Task 2.
- Produces: `validateProject(projectDir, runCommand): Promise<ValidationResult>`, `parseTypecheckErrors(output): ValidationError[]`, `parseTestErrors(stdout, projectDir): ValidationError[]`, used by `fix.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/validate.test.ts
import { describe, it, expect } from "vitest";
import { parseTypecheckErrors, parseTestErrors, validateProject } from "../phases/validate.js";
import type { ShellRunner } from "../tools/shell.js";

describe("parseTypecheckErrors", () => {
  it("extracts file and message from tsc --pretty false output", () => {
    const output = [
      "src/components/CarCard.tsx(12,7): error TS2339: Property 'colour' does not exist on type 'Car'.",
      "src/App.tsx(3,1): error TS2307: Cannot find module '@/foo'.",
    ].join("\n");

    const errors = parseTypecheckErrors(output);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({ file: "src/components/CarCard.tsx", message: "TS2339 at line 12: Property 'colour' does not exist on type 'Car'." });
  });

  it("returns an empty array for clean output", () => {
    expect(parseTypecheckErrors("")).toEqual([]);
  });
});

describe("parseTestErrors", () => {
  it("extracts failed test files from vitest json reporter output", () => {
    const projectDir = "/tmp/project";
    const json = JSON.stringify({
      testResults: [
        {
          name: "/tmp/project/src/__tests__/CarCard.test.tsx",
          status: "failed",
          assertionResults: [{ status: "failed", failureMessages: ["Expected 'Toyota' but got 'Honda'"] }],
        },
        {
          name: "/tmp/project/src/__tests__/SearchBar.test.tsx",
          status: "passed",
          assertionResults: [{ status: "passed" }],
        },
      ],
    });

    const errors = parseTestErrors(json, projectDir);

    expect(errors).toEqual([
      { file: "src/__tests__/CarCard.test.tsx", message: "Expected 'Toyota' but got 'Honda'" },
    ]);
  });

  it("returns an empty array when the output is not valid JSON", () => {
    expect(parseTestErrors("not json", "/tmp/project")).toEqual([]);
  });
});

describe("validateProject", () => {
  it("combines typecheck and test results", async () => {
    const fakeRunCommand: ShellRunner = async (_cmd, args) => {
      if (args.includes("typecheck")) {
        return { code: 1, stdout: "src/App.tsx(1,1): error TS2304: Cannot find name 'x'.", stderr: "" };
      }
      return { code: 0, stdout: JSON.stringify({ testResults: [] }), stderr: "" };
    };

    const result = await validateProject("/tmp/project", fakeRunCommand);

    expect(result.typecheckPassed).toBe(false);
    expect(result.testsPassed).toBe(true);
    expect(result.errors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/validate.test.ts`
Expected: FAIL — `../phases/validate.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/phases/validate.ts`**

```ts
import path from "node:path";
import type { ShellRunner } from "../tools/shell.js";
import type { ValidationError, ValidationResult } from "../types.js";

const TSC_ERROR_REGEX = /^(\S+\.tsx?)\((\d+),\d+\): error (TS\d+): (.+)$/gm;

export function parseTypecheckErrors(output: string): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const match of output.matchAll(TSC_ERROR_REGEX)) {
    const [, file, line, code, message] = match;
    errors.push({ file: file as string, message: `${code} at line ${line}: ${message}` });
  }
  return errors;
}

interface VitestJsonAssertionResult {
  status: string;
  failureMessages?: string[];
}

interface VitestJsonTestResult {
  name: string;
  status: string;
  message?: string;
  assertionResults?: VitestJsonAssertionResult[];
}

interface VitestJsonReport {
  testResults: VitestJsonTestResult[];
}

export function parseTestErrors(rawStdout: string, projectDir: string): ValidationError[] {
  let report: VitestJsonReport;
  try {
    report = JSON.parse(rawStdout);
  } catch {
    return [];
  }

  const errors: ValidationError[] = [];
  for (const fileResult of report.testResults ?? []) {
    if (fileResult.status !== "failed") continue;
    const file = path.relative(projectDir, fileResult.name);
    const failureMessages =
      fileResult.assertionResults?.filter((a) => a.status === "failed").flatMap((a) => a.failureMessages ?? []) ?? [];
    const message = failureMessages.length ? failureMessages.join("\n") : (fileResult.message ?? "Test failed");
    errors.push({ file, message });
  }
  return errors;
}

export async function validateProject(projectDir: string, runCommand: ShellRunner): Promise<ValidationResult> {
  const typecheck = await runCommand("npm", ["run", "typecheck", "--", "--pretty", "false"], projectDir, 120_000);
  const test = await runCommand("npm", ["run", "test", "--", "--reporter=json"], projectDir, 180_000);

  const errors = [...parseTypecheckErrors(typecheck.stdout + typecheck.stderr), ...parseTestErrors(test.stdout, projectDir)];

  return {
    typecheckPassed: typecheck.code === 0,
    testsPassed: test.code === 0,
    errors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/validate.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add agent/src/phases/validate.ts agent/src/__tests__/validate.test.ts
git commit -m "feat: add validate phase parsing tsc and vitest json output"
```

---

### Task 9: Fix phase (bounded retry loop)

**Files:**
- Create: `agent/src/prompts/fix.prompt.ts`
- Create: `agent/src/phases/fix.ts`
- Test: `agent/src/__tests__/fix.test.ts`

**Interfaces:**
- Consumes: `validateProject` from Task 8; `LlmClient` from Task 3; `GeneratedFileStore` from Task 4; `ShellRunner` from Task 5; `FixResult`, `ValidationError` from Task 2.
- Produces: `fixLoop(projectDir, fileStore, llm, runCommand, maxCycles): Promise<FixResult>` and `groupErrorsByFile(errors): Map<string, ValidationError[]>`, used by `index.ts` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/fix.test.ts
import { describe, it, expect } from "vitest";
import { fixLoop, groupErrorsByFile } from "../phases/fix.js";
import { createFileStore } from "../tools/fs.js";
import type { LlmClient, CallStructuredParams } from "../llm/client.js";
import type { ShellRunner } from "../tools/shell.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("groupErrorsByFile", () => {
  it("groups errors by their file", () => {
    const grouped = groupErrorsByFile([
      { file: "a.ts", message: "e1" },
      { file: "b.ts", message: "e2" },
      { file: "a.ts", message: "e3" },
    ]);
    expect(grouped.get("a.ts")).toHaveLength(2);
    expect(grouped.get("b.ts")).toHaveLength(1);
  });
});

class FixingFakeLlmClient implements LlmClient {
  async callStructured<T>(_params: CallStructuredParams): Promise<T> {
    return { content: "export const fixed = true;" } as T;
  }
  getUsage() {
    return { calls: 0, inputTokens: 0, outputTokens: 0 };
  }
}

describe("fixLoop", () => {
  let tmpRoot: string;

  async function makeProject() {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-fix-test-"));
    const fileStore = createFileStore(tmpRoot);
    await fileStore.write("src/App.tsx", "export const broken = true;");
    return fileStore;
  }

  it("stops as soon as validation passes and reports cycles used", async () => {
    const fileStore = await makeProject();
    let validateCalls = 0;
    const fakeRunCommand: ShellRunner = async (_cmd, args) => {
      const isTypecheck = args.includes("typecheck");
      // First validation call (cycle 1) fails typecheck; second (cycle 2) passes everything.
      validateCalls += 1;
      const cycle = Math.ceil(validateCalls / 2);
      if (isTypecheck) {
        return cycle === 1
          ? { code: 1, stdout: "src/App.tsx(1,1): error TS2304: Cannot find name 'x'.", stderr: "" }
          : { code: 0, stdout: "", stderr: "" };
      }
      return { code: 0, stdout: JSON.stringify({ testResults: [] }), stderr: "" };
    };

    const result = await fixLoop(tmpRoot, fileStore, new FixingFakeLlmClient(), fakeRunCommand, 3);

    expect(result.success).toBe(true);
    expect(result.cyclesUsed).toBe(1);
    expect(await fileStore.read("src/App.tsx")).toBe("export const fixed = true;");
  });

  it("gives up after maxCycles and reports remaining errors", async () => {
    const fileStore = await makeProject();
    const alwaysFailingRunCommand: ShellRunner = async (_cmd, args) => {
      if (args.includes("typecheck")) {
        return { code: 1, stdout: "src/App.tsx(1,1): error TS2304: Cannot find name 'x'.", stderr: "" };
      }
      return { code: 0, stdout: JSON.stringify({ testResults: [] }), stderr: "" };
    };

    const result = await fixLoop(tmpRoot, fileStore, new FixingFakeLlmClient(), alwaysFailingRunCommand, 2);

    expect(result.success).toBe(false);
    expect(result.cyclesUsed).toBe(2);
    expect(result.remainingErrors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/fix.test.ts`
Expected: FAIL — `../phases/fix.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/prompts/fix.prompt.ts`**

```ts
import type { ValidationError } from "../types.js";
import { FIXED_BOILERPLATE_CONTEXT } from "./boilerplateContext.js";

export const FIX_TOOL_NAME = "emit_fixed_file";
export const FIX_TOOL_DESCRIPTION = "Emit the full corrected contents of the file.";
export const FIX_INPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "string", description: "Full corrected source code of the file." },
  },
  required: ["content"],
  additionalProperties: false,
} as const;

export function buildFixPrompt(file: string, currentContent: string, errors: ValidationError[]): { system: string; user: string } {
  const system = `You are fixing a single TypeScript/React file that failed typecheck or tests.

${FIXED_BOILERPLATE_CONTEXT}

Rules:
- Output the FULL corrected file, not a diff or partial snippet.
- Make the minimal change needed to resolve the reported errors without changing the file's intended behavior.
- Do not remove functionality to make errors disappear (e.g. do not delete a failing assertion instead of fixing the code).

Respond only by calling the ${FIX_TOOL_NAME} tool.`;

  const errorsText = errors.map((e) => `- ${e.message}`).join("\n");

  const user = `File: ${file}

Current content:
\`\`\`tsx
${currentContent}
\`\`\`

Errors reported for this file:
${errorsText}`;

  return { system, user };
}
```

- [ ] **Step 4: Write `agent/src/phases/fix.ts`**

```ts
import type { ValidationError, FixResult } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import type { GeneratedFileStore } from "../tools/fs.js";
import type { ShellRunner } from "../tools/shell.js";
import { validateProject } from "./validate.js";
import { buildFixPrompt, FIX_TOOL_NAME, FIX_TOOL_DESCRIPTION, FIX_INPUT_JSON_SCHEMA } from "../prompts/fix.prompt.js";

export function groupErrorsByFile(errors: ValidationError[]): Map<string, ValidationError[]> {
  const map = new Map<string, ValidationError[]>();
  for (const error of errors) {
    const existing = map.get(error.file) ?? [];
    existing.push(error);
    map.set(error.file, existing);
  }
  return map;
}

export async function fixLoop(
  projectDir: string,
  fileStore: GeneratedFileStore,
  llm: LlmClient,
  runCommand: ShellRunner,
  maxCycles: number,
): Promise<FixResult> {
  let lastErrors: ValidationError[] = [];

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const result = await validateProject(projectDir, runCommand);
    if (result.typecheckPassed && result.testsPassed) {
      return { success: true, cyclesUsed: cycle - 1, remainingErrors: [] };
    }
    lastErrors = result.errors;

    const errorsByFile = groupErrorsByFile(result.errors);
    for (const [file, errors] of errorsByFile) {
      const currentContent = await fileStore.read(file);
      const { content } = await llm.callStructured<{ content: string }>({
        ...buildFixPrompt(file, currentContent, errors),
        toolName: FIX_TOOL_NAME,
        toolDescription: FIX_TOOL_DESCRIPTION,
        inputSchema: FIX_INPUT_JSON_SCHEMA,
      });
      await fileStore.write(file, content);
    }
  }

  const finalResult = await validateProject(projectDir, runCommand);
  return {
    success: finalResult.typecheckPassed && finalResult.testsPassed,
    cyclesUsed: maxCycles,
    remainingErrors: finalResult.errors.length ? finalResult.errors : lastErrors,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/fix.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add agent/src/prompts/fix.prompt.ts agent/src/phases/fix.ts agent/src/__tests__/fix.test.ts
git commit -m "feat: add bounded fix loop with per-file error grouping"
```

---

### Task 10: Config loading

**Files:**
- Create: `agent/src/config.ts`
- Test: `agent/src/__tests__/config.test.ts`

**Interfaces:**
- Produces: `AgentConfig` interface, `loadConfig(env?): AgentConfig`, used by `index.ts` (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/config.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/config.test.ts`
Expected: FAIL — `../config.js` does not exist yet.

- [ ] **Step 3: Write `agent/src/config.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/config.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add agent/src/config.ts agent/src/__tests__/config.test.ts
git commit -m "feat: add config loading with env overrides"
```

---

### Task 11: CLI entrypoint wiring the full pipeline

**Files:**
- Modify: `agent/src/index.ts` (replace placeholder from Task 1)
- Create: `agent/spec.example.txt`
- Test: `agent/src/__tests__/index.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 2–10 (`loadConfig`, `createAnthropicLlmClient`, `planFromSpec`, `generateAll`, `fixLoop`, `createFileStore`, `copyBoilerplate`, `runCommand`, `estimateCostUsd`, `RunReport`).
- Produces: `runAgent(options, deps): Promise<RunReport>` and `parseArgs(argv): { specPath: string; outputDir?: string }`, both exported for testing; a CLI bootstrap that runs only when the file is executed directly.

- [ ] **Step 1: Write `agent/spec.example.txt`**

```
Build a Car Inventory Manager, a single-page React app for browsing a dealership's car inventory.

Data: Cars come from a GraphQL API (already mocked in the boilerplate) with a GetCars query returning
a list of cars, each with an id, make, model, year, color, and three image URLs (mobile, tablet,
desktop). There is also a GetCar query for a single car by id, and an AddCar mutation that takes
make/model/year/color and returns the newly created car.

Required features:
- Display the full list of cars fetched from the GetCars query.
- Let the user search/filter the list by model name as they type.
- Let the user sort the list by year or by make.
- Cover the above with automated tests so a regression would be caught.

Nice to have, if time allows:
- Pull the GraphQL fetching logic out of the components into a reusable useCars() hook.
- Show the car's image, picking the mobile/tablet/desktop URL based on the current viewport width
  (mobile up to 640px, tablet from 641 to 1023px, desktop from 1024px up).
- Present each car as a Material UI card showing make, model, year, color, and its image.
- Add a small form to add a new car via the AddCar mutation, and show it in the list once added.

Keep the UI simple and functional — clarity over polish.
```

- [ ] **Step 2: Write the failing test for `index.ts`**

```ts
// agent/src/__tests__/index.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, runAgent } from "../index.js";
import type { LlmClient, CallStructuredParams } from "../llm/client.js";
import type { ShellRunner } from "../tools/shell.js";

describe("parseArgs", () => {
  it("parses --spec and --output", () => {
    expect(parseArgs(["--spec", "spec.txt", "--output", "out"])).toEqual({ specPath: "spec.txt", outputDir: "out" });
  });

  it("allows --output to be omitted", () => {
    expect(parseArgs(["--spec", "spec.txt"])).toEqual({ specPath: "spec.txt", outputDir: undefined });
  });

  it("throws when --spec is missing", () => {
    expect(() => parseArgs(["--output", "out"])).toThrow(/Usage/);
  });
});

class SequencedFakeLlmClient implements LlmClient {
  private index = 0;
  public usage = { calls: 0, inputTokens: 50, outputTokens: 20 };

  constructor(private readonly responses: unknown[]) {}

  async callStructured<T>(_params: CallStructuredParams): Promise<T> {
    const response = this.responses[this.index];
    this.index += 1;
    this.usage.calls += 1;
    return response as T;
  }

  getUsage() {
    return { ...this.usage };
  }
}

describe("runAgent", () => {
  let tmpRoot: string;
  let boilerplateDir: string;
  let outputDir: string;
  let specPath: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-index-test-"));
    boilerplateDir = path.join(tmpRoot, "boilerplate");
    outputDir = path.join(tmpRoot, "generated-app");
    specPath = path.join(tmpRoot, "spec.txt");

    await fs.mkdir(path.join(boilerplateDir, "src", "components"), { recursive: true });
    await fs.mkdir(path.join(boilerplateDir, "src", "__tests__"), { recursive: true });
    await fs.writeFile(path.join(boilerplateDir, "package.json"), "{}");
    await fs.writeFile(path.join(boilerplateDir, "src", "components", "Example.tsx"), "reference component");
    await fs.writeFile(path.join(boilerplateDir, "src", "__tests__", "Example.test.tsx"), "reference test");
    await fs.writeFile(specPath, "Build a car list.");
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("runs plan -> generate -> validate and writes a success report", async () => {
    const llm = new SequencedFakeLlmClient([
      {
        tasks: [
          { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "d", dependsOn: [] },
          { id: "CarList", file: "src/components/CarList.tsx", kind: "component", description: "d", dependsOn: ["useCars"] },
        ],
      },
      { content: "export function useCars() {}" },
      { content: "export default function CarList() {}" },
    ]);

    const fakeRunCommand: ShellRunner = async (_cmd, args) => {
      if (args.includes("install")) return { code: 0, stdout: "", stderr: "" };
      if (args.includes("typecheck")) return { code: 0, stdout: "", stderr: "" };
      return { code: 0, stdout: JSON.stringify({ testResults: [] }), stderr: "" };
    };

    const report = await runAgent(
      { specPath, outputDir, boilerplateDir, maxFixCycles: 3 },
      { llm, runCommand: fakeRunCommand },
    );

    expect(report.success).toBe(true);
    expect(report.tasksGenerated).toBe(2);
    expect(report.fix.cyclesUsed).toBe(0);
    expect(report.estimatedCostUsd).toBeGreaterThan(0);

    expect(await fs.readFile(path.join(outputDir, "src", "hooks", "useCars.ts"), "utf-8")).toBe(
      "export function useCars() {}",
    );
    const reportOnDisk = JSON.parse(await fs.readFile(path.join(outputDir, "report.json"), "utf-8"));
    expect(reportOnDisk.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/index.test.ts`
Expected: FAIL — `parseArgs`/`runAgent` are not exported from `../index.js` yet (it's still the Task 1 placeholder).

- [ ] **Step 4: Write `agent/src/index.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createAnthropicLlmClient } from "./llm/client.js";
import type { LlmClient } from "./llm/client.js";
import { estimateCostUsd } from "./llm/cost.js";
import { planFromSpec } from "./phases/plan.js";
import { generateAll } from "./phases/generate.js";
import { fixLoop } from "./phases/fix.js";
import { createFileStore, copyBoilerplate } from "./tools/fs.js";
import { runCommand } from "./tools/shell.js";
import type { ShellRunner } from "./tools/shell.js";
import type { RunReport, Task } from "./types.js";

export interface RunAgentOptions {
  specPath: string;
  outputDir: string;
  boilerplateDir: string;
  maxFixCycles: number;
}

export interface RunAgentDeps {
  llm: LlmClient;
  runCommand: ShellRunner;
}

const BOILERPLATE_REFERENCE_FILES: Record<Task["kind"], string> = {
  hook: "src/components/Example.tsx",
  component: "src/components/Example.tsx",
  test: "src/__tests__/Example.test.tsx",
};

export async function runAgent(options: RunAgentOptions, deps: RunAgentDeps): Promise<RunReport> {
  const start = Date.now();

  const specText = await fs.readFile(options.specPath, "utf-8");
  await copyBoilerplate(options.boilerplateDir, options.outputDir);

  const tasks = await planFromSpec(specText, deps.llm);

  const fileStore = createFileStore(options.outputDir);
  const referenceContents = new Map<string, string>();
  for (const relPath of new Set(Object.values(BOILERPLATE_REFERENCE_FILES))) {
    referenceContents.set(relPath, await fs.readFile(path.join(options.boilerplateDir, relPath), "utf-8"));
  }
  const boilerplateReferences: Record<Task["kind"], string> = {
    hook: referenceContents.get(BOILERPLATE_REFERENCE_FILES.hook) ?? "",
    component: referenceContents.get(BOILERPLATE_REFERENCE_FILES.component) ?? "",
    test: referenceContents.get(BOILERPLATE_REFERENCE_FILES.test) ?? "",
  };

  await generateAll(tasks, fileStore, boilerplateReferences, deps.llm);

  await deps.runCommand("npm", ["install"], options.outputDir, 300_000);

  const fix = await fixLoop(options.outputDir, fileStore, deps.llm, deps.runCommand, options.maxFixCycles);

  const usage = deps.llm.getUsage();
  const report: RunReport = {
    success: fix.success,
    tasksGenerated: tasks.length,
    fix,
    usage,
    estimatedCostUsd: estimateCostUsd(usage),
    durationMs: Date.now() - start,
  };

  await fs.writeFile(path.join(options.outputDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  return report;
}

export function parseArgs(argv: string[]): { specPath: string; outputDir?: string } {
  const specIndex = argv.indexOf("--spec");
  if (specIndex === -1 || !argv[specIndex + 1]) {
    throw new Error("Usage: npm start -- --spec <path> [--output <path>]");
  }
  const outputIndex = argv.indexOf("--output");
  const outputDir = outputIndex !== -1 ? argv[outputIndex + 1] : undefined;
  return { specPath: argv[specIndex + 1] as string, outputDir };
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const agentSrcDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(agentSrcDir, "../..");

  const { specPath, outputDir } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const llm = createAnthropicLlmClient(config.apiKey, config.model);

  runAgent(
    {
      specPath: path.resolve(specPath),
      outputDir: path.resolve(outputDir ?? path.join(repoRoot, "generated-app")),
      boilerplateDir: repoRoot,
      maxFixCycles: config.maxFixCycles,
    },
    { llm, runCommand },
  )
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.success) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/index.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full agent test suite and typecheck**

Run: `cd agent && npm test && npm run typecheck`
Expected: all test files pass, typecheck exits 0

- [ ] **Step 7: Commit**

```bash
git add agent/src/index.ts agent/spec.example.txt agent/src/__tests__/index.test.ts
git commit -m "feat: wire plan/generate/validate/fix into a CLI entrypoint"
```

---

### Task 12: Live end-to-end run, README, and cost write-up

This task requires a real `ANTHROPIC_API_KEY` and network access — it cannot be executed by a sandboxed subagent without credentials. Run it yourself, or supply the key to whichever agent executes this task.

**Files:**
- Create: `agent/.env` (untracked — copy from `.env.example` and fill in the key; never commit this file)
- Create: `agent/README.md`
- Modify: `agent/README.md` again after the live run to record real numbers

**Interfaces:**
- Consumes: the complete pipeline from Task 11 (`npm start` in `agent/`).
- Produces: `generated-app/` at the repo root (the sample output directory required by the submission), plus a documented `agent/README.md`.

- [ ] **Step 1: Set up credentials**

```bash
cp agent/.env.example agent/.env
```

Edit `agent/.env` and set `ANTHROPIC_API_KEY` to a real key. Confirm `.env` is covered by `agent/.gitignore` (it is, from Task 1) so it is never committed.

- [ ] **Step 2: Run the agent against the sample spec**

Run: `cd agent && npm start -- --spec spec.example.txt --output ../generated-app`
Expected: prints a JSON report to stdout ending with `"success": true`. If it prints `"success": false`, read `generated-app/report.json` for `remainingErrors` and investigate before continuing — do not paper over a failing run in the README.

- [ ] **Step 3: Verify the generated app actually runs**

```bash
cd ../generated-app
npm install
npm run typecheck
npm run test
```

Expected: both commands exit 0 (they should already, since the agent's own fix loop validated this before writing `report.json`, but this step confirms it from a clean `npm install` the same way an evaluator would run it).

- [ ] **Step 4: Record the real usage numbers**

Run: `cat generated-app/report.json` and note the `usage` (`calls`, `inputTokens`, `outputTokens`), `estimatedCostUsd`, `durationMs`, and `fix.cyclesUsed` fields — these are the real numbers for Step 6 below.

- [ ] **Step 5: Write `agent/README.md`**

```markdown
# Car Inventory Agent

A CLI agent that reads a natural-language spec and generates a React + TypeScript "Car
Inventory Manager" into a copy of the boilerplate at the repo root, self-validating and
fixing its own output along the way.

## Setup

\`\`\`bash
cd agent
npm install
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
\`\`\`

## Run

\`\`\`bash
npm start -- --spec spec.example.txt --output ../generated-app
\`\`\`

Then verify the result:

\`\`\`bash
cd ../generated-app
npm install
npm run dev
\`\`\`

## Architecture

\`\`\`
spec.txt -> [plan] -> task graph -> [generate, per file, topological order]
         -> [validate: tsc + vitest] -> [fix, up to 3 cycles] -> generated-app/
\`\`\`

A single orchestrator (\`src/index.ts\`) runs four phases in sequence:

- **plan** (\`src/phases/plan.ts\`) — one LLM call turns the spec into an ordered list of
  file-level tasks (hook / component / test), each declaring which other tasks it depends
  on. The response is forced through Anthropic tool-use with a JSON schema derived from a
  \`zod\` schema, then topologically sorted.
- **generate** (\`src/phases/generate.ts\`) — one LLM call per task, in dependency order.
  Each prompt includes only the content of the files the task actually depends on (not the
  whole project) plus the fixed \`Car\` type / GraphQL operations from the boilerplate — this
  is the context-management strategy: context grows with real dependencies, not project size.
- **validate** (\`src/phases/validate.ts\`) — runs \`npm run typecheck\` and
  \`npm run test -- --reporter=json\` inside the generated app and parses failures back to
  the specific file that caused them.
- **fix** (\`src/phases/fix.ts\`) — for each file with reported errors, one LLM call receives
  the current file content and the raw error message and returns the corrected file. Re-runs
  validation after each cycle, up to \`maxFixCycles\` (default 3). If errors remain after the
  cap, the agent exits non-zero and \`generated-app/report.json\` records exactly which files
  still fail and why — a visible failure, not a silent one.

All LLM calls and shell commands are injected through small interfaces (\`LlmClient\`,
\`ShellRunner\`), so every phase is unit-tested with fakes — no test in \`src/__tests__\`
hits the network or spawns a real process except by explicit design (\`tools/shell.test.ts\`
runs real, harmless \`node -e\` subprocesses to test the shell wrapper itself).

## Which LLM, and why

Anthropic Claude, called directly via \`@anthropic-ai/sdk\` — no agent framework. Tool-use
with a JSON-schema-constrained tool forces every phase's response into a parseable shape,
which removes the need for fragile free-text parsing and is the same mechanism used for the
plan, generate, and fix calls alike.

## What worked well

- Forcing every LLM response through tool-use with a schema meant the agent never had to
  parse free-form text — task graphs and file contents came back structured every time.
- Scoping the generate-phase context to only a task's declared dependencies kept prompts
  small and made it easy to reason about what each generation call could and couldn't see.
- Using vitest's JSON reporter instead of scraping colored terminal output made the
  validate/fix loop's error-to-file attribution reliable.

## What I'd improve with more time

- The fix loop replaces a whole file per cycle; a diff-based fix would use fewer tokens for
  small errors.
- Only one fix attempt is made per file per cycle even if a file has errors from both
  typecheck and tests — batching those into a single richer prompt could resolve both in
  one call instead of two cycles.
- No caching between runs — re-running the same spec re-does the full plan and generate
  phases from scratch.

## Cost per run

<!-- Filled in from generated-app/report.json after the live run in Step 4. -->
```

- [ ] **Step 6: Fill in the real cost numbers**

Replace the `<!-- Filled in ... -->` line in the "Cost per run" section with the actual values read in Step 4, e.g.:

```markdown
## Cost per run

Sample run against \`spec.example.txt\` (from \`generated-app/report.json\`):

| Metric | Value |
|---|---|
| LLM calls | *(usage.calls from report.json)* |
| Input tokens | *(usage.inputTokens)* |
| Output tokens | *(usage.outputTokens)* |
| Estimated cost (USD) | *(estimatedCostUsd)* |
| Fix cycles used | *(fix.cyclesUsed)* |
| Wall time | *(durationMs, converted to seconds)* |

Pricing is approximate — see the comment in \`src/llm/cost.ts\` and verify against
[Anthropic's current pricing](https://www.anthropic.com/pricing) before relying on this for
budgeting.
```

Substitute the real numbers from Step 4 in place of each italic placeholder — do not leave the run's actual output out of the committed README.

- [ ] **Step 7: Commit the README and sample output**

```bash
git add agent/README.md generated-app
git commit -m "docs: add agent README with architecture and real cost numbers"
```

Note: `generated-app/node_modules` must not be committed. If Step 3's `npm install` created one, either add `generated-app/node_modules` (and `generated-app/dist`) to a repo-root `.gitignore` before staging, or run `git status` first and confirm `node_modules` isn't in the diff before `git add generated-app`.

---

### Task 13: OpenAI LLM client

**Files:**
- Create: `agent/src/llm/openai-client.ts`
- Test: `agent/src/__tests__/openai-client.test.ts`

**Interfaces:**
- Consumes: `LlmClient`, `CallStructuredParams` from Task 3 (`../llm/client.js`); `UsageStats` from Task 2 (`../types.js`).
- Produces: `OpenAiLlmClient` (implements `LlmClient`) and `createOpenAiLlmClient(apiKey, model): OpenAiLlmClient`, a second, interchangeable implementation of the same `LlmClient` interface `AnthropicLlmClient` implements. Nothing outside `config.ts`/`index.ts` (Task 14) needs to know which one is in use — every phase (plan/generate/fix) already depends only on the `LlmClient` interface.

Added because the person running this agent wants to use their existing OpenAI API access instead of (or alongside) Anthropic's. This does not replace `AnthropicLlmClient` — both coexist, selected at startup by config (Task 14).

- [ ] **Step 1: Write the failing test**

```ts
// agent/src/__tests__/openai-client.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/openai-client.test.ts`
Expected: FAIL — `../llm/openai-client.js` does not exist yet.

- [ ] **Step 3: Add the `openai` dependency**

Run: `cd agent && npm install openai@^4.77.0`
Expected: adds `openai` to `agent/package.json` dependencies and updates `agent/package-lock.json`.

- [ ] **Step 4: Write `agent/src/llm/openai-client.ts`**

```ts
import OpenAI from "openai";
import type { LlmClient, CallStructuredParams } from "./client.js";
import type { UsageStats } from "../types.js";

interface MinimalChatApi {
  create(params: Record<string, unknown>): Promise<{
    choices: Array<{
      message: {
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  }>;
}

export class OpenAiLlmClient implements LlmClient {
  private usage: UsageStats = { calls: 0, inputTokens: 0, outputTokens: 0 };

  constructor(
    private readonly client: MinimalChatApi,
    private readonly model: string,
  ) {}

  async callStructured<T>(params: CallStructuredParams): Promise<T> {
    const response = await this.client.create({
      model: this.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: params.toolName,
            description: params.toolDescription,
            parameters: params.inputSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: params.toolName } },
    });

    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    this.usage.calls += 1;
    this.usage.inputTokens += usage.prompt_tokens;
    this.usage.outputTokens += usage.completion_tokens;

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error(
        `Expected a tool call from tool "${params.toolName}", got: ${JSON.stringify(response.choices[0]?.message)}`,
      );
    }
    return JSON.parse(toolCall.function.arguments) as T;
  }

  getUsage(): UsageStats {
    return { ...this.usage };
  }
}

export function createOpenAiLlmClient(apiKey: string, model: string): OpenAiLlmClient {
  const raw = new OpenAI({ apiKey });
  return new OpenAiLlmClient(raw.chat.completions as unknown as MinimalChatApi, model);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/openai-client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run typecheck**

Run: `cd agent && npm run typecheck`
Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add agent/package.json agent/package-lock.json agent/src/llm/openai-client.ts agent/src/__tests__/openai-client.test.ts
git commit -m "feat: add OpenAI LLM client as a second LlmClient implementation"
```

---

### Task 14: Multi-provider config and cost wiring

**Files:**
- Modify: `agent/src/config.ts`
- Modify: `agent/src/llm/cost.ts`
- Modify: `agent/src/index.ts`
- Modify: `agent/.env.example`
- Test: `agent/src/__tests__/config.test.ts` (extend)
- Test: `agent/src/__tests__/cost.test.ts` (extend)

**Interfaces:**
- Consumes: `OpenAiLlmClient`/`createOpenAiLlmClient` from Task 13; `AnthropicLlmClient`/`createAnthropicLlmClient` from Task 3.
- Produces: `AgentConfig` gains a `provider: "anthropic" | "openai"` field; `loadConfig` picks the right API key/model/error message per provider; `estimateCostUsd` accepts an optional `model` parameter and picks pricing accordingly; the CLI bootstrap in `index.ts` constructs whichever client `config.provider` selects.

- [ ] **Step 1: Update the config test**

Replace the full contents of `agent/src/__tests__/config.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/config.test.ts`
Expected: FAIL — `loadConfig`'s current return type has no `provider` field, and the openai-branch tests fail since `LLM_PROVIDER` isn't handled yet.

- [ ] **Step 3: Rewrite `agent/src/config.ts`**

```ts
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
```

- [ ] **Step 4: Run the config test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/config.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Update the cost test**

Replace the full contents of `agent/src/__tests__/cost.test.ts` with:

```ts
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
```

- [ ] **Step 6: Run the cost test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/cost.test.ts`
Expected: FAIL — `estimateCostUsd` doesn't accept a second argument yet, and gpt-4o pricing doesn't exist.

- [ ] **Step 7: Rewrite `agent/src/llm/cost.ts`**

```ts
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
```

- [ ] **Step 8: Run the cost test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/cost.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Wire provider selection into `agent/src/index.ts`**

In `agent/src/index.ts`, change the import line:

```ts
import { createAnthropicLlmClient } from "./llm/client.js";
```

to:

```ts
import { createAnthropicLlmClient } from "./llm/client.js";
import { createOpenAiLlmClient } from "./llm/openai-client.js";
```

Find the line inside `runAgent`'s catch block (and anywhere else `estimateCostUsd(usage)` is called) and change every call from:

```ts
estimateCostUsd(usage)
```

to:

```ts
estimateCostUsd(usage, options.model)
```

This requires `RunAgentOptions` to carry the model name through to cost estimation. Add a `model: string` field to the `RunAgentOptions` interface (next to `maxFixCycles`).

In the CLI bootstrap block (the `if (isMainModule) { ... }` section), change:

```ts
const llm = createAnthropicLlmClient(config.apiKey, config.model);
```

to:

```ts
const llm =
  config.provider === "openai"
    ? createOpenAiLlmClient(config.apiKey, config.model)
    : createAnthropicLlmClient(config.apiKey, config.model);
```

And add `model: config.model` to the options object passed to `runAgent(...)`, alongside the existing `specPath`/`outputDir`/`boilerplateDir`/`maxFixCycles` fields.

- [ ] **Step 10: Update `agent/src/__tests__/index.test.ts`**

Every call to `runAgent({ specPath, outputDir, boilerplateDir, maxFixCycles: 3 }, ...)` in the existing test file must add `model: "claude-sonnet-5"` to the options object (any string is fine — it only affects which pricing table `estimateCostUsd` picks).

- [ ] **Step 11: Run the full agent test suite and typecheck**

Run: `cd agent && npm test && npm run typecheck`
Expected: all test files pass, typecheck exits 0

- [ ] **Step 12: Update `agent/.env.example`**

Replace the full contents of `agent/.env.example` with:

```
# Which LLM provider to use: "anthropic" (default) or "openai".
LLM_PROVIDER=anthropic

# Required when LLM_PROVIDER=anthropic.
ANTHROPIC_API_KEY=
# Optional: override the default Anthropic model (see agent/src/config.ts).
ANTHROPIC_MODEL=

# Required when LLM_PROVIDER=openai.
OPENAI_API_KEY=
# Optional: override the default OpenAI model (see agent/src/config.ts).
OPENAI_MODEL=
```

- [ ] **Step 13: Commit**

```bash
git add agent/src/config.ts agent/src/llm/cost.ts agent/src/index.ts agent/.env.example agent/src/__tests__/config.test.ts agent/src/__tests__/cost.test.ts agent/src/__tests__/index.test.ts
git commit -m "feat: select LLM provider (anthropic or openai) from config"
```

---

### Task 15: Fix copyBoilerplate when destDir is nested inside srcDir

**Files:**
- Modify: `agent/src/tools/fs.ts`
- Test: `agent/src/__tests__/fs.test.ts` (extend)

**Interfaces:**
- Consumes/modifies: `copyBoilerplate(srcDir, destDir)` from Task 4.
- No signature change — same inputs/outputs, fixed behavior only.

Found during the live end-to-end run (Task 12/16): the real invocation copies the repo root (`boilerplateDir`) into `<repoRoot>/generated-app` — i.e. `destDir` is a subdirectory of `srcDir`. `fs.cp(srcDir, destDir, { recursive: true, filter })` refuses this outright with `ERR_FS_CP_EINVAL` ("cannot copy X to a subdirectory of self"), because Node's `fs.cp` checks whether `destDir` is nested inside `srcDir` on the top-level paths BEFORE any per-file `filter` callback runs — so excluding `generated-app` via the filter doesn't help; the top-level call itself is rejected before filtering ever applies. The existing test fixture in `agent/src/__tests__/fs.test.ts` used sibling directories (`src-project`/`dest-project`), so it never exercised this real-world path shape and didn't catch the bug.

- [ ] **Step 1: Write the failing test**

Add this test to the `describe("copyBoilerplate", ...)` block in `agent/src/__tests__/fs.test.ts` (alongside the existing two tests, reusing the same `writeFixture` helper already defined there):

```ts
  it("copies successfully when dest is nested inside src (e.g. src/generated-app)", async () => {
    const src = path.join(tmpRoot, "src-project-3");
    const dest = path.join(src, "generated-app");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);

    await copyBoilerplate(src, dest);

    await expect(fs.access(path.join(dest, "package.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "App.tsx"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "agent"))).rejects.toThrow();
    // dest must not contain itself
    await expect(fs.access(path.join(dest, "generated-app"))).rejects.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: FAIL — `SystemError [ERR_FS_CP_EINVAL]: cannot copy ... to a subdirectory of self`, reproducing the exact error seen in the live run.

- [ ] **Step 3: Rewrite `copyBoilerplate` in `agent/src/tools/fs.ts`**

Replace the existing `copyBoilerplate` function (keep `EXCLUDED_TOP_LEVEL` and `PLACEHOLDER_FILES` as they are) with:

```ts
export async function copyBoilerplate(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    await fs.cp(srcPath, destPath, { recursive: true });
  }

  for (const relPath of PLACEHOLDER_FILES) {
    await fs.rm(path.join(destDir, relPath), { force: true });
  }
}
```

This copies each top-level entry of `srcDir` individually instead of calling `fs.cp` on `srcDir` as a whole — since `generated-app` itself is always in `EXCLUDED_TOP_LEVEL`, it's never one of the entries copied, so `destDir` (which lives at `srcDir/generated-app`) never appears as a source path being copied into itself. Each per-entry `fs.cp(srcPath, destPath, ...)` call has `srcPath` and `destPath` in unrelated subtrees (e.g. `srcDir/src` → `destDir/src`), so Node's nested-path guard never triggers.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: PASS (5 tests — the 4 existing plus the new nested-dest case)

- [ ] **Step 5: Run the full agent suite and typecheck**

Run: `cd agent && npm test && npm run typecheck`
Expected: all test files pass, typecheck exits 0

- [ ] **Step 6: Commit**

```bash
git add agent/src/tools/fs.ts agent/src/__tests__/fs.test.ts
git commit -m "fix: copy boilerplate entries individually so nested output dirs work"
```

---

### Task 16: Harden copied vitest.config.ts's setupFiles path

**Files:**
- Modify: `agent/src/tools/fs.ts`
- Test: `agent/src/__tests__/fs.test.ts` (extend)

**Interfaces:**
- Consumes/modifies: `copyBoilerplate(srcDir, destDir)` from Task 4/15.
- No signature change — same inputs/outputs, fixed behavior only.

Found during the live end-to-end run (Task 12): the boilerplate's own `vitest.config.ts` (unmodified, provided by the challenge — do not touch the copy at the repo root) sets `test.setupFiles: ["./src/test-setup.ts"]` — a bare relative string. In this environment (verified by manually reproducing it in the actual `generated-app/` output), Vitest resolves that relative path against the wrong root once the config lives in a copied-elsewhere directory, producing `Cannot find module '<repo-root>/src/test-setup.ts'` (missing the `generated-app/` segment) even though the file exists at the correct path. Changing the line to `setupFiles: [resolve(__dirname, "src/test-setup.ts")]` (using the `resolve`/`__dirname` already imported and used for the `@` alias two lines above) fixed it when tested by hand. Since this bug lives in the boilerplate's own `vitest.config.ts` and the boilerplate itself must never be modified at the repo root, the fix is applied to the COPY inside `generated-app` only, as a small patch step at the end of `copyBoilerplate`.

- [ ] **Step 1: Write the failing test**

Add this test to the `describe("copyBoilerplate", ...)` block in `agent/src/__tests__/fs.test.ts` (reuse the existing `writeFixture` helper, but note it doesn't create a `vitest.config.ts` — add one inline in this test):

```ts
  it("rewrites the copied vitest.config.ts to resolve setupFiles via __dirname instead of a bare relative path", async () => {
    const src = path.join(tmpRoot, "src-project-4");
    const dest = path.join(tmpRoot, "dest-project-4");
    await fs.mkdir(src, { recursive: true });
    await writeFixture(src);
    await fs.writeFile(
      path.join(src, "vitest.config.ts"),
      [
        'import { defineConfig } from "vitest/config";',
        'import { resolve } from "node:path";',
        "",
        "export default defineConfig({",
        "  resolve: {",
        '    alias: { "@": resolve(__dirname, "src") },',
        "  },",
        "  test: {",
        '    setupFiles: ["./src/test-setup.ts"],',
        "  },",
        "});",
        "",
      ].join("\n"),
    );

    await copyBoilerplate(src, dest);

    const copiedConfig = await fs.readFile(path.join(dest, "vitest.config.ts"), "utf-8");
    expect(copiedConfig).toContain('setupFiles: [resolve(__dirname, "src/test-setup.ts")]');
    expect(copiedConfig).not.toContain('setupFiles: ["./src/test-setup.ts"]');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: FAIL — the copied `vitest.config.ts` still contains the original bare relative path; `copyBoilerplate` doesn't patch it yet.

- [ ] **Step 3: Add the patch step to `copyBoilerplate` in `agent/src/tools/fs.ts`**

Add this after the `for (const relPath of PLACEHOLDER_FILES)` cleanup loop, still inside `copyBoilerplate`:

```ts
  const vitestConfigPath = path.join(destDir, "vitest.config.ts");
  if (await fileExists(vitestConfigPath)) {
    const original = await fs.readFile(vitestConfigPath, "utf-8");
    const patched = original.replace(
      'setupFiles: ["./src/test-setup.ts"]',
      'setupFiles: [resolve(__dirname, "src/test-setup.ts")]',
    );
    if (patched !== original) {
      await fs.writeFile(vitestConfigPath, patched, "utf-8");
    }
  }
```

Add a small local helper (used only by the check above) near the top of the file, below the imports:

```ts
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

No new imports are needed in `fs.ts` for this step — the patch is pure string replacement on file content, using only the already-imported `fs` and `path`. The string `resolve(__dirname, "src/test-setup.ts")` written into the target file's content is text being generated, not code executed by `fs.ts` itself; the copied `vitest.config.ts` already has its own `import { resolve } from "node:path"` at its own top (untouched by this patch), so the rewritten line will compile correctly in the generated app.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && npx vitest run src/__tests__/fs.test.ts`
Expected: PASS (6 tests — the 5 existing plus the new vitest-config-patch case)

- [ ] **Step 5: Run the full agent suite and typecheck**

Run: `cd agent && npm test && npm run typecheck`
Expected: all test files pass, typecheck exits 0

- [ ] **Step 6: Commit**

```bash
git add agent/src/tools/fs.ts agent/src/__tests__/fs.test.ts
git commit -m "fix: harden copied vitest.config.ts setupFiles path resolution"
```
