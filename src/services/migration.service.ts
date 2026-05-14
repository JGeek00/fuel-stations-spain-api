import { Sequelize } from 'sequelize';
import { Migrations, MigrationsAttributes } from '@/models/db/Migrations';
import { MIGRATIONS } from '@/migrations';

export class MigrationService {
  /**
   * Ejecuta las migraciones pendientes en orden.
   * Cada migración se ejecuta dentro de una transacción atómica.
   */
  async run(sequelize: Sequelize): Promise<void> {
    const applied = await this.getApplied(sequelize);
    const pending = MIGRATIONS.filter((m) => !applied.includes(m.version));

    if (pending.length === 0) {
      console.log('  📋 No pending migrations');
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

      console.log(`  📋 Migration ${migration.version} ${migration.name} applied ✓`);
    }

    console.log(`  📋 ${pending.length} migration(s) applied`);
  }

  /**
   * Desaplica las últimas N migraciones (en orden inverso).
   */
  async rollback(sequelize: Sequelize, count: number = 1): Promise<void> {
    const applied = await this.getApplied(sequelize);
    const toRollback = applied.slice(-count).reverse();

    if (toRollback.length === 0) {
      console.log('  📋 No migrations to rollback');
      return;
    }

    for (const version of toRollback) {
      const migration = MIGRATIONS.find((m) => m.version === version);
      if (!migration) {
        console.warn(`  📋 Migration ${version} not found in registry, skipping`);
        continue;
      }

      await sequelize.transaction(async (transaction) => {
        await migration.down(sequelize);
        await Migrations.destroy({ where: { version }, transaction, logging: false });
      });

      console.log(`  📋 Migration ${version} ${migration.name} rolled back ✓`);
    }
  }

  /**
   * Devuelve el estado de todas las migraciones (aplicadas / pendientes).
   */
  async status(sequelize: Sequelize): Promise<Array<{ version: string; name: string; applied: boolean }>> {
    const applied = await this.getApplied(sequelize);
    return MIGRATIONS.map((m) => ({
      version: m.version,
      name: m.name,
      applied: applied.includes(m.version),
    }));
  }

  /**
   * Devuelve la versión de la última migración aplicada.
   */
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
    } catch {
      return [];
    }
  }
}

export const migrationService = new MigrationService();
