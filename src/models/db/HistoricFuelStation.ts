import { date, doublePrecision, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { HistoricPrice } from "@/models/entities";

/**
 * Typing shell replacing the removed Sequelize `Model` base: every member is
 * declaration-only. The real behavior comes from the memory-DB adapter
 * Object.assign'd by memory-db.ts (installHistoricFuelStationAdapter) and the
 * Drizzle-pg table `pgHistoricData` below; `sequelize` is only the liveness
 * seam the connection middleware reads.
 */
export class HistoricFuelStation {
  declare dataValues: HistoricPrice;
  declare get: (options?: { plain?: boolean }) => HistoricPrice;
  declare getDataValue: <K extends keyof HistoricPrice>(key: K) => HistoricPrice[K];

  // Liveness seam: a { authenticate } object installed by the adapters
  // (memory stub or real pool in database.service).
  declare static sequelize: { authenticate: () => Promise<unknown> } | undefined;

  declare static init: (...args: unknown[]) => void;
  declare static findAll: (options?: { order?: unknown[][] }) => Promise<HistoricFuelStation[]>;
  declare static findAndCountAll: (options?: { order?: unknown[][] }) => Promise<{ rows: HistoricFuelStation[]; count: number }>;
  declare static count: () => Promise<number>;
  declare static truncate: () => Promise<void>;
  declare static bulkCreate: (values: Record<string, unknown>[]) => Promise<HistoricFuelStation[]>;
  declare static create: (values: Record<string, unknown>) => Promise<HistoricFuelStation>;
}

/**
 * Drizzle-pg definition of the production `historic_data` table (names and
 * columns identical to the current Sequelize-generated schema after migration
 * 001: camelCase columns, uuid pk, varchar(255) strings, double precision
 * prices, date-only `date`, and the 002 unique index).
 */
export const pgHistoricData = pgTable('historic_data', {
  id: uuid('id').primaryKey(),
  stationId: varchar('stationId', { length: 255 }),
  stationSignage: varchar('stationSignage', { length: 255 }),
  adbluePrice: doublePrecision('adbluePrice'),
  ammoniaPrice: doublePrecision('ammoniaPrice'),
  biodieselPrice: doublePrecision('biodieselPrice'),
  bioethanolPrice: doublePrecision('bioethanolPrice'),
  compressedBiogasPrice: doublePrecision('compressedBiogasPrice'),
  liquefiedBiogasPrice: doublePrecision('liquefiedBiogasPrice'),
  renewableDieselPrice: doublePrecision('renewableDieselPrice'),
  cngPrice: doublePrecision('cngPrice'),
  lngPrice: doublePrecision('lngPrice'),
  lpgPrice: doublePrecision('lpgPrice'),
  gasoilAPrice: doublePrecision('gasoilAPrice'),
  gasoilBPrice: doublePrecision('gasoilBPrice'),
  premiumGasoilPrice: doublePrecision('premiumGasoilPrice'),
  gasoline95E10Price: doublePrecision('gasoline95E10Price'),
  gasoline95E25Price: doublePrecision('gasoline95E25Price'),
  gasoline95E5Price: doublePrecision('gasoline95E5Price'),
  gasoline95E5PremiumPrice: doublePrecision('gasoline95E5PremiumPrice'),
  gasoline95E85Price: doublePrecision('gasoline95E85Price'),
  gasoline98E10Price: doublePrecision('gasoline98E10Price'),
  gasoline98E5Price: doublePrecision('gasoline98E5Price'),
  renewableGasolinePrice: doublePrecision('renewableGasolinePrice'),
  hydrogenPrice: doublePrecision('hydrogenPrice'),
  methanolPrice: doublePrecision('methanolPrice'),
  date: date('date', { mode: 'string' }),
}, (t) => [
  uniqueIndex('idx_historic_station_date').on(t.stationId, t.date),
]);
