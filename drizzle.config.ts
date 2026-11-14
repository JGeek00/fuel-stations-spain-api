import { defineConfig, type Config } from 'drizzle-kit';

// Drizzle-kit config for the persisted (Postgres) schema. The memory tables are
// better-sqlite3 and are intentionally NOT part of this config. `drizzle-kit`
// itself is added with the T8 dependency cleanup; the migration registry in
// src/migrations/ runs through migration.service in the meantime.
// Explicit Config annotation: drizzle-kit exports no portable inferred type.
const config: Config = {
  dialect: 'postgresql',
  schema: [
    './src/models/db/HistoricFuelStation.ts',
    './src/models/db/HistoricNoData.ts',
    './src/models/db/Migrations.ts',
  ],
  out: './drizzle',
};

export default defineConfig(config);
