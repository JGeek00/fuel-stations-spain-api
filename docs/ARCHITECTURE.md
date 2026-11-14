# Architecture

Layered architecture of the Fuel Stations Spain API. The rule in one sentence:
**HTTP and MCP are thin I/O adapters, use cases own the business logic, repositories
own all database I/O, and scheduled jobs are wired in one place.**

```
src/
├── server.ts, express.ts, bootstrap.ts   # composition root (wiring only)
├── interfaces/
│   ├── http/          # REST I/O: controllers, routes, validations,
│   │                  # middlewares, dto/{in,out}
│   └── mcp/           # MCP I/O: server, tools, resources, routes
├── application/       # use cases + ports (no Express, no MCP, no Drizzle)
├── domain/            # entities (pure types, no dependencies)
├── infrastructure/
│   ├── persistence/   # THE ONLY place with Drizzle/table definitions,
│   │                  # repositories and schema helpers
│   ├── database/      # connection factory (DatabaseService) + migration runner
│   ├── migrations/    # versioned DDL (001, 002, 003, …)
│   ├── providers/     # external APIs (Minetur) + their DTOs
│   ├── mappers/       # external DTO → domain entity mapping
│   ├── sync/          # load logic for scheduled syncs (no cron here)
│   └── observability/ # Sentry
├── jobs/              # scheduled work: scheduler + job wrappers (own the crons)
└── shared/            # config, utils, errors (dependency-free helpers)
```

## Dependency rules

Dependencies point **inward** only:

`interfaces` → `application` → `infrastructure`/`domain`; `shared` ← everyone;
`domain` ← everyone; nothing points outward.

Concretely enforced (and verified by review/tests):

| Layer | May import | Must never import |
|---|---|---|
| `interfaces/*` | `application`, `domain`, `shared` | `drizzle-orm`, `models/db`, `infrastructure/persistence` internals |
| `application/*` | `infrastructure` (repos only), `domain`, `shared` | Express, MCP SDK, `drizzle-orm` |
| `infrastructure/*` | `domain`, `shared` | `interfaces` |
| `jobs/*` | `application`, `infrastructure`, `shared` | `interfaces` |
| `domain/*` | nothing (types only) | anything |

- The **only** Drizzle imports live in `infrastructure/persistence`
  (`memory-db.ts` tables + `pg-tables.ts`, repositories, schema helpers).
- The **only** `getMemoryDb`/`getPersistedDb` readers are the repositories and
  the `DatabaseService` connection factory. Services, jobs, controllers and MCP
  tools never touch them.
- Repositories expose the seams; use cases and jobs depend on the repository
  singletons, never on tables.

## Request flows

**REST** `routes → validations → controller → useCase → repository → DB`,
then the controller presents the result. Controllers validate input
(express-validator result), delegate, and map errors to HTTP status.

**MCP** `tool → useCase → repository → DB`, then the tool serializes the
result. Tools share the **same** use cases as REST, so both I/Os return the
same shapes. Each tool/resource registers in `interfaces/mcp/server.ts`.

**Realtime sync** `jobs/scheduler.ts → RealtimeSync.job → realtime-data.service
→ FuelStationsMapper + stationRepository.replaceAll / municipalitiesRepository`.
Bulk writes go in 500-row chunks (a single ~13k-row INSERT overflows Drizzle's
query builder). Failures restore the previous snapshot and rethrow.

**Historic backfill** `scheduler.ts → HistoricBackfill.job → persisted-data.service
→ historicRepository` (hole detection, 7-day batches, `onConflictDoNothing`,
no-data marking). The PG-vs-memory choice lives in **exactly one place**:
`HistoricRepository.backend()`.

**Database status** `getDatabaseStatusUseCase` prefers the injected
`DatabaseService.persistedDbInstance` seam and falls back to the global
persisted handle. The `database-connection` middleware gates the historic
endpoint via `historicRepository.isReady()` + `ping()`.

## Composition root

`server.ts` does, in order: validate env → `databaseService.init()`
(connections + schema only, **no jobs**) → `startScheduledJobs()` (initial
loads + cron registration) → `McpServerManager` → `initExpress`. Cron
registration lives in `jobs/*`, never inside the DB wiring.

## Persistence & migrations

- Memory (realtime) tables: `infrastructure/persistence/memory-db.ts`
  (better-sqlite3 `:memory:`), schema ensured by `ensureMemorySchema.ts`.
- Persisted (historic, Postgres) tables: `pg-tables.ts`; DDL owned by
  versioned migrations in `infrastructure/migrations/` and ensured by
  `ensurePersistedSchema.ts`. Never put raw DDL in services.
- Single sources of truth: 25-column historic projection and fuel-field name
  list live in `infrastructure/persistence/` (`fuel-fields.ts`,
  `HistoricRepository`), shared by REST and MCP — never duplicated.

## Delivery

Work lands in reviewable slices on feature branches (`feature-branch-chain`
when a change exceeds ~400 authored lines). Push, PR creation and merge stay
human decisions. Native review (RDD) runs per work-unit commit or PR slice.
