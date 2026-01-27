import { Sequelize } from "sequelize";
import * as Sentry from '@sentry/node';
import { validatePostgresDbData } from "@/utils/postgres-db";
import { HistoricFuelStation, HistoricFuelStationModel } from "@/models/db/historic-fuel-station";
import { loadPersistedData } from '@/services/data-loader/load-persisted-data';
import { startPersistentDataCron } from "@/utils/cron";

class PersistedDatabase {
  private _instance: Sequelize | null = null;

  constructor() {
    const getDbPort = () => {
      try {
        return parseInt(process.env.POSTGRES_PORT!)
      } catch {
        return 5432
      }
    }

    if (validatePostgresDbData()) {
      this._instance = new Sequelize(process.env.POSTGRES_DATABASE!, process.env.POSTGRES_USER!, process.env.POSTGRES_PASSWORD!, {
        host: process.env.POSTGRES_HOST,
        port:  getDbPort(),
        dialect: 'postgres',
        logging: false,
      });
  
      (async () => {
        try {
          await this.instance!.authenticate();
          console.log("✅ Persisted DB initialized") 
          this.initTables()
        } catch (error) {
          Sentry.captureException(error)
          console.error('❌ Unable to connect to the persisted database')
        }
      })();
    }
    else {
      console.log("❌ Database connection values not provided. Historic endpoint won`t be available.")
      return
    }
  }

  get instance() {
    if (!this._instance) {
      throw new Error('PersistedDatabase not initialized. Call PersistedDatabase.init() first.');
    }
    return this._instance;
  }

  async initTables() {
    HistoricFuelStation.init(HistoricFuelStationModel, {
      sequelize: this.instance!,
      modelName: 'historic_data',
      timestamps: false,
    });

    await this.instance!.sync({ alter: true });

    console.log("✅ Persisted DB tables initialized")

    await loadPersistedData()

    startPersistentDataCron()
  }
}

export default PersistedDatabase