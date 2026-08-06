# Agentic Code Generation Workflow — Design

**Date:** 2026-08-06
**Status:** Approved

## Context

This repository is the pre-built boilerplate for a take-home challenge (see `README.md`
and `take-home.pdf`). The boilerplate (`src/`, `package.json`, `vite.config.ts`, etc.)
is already configured with React 19 + TypeScript, Vite, Apollo Client, MUI, MSW, and
Vitest, and must **not** be scaffolded from scratch or deleted.

The deliverable is a separate CLI agent that:
1. Reads a natural-language spec describing a "Car Inventory Manager" app.
2. Plans, generates, and self-validates a React + TypeScript implementation.
3. Writes the result into a runnable `generated-app/` directory (a copy of this
   boilerplate with generated source files).

The agent itself — not the generated app — is the primary evaluated artifact.

## Goals

- Demonstrate a real agentic loop: task decomposition, discrete tool use, context
  management, error recovery, and structured prompting — not a single LLM call.
- Produce a working Car Inventory Manager covering both the required spec (list via
  `GetCars`, search by model, sort by year/make, acceptable test coverage) and the
  optional spec (`useCars()` hook, responsive images, MUI cards, `AddCar` form).
- Keep the agent implementation simple enough to fully explain and finish within the
  4–6 hour time budget — no framework, no unnecessary abstraction layers.

## Non-goals

- No backend, database, auth, deployment, or CI/CD.
- No attempt at 100% test coverage — "acceptable" means each functional component has
  at least one behavior test and the full suite passes.
- No multi-agent role-play (separate planner/coder/reviewer personas) — a single
  orchestrator with distinct phases is sufficient and easier to reason about.

## Architecture

```
spec.txt → [Plan] → task graph → [Generate (per file, topological order)]
         → [Validate: tsc + vitest] → [Fix loop, max 3 cycles] → generated-app/
```

A single CLI orchestrator (`agent/src/index.ts`) runs these phases sequentially,
calling the Anthropic API directly (no LangChain/LangGraph) with tool-use for
structured (schema-enforced) JSON responses.

### Module layout

