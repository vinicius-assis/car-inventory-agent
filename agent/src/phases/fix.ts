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
