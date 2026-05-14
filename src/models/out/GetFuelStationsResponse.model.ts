import { FuelStation } from "../entities/FuelStation.model";

export interface GetFuelStationsResponse {
  lastUpdated: Date;
  count: number;
  results: FuelStation[];
}