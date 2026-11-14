import type BetterSqlite3 from 'better-sqlite3';
import { count as drizzleCount, getTableColumns } from "drizzle-orm";
import { FuelStation } from "../entities/FuelStation.model";
import { fuelStationsTable, getMemoryDb, getMemorySqlite, MemoryRow, resetMemoryDb, translateOrder, translateWhere, type MemoryTable } from './memory-db';

/**
 * Typing shell replacing the removed Sequelize `Model` base: every member is
 * declaration-only, and the Drizzle adapter Object.assign'd below provides the
 * real behavior (init/findAll/findOne/findAndCountAll/count/truncate/
 * bulkCreate/create over the shared `:memory:` database).
 */
export class FuelStationsTable {
  declare dataValues: FuelStation;
  declare get: (options?: { plain?: boolean }) => FuelStation;
  declare getDataValue: <K extends keyof FuelStation>(key: K) => FuelStation[K];

  declare static init: (...args: unknown[]) => void;
  declare static findAll: (options?: FuelStationsFindOptions) => Promise<FuelStationsTable[]>;
  declare static findOne: (options?: FuelStationsFindOptions) => Promise<FuelStationsTable | null>;
  declare static findAndCountAll: (options?: FuelStationsFindOptions) => Promise<{ rows: FuelStationsTable[]; count: number }>;
  declare static count: () => Promise<number>;
  declare static truncate: () => Promise<void>;
  declare static bulkCreate: (values: Record<string, unknown>[]) => Promise<FuelStationsTable[]>;
  declare static create: (values: Record<string, unknown>) => Promise<FuelStationsTable>;
}

// Legacy column map kept only so DatabaseService keeps passing the model into
// the adapter's init() (database.service.spec pins that call shape); the real
// table definition is the single source of truth in memory-db.ts.
export const FuelStationModel = getTableColumns(fuelStationsTable);

const ensureFuelStationsTable = (sqlite: BetterSqlite3.Database): void => {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS fuel_stations (
  id TEXT PRIMARY KEY,
  stationId TEXT,
  postalCode TEXT,
  address TEXT,
  openingHours TEXT,
  latitude REAL,
  longitude REAL,
  locality TEXT,
  margin TEXT,
  municipality TEXT,
  province TEXT,
  referral TEXT,
  signage TEXT,
  saleType TEXT,
  percBioEthanol TEXT,
  percMethylEster TEXT,
  municipalityId INTEGER,
  provinceId INTEGER,
  regionId INTEGER,
  adbluePrice REAL,
  ammoniaPrice REAL,
  biodieselPrice REAL,
  bioethanolPrice REAL,
  compressedBiogasPrice REAL,
  liquefiedBiogasPrice REAL,
  renewableDieselPrice REAL,
  cngPrice REAL,
  lngPrice REAL,
  lpgPrice REAL,
  gasoilAPrice REAL,
  gasoilBPrice REAL,
  premiumGasoilPrice REAL,
  gasoline95E10Price REAL,
  gasoline95E25Price REAL,
  gasoline95E5Price REAL,
  gasoline95E5PremiumPrice REAL,
  gasoline95E85Price REAL,
  gasoline98E10Price REAL,
  gasoline98E5Price REAL,
  renewableGasolinePrice REAL,
  hydrogenPrice REAL,
  methanolPrice REAL
)`);
};

// Tables exist from module load so pre-init queries work too.
ensureFuelStationsTable(getMemorySqlite());

interface FuelStationsFindOptions {
  where?: Record<string, unknown>;
  attributes?: (keyof FuelStation)[];
  order?: unknown[][];
  limit?: number;
  offset?: number;
}

const table = fuelStationsTable as unknown as MemoryTable;

const runSelect = (options: FuelStationsFindOptions) => {
  const db = getMemoryDb();
  const base = options.attributes?.length
    ? db.select(Object.fromEntries(options.attributes.map((attribute) => [attribute, table[attribute]])))
    : db.select();

  let query = base.from(fuelStationsTable).where(translateWhere(table, options.where));

  const orderBy = translateOrder(table, options.order);
  if (orderBy.length > 0) {
    query = query.orderBy(...orderBy);
  }
  // Controllers pass limit/offset straight from query params (strings); sqlite
  // rejects a text bind in LIMIT/OFFSET, so coerce like Sequelize did.
  if (options.limit !== undefined) {
    query = query.limit(Number(options.limit));
  }
  if (options.offset !== undefined) {
    query = query.offset(Number(options.offset));
  }
  return query;
};

const rowOf = (values: Record<string, unknown>) => new MemoryRow(values) as unknown as FuelStationsTable;

const findAll = async (options: FuelStationsFindOptions = {}) =>
  (await runSelect(options)).map(rowOf);

const findOne = async (options: FuelStationsFindOptions = {}) => {
  const rows = await runSelect({ ...options, limit: 1 });
  return rows.length > 0 ? rowOf(rows[0]) : null;
};

const count = async () => {
  const [row] = await getMemoryDb().select({ value: drizzleCount() }).from(fuelStationsTable);
  return row.value as number;
};

const findAndCountAll = async (options: FuelStationsFindOptions = {}) => {
  const rows = await runSelect(options);
  const [countRow] = await getMemoryDb().select({ value: drizzleCount() }).from(fuelStationsTable).where(translateWhere(table, options.where));
  return { rows: rows.map(rowOf), count: countRow.value as number };
};

const truncate = async () => {
  // Drizzle query builders are lazy promise-likes: they only run when awaited.
  await getMemoryDb().delete(fuelStationsTable);
};

const bulkCreate = async (values: Record<string, unknown>[]) => {
  if (values.length === 0) return [];
  const rows = await getMemoryDb().insert(fuelStationsTable).values(values).returning();
  return rows.map(rowOf);
};

const create = async (values: Record<string, unknown>) => {
  const [row] = await getMemoryDb().insert(fuelStationsTable).values(values).returning();
  return rowOf(row);
};

/**
 * Drizzle-backed adapter replacing the Sequelize statics. Every `init()` call
 * swaps in a fresh better-sqlite3 `:memory:` database (same isolation the
 * Sequelize per-instance setup gave each spec), then recreates the tables.
 */
Object.assign(FuelStationsTable, {
  init: () => {
    resetMemoryDb();
    ensureFuelStationsTable(getMemorySqlite());
  },
  findAll,
  findOne,
  count,
  findAndCountAll,
  truncate,
  bulkCreate,
  create,
});
