import type BetterSqlite3 from 'better-sqlite3';
import { getMemorySqlite, resetMemoryDb } from '@/models/db/memory-db';

const FUEL_STATIONS_DDL = `CREATE TABLE IF NOT EXISTS fuel_stations (
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
)`;

const LAST_UPDATED_DDL = 'CREATE TABLE IF NOT EXISTS last_updated (lastUpdated TEXT PRIMARY KEY)';

/**
 * Ensures the memory (realtime) schema on a fresh :memory: database.
 * Replaces the legacy `FuelStationsTable.init(model)` / `LastUpdated.init()`
 * adapter calls (T-legacy): same fresh-DB-per-init semantics the specs pin,
 * without the Sequelize-style shells.
 */
export function ensureMemorySchema(): void {
  resetMemoryDb();
  const sqlite: BetterSqlite3.Database = getMemorySqlite();
  sqlite.exec(FUEL_STATIONS_DDL);
  sqlite.exec(LAST_UPDATED_DDL);
}
