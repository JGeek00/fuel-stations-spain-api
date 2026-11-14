import * as Sentry from '@sentry/node';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

/**
 * Drizzle-pg persisted database seam. `authenticate` keeps the liveness check
 * the MCP status tools call through persistedDbInstance.
 */
export type PersistedDb = NodePgDatabase<Record<string, never>> & {
  authenticate: () => Promise<unknown>;
};
import { LastUpdated, LastUpdatedModel } from '@/models/db/LastUpdated';
import { FuelStationModel, FuelStationsTable } from '@/models/db/FuelStations';
import { getMemoryDb, markPersistedDbInitialized, setPersistedDb } from '@/models/db/memory-db';
import { validatePostgresDbData } from '@/utils/postgres-db';
import { HistoricFuelStation } from '@/models/db/HistoricFuelStation';
import { pgMigrations } from '@/models/db/Migrations';
import { migrationService } from '@/services/migration.service';
import { MIGRATIONS } from '@/migrations';
import { ensurePersistedSchema } from '@/infrastructure/persistence/ensurePersistedSchema';
import { logger } from '@/utils/logger';

export class DatabaseService {
  // `config` keeps the legacy database.service.spec assertion typecheckable.
  private _memoryDbInstance: (BetterSQLite3Database & { config?: { dialect?: string } }) | null = null;
  private _persistedDbInstance: PersistedDb | null = null;

  get memoryDbInstance() {
    if (!this._memoryDbInstance) {
      throw new Error('Memory database not initialized. Call DatabaseService.init() first.');
    }
    return this._memoryDbInstance;
  }

  get persistedDbInstance(): PersistedDb {
    if (!this._persistedDbInstance) {
      throw new Error('Persisted database not available.');
    }
    return this._persistedDbInstance;
  }

  private async initMemoryDb(): Promise<void> {
    // Memory DB is now a better-sqlite3 `:memory:` database behind Drizzle
    // (src/models/db/memory-db.ts); tables are created by the model adapters,
    // replacing Sequelize's sync({ alter: true }).
    logger.info("✅ Memory DB initialized")

    // Kept as interface-compatible calls (database.service.spec pins this call
    // shape); the adapters' init creates the tables and swaps in a fresh
    // :memory: database — the model args are carried through for legacy
    // compatibility only.
    FuelStationsTable.init(FuelStationModel, {
      modelName: 'FuelStation',
      timestamps: false,
    });

    LastUpdated.init(LastUpdatedModel, {
      modelName: 'LastUpdated',
      timestamps: false,
    })

    this._memoryDbInstance = getMemoryDb();

    // Scheduled jobs are owned by src/jobs/scheduler.ts (called from server.ts),
    // never by the DB wiring.

    logger.info("✅ Memory DB tables initialized")
  }

  private async initPersistedDb(): Promise<void> {
    const getDbPort = () => {
      try {
        return parseInt(process.env.POSTGRES_PORT!);
      } catch {
        return 5432;
      }
    };

    if (validatePostgresDbData()) {
      const pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: getDbPort(),
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE,
      });
      const db = drizzle(pool) as unknown as PersistedDb;
      // Sequelize `authenticate()` equivalent: a `select 1` over the pool.
      db.authenticate = () => pool.query('select 1');
      this._persistedDbInstance = db;

      try {
        await db.authenticate();

        logger.info('✅ Persisted DB initialized');

        const isFreshInstall = await migrationService.isDbEmpty(this._persistedDbInstance);

        // Migrations.sync({ force: false }) equivalent: ensure the migrations table exists.
        await this._persistedDbInstance.execute(sql`
          CREATE TABLE IF NOT EXISTS migrations (
            "version" varchar(255) PRIMARY KEY,
            "name" varchar(255) NOT NULL,
            "appliedAt" timestamptz DEFAULT now()
          )
        `);

        if (!isFreshInstall) {
          await migrationService.run(this._persistedDbInstance);
        } else {
          logger.info('  📋 Fresh install — marking all migrations as applied');
          await this._persistedDbInstance
            .insert(pgMigrations)
            .values(
              MIGRATIONS.map(m => ({
                version: m.version,
                name: m.name,
                appliedAt: new Date(),
              }))
            );
        }

        // Schema owned by migrations (003_ensure_historic_schema); the service
        // only ensures it exists (fresh installs mark migrations applied).
        await ensurePersistedSchema(this._persistedDbInstance);

        markPersistedDbInitialized();
        setPersistedDb(this._persistedDbInstance);
        // The connection middleware reads HistoricFuelStation.sequelize; point
        // it at a liveness seam over the real pool (same shape the memory
        // adapter uses for its stub).
        Object.defineProperty(HistoricFuelStation, 'sequelize', {
          value: {
            authenticate: async () => {
              await pool.query('select 1');
            },
          },
          writable: true,
          configurable: true,
        });

        // Scheduled jobs are owned by src/jobs/scheduler.ts (called from server.ts),
        // never by the DB wiring.

        logger.info('✅ Persisted DB tables initialized');
      } catch (error) {
        logger.error(error)
        Sentry.captureException(error);
        logger.error('❌ Unable to connect to the persisted database');
        this._persistedDbInstance = null;
      }
    } else {
      logger.warn("❌ Database connection values not provided. Historic endpoint won`t be available.");
    }
  }

  async init(): Promise<void> {
    await Promise.all([
      this.initMemoryDb(),
      this.initPersistedDb()
    ]);
  }
}

export const databaseService = new DatabaseService();
