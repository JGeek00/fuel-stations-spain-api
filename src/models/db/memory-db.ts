import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Shared better-sqlite3 `:memory:` database behind the realtime Drizzle
 * tables. `resetMemoryDb()` swaps in a fresh `:memory:` database (per-test
 * isolation); `ensureMemorySchema()` in infrastructure also recreates the
 * fuel_stations + last_updated tables.
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
  ensureHistoricNoDataTable(sqlite);
};

// Marks whether the persisted/historic side is initialized (set by
// database.service after the PG pool authenticates, or by test seeds that
// run against the memory historic tables).
let persistedDbInitialized = false;
export const markPersistedDbInitialized = (): void => {
  persistedDbInitialized = true;
};
export const isPersistedDbInitialized = (): boolean => persistedDbInitialized;

// Drizzle-pg handle installed by database.service.initPersistedDb on success.
// Null when PG is not configured/reachable: readers fall back to memory (S1).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let persistedPg: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setPersistedDb = (db: any): void => {
  persistedPg = db;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPersistedDb = (): any => persistedPg;

// ── Drizzle table definitions: single source of truth ─────────────────────
// Owned by the data layer: repositories query these tables, never raw SQL
// in controllers, tools, services or jobs.
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

export const historicNoDataTable = sqliteTable('historic_no_data', {
  date: text('date').primaryKey(),
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
  date TEXT,
  UNIQUE(stationId, date)
)`);
};

const ensureHistoricNoDataTable = (sqlite: BetterSqlite3.Database): void => {
  sqlite.exec('CREATE TABLE IF NOT EXISTS historic_no_data (date TEXT PRIMARY KEY)');
};

// Table exists from module load so pre-init queries work too.
ensureHistoricTable(getMemorySqlite());
ensureHistoricNoDataTable(getMemorySqlite());


