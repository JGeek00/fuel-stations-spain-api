import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Op } from 'sequelize';
import { and, asc, between, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { integer, real, sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { HistoricFuelStation } from './HistoricFuelStation';

/**
 * Shared better-sqlite3 `:memory:` database behind the FuelStations/LastUpdated
 * Drizzle tables. A fresh `:memory:` database is swapped in on every model
 * `init()` call, restoring the per-instance isolation Sequelize gave tests
 * (fresh `new Sequelize({ storage: ':memory:' })` per setup).
 */
export const memorySqlite: BetterSqlite3.Database = new Database(':memory:');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const memoryDb = drizzle(memorySqlite) as any;

let active = { sqlite: memorySqlite as BetterSqlite3.Database, db: memoryDb };

export const getMemorySqlite = (): BetterSqlite3.Database => active.sqlite;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getMemoryDb = (): any => active.db;

export const resetMemoryDb = (): void => {
  const sqlite = new Database(':memory:');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active = { sqlite, db: drizzle(sqlite) as any };
  ensureHistoricTable(sqlite);
};

export type MemoryTable = Record<string, AnySQLiteColumn>;

// ── Drizzle table definitions shared by controllers and MCP tools ──────────
// FuelStations.ts / LastUpdated.ts keep identical private defs for the model
// adapters; these mirror them (same table/column names) so consumers can build
// Drizzle queries directly without importing Sequelize models.
export const fuelStationsTable = sqliteTable('fuel_stations', {
  id: text('id').primaryKey(),
  stationId: text('stationId'),
  postalCode: text('postalCode'),
  address: text('address'),
  openingHours: text('openingHours'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  locality: text('locality'),
  margin: text('margin'),
  municipality: text('municipality'),
  province: text('province'),
  referral: text('referral'),
  signage: text('signage'),
  saleType: text('saleType'),
  percBioEthanol: text('percBioEthanol'),
  percMethylEster: text('percMethylEster'),
  municipalityId: integer('municipalityId'),
  provinceId: integer('provinceId'),
  regionId: integer('regionId'),
  adbluePrice: real('adbluePrice'),
  ammoniaPrice: real('ammoniaPrice'),
  biodieselPrice: real('biodieselPrice'),
  bioethanolPrice: real('bioethanolPrice'),
  compressedBiogasPrice: real('compressedBiogasPrice'),
  liquefiedBiogasPrice: real('liquefiedBiogasPrice'),
  renewableDieselPrice: real('renewableDieselPrice'),
  cngPrice: real('cngPrice'),
  lngPrice: real('lngPrice'),
  lpgPrice: real('lpgPrice'),
  gasoilAPrice: real('gasoilAPrice'),
  gasoilBPrice: real('gasoilBPrice'),
  premiumGasoilPrice: real('premiumGasoilPrice'),
  gasoline95E10Price: real('gasoline95E10Price'),
  gasoline95E25Price: real('gasoline95E25Price'),
  gasoline95E5Price: real('gasoline95E5Price'),
  gasoline95E5PremiumPrice: real('gasoline95E5PremiumPrice'),
  gasoline95E85Price: real('gasoline95E85Price'),
  gasoline98E10Price: real('gasoline98E10Price'),
  gasoline98E5Price: real('gasoline98E5Price'),
  renewableGasolinePrice: real('renewableGasolinePrice'),
  hydrogenPrice: real('hydrogenPrice'),
  methanolPrice: real('methanolPrice'),
});

export const lastUpdatedTable = sqliteTable('last_updated', {
  lastUpdated: text('lastUpdated').primaryKey(),
});

export const historicFuelStationsTable = sqliteTable('historic_data', {
  id: text('id').primaryKey(),
  stationId: text('stationId'),
  stationSignage: text('stationSignage'),
  adbluePrice: real('adbluePrice'),
  ammoniaPrice: real('ammoniaPrice'),
  biodieselPrice: real('biodieselPrice'),
  bioethanolPrice: real('bioethanolPrice'),
  compressedBiogasPrice: real('compressedBiogasPrice'),
  liquefiedBiogasPrice: real('liquefiedBiogasPrice'),
  renewableDieselPrice: real('renewableDieselPrice'),
  cngPrice: real('cngPrice'),
  lngPrice: real('lngPrice'),
  lpgPrice: real('lpgPrice'),
  gasoilAPrice: real('gasoilAPrice'),
  gasoilBPrice: real('gasoilBPrice'),
  premiumGasoilPrice: real('premiumGasoilPrice'),
  gasoline95E10Price: real('gasoline95E10Price'),
  gasoline95E25Price: real('gasoline95E25Price'),
  gasoline95E5Price: real('gasoline95E5Price'),
  gasoline95E5PremiumPrice: real('gasoline95E5PremiumPrice'),
  gasoline95E85Price: real('gasoline95E85Price'),
  gasoline98E10Price: real('gasoline98E10Price'),
  gasoline98E5Price: real('gasoline98E5Price'),
  renewableGasolinePrice: real('renewableGasolinePrice'),
  hydrogenPrice: real('hydrogenPrice'),
  methanolPrice: real('methanolPrice'),
  date: text('date'),
});

const ensureHistoricTable = (sqlite: BetterSqlite3.Database): void => {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS historic_data (
  id TEXT PRIMARY KEY,
  stationId TEXT,
  stationSignage TEXT,
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
  methanolPrice REAL,
  date TEXT
)`);
};

// Table exists from module load so pre-init queries work too.
ensureHistoricTable(getMemorySqlite());

/**
 * Routes the HistoricFuelStation statics used by the historic e2e seeds
 * (init/truncate/bulkCreate) to the shared memory DB this controller reads, so
 * both sides see the same rows without touching the e2e files. The persisted
 * PG wiring stays detached until T6 wires Drizzle pg for historic_data.
 */
export function installHistoricFuelStationAdapter(): void {
  Object.assign(HistoricFuelStation, {
    init: () => {
      ensureHistoricTable(getMemorySqlite());
      // The connection middleware reads HistoricFuelStation.sequelize; point it
      // at a no-op stub so requests pass while the memory table is the backend.
      Object.defineProperty(HistoricFuelStation, 'sequelize', {
        value: { authenticate: async () => undefined },
        writable: true,
        configurable: true,
      });
    },
    truncate: async () => {
      // Drizzle query builders are lazy promise-likes: they only run when awaited.
      await getMemoryDb().delete(historicFuelStationsTable);
    },
    bulkCreate: async (values: Record<string, unknown>[]) => {
      if (values.length === 0) return [];
      return getMemoryDb().insert(historicFuelStationsTable).values(values).returning();
    },
  });
}

/**
 * Minimal Sequelize model-instance lookalike returned by the memory DB
 * adapters: consumers only use `dataValues`, `get({ plain: true })` and
 * `getDataValue(key)`.
 */
export class MemoryRow<T extends Record<string, unknown>> {
  dataValues: T;

  constructor(values: T) {
    this.dataValues = values;
  }

  get(_options?: { plain?: boolean }): T {
    return { ...this.dataValues };
  }

  getDataValue<K extends keyof T>(key: K): T[K] {
    return this.dataValues[key];
  }
}

type SequelizeStyleWhere = Record<string, unknown>;

/** Translate a Sequelize-style where object ({col, [Op.between], [Op.in]}) into Drizzle conditions. */
export function translateWhere(table: MemoryTable, where?: SequelizeStyleWhere): SQL | undefined {
  if (!where) return undefined;

  const conditions: SQL[] = [];
  for (const [key, value] of Object.entries(where)) {
    const column = table[key];
    if (!column) {
      throw new Error(`Unknown column "${key}" in memory DB query`);
    }
    const record = value as Record<symbol, unknown>;
    if (Array.isArray(value)) {
      conditions.push(inArray(column, value));
    } else if (value !== null && typeof value === 'object' && Op.between in record) {
      const [min, max] = record[Op.between] as [unknown, unknown];
      conditions.push(between(column, min as never, max as never));
    } else if (value !== null && typeof value === 'object' && Op.in in record) {
      conditions.push(inArray(column, record[Op.in] as never));
    } else if (value !== null && typeof value === 'object' && Op.eq in record) {
      conditions.push(eq(column, record[Op.eq] as never));
    } else if (value !== null && typeof value === 'object') {
      throw new Error(`Unsupported memory DB where operator for column "${key}"`);
    } else {
      conditions.push(eq(column, value as never));
    }
  }

  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

/** Translate a Sequelize-style order ([col, 'ASC'|'DESC']) into Drizzle orderBy entries. */
export function translateOrder(table: MemoryTable, order?: unknown[][]): SQL[] {
  if (!order) return [];
  return order.map(([column, direction]) => {
    const col = table[column as string];
    if (!col) {
      throw new Error(`Unknown order column "${String(column)}" in memory DB query`);
    }
    return String(direction).toUpperCase() === 'DESC' ? desc(col) : asc(col);
  });
}
