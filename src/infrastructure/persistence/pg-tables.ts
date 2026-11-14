import { date, doublePrecision, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Drizzle-pg production tables (moved verbatim from the deleted
 * Sequelize-style adapter shells so infrastructure owns the DDL).
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

export const pgHistoricNoData = pgTable('historic_no_data', {
  date: date('date', { mode: 'string' }).primaryKey(),
});
