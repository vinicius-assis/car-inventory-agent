import { zodToJsonSchema } from "zod-to-json-schema";
import { TaskGraphSchema } from "../types.js";
import { FIXED_BOILERPLATE_CONTEXT } from "./boilerplateContext.js";

export const PLAN_TOOL_NAME = "emit_task_graph";
export const PLAN_TOOL_DESCRIPTION =
  "Emit the ordered list of file-level implementation tasks needed to build the app described in the specification.";
export const PLAN_INPUT_JSON_SCHEMA = zodToJsonSchema(TaskGraphSchema, { name: "TaskGraph" }).definitions
  ?.TaskGraph as Record<string, unknown>;

const FEW_SHOT_EXAMPLE = `
Example specification: "Build a simple product catalog: list products, let users search by name."

Example task graph:
\`\`\`json
{
  "tasks": [
    { "id": "useProducts", "file": "src/hooks/useProducts.ts", "kind": "hook", "description": "Custom hook wrapping the GetProducts query, returning { products, loading, error }.", "dependsOn": [] },
    { "id": "SearchBar", "file": "src/components/SearchBar.tsx", "kind": "component", "description": "Controlled text input that calls onChange(value) as the user types.", "dependsOn": [] },
    { "id": "ProductList", "file": "src/components/ProductList.tsx", "kind": "component", "description": "Uses useProducts and SearchBar to render a filtered list of products.", "dependsOn": ["useProducts", "SearchBar"] },
    { "id": "App", "file": "src/App.tsx", "kind": "component", "description": "Renders ProductList inside the page shell.", "dependsOn": ["ProductList"] },
    { "id": "ProductList.test", "file": "src/__tests__/ProductList.test.tsx", "kind": "test", "description": "Renders ProductList with MockedProvider and asserts search filters the visible items.", "dependsOn": ["ProductList"] }
  ]
}
\`\`\`
`.trim();

export function buildPlanPrompt(spec: string): { system: string; user: string } {
  const system = `You are a senior frontend engineer planning the implementation of a React + TypeScript app.
Break the specification into a small, ordered set of file-level tasks. Each task produces exactly one file.
Prefer small, focused files: one hook, one component, or one test per task. A component that composes others
should depend on them via "dependsOn". Every "component" task that renders meaningful behavior should have a
matching "test" task depending on it.

${FIXED_BOILERPLATE_CONTEXT}

${FEW_SHOT_EXAMPLE}

Respond only by calling the ${PLAN_TOOL_NAME} tool.`;

  const user = `Specification:\n${spec}`;

  return { system, user };
}
