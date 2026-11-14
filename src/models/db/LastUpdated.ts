import type BetterSqlite3 from 'better-sqlite3';
import { count as drizzleCount } from 'drizzle-orm';
import { DataTypes, Model } from "sequelize";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { getMemoryDb, getMemorySqlite, MemoryRow } from './memory-db';

export interface LastUpdatedAttributes {
  lastUpdated: Date;
}

export class LastUpdated extends Model<LastUpdatedAttributes> {}

export const LastUpdatedModel = {
  lastUpdated: {
    type: DataTypes.DATE,
    primaryKey: true
  }
}

const lastUpdatedTable = sqliteTable('last_updated', {
  lastUpdated: text('lastUpdated').primaryKey(),
});

const ensureLastUpdatedTable = (sqlite: BetterSqlite3.Database): void => {
  sqlite.exec('CREATE TABLE IF NOT EXISTS last_updated (lastUpdated TEXT PRIMARY KEY)');
};

// Table exists from module load so pre-init queries work too.
ensureLastUpdatedTable(getMemorySqlite());

// Dates are stored as ISO strings (sqlite has no DATE type) and surfaced as
// Date objects, matching the previous Sequelize DATE behavior.
const toRow = (raw: { lastUpdated: string | Date }) =>
  new MemoryRow({
    lastUpdated: raw.lastUpdated instanceof Date ? raw.lastUpdated : new Date(raw.lastUpdated),
  }) as unknown as LastUpdated;

const findAll = async () => {
  const rows = await getMemoryDb().select().from(lastUpdatedTable);
  return rows.map(toRow);
};

const findOne = async () => {
  const rows = await getMemoryDb().select().from(lastUpdatedTable).limit(1);
  return rows.length > 0 ? toRow(rows[0]) : null;
};

const count = async () => {
  const [row] = await getMemoryDb().select({ value: drizzleCount() }).from(lastUpdatedTable);
  return row.value as number;
};

const truncate = async () => {
  // Drizzle query builders are lazy promise-likes: they only run when awaited.
  await getMemoryDb().delete(lastUpdatedTable);
};

const create = async (values: { lastUpdated: Date }) => {
  const stored = values.lastUpdated instanceof Date ? values.lastUpdated.toISOString() : values.lastUpdated;
  await getMemoryDb().insert(lastUpdatedTable).values({ lastUpdated: stored });
  return toRow({ lastUpdated: stored });
};

/**
 * Drizzle-backed adapter replacing the Sequelize statics. `init` ensures the
 * table on the active memory database (FuelStationsTable.init, when called
 * first, swaps in the fresh database for this spec/instance).
 */
Object.assign(LastUpdated, {
  init: () => {
    ensureLastUpdatedTable(getMemorySqlite());
  },
  findAll,
  findOne,
  count,
  truncate,
  create,
});
