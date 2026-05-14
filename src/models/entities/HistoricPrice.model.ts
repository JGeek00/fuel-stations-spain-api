import { FuelStationPrices } from "./FuelStation.model";

// Response model — camelCase, used in API responses
export interface HistoricPrice extends FuelStationPrices {
  stationId: string | null;
  stationSignage: string | null;
  date: string | null;
}

// Database model — camelCase, matches DB column names
export interface HistoricPriceAttributes {
  id: string;
  stationId: string | null;
  stationSignage: string | null;
  adbluePrice: number | null;
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
  date: string | null;
}
