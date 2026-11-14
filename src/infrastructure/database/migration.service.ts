import { asc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgMigrations } from '@/infrastructure/persistence/Migrations';
import { MIGRATIONS } from '@/infrastructure/migrations';
import { logger } from '@/shared/utils/logger';

type MigrationDb = NodePgDatabase<Record<string, never>>;

export class MigrationService {
  async run(db: MigrationDb): Promise<void> {
    const applied = await this.getApplied(db);
    const pending = MIGRATIONS.filter((m) => !applied.includes(m.version));

    if (pending.length === 0) {
      logger.info('  📋 No pending migrations');
      return;
    }

    for (const migration of pending) {
      await db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.insert(pgMigrations).values({
          version: migration.version,
          name: migration.name,
          appliedAt: new Date(),
        });
      });

      logger.info(`  📋 Migration ${migration.version} ${migration.name} applied ✓`);
    }

    logger.info(`  📋 ${pending.length} migration(s) applied`);
  }

  async rollback(db: MigrationDb, count: number = 1): Promise<void> {
    const applied = await this.getApplied(db);
    const toRollback = applied.slice(-count).reverse();

    if (toRollback.length === 0) {
      logger.info('  📋 No migrations to rollback');
      return;
    }

    for (const version of toRollback) {
      const migration = MIGRATIONS.find((m) => m.version === version);
      if (!migration) {
        logger.warn(`  📋 Migration ${version} not found in registry, skipping`);
        continue;
      }

      await db.transaction(async (tx) => {
        await migration.down(tx);
        await tx.delete(pgMigrations).where(eq(pgMigrations.version, version));
      });

      logger.info(`  📋 Migration ${version} ${migration.name} rolled back ✓`);
    }
  }

  async status(db: MigrationDb): Promise<Array<{ version: string; name: string; applied: boolean }>> {
    const applied = await this.getApplied(db);
    return MIGRATIONS.map((m) => ({
      version: m.version,
      name: m.name,
      applied: applied.includes(m.version),
    }));
  }

  async isDbEmpty(db: MigrationDb): Promise<boolean> {
    const result = await db.execute<{ has_tables: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public') AS has_tables`
    );
    return !result.rows[0].has_tables;
  }

  async getLastAppliedVersion(db: MigrationDb): Promise<string | null> {
    const applied = await this.getApplied(db);
    return applied.length > 0 ? applied[applied.length - 1] : null;
  }

  private async getApplied(db: MigrationDb): Promise<string[]> {
    try {
      const rows = await db.select().from(pgMigrations).orderBy(asc(pgMigrations.version));
      return rows.map((r) => r.version);
    } catch (error) {
      logger.debug('  📋 Migrations table not found, returning empty list', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}

export const migrationService = new MigrationService();
