import { Sequelize } from 'sequelize';
import * as Sentry from '@sentry/node';
import { LastUpdated, LastUpdatedModel } from '@/models/db/LastUpdated';
import { FuelStationModel, FuelStationsTable } from '@/models/db/FuelStations';
import { validatePostgresDbData } from '@/utils/postgres-db';
import { HistoricFuelStation, HistoricFuelStationModel } from '@/models/db/HistoricFuelStation';
import { HistoricNoDataTable, HistoricNoDataModel } from '@/models/db/HistoricNoData';
import { Migrations, MigrationsModel } from '@/models/db/Migrations';
import { migrationService } from '@/services/migration.service';
import { MIGRATIONS } from '@/migrations';
import { realtimeDataService } from '@/services/realtime-data.service';
import { persistedDataService } from '@/services/persisted-data.service';
import { logger } from '@/utils/logger';

export class DatabaseService {
  private _memoryDbInstance: Sequelize | null = null;
  private _persistedDbInstance: Sequelize | null = null;

  get memoryDbInstance() {
    if (!this._memoryDbInstance) {
      throw new Error('Memory database not initialized. Call DatabaseService.init() first.');
    }
    return this._memoryDbInstance;
  }

  get persistedDbInstance(): Sequelize {
    if (!this._persistedDbInstance) {
      throw new Error('Persisted database not available.');
    }
    return this._persistedDbInstance;
  }

  private async initMemoryDb(): Promise<void> {
    this._memoryDbInstance = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    })
    logger.info("✅ Memory DB initialized")

    FuelStationsTable.init(FuelStationModel, {
      sequelize: this._memoryDbInstance,
      modelName: 'FuelStation',
      timestamps: false,
    });

    LastUpdated.init(LastUpdatedModel, {
      sequelize: this._memoryDbInstance,
      modelName: 'LastUpdated',
      timestamps: false,
    })

    await this._memoryDbInstance.sync({ alter: true });

    realtimeDataService.loadAll() // Load data on start
    realtimeDataService.registerProgrammedTask();

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
      this._persistedDbInstance = new Sequelize(process.env.POSTGRES_DATABASE!, process.env.POSTGRES_USER!, process.env.POSTGRES_PASSWORD!, {
        host: process.env.POSTGRES_HOST,
        port: getDbPort(),
        dialect: 'postgres',
        logging: false,
      });

      try {
        await this._persistedDbInstance.authenticate();

        logger.info('✅ Persisted DB initialized');

        const isFreshInstall = await migrationService.isDbEmpty(this._persistedDbInstance);

        Migrations.init(MigrationsModel, {
          sequelize: this._persistedDbInstance,
          modelName: 'migrations',
          timestamps: false,
        });
        await Migrations.sync({ force: false });

        if (!isFreshInstall) {
          await migrationService.run(this._persistedDbInstance);
        } else {
          logger.info('  📋 Fresh install — marking all migrations as applied');
          await Migrations.bulkCreate(
            MIGRATIONS.map(m => ({
              version: m.version,
              name: m.name,
              appliedAt: new Date(),
            })),
            { logging: false }
          );
        }

        HistoricFuelStation.init(HistoricFuelStationModel, {
          sequelize: this._persistedDbInstance,
          modelName: 'historic_data',
          timestamps: false,
        });

        HistoricNoDataTable.init(HistoricNoDataModel, {
          sequelize: this._persistedDbInstance,
          modelName: 'historic_no_data',
          timestamps: false,
        });

        await this._persistedDbInstance.sync({ alter: true });

        persistedDataService.loadAll() // Load persisted data on start
        persistedDataService.registerProgrammedTask();

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

