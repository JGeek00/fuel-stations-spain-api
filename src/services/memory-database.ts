import { Sequelize } from "sequelize";
import { FuelStation, FuelStationModel } from "@/models/db/fuel-station";
import { loadDataOnStart } from "@/services/data-loader/load-stations";
import { LastUpdated, LastUpdatedModel } from "@/models/db/last-updated";

class MemoryDatabase {
  instance;

  constructor() {
    this.instance = new Sequelize('sqlite::memory:', {
      logging: false
    })
    console.log("✅ Memory DB initialized")

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

    console.log("✅ Memory DB tables initialized")

    loadDataOnStart()
  }
}

export default new MemoryDatabase()