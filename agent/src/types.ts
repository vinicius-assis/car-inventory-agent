import { z } from "zod";

export const TaskKindSchema = z.enum(["hook", "component", "test"]);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  kind: TaskKindSchema,
  description: z.string().min(1),
  dependsOn: z.array(z.string()),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskGraphSchema = z.object({
  tasks: z.array(TaskSchema).min(1),
});
export type TaskGraph = z.infer<typeof TaskGraphSchema>;

export interface UsageStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ValidationError {
  file: string;
  message: string;
}

export interface ValidationResult {
  typecheckPassed: boolean;
  testsPassed: boolean;
  errors: ValidationError[];
}

export interface FixResult {
  success: boolean;
  cyclesUsed: number;
  remainingErrors: ValidationError[];
}

export interface RunReport {
  success: boolean;
  error?: string;
  tasksGenerated: number;
  fix: FixResult;
  usage: UsageStats;
  estimatedCostUsd: number;
  durationMs: number;
}
