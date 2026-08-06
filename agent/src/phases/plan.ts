import { TaskGraphSchema, type Task } from "../types.js";
import { buildPlanPrompt, PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, PLAN_INPUT_JSON_SCHEMA } from "../prompts/plan.prompt.js";
import type { LlmClient } from "../llm/client.js";

export async function planFromSpec(spec: string, llm: LlmClient): Promise<Task[]> {
  const { system, user } = buildPlanPrompt(spec);
  const raw = await llm.callStructured<unknown>({
    system,
    user,
    toolName: PLAN_TOOL_NAME,
    toolDescription: PLAN_TOOL_DESCRIPTION,
    inputSchema: PLAN_INPUT_JSON_SCHEMA,
  });
  const graph = TaskGraphSchema.parse(raw);
  return topologicalSort(graph.tasks);
}

export function topologicalSort(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Task[] = [];

  function visit(task: Task, stack: string[]): void {
    if (visited.has(task.id)) return;
    if (stack.includes(task.id)) {
      throw new Error(`Circular dependency detected: ${[...stack, task.id].join(" -> ")}`);
    }
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Task "${task.id}" depends on unknown task "${depId}"`);
      }
      visit(dep, [...stack, task.id]);
    }
    visited.add(task.id);
    result.push(task);
  }

  for (const task of tasks) visit(task, []);
  return result;
}
