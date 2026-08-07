import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createAnthropicLlmClient } from "./llm/client.js";
import { createOpenAiLlmClient } from "./llm/openai-client.js";
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
  model: string;
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

  try {
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
      estimatedCostUsd: estimateCostUsd(usage, options.model),
      durationMs: Date.now() - start,
    };

    await fs.writeFile(path.join(options.outputDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

    return report;
  } catch (err) {
    const usage = deps.llm.getUsage();
    const failureReport: RunReport = {
      success: false,
      tasksGenerated: 0,
      fix: { success: false, cyclesUsed: 0, remainingErrors: [] },
      usage,
      estimatedCostUsd: estimateCostUsd(usage, options.model),
      durationMs: Date.now() - start,
    };

    await fs.mkdir(options.outputDir, { recursive: true });
    await fs.writeFile(
      path.join(options.outputDir, "report.json"),
      JSON.stringify(failureReport, null, 2),
      "utf-8",
    );

    throw err;
  }
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
  const llm =
    config.provider === "openai"
      ? createOpenAiLlmClient(config.apiKey, config.model)
      : createAnthropicLlmClient(config.apiKey, config.model);

  runAgent(
    {
      specPath: path.resolve(specPath),
      outputDir: path.resolve(outputDir ?? path.join(repoRoot, "generated-app")),
      boilerplateDir: repoRoot,
      maxFixCycles: config.maxFixCycles,
      model: config.model,
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
