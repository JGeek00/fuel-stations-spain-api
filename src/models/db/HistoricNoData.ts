import { DataTypes, Model } from "sequelize";
import { date, pgTable } from "drizzle-orm/pg-core";
import { HistoricNoData } from '@/models/entities';

export class HistoricNoDataTable extends Model<HistoricNoData> {}

export const HistoricNoDataModel = {
  date: { type: DataTypes.DATEONLY, primaryKey: true },
};

/**
 * Drizzle-pg definition of the production `historic_no_data` table (names and
 * columns identical to the Sequelize-generated schema: date-only pk).
 */
export const pgHistoricNoData = pgTable('historic_no_data', {
  date: date('date', { mode: 'string' }).primaryKey(),
});
