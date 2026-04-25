import { Sequelize } from "sequelize";
import { FuelStation, FuelStationModel } from "@/models/fuel-station";
import { loadDataOnStart } from "@/services/data-loader/load-stations";
import { LastUpdated, LastUpdatedModel } from "@/models/last-updated";

class MemoryDatabase {
  private _instance;

  constructor() {
    this._instance = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    })
    console.log("✅ Memory DB initialized")

    this.initTables()
  }

  async initTables() {
    FuelStation.init(FuelStationModel, {
      sequelize: this._instance,
      modelName: 'FuelStation',
      timestamps: false,
    });

    LastUpdated.init(LastUpdatedModel, {
      sequelize: this._instance,
      modelName: 'LastUpdated',
      timestamps: false,
    })

    await this._instance.sync({ alter: true });

    console.log("✅ Memory DB tables initialized")

    loadDataOnStart()
  }
}

export default MemoryDatabase;