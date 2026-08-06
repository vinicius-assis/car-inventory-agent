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

Respond only by calling the ${GENERATE_TOOL_NAME} tool.`;

  const user = `Task: ${ctx.task.id}
File to produce: ${ctx.task.file}
Kind: ${ctx.task.kind}
Description: ${ctx.task.description}

Files this task depends on (already generated, exact current content):
${depsSection}`;

  return { system, user };
}
