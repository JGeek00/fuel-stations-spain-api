import { DataTypes, Model } from "sequelize";
import { date, doublePrecision, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { HistoricPrice } from "@/models/entities";

export class HistoricFuelStation extends Model<HistoricPrice> {}

export const HistoricFuelStationModel = {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  stationId: { type: DataTypes.STRING, unique: 'idx_historic_station_date' },
  stationSignage: DataTypes.STRING,
  adbluePrice: DataTypes.DOUBLE,
  ammoniaPrice: DataTypes.DOUBLE,
  biodieselPrice: DataTypes.DOUBLE,
  bioethanolPrice: DataTypes.DOUBLE,
  compressedBiogasPrice: DataTypes.DOUBLE,
  liquefiedBiogasPrice: DataTypes.DOUBLE,
  renewableDieselPrice: DataTypes.DOUBLE,
  cngPrice: DataTypes.DOUBLE,
  lngPrice: DataTypes.DOUBLE,
  lpgPrice: DataTypes.DOUBLE,
  gasoilAPrice: DataTypes.DOUBLE,
  gasoilBPrice: DataTypes.DOUBLE,
  premiumGasoilPrice: DataTypes.DOUBLE,
  gasoline95E10Price: DataTypes.DOUBLE,
  gasoline95E25Price: DataTypes.DOUBLE,
  gasoline95E5Price: DataTypes.DOUBLE,
  gasoline95E5PremiumPrice: DataTypes.DOUBLE,
  gasoline95E85Price: DataTypes.DOUBLE,
  gasoline98E10Price: DataTypes.DOUBLE,
  gasoline98E5Price: DataTypes.DOUBLE,
  renewableGasolinePrice: DataTypes.DOUBLE,
  hydrogenPrice: DataTypes.DOUBLE,
  methanolPrice: DataTypes.DOUBLE,
  date: { type: DataTypes.DATEONLY, unique: 'idx_historic_station_date' },
};

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
