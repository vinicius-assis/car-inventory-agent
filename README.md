# Car Inventory Agent

A CLI agent that reads a natural-language spec and generates a working **Car Inventory Manager**
(React + TypeScript, Apollo Client, MUI) into a copy of the boilerplate below — planning the work
into ordered tasks, generating file by file, then validating and self-correcting its own output.

This repo is the take-home deliverable: the agent itself, plus a pre-built boilerplate it targets
and a sample of its generated output.

## Layout

```
.                    # pre-built boilerplate (Car Inventory Manager shell) — do not restructure
├── src/                 Apollo + MUI + MSW app shell, fixed GraphQL schema, seed data
├── agent/               the agent — CLI, planning/generation/validation/fix pipeline
│   ├── spec.example.txt   sample natural-language spec
│   └── README.md           setup, architecture, LLM choice, cost per run, trade-offs
├── generated-app/       sample output of a real agent run against spec.example.txt
└── docs/superpowers/    design spec + task-by-task build log for the agent
```

## Quick start

**1. Verify the boilerplate runs on its own:**

```bash
npm install
npm run dev         # http://localhost:5173
npm run test
npm run typecheck
```

**2. Run the agent** (see `agent/README.md` for full setup, including `.env`):

```bash
cd agent
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY or OPENAI_API_KEY
npm start -- --spec spec.example.txt --output ../generated-app
```

**3. Run the generated app:**

```bash
cd generated-app
npm install
npm run dev
```

## Where to read more

- **`agent/README.md`** — architecture, why this LLM/provider, prompt design, what worked,
  what's left to improve, and cost per run.
- **`generated-app/README.md`** — what was generated in the committed sample run, and the bugs
  found and fixed in that output afterwards.
- **`docs/superpowers/`** — design decisions and the task-by-task plan the agent's own build
  followed.
