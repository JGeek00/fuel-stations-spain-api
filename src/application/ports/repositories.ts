/**
 * Ports (interfaces) for the data layer.
 * Use cases depend on these, never on Drizzle or memory-db directly.
 */
export interface StationFilters {
  municipalityId?: number;
  provinceId?: number;
  regionId?: number;
  ids?: string[];
  boundingBox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  limit?: number;
  offset?: number;
}

export interface CheapestQuery {
  fuelType: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  limit?: number;
}

export interface CompareQuery {
  fuelType: string;
  ids?: string[];
  municipalityId?: number;
  limit?: number;
}

export interface IStationRepository {
  query(filters: StationFilters): Promise<{ rows: Record<string, unknown>[]; count: number }>;
  findByStationId(stationId: string): Promise<Record<string, unknown> | null>;
  findCheapest(q: CheapestQuery): Promise<Record<string, unknown>[]>;
  compare(q: CompareQuery): Promise<Record<string, unknown>[]>;
  searchByLocation(lat: number, lon: number, distanceKm: number): Promise<Record<string, unknown>[]>;
  replaceAll(stations: Record<string, unknown>[], lastUpdatedISO: string): Promise<void>;
  getLastUpdated(): Promise<string | null>;
  count(): Promise<number>;
}

export interface IHistoricRepository {
  queryRange(stationId: string, startDate: string, endDate: string): Promise<Record<string, unknown>[]>;
  queryCurrent(stationId: string): Promise<Record<string, unknown> | null>;
}

export interface IMunicipalitiesRepository {
  list(filters?: { province?: string; region?: string; search?: string }): Record<string, unknown>[];
  replaceAll(data: Record<string, unknown>[]): void;
}
