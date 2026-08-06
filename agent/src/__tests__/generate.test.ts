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
