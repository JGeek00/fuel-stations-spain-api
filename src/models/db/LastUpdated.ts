import type BetterSqlite3 from 'better-sqlite3';
import { count as drizzleCount, getTableColumns } from 'drizzle-orm';
import { getMemoryDb, getMemorySqlite, lastUpdatedTable, MemoryRow } from './memory-db';

export interface LastUpdatedAttributes {
  lastUpdated: Date;
}

/**
 * Typing shell replacing the removed Sequelize `Model` base: every member is
 * declaration-only, and the Drizzle adapter Object.assign'd below provides the
 * real behavior over the shared `:memory:` database.
 */
export class LastUpdated {
  declare dataValues: LastUpdatedAttributes;
  declare get: (options?: { plain?: boolean }) => LastUpdatedAttributes;
  declare getDataValue: <K extends keyof LastUpdatedAttributes>(key: K) => LastUpdatedAttributes[K];

  declare static init: (...args: unknown[]) => void;
  declare static findAll: () => Promise<LastUpdated[]>;
  declare static findOne: () => Promise<LastUpdated | null>;
  declare static count: () => Promise<number>;
  declare static truncate: () => Promise<void>;
  declare static create: (values: { lastUpdated: Date }) => Promise<LastUpdated>;
}

// Legacy column map kept only so DatabaseService keeps passing the model into
// the adapter's init() (database.service.spec pins that call shape); the real
// table definition is the single source of truth in memory-db.ts.
export const LastUpdatedModel = getTableColumns(lastUpdatedTable);

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
