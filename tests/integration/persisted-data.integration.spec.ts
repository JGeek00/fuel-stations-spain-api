import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    banner: vi.fn(),
  },
}));

// The typia transform does not run under vitest (esbuild), so the runtime
// module cannot assert — same treatment as tests/unit/services/data-provider-api.service.spec.ts
vi.mock('typia', () => ({
  default: {
    assert: vi.fn((value: unknown) => value),
  },
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

// Never wait real 60s between batches; the tests keep batches <= 1 anyway
vi.mock('@/shared/utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

import { asc, count } from 'drizzle-orm';
import { persistedDataService } from '@/infrastructure/sync/persisted-data.service';
import { logger } from '@/shared/utils/logger';
import type { HistoricNoData, HistoricPrice } from '@/domain/entities';
import { getMemoryDb, historicFuelStationsTable, historicNoDataTable } from '@/infrastructure/persistence/memory-db';
import {
  initHistoricSchema,
  stationEntry,
  stubProviderFetch,
} from './helpers';

const historicResponse = (stations: Record<string, string>[]) => ({
  Fecha: '13/06/2024 10:00:00', // the only hole the date-range logic computes
  ListaEESSPrecio: stations,
  Nota: '',
  ResultadoConsulta: 'OK',
});

const seedHistoricRow = async (
  stationId: string,
  date: string,
  gasoilAPrice: number
) =>
  getMemoryDb().insert(historicFuelStationsTable).values({
    id: crypto.randomUUID(),
    stationId,
    stationSignage: 'Test',
    date,
    gasoilAPrice,
  });

const countOf = async (table: typeof historicFuelStationsTable | typeof historicNoDataTable): Promise<number> => {
  const [row] = await getMemoryDb().select({ value: count() }).from(table);
  return row.value as number;
};

const historicCount = () => countOf(historicFuelStationsTable);
const noDataCount = () => countOf(historicNoDataTable);

describe('PersistedDataService.loadStationsHistoric (integration, real in-memory sqlite)', () => {
  beforeEach(() => {
    initHistoricSchema();
    // Fixed "today" (2024-06-15) so the date-range logic is deterministic:
    // seeded data = 2024-06-12 and 2024-06-14, leaving 2024-06-13 as the only hole
    vi.useFakeTimers({ now: new Date('2024-06-15T12:00:00'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetches the missing dates and persists the parsed historic rows', async () => {
    await seedHistoricRow('ES000001', '2024-06-12', 1.4);
    await seedHistoricRow('ES000001', '2024-06-14', 1.42);
    const fetchMock = stubProviderFetch({
      historic: () => historicResponse([stationEntry()]),
    });

    await persistedDataService.loadAll();

    // one hole -> one fetch, one batch (no sleep in between)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/EstacionesTerrestresHist/13-06-2024'),
      expect.anything()
    );

    const rows = (await getMemoryDb()
      .select()
      .from(historicFuelStationsTable)
      .orderBy(asc(historicFuelStationsTable.date))) as HistoricPrice[];
    expect(rows).toHaveLength(3);
    const fetched = rows.find((r) => r.date === '2024-06-13');
    expect(fetched).toBeDefined();
    expect(fetched?.stationId).toBe('ES000123');
    expect(fetched?.gasoilAPrice).toBe(1.5);
    expect(fetched?.stationSignage).toBe('Test');

    expect(await noDataCount()).toBe(0);
  });

  it('deduplicates a batch that carries duplicate (stationId, date) rows: conflict-ignore now applies on sqlite too (Drizzle onConflictDoNothing), matching the postgres semantics the old option targeted', async () => {
    await seedHistoricRow('ES000001', '2024-06-12', 1.4);
    await seedHistoricRow('ES000001', '2024-06-14', 1.42);
    stubProviderFetch({
      historic: () => historicResponse([stationEntry(), stationEntry({ 'Precio Gasoleo A': '2,500' })]),
    });

    await persistedDataService.loadAll();

    // the duplicate row was ignored, the first one was kept
    expect(await historicCount()).toBe(3);
    expect(await noDataCount()).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('marks dates with no provider data as no-data instead of storing stations', async () => {
    await seedHistoricRow('ES000001', '2024-06-12', 1.4);
    await seedHistoricRow('ES000001', '2024-06-14', 1.42);
    stubProviderFetch({
      historic: () => ({ Fecha: '13/06/2024 10:00:00', ListaEESSPrecio: [], Nota: '', ResultadoConsulta: 'OK' }),
    });

    await persistedDataService.loadAll();

    expect(await historicCount()).toBe(2);
    const noData = (await getMemoryDb().select().from(historicNoDataTable)) as HistoricNoData[];
    expect(noData).toHaveLength(1);
    expect(noData[0].date).toBe('2024-06-13');
  });

  it('returns early without fetching when the database has no historic data', async () => {
    const fetchMock = stubProviderFetch({ reject: new Error('must not be called') });

    await persistedDataService.loadAll();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await noDataCount()).toBe(0);
  });
});
