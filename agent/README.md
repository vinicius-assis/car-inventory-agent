# Car Inventory Agent

A CLI agent that reads a natural-language spec and generates a React + TypeScript "Car
Inventory Manager" into a copy of the boilerplate at the repo root, self-validating and
fixing its own output along the way.

## Setup

```bash
cd agent
npm install
cp .env.example .env   # then fill in the keys for the provider you want to use
```

`.env` supports two providers, selected by `LLM_PROVIDER`:

```
LLM_PROVIDER=anthropic   # or "openai"

ANTHROPIC_API_KEY=       # required when LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=         # optional override, default: claude-sonnet-5

OPENAI_API_KEY=          # required when LLM_PROVIDER=openai
OPENAI_MODEL=            # optional override, default: gpt-4o
```

## Run

```bash
npm start -- --spec spec.example.txt --output ../generated-app
```

Then verify the result:

```bash
cd ../generated-app
npm install
npm run dev
```

## Architecture

```
spec.txt -> [plan] -> task graph -> [generate, per file, topological order]
         -> [validate: tsc + vitest] -> [fix, up to 3 cycles] -> generated-app/
```

A single orchestrator (`src/index.ts`) runs four phases in sequence:

- **plan** (`src/phases/plan.ts`) — one LLM call turns the spec into an ordered list of
  file-level tasks (hook / component / test), each declaring which other tasks it depends
  on. The response is forced through structured tool-use with a JSON schema derived from a
  `zod` schema, then topologically sorted so dependencies are generated before dependents.
- **generate** (`src/phases/generate.ts`) — one LLM call per task, in dependency order.
  Each prompt includes only the content of the files the task actually depends on (not the
  whole project) plus the fixed `Car` type / GraphQL operations from the boilerplate — this
  is the context-management strategy: context grows with real dependencies, not project size.
- **validate** (`src/phases/validate.ts`) — runs `npm run typecheck` and
  `npm run test -- --reporter=json` inside the generated app and parses failures back to
  the specific file that caused them, using Vitest's JSON reporter rather than scraping
  colored terminal output.
- **fix** (`src/phases/fix.ts`) — for each file with reported errors, one LLM call receives
  the current file content and the raw error message and returns the corrected file. Re-runs
  validation after each cycle, up to `maxFixCycles` (default 3). If errors remain after the
  cap, the agent exits non-zero and `generated-app/report.json` records exactly which files
  still fail and why — a visible failure, not a silent one, even for failures that happen
  before the fix loop starts (e.g. an invalid spec or a malformed plan response).

All LLM calls and shell commands are injected through small interfaces (`LlmClient`,
`ShellRunner`), so every phase is unit-tested with fakes — no test in `src/__tests__`
hits the network or spawns a real process except by explicit design (`tools/shell.test.ts`
runs real, harmless `node -e` subprocesses to test the shell wrapper itself).

```
agent/src/
├── index.ts               # CLI entrypoint: parseArgs, runAgent, provider selection
├── config.ts               # env loading, provider/model defaults
├── types.ts                 # Task, TaskGraph schema (zod), UsageStats, RunReport, ...
├── llm/
│   ├── client.ts             # LlmClient interface + AnthropicLlmClient
│   ├── openai-client.ts        # OpenAiLlmClient (second LlmClient implementation)
│   └── cost.ts                  # model-aware USD cost estimate from token usage
├── phases/
│   ├── plan.ts                   # spec -> ordered task graph
│   ├── generate.ts                 # task -> file content
│   ├── validate.ts                   # tsc + vitest -> structured errors
│   └── fix.ts                          # bounded retry loop
├── prompts/                            # prompt builders + few-shot examples, per phase
└── tools/
    ├── fs.ts                             # GeneratedFileStore, copyBoilerplate
    └── shell.ts                            # runCommand (spawn wrapper, timeout-safe)
```

## Which LLM, and why

