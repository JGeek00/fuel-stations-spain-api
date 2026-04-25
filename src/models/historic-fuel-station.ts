import { DataTypes, Model } from "sequelize";

export class HistoricFuelStation extends Model {}

export const HistoricFuelStationModel = {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  station_id: DataTypes.STRING,
  station_signage: DataTypes.STRING,
  adblue_price: DataTypes.DOUBLE,
  ammonia_price: DataTypes.DOUBLE,
  biodiesel_price: DataTypes.DOUBLE,
  bioethanol_price: DataTypes.DOUBLE,
  compressed_biogas_price: DataTypes.DOUBLE,
  liquefied_biogas_price: DataTypes.DOUBLE,
  renewable_diesel_price: DataTypes.DOUBLE,
  cng_price: DataTypes.DOUBLE,
  lng_price: DataTypes.DOUBLE,
  lpg_price: DataTypes.DOUBLE,
  gasoil_a_price: DataTypes.DOUBLE,
  gasoil_b_price: DataTypes.DOUBLE,
  premium_gasoil_price: DataTypes.DOUBLE,
  gasoline_95_e10_price: DataTypes.DOUBLE,
  gasoline_95_e25_price: DataTypes.DOUBLE,
  gasoline_95_e5_price: DataTypes.DOUBLE,
  gasoline_95_e5_premium_price: DataTypes.DOUBLE,
  gasoline_95_e85_price: DataTypes.DOUBLE,
  gasoline_98_e10_price: DataTypes.DOUBLE,
  gasoline_98_e5_price: DataTypes.DOUBLE,
  renewable_gasoline_price: DataTypes.DOUBLE,
  hydrogen_price: DataTypes.DOUBLE,
  methanol_price: DataTypes.DOUBLE,
  date: DataTypes.DATEONLY,
}