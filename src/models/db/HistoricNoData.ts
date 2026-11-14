import { date, pgTable } from "drizzle-orm/pg-core";
import { HistoricNoData } from '@/models/entities';

/**
 * Typing shell replacing the removed Sequelize `Model` base: every member is
 * declaration-only; the real behavior comes from the memory-DB adapter
 * Object.assign'd by memory-db.ts (installHistoricNoDataAdapter).
 */
export class HistoricNoDataTable {
  declare dataValues: HistoricNoData;
  declare get: (options?: { plain?: boolean }) => HistoricNoData;
  declare getDataValue: <K extends keyof HistoricNoData>(key: K) => HistoricNoData[K];

  declare static init: (...args: unknown[]) => void;
  declare static findAll: () => Promise<HistoricNoDataTable[]>;
  declare static count: () => Promise<number>;
  declare static create: (values: { date: string }) => Promise<HistoricNoDataTable>;
}

/**
 * Drizzle-pg definition of the production `historic_no_data` table (names and
 * columns identical to the Sequelize-generated schema: date-only pk).
 */
export const pgHistoricNoData = pgTable('historic_no_data', {
  date: date('date', { mode: 'string' }).primaryKey(),
});
