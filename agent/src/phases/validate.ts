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
