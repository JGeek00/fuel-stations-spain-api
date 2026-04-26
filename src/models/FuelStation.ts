import { DataTypes, Model } from "sequelize";

export interface FuelStationAttributes extends FuelStationPrices {
  id: string | null;
  postalCode: string | null;
  address: string | null;
  openingHours: string | null;
  latitude: number | null;
  longitude: number | null;
  locality: string | null;
  margin: string | null;
  municipality: string | null;
  province: string | null;
  referral: string | null;
  signage: string | null;
  saleType: string | null;
  percBioEthanol: string | null;
  percMethylEster: string | null;
  municipalityId: number | null;
  provinceId: number | null;
  regionId: number | null;
}

export interface FuelStationPrices {
  ammoniaPrice: number | null;
  biodieselPrice: number | null;
  bioethanolPrice: number | null;
  compressedBiogasPrice: number | null;
  liquefiedBiogasPrice: number | null;
  renewableDieselPrice: number | null;
  cngPrice: number | null;
  lngPrice: number | null;
  lpgPrice: number | null;
  gasoilAPrice: number | null;
  gasoilBPrice: number | null;
  premiumGasoilPrice: number | null;
  gasoline95E10Price: number | null;
  gasoline95E25Price: number | null;
  gasoline95E5Price: number | null;
  gasoline95E5PremiumPrice: number | null;
  gasoline95E85Price: number | null;
  gasoline98E10Price: number | null;
  gasoline98E5Price: number | null;
  renewableGasolinePrice: number | null;
  hydrogenPrice: number | null;
  methanolPrice: number | null;
  adbluePrice: number | null;
}

export class FuelStation extends Model<FuelStationAttributes> {}

export const FuelStationModel = {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  postalCode: DataTypes.STRING,
  address: DataTypes.STRING,
  openingHours: DataTypes.STRING,
  latitude: DataTypes.FLOAT,
  longitude: DataTypes.FLOAT,
  locality: DataTypes.STRING,
  margin: DataTypes.STRING,
  municipality: DataTypes.STRING,
  province: DataTypes.STRING,
  referral: DataTypes.STRING,
  signage: DataTypes.STRING,
  saleType: DataTypes.STRING,
  percBioEthanol: DataTypes.STRING,
  percMethylEster: DataTypes.STRING,
  municipalityId: DataTypes.INTEGER,
  provinceId: DataTypes.INTEGER,
  regionId: DataTypes.INTEGER,
  adbluePrice: DataTypes.FLOAT,
  ammoniaPrice: DataTypes.FLOAT,
  biodieselPrice: DataTypes.FLOAT,
  bioethanolPrice: DataTypes.FLOAT,
  compressedBiogasPrice: DataTypes.FLOAT,
  liquefiedBiogasPrice: DataTypes.FLOAT,
  renewableDieselPrice: DataTypes.FLOAT,
  cngPrice: DataTypes.FLOAT,
  lngPrice: DataTypes.FLOAT,
  lpgPrice: DataTypes.FLOAT,
  gasoilAPrice: DataTypes.FLOAT,
  gasoilBPrice: DataTypes.FLOAT,
  premiumGasoilPrice: DataTypes.FLOAT,
  gasoline95E10Price: DataTypes.FLOAT,
  gasoline95E25Price: DataTypes.FLOAT,
  gasoline95E5Price: DataTypes.FLOAT,
  gasoline95E5PremiumPrice: DataTypes.FLOAT,
  gasoline95E85Price: DataTypes.FLOAT,
  gasoline98E10Price: DataTypes.FLOAT,
  gasoline98E5Price: DataTypes.FLOAT,
  renewableGasolinePrice: DataTypes.FLOAT,
  hydrogenPrice: DataTypes.FLOAT,
  methanolPrice: DataTypes.FLOAT,
}