import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgTable } from 'drizzle-orm/pg-core';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';
import {
  fuelStationsTable,
  historicFuelStationsTable,
  historicNoDataTable,
  isPersistedDbInitialized,
  markPersistedDbInitialized,
  resetMemoryDb,
  setPersistedDb,
  getPersistedDb,
  getMemoryDb,
} from '@/infrastructure/persistence/memory-db';
import { pgHistoricData, pgHistoricNoData } from '@/infrastructure/persistence/pg-tables';
import type { HistoricPrice } from '@/domain/entities';

/**
 * HistoricRepository — covers both backends (memory sqlite and a mocked
 * Drizzle-pg handle installed through setPersistedDb) plus the seam helpers.
 */

const makeHistoricRow = (overrides: Partial<HistoricPrice> = {}): HistoricPrice => ({
  stationId: 'ES001',
  stationSignage: 'Test',
  adbluePrice: null,
  ammoniaPrice: null,
  biodieselPrice: null,
  bioethanolPrice: null,
  compressedBiogasPrice: null,
  liquefiedBiogasPrice: null,
  renewableDieselPrice: null,
  cngPrice: null,
  lngPrice: null,
  lpgPrice: null,
  gasoilAPrice: 1.5,
  gasoilBPrice: null,
  premiumGasoilPrice: null,
  gasoline95E10Price: null,
  gasoline95E25Price: null,
  gasoline95E5Price: null,
  gasoline95E5PremiumPrice: null,
  gasoline95E85Price: null,
  gasoline98E10Price: null,
  gasoline98E5Price: null,
  renewableGasolinePrice: null,
  hydrogenPrice: null,
  methanolPrice: null,
  date: '2025-01-01',
  ...overrides,
});

// Flexible Drizzle-pg handle mock: chainable builder resolving to `rows`.
function createPgDbMock(initialRows: unknown[] = []) {
  const state = { rows: initialRows };
  const builder: Record<string, any> = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(state.rows).then(onFulfilled, onRejected),
  };
  const db: Record<string, any> = {
    select: vi.fn(() => builder),
    selectDistinct: vi.fn(() => builder),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(async () => undefined),
        then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(undefined).then(onFulfilled),
      })),
    })),
  };
  return { db, builder, state };
}

