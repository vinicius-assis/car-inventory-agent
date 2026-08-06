import { describe, it, expect } from "vitest";
import { parseTypecheckErrors, parseTestErrors, validateProject } from "../phases/validate.js";
import type { ShellRunner } from "../tools/shell.js";

describe("parseTypecheckErrors", () => {
  it("extracts file and message from tsc --pretty false output", () => {
    const output = [
      "src/components/CarCard.tsx(12,7): error TS2339: Property 'colour' does not exist on type 'Car'.",
      "src/App.tsx(3,1): error TS2307: Cannot find module '@/foo'.",
    ].join("\n");

    const errors = parseTypecheckErrors(output);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({ file: "src/components/CarCard.tsx", message: "TS2339 at line 12: Property 'colour' does not exist on type 'Car'." });
  });

  it("returns an empty array for clean output", () => {
    expect(parseTypecheckErrors("")).toEqual([]);
  });
});

describe("parseTestErrors", () => {
  it("extracts failed test files from vitest json reporter output", () => {
    const projectDir = "/tmp/project";
    const json = JSON.stringify({
      testResults: [
        {
          name: "/tmp/project/src/__tests__/CarCard.test.tsx",
          status: "failed",
          assertionResults: [{ status: "failed", failureMessages: ["Expected 'Toyota' but got 'Honda'"] }],
        },
        {
          name: "/tmp/project/src/__tests__/SearchBar.test.tsx",
          status: "passed",
          assertionResults: [{ status: "passed" }],
        },
      ],
    });

    const errors = parseTestErrors(json, projectDir);

    expect(errors).toEqual([
      { file: "src/__tests__/CarCard.test.tsx", message: "Expected 'Toyota' but got 'Honda'" },
    ]);
  });

  it("returns an empty array when the output is not valid JSON", () => {
    expect(parseTestErrors("not json", "/tmp/project")).toEqual([]);
  });
});

describe("validateProject", () => {
  it("combines typecheck and test results", async () => {
    const fakeRunCommand: ShellRunner = async (_cmd, args) => {
      if (args.includes("typecheck")) {
        return { code: 1, stdout: "src/App.tsx(1,1): error TS2304: Cannot find name 'x'.", stderr: "" };
      }
      return { code: 0, stdout: JSON.stringify({ testResults: [] }), stderr: "" };
    };

    const result = await validateProject("/tmp/project", fakeRunCommand);

    expect(result.typecheckPassed).toBe(false);
    expect(result.testsPassed).toBe(true);
    expect(result.errors).toHaveLength(1);
  });
});
