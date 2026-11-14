# Code conventions

How to write code in this repository. The layer rules live in
[ARCHITECTURE.md](./ARCHITECTURE.md); this file is about day-to-day practice.

## Language & naming

- Code, identifiers, comments and commit messages in **English**. User-facing
  conversation may be in any language; artifacts stay in English unless the
  target project convention says otherwise.
- Files: `PascalCase` classes (`StationRepository.ts`), `camelCase` functions,
  `kebab-case` jobs/specs (`RealtimeSync.job.ts`, `*.spec.ts`).

## Imports

- Always import through the `@/` alias (`@/application/...`,
  `@/infrastructure/...`, `@/shared/...`, `@/interfaces/...`). Never write
  relative imports that cross directories (`../entities/...`); same-directory
  barrels (`./index`, `./manager`) are fine.
- Re-export barrels (`index.ts`) exist per folder — import the barrel, not
  deep paths, when one exists.
- New code must not import `drizzle-orm`, `@/infrastructure/persistence`
  internals, or the legacy paths (gone since the layered refactor). If a test
  needs such an import, the seam is wrong — fix the seam.

## Errors

- Business/validation failures throw `ApiError` via the factories in
  `shared/errors/error-handler.ts` (`createValidationError`,
  `createBadRequestError`, `createNotFoundError`, `createInternalServerError`).
- HTTP mapping is mechanical: `VALIDATION_ERROR`/`BAD_REQUEST` → 400,
  `NOT_FOUND` → 404, else 500 (see `errorStatus`). Controllers and the
  error-handler middleware own this mapping — nothing else sends responses.
- Log expected failures with `logger` (`warn`/`error`); send only unexpected
  exceptions to Sentry, with context. Never `console.log`.
- Never swallow errors in jobs: log, restore previous state where applicable,
  and rethrow so the failure is visible.

## Validation & presentation

- REST input: `express-validator` chains in `interfaces/http/validations`,
  checked with `validationResult(req)` at the top of every controller.
- MCP input: `zod` schemas in each tool's `inputSchema`.
- Response shapes are contracts: `stationId → id` remap on stations,
  `camelCase` keys, bare array for historic REST, `{count, ...}` envelopes
  for MCP. Changing a shape requires updating its specs the same commit.

## Data access

- All DB reads/writes go through repositories. No `select`/`insert`/`delete`
  outside `infrastructure/persistence` (the `DatabaseService` factory is the
  only other exception, and it only opens connections).
- Bulk writes are chunked (500 rows) — a full-census single INSERT overflows
  the query builder (seen at boot, fixed in `StationRepository.replaceAll`).
- DDL belongs in versioned migrations (`infrastructure/migrations/`), never
  in services. Keep the `MIGRATIONS` registry ordered.
- Crons belong in `jobs/` (scheduler + job wrappers). Services expose `load*`
  logic with no scheduling side effects.

## Tests

- Runner: `vitest` (`test:unit`, `test:e2e`, `test:integration`,
  `test:coverage`). Typecheck (`ttsc --noEmit`) must pass with every change.
- Layout mirrors `src`: `tests/unit/<layer-path>/<Name>.spec.ts`. E2E and
  integration live in `tests/e2e` / `tests/integration` with shared boot in
  `tests/e2e/setup.ts` and seeds in `tests/integration/helpers.ts`.
- Mock at the repository seam (`stationRepository`, `historicRepository`,
  `municipalitiesRepository`, use cases), never the database. Seeds for
  e2e/integration use `ensureMemorySchema()` + direct Drizzle inserts over the
  memory tables + `replaceAll` for municipalities.
- New/changed behavior ships with its tests in the same commit. Target ~100%
  statements/branches/functions; genuinely uncoverable lines (type-only files,
  provably-impossible branches) are documented in the commit/PR, not gamed
  with vacuous tests.
- For behavior changes, write the failing test first (RED), then the minimal
  implementation (GREEN), then refactor with tests green.

## Commits & delivery

- Conventional Commits (`refactor(data): …`, `fix(…): …`, `test(coverage): …`,
  `chore(…)`, `refactor!: …` for breaking internal removals).
- Keep work units reviewable (~400 authored lines); larger features ride a
  `feature/*` branch chain. Never commit with failing tests or typecheck.
- Regenerate MCP docs when tools change (`generate:mcp-docs`, paths point at
  `src/interfaces/mcp/`). Keep `ARCHITECTURE.md`/`CONVENTIONS.md` and the
  OpenAPI/MCP docs alongside the code they describe.
