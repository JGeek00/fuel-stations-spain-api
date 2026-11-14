import { and, asc, between, count, eq, inArray, type SQL } from 'drizzle-orm';
import { fuelStationsTable, getMemoryDb, lastUpdatedTable } from '@/infrastructure/persistence/memory-db';
import { calculateBoundingBox } from '@/shared/utils/calculate-distance';
import type { CompareQuery, CheapestQuery, IStationRepository, StationFilters } from '@/application/ports/repositories';

/**
 * Drizzle-backed station repository — the ONLY place (with HistoricRepository)
 * allowed to import drizzle-orm or getMemoryDb for station reads/writes.
 * Behavior moved verbatim from service-stations.controller + MCP tools.
 */

// Single-statement bulk inserts of the full station census (~13k rows x 43
// cols) overflow drizzle's recursive query builder, so all bulk writes go in
// chunks (same semantics, more statements).
const INSERT_CHUNK_SIZE = 500;

class StationRepository implements IStationRepository {
  private buildWhere(f: StationFilters): SQL | undefined {
    const t = fuelStationsTable;
    if (f.ids && f.ids.length > 0) {
      return inArray(t.stationId, f.ids);
    }
    if (f.boundingBox) {
      const b = f.boundingBox;
      return and(
        between(t.latitude, b.minLat, b.maxLat),
        between(t.longitude, b.minLon, b.maxLon),
      );
    }
    if (f.municipalityId !== undefined) {
      return eq(t.municipalityId, f.municipalityId);
    }
    return undefined;
  }

  async query(filters: StationFilters): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    const db = getMemoryDb();
    const where = this.buildWhere(filters);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.select().from(fuelStationsTable).where(where);
    if (filters.limit !== undefined) q = q.limit(Number(filters.limit));
    if (filters.offset !== undefined) q = q.offset(Number(filters.offset));
    const rows = (await q) as Record<string, unknown>[];
    const [countRow] = await db.select({ value: count() }).from(fuelStationsTable).where(where);
    return { rows, count: countRow.value as number };
  }

  async findByStationId(stationId: string): Promise<Record<string, unknown> | null> {
    const { rows } = await this.query({ ids: [stationId] });
    return rows[0] ?? null;
  }

  async findCheapest(q: CheapestQuery): Promise<Record<string, unknown>[]> {
    const db = getMemoryDb();
    const t = fuelStationsTable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fuelColumn = (t as unknown as Record<string, any>)[q.fuelType];
    let where: SQL | undefined;
    if (q.latitude !== undefined && q.longitude !== undefined) {
      const distance = q.distanceKm ?? 30;
      const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(q.latitude, q.longitude, distance);
      where = and(between(t.latitude, minLat, maxLat), between(t.longitude, minLon, maxLon));
    }
    return (await db
      .select({
        id: t.id,
        referral: t.referral,
        signage: t.signage,
        address: t.address,
        municipality: t.municipality,
        province: t.province,
        latitude: t.latitude,
        longitude: t.longitude,
        [q.fuelType]: fuelColumn,
      })
      .from(t)
      .where(where)
      .orderBy(asc(fuelColumn))
      .limit(q.limit ?? 10)) as Record<string, unknown>[];
  }

  async compare(q: CompareQuery): Promise<Record<string, unknown>[]> {
    const db = getMemoryDb();
    const t = fuelStationsTable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fuelColumn = (t as unknown as Record<string, any>)[q.fuelType];
    const conditions: SQL[] = [];
    if (q.ids && q.ids.length > 0) conditions.push(inArray(t.id, q.ids));
    if (q.municipalityId !== undefined) conditions.push(eq(t.municipalityId, q.municipalityId));
    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
    return (await db
      .select({
        id: t.id,
        referral: t.referral,
        signage: t.signage,
        address: t.address,
        municipality: t.municipality,
        province: t.province,
        latitude: t.latitude,
        longitude: t.longitude,
        [q.fuelType]: fuelColumn,
      })
      .from(t)
      .where(where)
      .limit(q.limit ?? 50)) as Record<string, unknown>[];
  }

  async searchByLocation(lat: number, lon: number, distanceKm: number): Promise<Record<string, unknown>[]> {
    const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(lat, lon, distanceKm);
    const { rows } = await this.query({ boundingBox: { minLat, maxLat, minLon, maxLon } });
    return rows;
  }

  /** Replaces all realtime rows (moved from realtime-data.service; same semantics). */
  async replaceAll(stations: Record<string, unknown>[], lastUpdatedISO: string): Promise<void> {
    const db = getMemoryDb();
    const previousStations = await db.select().from(fuelStationsTable);
    const previousLastUpdated = await db.select().from(lastUpdatedTable);
    await db.delete(fuelStationsTable);
    await db.delete(lastUpdatedTable);
    try {
      // Chunked inserts: a single ~13k-row statement overflows drizzle's
      // recursive query builder (RangeError at boot, pre-existing on master).
      for (let i = 0; i < stations.length; i += INSERT_CHUNK_SIZE) {
        await db.insert(fuelStationsTable).values(stations.slice(i, i + INSERT_CHUNK_SIZE));
      }
      await db.insert(lastUpdatedTable).values({ lastUpdated: lastUpdatedISO });
    } catch (error) {
      for (let i = 0; i < previousStations.length; i += INSERT_CHUNK_SIZE) {
        await db.insert(fuelStationsTable).values(previousStations.slice(i, i + INSERT_CHUNK_SIZE));
      }
      if (previousLastUpdated.length > 0) await db.insert(lastUpdatedTable).values(previousLastUpdated[0]);
      throw error;
    }
  }

  async getLastUpdated(): Promise<string | null> {
    const rows = await getMemoryDb().select().from(lastUpdatedTable);
    return (rows[0]?.lastUpdated as string) ?? null;
  }

  async count(): Promise<number> {
    const [row] = await getMemoryDb().select({ value: count() }).from(fuelStationsTable);
    return row.value as number;
  }
}

export const stationRepository = new StationRepository();
