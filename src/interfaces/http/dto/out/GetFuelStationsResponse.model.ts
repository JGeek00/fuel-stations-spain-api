import { FuelStation } from "@/domain/entities/FuelStation.model";

export interface GetFuelStationsResponse {
  lastUpdated: Date;
  count: number;
  results: FuelStation[];
}