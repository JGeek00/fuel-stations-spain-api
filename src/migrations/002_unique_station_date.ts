import { sql } from 'drizzle-orm';
import { Migration } from '@/models/entities';

const INDEX_NAME = 'idx_historic_station_date';

const migration: Migration = {
  version: '002',
  name: 'unique_station_date',
  up: async (db) => {
    await db.execute(sql`CREATE UNIQUE INDEX ${sql.identifier(INDEX_NAME)} ON historic_data ("stationId", "date")`);
    await db.execute(sql`CREATE TABLE historic_no_data ("date" DATE PRIMARY KEY)`);
  },
  down: async (db) => {
    await db.execute(sql`DROP TABLE IF EXISTS historic_no_data`);
    await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(INDEX_NAME)}`);
  },
};

export default migration;
