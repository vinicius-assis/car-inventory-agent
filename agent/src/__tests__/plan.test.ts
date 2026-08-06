// agent/src/__tests__/plan.test.ts
import { describe, it, expect } from "vitest";
import { planFromSpec, topologicalSort } from "../phases/plan.js";
import type { LlmClient, CallStructuredParams } from "../llm/client.js";
import type { Task } from "../types.js";

class FakeLlmClient implements LlmClient {
  constructor(private readonly response: unknown) {}
  async callStructured<T>(_params: CallStructuredParams): Promise<T> {
    return this.response as T;
  }
  getUsage() {
    return { calls: 1, inputTokens: 10, outputTokens: 10 };
  }
}

describe("planFromSpec", () => {
  it("returns tasks ordered so dependencies come before dependents", async () => {
    const llm = new FakeLlmClient({
      tasks: [
        { id: "App", file: "src/App.tsx", kind: "component", description: "d", dependsOn: ["CarList"] },
        { id: "useCars", file: "src/hooks/useCars.ts", kind: "hook", description: "d", dependsOn: [] },
        { id: "CarList", file: "src/components/CarList.tsx", kind: "component", description: "d", dependsOn: ["useCars"] },
      ],
    });

    const tasks = await planFromSpec("Build a car list.", llm);
    const order = tasks.map((t) => t.id);

    expect(order.indexOf("useCars")).toBeLessThan(order.indexOf("CarList"));
    expect(order.indexOf("CarList")).toBeLessThan(order.indexOf("App"));
  });
});

describe("topologicalSort", () => {
  it("throws on circular dependencies", () => {
    const tasks: Task[] = [
      { id: "a", file: "a.ts", kind: "hook", description: "d", dependsOn: ["b"] },
      { id: "b", file: "b.ts", kind: "hook", description: "d", dependsOn: ["a"] },
    ];
    expect(() => topologicalSort(tasks)).toThrow(/Circular/);
  });

  it("throws when a task depends on an unknown task id", () => {
    const tasks: Task[] = [{ id: "a", file: "a.ts", kind: "hook", description: "d", dependsOn: ["missing"] }];
    expect(() => topologicalSort(tasks)).toThrow(/unknown task/);
  });
});
