import { Sequelize } from "sequelize";
import { FuelStation, FuelStationModel } from "@/models/db/fuel-station";
import { loadDataOnStart } from "@/services/load-data";

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
    });
    await this.instance.sync({ force: true });
    console.log("✅ DB tables initialized")

    loadDataOnStart()
  }
}

export default new Database()