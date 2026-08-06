import type { Task } from "../types.js";
import type { LlmClient } from "../llm/client.js";
import type { GeneratedFileStore } from "../tools/fs.js";
import {
  buildGeneratePrompt,
  GENERATE_TOOL_NAME,
  GENERATE_TOOL_DESCRIPTION,
  GENERATE_INPUT_JSON_SCHEMA,
} from "../prompts/generate.prompt.js";

export interface GenerateFileResult {
  task: Task;
  content: string;
}

export async function generateFile(
  task: Task,
  allTasks: Task[],
  fileStore: GeneratedFileStore,
  boilerplateReferences: Record<Task["kind"], string>,
  llm: LlmClient,
): Promise<GenerateFileResult> {
  const dependencyFiles = await Promise.all(
    task.dependsOn.map(async (depId) => {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask) throw new Error(`Unknown dependency "${depId}" for task "${task.id}"`);
      return { path: depTask.file, content: await fileStore.read(depTask.file) };
    }),
  );

  const { system, user } = buildGeneratePrompt({
    task,
    dependencyFiles,
    boilerplateReference: boilerplateReferences[task.kind],
  });

  const { content } = await llm.callStructured<{ content: string }>({
    system,
    user,
    toolName: GENERATE_TOOL_NAME,
    toolDescription: GENERATE_TOOL_DESCRIPTION,
    inputSchema: GENERATE_INPUT_JSON_SCHEMA,
  });

  await fileStore.write(task.file, content);
  return { task, content };
}

export async function generateAll(
  tasks: Task[],
  fileStore: GeneratedFileStore,
  boilerplateReferences: Record<Task["kind"], string>,
  llm: LlmClient,
): Promise<GenerateFileResult[]> {
  const results: GenerateFileResult[] = [];
  for (const task of tasks) {
    results.push(await generateFile(task, tasks, fileStore, boilerplateReferences, llm));
  }
  return results;
}
