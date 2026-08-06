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