```
agent/
├── src/
│   ├── index.ts            # CLI entrypoint — parses --spec / --output, runs the pipeline
│   ├── config.ts           # env loading (ANTHROPIC_API_KEY), model name, retry limits
│   ├── llm/
│   │   └── client.ts       # thin wrapper over the Anthropic SDK; call(prompt, schema)
│   │                       # via tool-use; accumulates token usage for cost reporting
│   ├── phases/
│   │   ├── plan.ts         # spec.txt -> ordered task graph
│   │   ├── generate.ts     # per task: build minimal context, call LLM, write file
│   │   ├── validate.ts     # runs `npm run typecheck` + `npm run test -- --run`
│   │   └── fix.ts          # groups errors by file, re-generates, re-validates
│   ├── tools/
│   │   ├── fs.ts           # writeFile/readFile + tracks what has been generated so far
│   │   └── shell.ts        # exec wrapper with stdout/stderr capture and timeout
│   ├── prompts/
│   │   ├── plan.prompt.ts
│   │   ├── generate.prompt.ts   # varies by task kind: hook / component / test
│   │   └── fix.prompt.ts
│   └── types.ts            # Task, TaskResult, ValidationResult, UsageStats
├── spec.example.txt
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Phase details

**Plan** (`phases/plan.ts`)
One LLM call with: the full spec text, the boilerplate's fixed `Car` type and GraphQL
operations (`GET_CARS`, `GET_CAR`, `ADD_CAR`), and a few-shot example of a small task
graph in the expected JSON shape. The response is forced through Anthropic tool-use
with a JSON schema (derived from a `zod` schema) and validated before use.

Task shape:
```ts
{
  id: string;
  file: string;              // path relative to generated-app/
  kind: "hook" | "component" | "test";
  description: string;
  dependsOn: string[];       // ids of tasks that must be generated first
}
```

Tasks are ordered topologically by `dependsOn` before generation.

**Generate** (`phases/generate.ts`)
Iterates tasks in topological order. For each task, builds a prompt containing only:
the task description, the source of the (already-generated) files listed in
`dependsOn`, and the fixed boilerplate types/queries — not the whole project. This is
the context-management mechanism: context grows with real dependencies only, not with
project size. Prompts differ by `kind` and each includes a reference example pulled
from the boilerplate (`Example.tsx` / `Example.test.tsx`) to anchor style and API
usage (Apollo hooks, MUI components, `MockedProvider` test pattern). The file is
written via `tools/fs.ts`.

**Validate** (`phases/validate.ts`)
After all tasks are generated: `npm install` once, then `npm run typecheck` and
`npm run test -- --run` inside `generated-app/`, captured via `tools/shell.ts`.
Output is parsed for per-file error attribution (file paths appear in both `tsc` and
Vitest failure output).

**Fix** (`phases/fix.ts`)
If validation fails, errors are grouped by affected file. For each affected file, one
LLM call receives the current file content and the raw error message, and returns the
full corrected file (not a diff — more reliable to apply). Validation re-runs after
each cycle.

- **Stop condition:** maximum 3 fix cycles. If errors remain after 3 cycles, the agent
  exits non-zero and writes `generated-app/report.json` listing which files still have
  errors and the last error message — a visible failure, not a silent one.
- On success, `report.json` records success plus usage stats (see below).

### Testing scope

The task graph includes `kind: "test"` tasks for the main functional pieces:
`useCars`, `CarCard`, `SearchBar`/search behavior in `CarList`, sort behavior, and
`AddCarForm` (mutation + list update via the existing MSW handlers). "Acceptable
level of testing" means one behavior test per functional unit and a fully green
suite — not a coverage percentage target.

### Prompt design

- All three prompt templates use Anthropic tool-use with a JSON schema to force
  structured output — never free-text parsed with regex.
- `plan.prompt.ts` includes a few-shot example task graph to anchor the output shape.
- `generate.prompt.ts` explicitly instructs the model to use only the provided types
  and GraphQL operations and not invent schema fields — this both keeps output
  consistent and reduces the risk of overfitting to the exact sample spec, since the
  evaluator may modify the spec to test generalization.
- `fix.prompt.ts` passes the raw tool error output verbatim plus the current file, and
  asks for the complete corrected file.

### Cost / observability

`llm/client.ts` accumulates `input_tokens` / `output_tokens` from the `usage` field of
every Anthropic API response. At the end of a run the agent prints: number of LLM
calls, total tokens, estimated cost (using an embedded Sonnet pricing table), wall
time, and how many fix cycles were needed. This feeds directly into the "approximate
cost per run" write-up requirement.

## Key decisions

- **LLM provider:** Anthropic (Claude), via direct API calls.
- **Agent runtime:** TypeScript/Node.js — matches the boilerplate's ecosystem, makes
  it natural to shell out to `npm`/`vitest`/`tsc` and reuse type definitions.
- **Orchestration:** hand-rolled function-calling loop, no agent framework — avoids
  the "sprawling abstraction layer" the challenge explicitly discourages, and keeps
  the pipeline easy to explain end to end.
- **Agent location:** `agent/` directory at the repo root, alongside the existing
  boilerplate. The agent copies the boilerplate into `generated-app/` and generates
  source files there, per the challenge's expected invocation
  (`node agent.js --spec ./spec.txt --output ./generated-app`).
- **Single orchestrator, not multi-agent:** one process with distinct phases
  (plan/generate/validate/fix) rather than separate planner/coder/reviewer LLM
  personas — sufficient to demonstrate the required architecture concepts within the
  time budget.
- **Full-file rewrites on fix, not diffs:** simpler and more reliable to apply than
  partial patches, at the cost of slightly higher token usage per fix cycle.

## Existing boilerplate — confirmed to keep as-is

`src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`,
`index.html`, `public/`, and `README.md` are the official boilerplate provided by the
challenge and must not be deleted or scaffolded over. The agent's job is to copy this
directory into `generated-app/` and replace only the placeholder files
(`App.tsx`, `components/Example.tsx`, `__tests__/Example.test.tsx`) with generated
code.
