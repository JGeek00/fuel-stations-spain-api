import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  ensureMemorySchema,
} from '@/infrastructure/persistence/ensureMemorySchema';
import {
  fuelStationsTable,
  getMemoryDb,
  lastUpdatedTable,
} from '@/infrastructure/persistence/memory-db';
import { stationRepository } from '@/infrastructure/persistence/StationRepository';

/**
 * StationRepository against the real :memory: Drizzle database.
 * Seeds rows through direct Drizzle inserts over the shared tables.
 */

const makeRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'row-1',
  stationId: 'ES001',
  postalCode: '28001',
  address: 'Calle Test 1',
  openingHours: '24h',
  latitude: 40.4,
  longitude: -3.7,
  locality: 'Madrid',
  margin: 'L',
  municipality: 'Madrid',
  province: 'Madrid',
  referral: '',
  signage: 'Test',
  saleType: 'P',
  municipalityId: 28079,
  provinceId: 28,
  regionId: 29,
  gasoilAPrice: 1.5,
  gasoline95E5Price: 1.6,
  ...overrides,
});

const seed = async (rows: Record<string, unknown>[]): Promise<void> => {
  await getMemoryDb().insert(fuelStationsTable).values(rows);
};

const seedLastUpdated = async (iso: string): Promise<void> => {
  await getMemoryDb().insert(lastUpdatedTable).values({ lastUpdated: iso });
};

const countRows = async (): Promise<number> => {
  const rows = await getMemoryDb().select().from(fuelStationsTable);
  return rows.length;
};

