import { Sequelize } from "sequelize";
import { FuelStation, FuelStationModel } from "@/models/db/fuel-station";
import { loadDataOnStart } from "@/services/load-data";
import { LastUpdated, LastUpdatedModel } from "@/models/db/last-updated";

class Database {
  instance;

  constructor() {
    this.instance = new Sequelize('sqlite::memory:', {
      logging: false
    })
    console.log("✅ DB initialized")

    this.initTables()
  }

  async initTables() {
    FuelStation.init(FuelStationModel, {
      sequelize: this.instance,
      modelName: 'FuelStation',
      timestamps: false,
    });

    LastUpdated.init(LastUpdatedModel, {
      sequelize: this.instance,
      modelName: 'LastUpdated',
      timestamps: false,
    })

    await this.instance.sync({ force: true });

    console.log("✅ DB tables initialized")

    loadDataOnStart()
  }
}

export default new Database()