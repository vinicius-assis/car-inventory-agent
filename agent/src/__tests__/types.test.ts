import { describe, it, expect } from "vitest";
import { TaskGraphSchema } from "../types.js";

describe("TaskGraphSchema", () => {
  it("accepts a valid task graph", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [
        { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "Fetch cars.", dependsOn: [] },
        { id: "App", file: "src/App.tsx", kind: "component", description: "Renders the app.", dependsOn: ["useCars"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a task missing required fields", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [{ id: "useCars", file: "src/hooks/useCars.ts", dependsOn: [] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown task kind", () => {
    const result = TaskGraphSchema.safeParse({
      tasks: [{ id: "x", file: "src/x.ts", kind: "service", description: "d", dependsOn: [] }],
    });
    expect(result.success).toBe(false);
  });
});
