import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export interface MigrationsAttributes {
  version: string;
  name: string;
  appliedAt: Date;
}

/**
 * Drizzle-pg definition of the production `migrations` table (names and
 * columns identical to the Sequelize-generated schema: version pk, name,
 * appliedAt timestamptz default now).
 */
export const pgMigrations = pgTable('migrations', {
  version: varchar('version', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  appliedAt: timestamp('appliedAt', { mode: 'date' }).notNull().defaultNow(),
});
