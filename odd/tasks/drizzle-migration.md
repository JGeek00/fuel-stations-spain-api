# Migración Sequelize v6 + sqlite3 → Drizzle + better-sqlite3/pg

Plan por slices que mantiene el contrato de salida intacto y usa los e2e/integration existentes como guardianes. Sin cambios en `src/models/out/`.
Sin commits todavía — este documento es el plan.

## Specs

- S1: "el modelo de datos de salida de los endpoint debe mantenerse intacto"
- S2: "Puedes basarte en los test existentes para verificar que la funcionalidad sigue igual después de la migración"
- S3: "El sustituto es better-sqlite3."
- S4: "si hubiera que migrar a otro ORM, analiza las alternativas" — decisión: Drizzle ORM (recomendación #1 del análisis previo)

## Tasks

- T1 (S2): Slice 0 baseline — correr `pnpm test` completo y dejar constancia verde antes de tocar nada — route: inline — commit: —
- T2 (S1,S2): Slice 1 cero-DB — municipalities + healthcheck unit + mcp unit + case-keys como contrato de normalización, sin cambios funcionales — route: inline — commit: —
- T3 (S1,S2,S3): Slice 2 memory DB — Drizzle `better-sqlite3` `:memory:` para FuelStations + LastUpdated; reescribir solo `tests/e2e/setup.ts` + seeds (`insert().values()`, `delete()` en vez de `truncate`); e2e service-stations/health/historic-prices/mcp en verde byte-por-byte — route: worker — commit: —
- T4 (S1,S2): Slice 3 controllers — `Op.between`→`between`, `Op.in`→`inArray`, `findAndCountAll`→`select+count`, `attributes.exclude`→proyección explícita; mantener `...row` + `stationId → id` + `keysToCamel`; specs de response-format intactos — route: worker — commit: —
- T5 (S1,S2): Slice 4 servicios datos — realtime/persisted-data: `.get({plain:true})`/`dataValues`→rows planas, `sequelize.fn(DISTINCT,col)`→helper Drizzle, `conflict:{target,action:'ignore'}`→`onConflictDoNothing()`; integration realtime/persisted en verde — route: worker — commit: —
- T6 (S2,S3): Slice 5 migraciones + persisted pg — Drizzle `pg` para historic_data/historic_no_data/migrations; portar 001/002 a migraciones SQL Drizzle (Postgres); migration.service specs + database.service.spec al final — route: worker — commit: —
- T7 (S1,S2): Slice 6 gaps contrato — agregar solo 2 asserts: shape completa de un result en service-stations.e2e (`Object.keys(result)`) y precio nulo en historic e2e; nada más — route: inline — commit: —
- T8 (S3): Slice 7 limpieza — quitar `sequelize`+`sqlite3`, agregar `drizzle-orm`+`better-sqlite3`+`drizzle-kit`, quitar `allowBuilds: sqlite3` de `pnpm-workspace.yaml`, actualizar Dockerfile si compila sqlite3 — route: inline — commit: —

## Log

- L1: "Este proyecto actualmente usa sequelize, pero sequelize hace tiempo que no recibe actualizaciones. De hecho utiliza como peer dependency sqlite3, que también está descontinuado y tiene vulnerabilidades de seguridad. El sustituto es better-sqlite3. Analiza la situación y mira a ver cual es la mejor opción para solventar este problema, si hubiera que migrar a otro ORM, analiza las alternativas"
- L2: "Una cosa importante es que el modelo de datos de salida de los endpoint debe mantenerse intacto"
- L3: "Elabora el plan de migración. Puedes basarte en los test existentes para verificar que la funcionalidad sigue igual después de la migración"
- L4: Inventario tests (subagente): e2e service-stations (shape `{lastUpdated,count,results}`, `id` sin `stationId`, limit/offset, 400/404/500), historic-prices (array ASC camelCase sin `id`, `includeCurrentPrices` con `id` actual), health, mcp (8 tools, `find_cheapest_fuel`), municipalities (igualdad profunda, sin DB); acoplados a Sequelize: `database.service.spec` (mock constructor), controllers (`Op.*`), `persisted/realtime` (`.get/dataValues`, `fn/col`), `controller-mocks.ts:121-135`; gaps: shape completa de FuelStation (30+ campos) y precio nulo sin pinar. Orden slices validado T1→T7.
- L5 T3 done: memory DB Drizzle+better-sqlite3 (memory-db.ts nuevo, FuelStations/LastUpdated adapters, database.service initMemoryDb, setup.ts doc). Verificado: 55/55 e2e (service-stations, health, mcp, case-keys, historic-prices, municipalities) + typecheck limpio. Fallout conocido: database.service.spec 4/12 en rojo (constructor Sequelize), va a T6.
