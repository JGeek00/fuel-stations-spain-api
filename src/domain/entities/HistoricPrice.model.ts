import { FuelStationPrices } from "./FuelStation.model";

export interface HistoricPrice extends FuelStationPrices {
  stationId: string | null;
  stationSignage: string | null;
  date: string | null;
}
