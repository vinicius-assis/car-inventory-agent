# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is a take-home challenge (`take-home.pdf`, mirrored in more detail in `README.md`). The root of
the repo is a **pre-built boilerplate** for a "Car Inventory Manager" React app — it must not be
scaffolded over, deleted, or restructured. The actual deliverable is a separate **code-generation
agent** (planned to live in `agent/`) that reads a natural-language spec and generates a working
implementation into a copy of this boilerplate (`generated-app/`).

Design and implementation planning for the agent live in `docs/superpowers/specs/` and
`docs/superpowers/plans/` — read those before starting or resuming agent work.

## Commands (root boilerplate)

```bash
npm install
npm run dev         # Vite dev server at localhost:5173
npm run test         # vitest run — full suite
npm run typecheck    # tsc --noEmit
npm run build         # tsc -b && vite build
npm run preview       # preview a production build
```

Run a single test file: `npx vitest run src/__tests__/Example.test.tsx`
Run tests matching a name: `npx vitest run -t "renders car data"`

The `agent/` package (once built per the implementation plan) has its own `package.json` with the
same `test`/`typecheck` scripts, plus `npm start -- --spec <path> --output <path>` to run the agent.

## Architecture (root boilerplate)

- **Path alias**: `@/*` maps to `src/*` (configured in both `tsconfig.json` and `vite.config.ts` —
  keep them in sync if it ever changes).
- **Data flow**: `src/main.tsx` starts the MSW mock worker in dev (`src/mocks/browser.ts`), then
  wraps `App` in `ApolloProvider` (client from `src/graphql/client.ts`) and MUI's `ThemeProvider`.
  Apollo's GraphQL requests are intercepted by MSW handlers (`src/mocks/handlers.ts`), which serve
  an in-memory copy of the seed data (`src/mocks/data.ts`). There is no real backend — MSW *is* the
  API, in both the browser (dev) and Vitest (via `src/mocks/server.ts` + `src/test-setup.ts`).
- **Fixed GraphQL schema**: `src/graphql/queries.ts` defines exactly three operations —
  `GetCars` (no args → `{ cars: Car[] }`), `GetCar($id)` (→ `{ car: Car | null }`), and
  `AddCar($make, $model, $year, $color)` (→ newly created `Car`, with `id` and image URLs assigned
  server-side). The `Car` shape is defined once in `src/types.ts`. Any generated or hand-written code
  must use these exactly as given — don't invent fields or operations.
- **Testing pattern**: Apollo-dependent components are tested by wrapping them in
  `<MockedProvider mocks={...}>` with mock results that include `__typename: "Car" as const` on
  mocked data — see `src/__tests__/Example.test.tsx` for the reference pattern.
- **Placeholders**: `src/App.tsx` and `src/components/Example.tsx` are stand-ins meant to be
  replaced by the generated app — they are not part of the required functionality themselves.

## Git commit conventions

Commits in this repo follow **Conventional Commits** (`type: subject`, e.g. `feat:`, `fix:`,
`chore:`, `docs:`), written in English, with **no co-author trailer**.
