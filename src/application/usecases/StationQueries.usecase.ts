import { stationRepository } from '@/infrastructure/persistence/StationRepository';
import type { CheapestQuery, CompareQuery } from '@/application/ports/repositories';

function presentPriceRow(station: Record<string, unknown>, fuelType: string) {
  return {
    id: station.id,
    referral: station.referral,
    signage: station.signage,
    address: station.address,
    municipality: station.municipality,
    province: station.province,
    coordinates:
      station.latitude && station.longitude
        ? { latitude: station.latitude, longitude: station.longitude }
        : null,
    price: station[fuelType],
  };
}

export async function findCheapestFuelUseCase(q: CheapestQuery) {
  const stations = await stationRepository.findCheapest(q);
  const results = stations.map((s) => presentPriceRow(s, q.fuelType));
  const locationInfo =
    q.latitude !== undefined && q.longitude !== undefined
      ? { center: { latitude: q.latitude, longitude: q.longitude }, radiusKm: q.distanceKm ?? 30 }
      : { scope: 'national' };
  return { fuelType: q.fuelType, ...locationInfo, count: results.length, results };
}

export async function compareFuelPricesUseCase(q: CompareQuery) {
  const stations = await stationRepository.compare(q);
  const results = stations.map((s) => presentPriceRow(s, q.fuelType));
  return { fuelType: q.fuelType, count: results.length, results };
}

export async function searchByLocationUseCase(lat: number, lon: number, distanceKm: number) {
  const rows = await stationRepository.searchByLocation(lat, lon, distanceKm);
  return { center: { latitude: lat, longitude: lon }, radiusKm: distanceKm, count: rows.length, results: rows };
}

export async function getStationInfoUseCase(stationId: string) {
  return stationRepository.findByStationId(stationId);
}

export async function queryStationsUseCase(filters: {
  ids?: string[];
  municipalityId?: number;
  provinceId?: number;
  regionId?: number;
  limit?: number;
  offset?: number;
}) {
  // Province/region filters go through the legacy adapter-compatible path:
  // StationRepository.query handles ids/municipality/bbox; province/region
  // fall back to full scan + in-memory filter to preserve MCP behavior.
  if (filters.provinceId !== undefined || filters.regionId !== undefined) {
    const { rows } = await stationRepository.query({ limit: undefined, offset: undefined });
    const filtered = rows.filter((r) => {
      if (filters.provinceId !== undefined && r.provinceId !== filters.provinceId) return false;
      if (filters.regionId !== undefined && r.regionId !== filters.regionId) return false;
      return true;
    });
    const limit = filters.limit ?? 30;
    const offset = filters.offset ?? 0;
    return { count: filtered.length, limit, offset, results: filtered.slice(offset, offset + limit) };
  }
  const { rows, count } = await stationRepository.query({
    ids: filters.ids,
    municipalityId: filters.municipalityId,
    limit: filters.limit ?? 30,
    offset: filters.offset ?? 0,
  });
  return { count, limit: filters.limit ?? 30, offset: filters.offset ?? 0, results: rows };
}
