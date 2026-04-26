import { FuelStationPrices } from "@/models/FuelStation";

export interface HistoricPrice extends FuelStationPrices {
  stationId: string | null,
  stationSignage: string | null,
  date: string | null,
}