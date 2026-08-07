# Car Inventory Manager (generated app)

This is a sample output of the code-generation agent in `../agent/`, produced from
`../agent/spec.example.txt`. It is **not hand-written** — every file under `src/` besides the
copied boilerplate (`main.tsx`, `types.ts`, `graphql/`, `mocks/`, `test-setup.ts`) was generated
by the agent's `generate` phase and passed (or partially passed) through its `validate`/`fix`
loop. See `report.json` in this directory for the exact run metrics (tokens, cost, cycles used).

## Run it

```bash
npm install
npm run dev         # http://localhost:5173
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
```

## What was generated

- `src/hooks/useCars.ts` — Apollo `GetCars` query wrapped in a reusable hook
- `src/components/CarCard.tsx` — MUI card showing make/model/year/color and responsive image
- `src/components/CarList.tsx` — search-by-model + sort-by-year/make over the fetched list
- `src/components/AddCarForm.tsx` — form submitting the `AddCar` mutation
- `src/__tests__/AddCarForm.test.tsx`, `src/__tests__/CarList.test.tsx` — generated tests

## Known issue in this sample run

`src/__tests__/CarList.test.tsx` fails one assertion: `getByLabelText("Sort by")` against the MUI
`Select` doesn't resolve because MUI doesn't wire the label to the control the way Testing Library
expects out of the box. The agent's fix loop rewrote the file three times (its retry cap) without
landing on the right pattern (`aria-labelledby` / querying by role instead of label). This is
documented in `../agent/README.md` under "What I'd improve with more time" and left as-is here so
the sample reflects a real, non-cherry-picked run.

Everything else (`npm run typecheck`, `npm run dev`, and 5 of 6 tests) passes as generated.
