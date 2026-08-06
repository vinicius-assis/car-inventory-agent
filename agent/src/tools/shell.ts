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
