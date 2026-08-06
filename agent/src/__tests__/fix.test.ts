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
