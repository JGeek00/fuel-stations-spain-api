import { Sequelize } from 'sequelize';
import { Migrations, MigrationsAttributes } from '@/models/db/Migrations';
import { MIGRATIONS } from '@/migrations';
import { logger } from '@/utils';

export class MigrationService {
  async run(sequelize: Sequelize): Promise<void> {
    const applied = await this.getApplied(sequelize);
    const pending = MIGRATIONS.filter((m) => !applied.includes(m.version));

    if (pending.length === 0) {
      logger.info('  📋 No pending migrations');
      return;
    }

    for (const migration of pending) {
      await sequelize.transaction(async (transaction) => {
        await migration.up(sequelize);
        await Migrations.create(
          {
            version: migration.version,
            name: migration.name,
            appliedAt: new Date(),
          },
          { transaction, logging: false }
        );
      });

      logger.info(`  📋 Migration ${migration.version} ${migration.name} applied ✓`);
    }

    logger.info(`  📋 ${pending.length} migration(s) applied`);
  }

  async rollback(sequelize: Sequelize, count: number = 1): Promise<void> {
    const applied = await this.getApplied(sequelize);
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

      await sequelize.transaction(async (transaction) => {
        await migration.down(sequelize);
        await Migrations.destroy({ where: { version }, transaction, logging: false });
      });

      logger.info(`  📋 Migration ${version} ${migration.name} rolled back ✓`);
    }
  }

  async status(sequelize: Sequelize): Promise<Array<{ version: string; name: string; applied: boolean }>> {
    const applied = await this.getApplied(sequelize);
    return MIGRATIONS.map((m) => ({
      version: m.version,
      name: m.name,
      applied: applied.includes(m.version),
    }));
  }

  async isDbEmpty(sequelize: Sequelize): Promise<boolean> {
    const [rows] = await sequelize.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public') AS has_tables"
    );
    return !(rows as { has_tables: boolean }[])[0].has_tables;
  }

  async getLastAppliedVersion(sequelize: Sequelize): Promise<string | null> {
    const applied = await this.getApplied(sequelize);
    return applied.length > 0 ? applied[applied.length - 1] : null;
  }

  private async getApplied(sequelize: Sequelize): Promise<string[]> {
    try {
      const rows = await Migrations.findAll({
        order: [['version', 'ASC']],
        logging: false,
      });
      return rows.map((r) => (r as unknown as MigrationsAttributes).version);
    } catch (error) {
      logger.debug('  📋 Migrations table not found, returning empty list', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}

export const migrationService = new MigrationService();