The agent supports both Anthropic Claude and OpenAI out of the box, selected via
`LLM_PROVIDER`. Both are implemented against the same `LlmClient` interface
(`callStructured<T>({ system, user, toolName, toolDescription, inputSchema }): Promise<T>`),
so every phase (plan/generate/fix) depends only on that interface and has no idea which
provider is active. Tool-use (Anthropic) / function-calling (OpenAI) is used for every call
instead of free-text parsing — the response is always a schema-constrained JSON object, not
prose to regex out.

The sample run documented below used **OpenAI (`gpt-4o`)**, since that was the API access
available when this was run. Anthropic Claude was the original default and is the
better-tested path (more of this project's own design and prompt iteration targeted it
first) — both are exercised by the agent's own automated test suite via fakes, but only the
OpenAI path has a real end-to-end run recorded here.

## What worked well

- Forcing every LLM response through tool-use / function-calling with a schema meant the
  agent never had to parse free-form text — task graphs and file contents came back
  structured every time, across both providers.
- Scoping the generate-phase context to only a task's declared dependencies kept prompts
  small and made it easy to reason about what each generation call could and couldn't see.
- Using Vitest's JSON reporter instead of scraping colored terminal output made the
  validate/fix loop's error-to-file attribution reliable.
- The `LlmClient` interface made adding a second provider (OpenAI, added after the initial
  build) a genuinely small, isolated change — one new file plus a few lines of config/index
  wiring, no changes to any of the four pipeline phases.

## What I'd improve with more time

- The fix loop replaces a whole file per cycle; a diff-based fix would use fewer tokens for
  small errors.
- Only one fix attempt is made per file per cycle even if a file has errors from both
  typecheck and tests — batching those into a single richer prompt could resolve both in
  one call instead of two cycles.
- The sample run below hit a real limit of the current fix loop: the generated
  `CarList.test.tsx` used `getByLabelText("Sort by")` against a MUI `Select`, which doesn't
  associate its label with the control the way Testing Library expects by default (a known
  MUI accessibility-wiring subtlety, not a typecheck error). Three fix cycles rewrote the
  file each time but didn't land on the right MUI-specific pattern (e.g. `labelId` +
  `aria-labelledby`, or querying by role instead of label). A future version could special-case
  common MUI/Testing-Library pitfalls in the fix prompt, or give the fix loop a short library
  of known-good patterns to draw on instead of only the raw error text.
- Two real, non-LLM bugs were found only by actually running the agent end-to-end against a
  real API (not caught by the unit test suite, which used sibling temp directories rather
  than the real nested-output-directory shape): `fs.cp` refuses to copy a directory into a
  subdirectory of itself, which is exactly what copying the repo root into
  `<repoRoot>/generated-app` does; and the boilerplate's own `vitest.config.ts` resolves its
  `setupFiles` path incorrectly once copied to a different directory in this environment.
  Both are fixed now, but it's a reminder that dependency-injected unit tests, however
  thorough, don't substitute for at least one real run before calling a pipeline done.
- No caching between runs — re-running the same spec re-does the full plan and generate
  phases from scratch.

## Cost per run

Sample run against `spec.example.txt`, using `LLM_PROVIDER=openai` / `gpt-4o` (from
`generated-app/report.json`):

| Metric | Value |
|---|---|
| LLM calls | 14 |
| Input tokens | 34,658 |
| Output tokens | 9,743 |
| Estimated cost (USD) | $0.184 |
| Fix cycles used | 3 (cap reached) |
| Wall time | ~98 seconds |
| Tasks generated | 7 (useCars hook, CarCard, CarList, AddCarForm, App, 2 tests) |
| Result | `typecheck`: clean · `test`: 5/6 passing (1 known MUI label-association issue, see above) · `npm run dev`: starts cleanly |

Pricing is approximate — see the comment in `src/llm/cost.ts` and verify against
[Anthropic's](https://www.anthropic.com/pricing) or
[OpenAI's](https://openai.com/api/pricing) current pricing before relying on this for
budgeting. The agent's own `PRICING` table only has entries for `claude-sonnet-5` and
`gpt-4o`; other models fall back to the Claude Sonnet rate.
