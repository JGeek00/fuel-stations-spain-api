import type BetterSqlite3 from 'better-sqlite3';
import { DataTypes, Model } from "sequelize";
import { count as drizzleCount } from "drizzle-orm";
import { sqliteTable, text, integer, real, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { FuelStation } from "../entities/FuelStation.model";
import { getMemoryDb, getMemorySqlite, MemoryRow, resetMemoryDb, translateOrder, translateWhere, type MemoryTable } from './memory-db';

export class FuelStationsTable extends Model<FuelStation> {}

export const FuelStationModel = {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  stationId: DataTypes.STRING,
  postalCode: DataTypes.STRING,
  address: DataTypes.STRING,
  openingHours: DataTypes.STRING,
  latitude: DataTypes.FLOAT,
  longitude: DataTypes.FLOAT,
  locality: DataTypes.STRING,
  margin: DataTypes.STRING,
  municipality: DataTypes.STRING,
  province: DataTypes.STRING,
  referral: DataTypes.STRING,
  signage: DataTypes.STRING,
  saleType: DataTypes.STRING,
  percBioEthanol: DataTypes.STRING,
  percMethylEster: DataTypes.STRING,
  municipalityId: DataTypes.INTEGER,
  provinceId: DataTypes.INTEGER,
  regionId: DataTypes.INTEGER,
  adbluePrice: DataTypes.FLOAT,
  ammoniaPrice: DataTypes.FLOAT,
  biodieselPrice: DataTypes.FLOAT,
  bioethanolPrice: DataTypes.FLOAT,
  compressedBiogasPrice: DataTypes.FLOAT,
  liquefiedBiogasPrice: DataTypes.FLOAT,
  renewableDieselPrice: DataTypes.FLOAT,
  cngPrice: DataTypes.FLOAT,
  lngPrice: DataTypes.FLOAT,
  lpgPrice: DataTypes.FLOAT,
  gasoilAPrice: DataTypes.FLOAT,
  gasoilBPrice: DataTypes.FLOAT,
  premiumGasoilPrice: DataTypes.FLOAT,
  gasoline95E10Price: DataTypes.FLOAT,
  gasoline95E25Price: DataTypes.FLOAT,
  gasoline95E5Price: DataTypes.FLOAT,
  gasoline95E5PremiumPrice: DataTypes.FLOAT,
  gasoline95E85Price: DataTypes.FLOAT,
  gasoline98E10Price: DataTypes.FLOAT,
  gasoline98E5Price: DataTypes.FLOAT,
  renewableGasolinePrice: DataTypes.FLOAT,
  hydrogenPrice: DataTypes.FLOAT,
  methanolPrice: DataTypes.FLOAT,
}

const fuelStations = sqliteTable('fuel_stations', {
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

const table = fuelStations as unknown as MemoryTable;

const runSelect = (options: FuelStationsFindOptions) => {
  const db = getMemoryDb();
  const base = options.attributes?.length
    ? db.select(Object.fromEntries(options.attributes.map((attribute) => [attribute, table[attribute]])))
    : db.select();

  let query = base.from(fuelStations).where(translateWhere(table, options.where));

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
  const [row] = await getMemoryDb().select({ value: drizzleCount() }).from(fuelStations);
  return row.value as number;
};

const findAndCountAll = async (options: FuelStationsFindOptions = {}) => {
  const rows = await runSelect(options);
  const [countRow] = await getMemoryDb().select({ value: drizzleCount() }).from(fuelStations).where(translateWhere(table, options.where));
  return { rows: rows.map(rowOf), count: countRow.value as number };
};

const truncate = async () => {
  // Drizzle query builders are lazy promise-likes: they only run when awaited.
  await getMemoryDb().delete(fuelStations);
};

const bulkCreate = async (values: Record<string, unknown>[]) => {
  if (values.length === 0) return [];
  const rows = await getMemoryDb().insert(fuelStations).values(values).returning();
  return rows.map(rowOf);
};

const create = async (values: Record<string, unknown>) => {
  const [row] = await getMemoryDb().insert(fuelStations).values(values).returning();
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