describe('StationRepository', () => {
  beforeEach(() => {
    ensureMemorySchema();
  });

  describe('query', () => {
    it('returns all rows and total count without filters', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' }), makeRow({ id: 'row-3', stationId: 'ES003' })]);

      const { rows, count } = await stationRepository.query({});

      expect(rows).toHaveLength(3);
      expect(count).toBe(3);
    });

    it('filters by station ids', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' })]);

      const { rows, count } = await stationRepository.query({ ids: ['ES002'] });

      expect(rows).toHaveLength(1);
      expect(rows[0].stationId).toBe('ES002');
      expect(count).toBe(1);
    });

    it('filters by bounding box', async () => {
      await seed([
        makeRow(),
        makeRow({ id: 'row-2', stationId: 'ES002', latitude: 41.9, longitude: 2.1 }),
      ]);

      const { rows, count } = await stationRepository.query({
        boundingBox: { minLat: 40.3, maxLat: 40.5, minLon: -3.8, maxLon: -3.6 },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].stationId).toBe('ES001');
      expect(count).toBe(1);
    });

    it('filters by municipalityId', async () => {
      await seed([
        makeRow(),
        makeRow({ id: 'row-2', stationId: 'ES002', municipalityId: 8001, municipality: 'Barcelona', province: 'Barcelona' }),
      ]);

      const { rows, count } = await stationRepository.query({ municipalityId: 8001 });

      expect(rows).toHaveLength(1);
      expect(rows[0].stationId).toBe('ES002');
      expect(count).toBe(1);
    });

    it('applies limit and offset for pagination', async () => {
      await seed([
        makeRow(),
        makeRow({ id: 'row-2', stationId: 'ES002' }),
        makeRow({ id: 'row-3', stationId: 'ES003' }),
      ]);

      const page = await stationRepository.query({ limit: 2, offset: 1 });
      expect(page.rows).toHaveLength(2);
      expect(page.count).toBe(3);

      const first = await stationRepository.query({ limit: 1 });
      expect(first.rows).toHaveLength(1);
    });

    it('ignores an empty ids list (falls through to unfiltered query)', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' })]);

      const { rows, count } = await stationRepository.query({ ids: [] });

      expect(rows).toHaveLength(2);
      expect(count).toBe(2);
    });
  });

  describe('findByStationId', () => {
    it('returns the station when found', async () => {
      await seed([makeRow({ id: 'row-2', stationId: 'ES002', signage: 'Other' })]);

      const station = await stationRepository.findByStationId('ES002');

      expect(station).not.toBeNull();
      expect(station?.stationId).toBe('ES002');
      expect(station?.signage).toBe('Other');
    });

    it('returns null when the station does not exist', async () => {
      const station = await stationRepository.findByStationId('missing');

      expect(station).toBeNull();
    });
  });

  describe('findCheapest', () => {
    it('sorts by the selected fuel price ascending', async () => {
      await seed([
        makeRow({ gasoilAPrice: 1.55 }),
        makeRow({ id: 'row-2', stationId: 'ES002', gasoilAPrice: 1.4 }),
        makeRow({ id: 'row-3', stationId: 'ES003', gasoilAPrice: 1.62 }),
      ]);

      const rows = await stationRepository.findCheapest({ fuelType: 'gasoilAPrice' });

      expect(rows).toHaveLength(3);
      expect((rows[0] as Record<string, unknown>).gasoilAPrice).toBe(1.4);
      expect((rows[2] as Record<string, unknown>).gasoilAPrice).toBe(1.62);
    });

    it('restricts to the bounding box around the given coordinates', async () => {
      await seed([
        makeRow({ gasoilAPrice: 1.7 }),
        makeRow({ id: 'row-2', stationId: 'ES002', municipality: 'Barcelona', province: 'Barcelona', latitude: 41.9, longitude: 2.1, gasoilAPrice: 1.3 }),
      ]);

      // Radius covering Madrid but not Barcelona (30km default).
      const rows = await stationRepository.findCheapest({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7 });

      expect(rows).toHaveLength(1);
      expect((rows[0] as Record<string, unknown>).gasoilAPrice).toBe(1.7);
    });

    it('honors an explicit distanceKm', async () => {
      await seed([
        makeRow({ gasoilAPrice: 1.5, latitude: 40.4, longitude: -3.7 }),
        makeRow({ id: 'row-2', stationId: 'ES002', gasoilAPrice: 1.2, latitude: 40.2, longitude: -3.5 }),
      ]);

      const rows = await stationRepository.findCheapest({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7, distanceKm: 50 });

      expect(rows).toHaveLength(2);
      expect((rows[0] as Record<string, unknown>).gasoilAPrice).toBe(1.2);
    });

    it('applies the requested limit (default 10)', async () => {
      const rows = Array.from({ length: 12 }, (_, i) => makeRow({ id: `row-${i}`, stationId: `ES${i}`, gasoilAPrice: 1 + i / 100 }));
      await seed(rows);

      const limited = await stationRepository.findCheapest({ fuelType: 'gasoilAPrice', limit: 3 });
      expect(limited).toHaveLength(3);

      const all = await stationRepository.findCheapest({ fuelType: 'gasoilAPrice' });
      expect(all).toHaveLength(10);
    });
  });

  describe('compare', () => {
    it('returns all stations when no filters are given', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' })]);

      const rows = await stationRepository.compare({ fuelType: 'gasoilAPrice' });

      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveProperty('gasoilAPrice', 1.5);
    });

    it('filters by ids', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' })]);

      const rows = await stationRepository.compare({ fuelType: 'gasoilAPrice', ids: ['row-2'] });

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('row-2');
    });

    it('filters by municipalityId', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002', municipalityId: 8001 })]);

      const rows = await stationRepository.compare({ fuelType: 'gasoilAPrice', municipalityId: 8001 });

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('row-2');
    });

    it('combines ids and municipalityId filters', async () => {
      await seed([
        makeRow(),
        makeRow({ id: 'row-2', stationId: 'ES002', municipalityId: 8001 }),
        makeRow({ id: 'row-3', stationId: 'ES003' }),
      ]);

      const rows = await stationRepository.compare({ fuelType: 'gasoilAPrice', ids: ['row-2', 'row-3'], municipalityId: 8001 });

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('row-2');
    });

    it('treats an empty ids list as no ids filter', async () => {
      await seed([makeRow(), makeRow({ id: 'row-2', stationId: 'ES002' })]);

      const rows = await stationRepository.compare({ fuelType: 'gasoilAPrice', ids: [] });

      expect(rows).toHaveLength(2);
    });

    it('applies the requested limit (default 50)', async () => {
      const rows = Array.from({ length: 60 }, (_, i) => makeRow({ id: `row-${i}`, stationId: `ES${i}` }));
      await seed(rows);

      const limited = await stationRepository.compare({ fuelType: 'gasoilAPrice', limit: 5 });
      expect(limited).toHaveLength(5);

      const all = await stationRepository.compare({ fuelType: 'gasoilAPrice' });
      expect(all).toHaveLength(50);
    });
  });

  describe('searchByLocation', () => {
    it('returns stations inside the radius', async () => {
      await seed([
        makeRow(),
        makeRow({ id: 'row-2', stationId: 'ES002', municipality: 'Barcelona', province: 'Barcelona', latitude: 41.9, longitude: 2.1 }),
      ]);

      const rows = await stationRepository.searchByLocation(40.4, -3.7, 10);

      expect(rows).toHaveLength(1);
      expect(rows[0].stationId).toBe('ES001');
    });
  });

  describe('replaceAll', () => {
    it('replaces all stations and the lastUpdated timestamp', async () => {
      await seed([makeRow({ id: 'old-1' }), makeRow({ id: 'old-2' })]);
      await seedLastUpdated('2024-01-01T00:00:00.000Z');

      await stationRepository.replaceAll([makeRow({ id: 'new-1' }), makeRow({ id: 'new-2' }), makeRow({ id: 'new-3' })], '2025-06-01T10:00:00.000Z');

      expect(await countRows()).toBe(3);
      const stale = await getMemoryDb().select().from(fuelStationsTable).where(eq(fuelStationsTable.id, 'old-1'));
      expect(stale).toHaveLength(0);
      expect(await stationRepository.getLastUpdated()).toBe('2025-06-01T10:00:00.000Z');
    });

    it('restores the previous stations and lastUpdated when the insert fails', async () => {
      await seed([makeRow({ id: 'prev-1' }), makeRow({ id: 'prev-2' })]);
      await seedLastUpdated('2024-01-01T00:00:00.000Z');

      // Duplicate primary key inside one chunk forces the insert to fail.
      await expect(
        stationRepository.replaceAll(
          [makeRow({ id: 'dup' }), makeRow({ id: 'dup' })],
          '2025-06-01T10:00:00.000Z',
        ),
      ).rejects.toThrow();

      expect(await countRows()).toBe(2);
      const restored = await getMemoryDb().select().from(fuelStationsTable);
      expect(restored.map((r: Record<string, unknown>) => r.id).sort()).toEqual(['prev-1', 'prev-2']);
      expect(await stationRepository.getLastUpdated()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('restores the previous stations without a lastUpdated row when none existed', async () => {
      await seed([makeRow({ id: 'prev-1' })]);

      await expect(
        stationRepository.replaceAll([makeRow({ id: 'dup' }), makeRow({ id: 'dup' })], '2025-06-01T10:00:00.000Z'),
      ).rejects.toThrow();

      expect(await countRows()).toBe(1);
      expect((await getMemoryDb().select().from(fuelStationsTable))[0].id).toBe('prev-1');
      expect(await stationRepository.getLastUpdated()).toBeNull();
    });
  });

  describe('getLastUpdated', () => {
    it('returns the stored timestamp', async () => {
      await seedLastUpdated('2025-03-01T08:00:00.000Z');

      expect(await stationRepository.getLastUpdated()).toBe('2025-03-01T08:00:00.000Z');
    });

    it('returns null when no timestamp is stored', async () => {
      expect(await stationRepository.getLastUpdated()).toBeNull();
    });
  });

  describe('count', () => {
    it('returns the number of stored stations', async () => {
      expect(await stationRepository.count()).toBe(0);

      await seed([makeRow(), makeRow({ id: 'row-2' })]);
      expect(await stationRepository.count()).toBe(2);
    });
  });
});
