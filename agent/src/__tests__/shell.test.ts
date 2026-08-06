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
