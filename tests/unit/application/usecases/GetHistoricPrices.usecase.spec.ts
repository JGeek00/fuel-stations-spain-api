import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { DateTime } from 'luxon';

// ── Mock the data seam: usecase → historicRepository ────────────────────────
vi.mock('@/infrastructure/persistence/HistoricRepository', () => ({
  historicRepository: {
    queryRange: vi.fn(),
    queryCurrent: vi.fn(),
  },
}));

// Keep the range rule out of the way so date tests stay deterministic
// (the env-driven limit branch is pinned by the controller spec).
vi.mock('@/shared/utils/historic-data-limit', () => ({
  getHistoricDataMaxRangeMonths: vi.fn(() => null),
  formatRange: vi.fn((n: number) => `${n} months`),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { getHistoricPricesUseCase } from '@/application/usecases/GetHistoricPrices.usecase';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';

const mockQueryRange = vi.mocked(historicRepository.queryRange) as Mock;
const mockQueryCurrent = vi.mocked(historicRepository.queryCurrent) as Mock;

describe('GetHistoricPrices.usecase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRange.mockResolvedValue([]);
    mockQueryCurrent.mockResolvedValue(null);
  });

  it('rejects an unparsable startDate as a bad request without querying', async () => {
    // luxon's fromSQL never throws — it returns an invalid DateTime — so the
    // unparsable dates surface through the NaN day-difference check.
    await expect(
      getHistoricPricesUseCase({ id: 'AAA', startDate: 'not-a-date', endDate: '2024-01-15' }),
    ).rejects.toMatchObject({
      error: { code: 'BAD_REQUEST', message: 'startDate must be an earlier date than endDate' },
    });
    expect(mockQueryRange).not.toHaveBeenCalled();
  });

  it('normalizes an array id to its first element for both queries', async () => {
    mockQueryRange.mockResolvedValue([{ price_5: '1.5' }]);
    mockQueryCurrent.mockResolvedValue({ id: 'AAA', signage: 'BP', price_5: '1.6' });

    const result = await getHistoricPricesUseCase({
      id: ['AAA', 'BBB'],
      startDate: '2024-01-10',
      endDate: '2024-01-15',
      includeCurrentPrices: true,
    });

    expect(mockQueryRange).toHaveBeenCalledWith('AAA', '2024-01-10', '2024-01-15');
    expect(mockQueryCurrent).toHaveBeenCalledWith('AAA');
    expect(result).toEqual([
      { price5: '1.5' },
      { id: 'AAA', signage: 'BP', price5: '1.6', stationId: 'AAA', stationSignage: 'BP', date: DateTime.now().toSQLDate() },
    ]);
  });

  it('falls back to stationSignage/stationId when the current row has no id/signage', async () => {
    mockQueryCurrent.mockResolvedValue({ stationId: 'FALLBACK-ID', stationSignage: 'Shell' });

    const result = await getHistoricPricesUseCase({
      id: 'AAA',
      startDate: '2024-01-10',
      endDate: '2024-01-15',
      includeCurrentPrices: true,
    });

    expect(result).toEqual([
      { stationId: 'FALLBACK-ID', stationSignage: 'Shell', date: DateTime.now().toSQLDate() },
    ]);
  });

  it('uses null for stationId/stationSignage when the current row has neither naming', async () => {
    mockQueryCurrent.mockResolvedValue({ price_5: '1.6' });

    const result = await getHistoricPricesUseCase({
      id: 'AAA',
      startDate: '2024-01-10',
      endDate: '2024-01-15',
      includeCurrentPrices: true,
    });

    expect(result).toEqual([{ price5: '1.6', stationId: null, stationSignage: null, date: DateTime.now().toSQLDate() }]);
  });
});