describe('HistoricRepository', () => {
  beforeEach(() => {
    resetMemoryDb();
    setPersistedDb(null);
  });

  describe('isReady', () => {
    it('is false before anything marks the persisted DB initialized', () => {
      expect(historicRepository.isReady()).toBe(false);
    });

    it('is true after markPersistedDbInitialized', () => {
      expect(isPersistedDbInitialized()).toBe(false);
      markPersistedDbInitialized();
      expect(historicRepository.isReady()).toBe(true);
      expect(isPersistedDbInitialized()).toBe(true);
    });
  });

  describe('memory backend (no persisted DB)', () => {
    beforeEach(() => {
      setPersistedDb(null);
    });

    it('queries the sqlite historic table', async () => {
      await getMemoryDb().insert(historicFuelStationsTable).values([
        { id: 'h1', ...makeHistoricRow({ date: '2025-01-02', stationId: 'ES001' }) },
        { id: 'h2', ...makeHistoricRow({ date: '2025-01-01', stationId: 'ES001' }) },
      ]);

      const rows = await historicRepository.queryRange('ES001', '2025-01-01', '2025-01-31');

      expect(rows).toHaveLength(2);
      // Ordered by date ascending.
      expect(rows[0].date).toBe('2025-01-01');
      expect(rows[0].stationId).toBe('ES001');
      expect(rows[0].gasoilAPrice).toBe(1.5);
    });

    it('returns existing dates sorted and without nulls', async () => {
      await getMemoryDb().insert(historicFuelStationsTable).values([
        { id: 'h1', ...makeHistoricRow({ date: '2025-01-03' }) },
        { id: 'h2', ...makeHistoricRow({ date: '2025-01-01' }) },
        { id: 'h3', ...makeHistoricRow({ date: '2025-01-02' }) },
      ]);

      const dates = await historicRepository.getExistingDates();

      expect(dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
    });

    it('returns no-data dates', async () => {
      await getMemoryDb().insert(historicNoDataTable).values([{ date: '2025-02-01' }]);

      expect(await historicRepository.getNoDataDates()).toEqual(['2025-02-01']);
    });

    it('inserts a batch with generated ids and ignores conflicts on re-insert', async () => {
      const rows: HistoricPrice[] = [makeHistoricRow({ date: '2025-03-01' }), makeHistoricRow({ stationId: 'ES002', date: '2025-03-01' })];

      await historicRepository.insertHistoricBatch(rows);
      // Re-inserting identical payloads must not throw (onConflictDoNothing);
      // the unique (stationId, date) index keeps the second batch out.
      await historicRepository.insertHistoricBatch(rows);

      const stored = await getMemoryDb().select().from(historicFuelStationsTable);
      expect(stored).toHaveLength(2);
      for (const row of stored) expect(row.id).toBeTruthy();
    });

    it('does not touch the DB when the batch is empty', async () => {
      await historicRepository.insertHistoricBatch([]);

      const stored = await getMemoryDb().select().from(historicFuelStationsTable);
      expect(stored).toHaveLength(0);
    });

    it('marks a date as no-data', async () => {
      await historicRepository.markNoDataDate('2025-04-01');

      expect(await historicRepository.getNoDataDates()).toEqual(['2025-04-01']);
    });

    it('pings through the memory select fallback (no authenticate method)', async () => {
      await expect(historicRepository.ping()).resolves.toBeUndefined();
    });

    it('queries the realtime table for current prices', async () => {
      const { ensureMemorySchema } = await import('@/infrastructure/persistence/ensureMemorySchema');
      ensureMemorySchema();
      await getMemoryDb().insert(fuelStationsTable)
        .values({ id: 'r1', stationId: 'ES001', signage: 'Current' });

      const current = await historicRepository.queryCurrent('ES001');

      expect(current).not.toBeNull();
      expect(current?.stationId).toBe('ES001');
    });

    it('returns null for current prices when the station is unknown', async () => {
      const { ensureMemorySchema } = await import('@/infrastructure/persistence/ensureMemorySchema');
      ensureMemorySchema();
      expect(await historicRepository.queryCurrent('missing')).toBeNull();
    });
  });

  describe('pg backend (persisted DB installed)', () => {
    it('queries the pg historic table when getPersistedDb returns a handle', async () => {
      const { db, builder } = createPgDbMock([
        { date: '2025-01-01', gasoilAPrice: 1.4 },
      ]);
      setPersistedDb(db);

      const rows = await historicRepository.queryRange('ES001', '2025-01-01', '2025-01-31');

      // The pg table definition is passed to from(), not the sqlite one.
      expect(builder.from).toHaveBeenCalledWith(pgHistoricData);
      expect(rows).toEqual([{ date: '2025-01-01', gasoilAPrice: 1.4 }]);
    });

    it('reads existing dates from the pg table', async () => {
      const { db } = createPgDbMock([{ date: '2025-01-01' }, { date: null }]);
      setPersistedDb(db);

      const dates = await historicRepository.getExistingDates();

      // Null dates are filtered out.
      expect(dates).toEqual(['2025-01-01']);
      expect(db.selectDistinct).toHaveBeenCalled();
    });

    it('reads no-data dates from the pg table', async () => {
      const { db, builder } = createPgDbMock([{ date: '2025-05-01' }]);
      setPersistedDb(db);

      expect(await historicRepository.getNoDataDates()).toEqual(['2025-05-01']);
      expect(builder.from).toHaveBeenCalledWith(pgHistoricNoData);
    });

    it('inserts historic batches into the pg table with conflict-ignore', async () => {
      const { db } = createPgDbMock();
      setPersistedDb(db);

      await historicRepository.insertHistoricBatch([makeHistoricRow()]);

      expect(db.insert).toHaveBeenCalledWith(pgHistoricData);
      const values = db.insert.mock.results[0].value.values;
      expect(values).toHaveBeenCalledWith([expect.objectContaining({ stationId: 'ES001', id: expect.any(String) })]);
      expect(values.mock.results[0].value.onConflictDoNothing).toHaveBeenCalled();
    });

    it('marks no-data dates in the pg table', async () => {
      const { db } = createPgDbMock();
      setPersistedDb(db);

      await historicRepository.markNoDataDate('2025-06-01');

      expect(db.insert).toHaveBeenCalledWith(pgHistoricNoData);
      expect(db.insert.mock.results[0].value.values).toHaveBeenCalledWith({ date: '2025-06-01' });
    });

    describe('ping', () => {
      it('authenticates against the pg handle when it exposes authenticate', async () => {
        const authenticate = vi.fn().mockResolvedValue(undefined);
        setPersistedDb({ authenticate });

        await expect(historicRepository.ping()).resolves.toBeUndefined();
        expect(authenticate).toHaveBeenCalledTimes(1);
      });

      it('propagates authentication failures', async () => {
        setPersistedDb({ authenticate: vi.fn().mockRejectedValue(new Error('Connection refused')) });

        await expect(historicRepository.ping()).rejects.toThrow('Connection refused');
      });

      it('falls back to a memory select when the handle has no authenticate method', async () => {
        const { db, builder } = createPgDbMock();
        setPersistedDb(db);

        await expect(historicRepository.ping()).resolves.toBeUndefined();
        // Fallback select runs against the memory sqlite historic table.
        expect(builder.from).toHaveBeenCalledWith(historicFuelStationsTable);
      });
    });
  });

  describe('seam helpers', () => {
    it('declares the unique (stationId, date) index on the pg historic table', () => {
      // drizzle-orm stores the extra-config callback lazily (only drizzle-kit
      // invokes it during schema push); call it here to pin the index config.
      const table = pgHistoricData as unknown as Record<symbol, unknown>;
      const { Symbol: pgSymbols } = PgTable as unknown as {
        Symbol: { ExtraConfigBuilder: symbol; ExtraConfigColumns: symbol };
      };
      const builder = table[pgSymbols.ExtraConfigBuilder] as (
        cols: Record<string, unknown>
      ) => unknown[];
      const extraColumns = table[pgSymbols.ExtraConfigColumns] as Record<string, unknown>;

      const config = builder(extraColumns) as Array<{ config: { name: string; unique: boolean; columns: unknown[] } }>;

      expect(config).toHaveLength(1);
      expect(config[0].config).toMatchObject({
        name: 'idx_historic_station_date',
        unique: true,
      });
      expect(config[0].config.columns).toHaveLength(2);
    });

    it('exports a singleton instance', async () => {
      const module = await import('@/infrastructure/persistence/HistoricRepository');
      expect(module.historicRepository).toBe(historicRepository);
    });

    it('getPersistedDb reflects the installed handle', () => {
      expect(getPersistedDb()).toBeNull();
      const handle = { marker: true };
      setPersistedDb(handle);
      expect(getPersistedDb()).toBe(handle);
      setPersistedDb(null);
      expect(getPersistedDb()).toBeNull();
    });
  });
});
