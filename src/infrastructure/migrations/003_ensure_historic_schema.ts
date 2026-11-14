import { sql } from 'drizzle-orm';
import { Migration } from '@/domain/entities';
import { ensurePersistedSchema } from '@/infrastructure/persistence/ensurePersistedSchema';

const migration: Migration = {
  version: '003',
  name: 'ensure_historic_schema',
  up: async (db) => {
    await ensurePersistedSchema(db);
  },
  down: async (db) => {
    await db.execute(sql`DROP TABLE IF EXISTS historic_no_data`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_historic_station_date`);
  },
};

export default migration;
