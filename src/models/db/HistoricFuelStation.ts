import { DataTypes, Model } from "sequelize";
import { HistoricPriceAttributes } from "../entities/HistoricPrice.model";

export class HistoricFuelStation extends Model<HistoricPriceAttributes> {}

export const HistoricFuelStationModel = {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  stationId: DataTypes.STRING,
  stationSignage: DataTypes.STRING,
  adbluePrice: DataTypes.DOUBLE,
  ammoniaPrice: DataTypes.DOUBLE,
  biodieselPrice: DataTypes.DOUBLE,
  bioethanolPrice: DataTypes.DOUBLE,
  compressedBiogasPrice: DataTypes.DOUBLE,
  liquefiedBiogasPrice: DataTypes.DOUBLE,
  renewableDieselPrice: DataTypes.DOUBLE,
  cngPrice: DataTypes.DOUBLE,
  lngPrice: DataTypes.DOUBLE,
  lpgPrice: DataTypes.DOUBLE,
  gasoilAPrice: DataTypes.DOUBLE,
  gasoilBPrice: DataTypes.DOUBLE,
  premiumGasoilPrice: DataTypes.DOUBLE,
  gasoline95E10Price: DataTypes.DOUBLE,
  gasoline95E25Price: DataTypes.DOUBLE,
  gasoline95E5Price: DataTypes.DOUBLE,
  gasoline95E5PremiumPrice: DataTypes.DOUBLE,
  gasoline95E85Price: DataTypes.DOUBLE,
  gasoline98E10Price: DataTypes.DOUBLE,
  gasoline98E5Price: DataTypes.DOUBLE,
  renewableGasolinePrice: DataTypes.DOUBLE,
  hydrogenPrice: DataTypes.DOUBLE,
  methanolPrice: DataTypes.DOUBLE,
  date: DataTypes.DATEONLY,
};
