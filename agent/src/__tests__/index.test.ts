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
