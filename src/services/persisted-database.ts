import { Sequelize } from "sequelize";
import * as Sentry from '@sentry/node';
import { validatePostgresDbData } from "@/utils/postgres-db";
import { HistoricFuelStation, HistoricFuelStationModel } from "@/models/db/historic-fuel-station";
import { loadPersistedData } from '@/services/load-data';

class PersistedDatabase {
  instance;

  constructor() {
    const getDbPort = () => {
      try {
        return parseInt(process.env.POSTGRES_PORT!)
      } catch {
        return 5432
      }
    }

    if (validatePostgresDbData()) {
      this.instance = new Sequelize(process.env.POSTGRES_DATABASE!, process.env.POSTGRES_USER!, process.env.POSTGRES_PASSWORD!, {
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

  async initTables() {
    HistoricFuelStation.init(HistoricFuelStationModel, {
      sequelize: this.instance!,
      modelName: 'historic_data',
      timestamps: false,
    });

    await this.instance!.sync({ force: false });

    console.log("✅ Persisted DB tables initialized")

    loadPersistedData()
  }
}

export default new PersistedDatabase()