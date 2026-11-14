import type { SQL } from "drizzle-orm";

/**
 * Minimal Drizzle executor seam for migrations: both `NodePgDatabase` and its
 * transaction handles satisfy it structurally.
 */
export type MigrationExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

export interface Migration {
  version: string;
  name: string;
  up: (db: MigrationExecutor) => Promise<void>;
  down: (db: MigrationExecutor) => Promise<void>;
}
