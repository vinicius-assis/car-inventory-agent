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

## Fixed after generation

The agent's fix loop (capped at 3 cycles) left one test failing in the original run — see
`report.json` and `../agent/README.md` for that as-generated state. Investigating it turned up
three separate bugs, since fixed by hand in this copy:

- `CarList.tsx`: `InputLabel` had no `id` and `Select` had no matching `labelId`, so the label
  was wired to a hidden native input instead of the visible `role="combobox"` element — a real
  accessibility gap, not just a test-query quirk. Fixed by adding `id="sort-by-label"` /
  `labelId="sort-by-label"`.
- `CarCard.tsx`: was missing the `data-testid="car-model"` attribute the test queried for.
- `CarList.test.tsx`: the sort-by-make assertion asserted the wrong order
  (`["Honda Accord", "Ford Mustang", ...]`, not alphabetical) — the component's sort logic was
  already correct; only the test's expected value was wrong.

All 6 tests, `npm run typecheck`, and `npm run build` pass as of this copy.
