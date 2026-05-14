import { FuelStationPrices } from "./FuelStation.model";

// Response model — camelCase, used in API responses
export interface HistoricPrice extends FuelStationPrices {
  stationId: string | null;
  stationSignage: string | null;
  date: string | null;
}

// Database model — snake_case, matches DB column names
export interface HistoricPriceAttributes {
  id: string;
  station_id: string;
  station_signage: string;
  adblue_price: number | null;
  ammonia_price: number | null;
  biodiesel_price: number | null;
  bioethanol_price: number | null;
  compressed_biogas_price: number | null;
  liquefied_biogas_price: number | null;
  renewable_diesel_price: number | null;
  cng_price: number | null;
  lng_price: number | null;
  lpg_price: number | null;
  gasoil_a_price: number | null;
  gasoil_b_price: number | null;
  premium_gasoil_price: number | null;
  gasoline_95_e10_price: number | null;
  gasoline_95_e25_price: number | null;
  gasoline_95_e5_price: number | null;
  gasoline_95_e5_premium_price: number | null;
  gasoline_95_e85_price: number | null;
  gasoline_98_e10_price: number | null;
  gasoline_98_e5_price: number | null;
  renewable_gasoline_price: number | null;
  hydrogen_price: number | null;
  methanol_price: number | null;
  date: string | null;
}
