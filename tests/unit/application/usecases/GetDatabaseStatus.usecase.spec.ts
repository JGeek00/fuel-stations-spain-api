import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock the data seam: usecase → stationRepository ─────────────────────────
vi.mock('@/infrastructure/persistence/StationRepository', () => ({
  stationRepository: {
    count: vi.fn(),
    getLastUpdated: vi.fn(),
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { getDatabaseStatusUseCase } from '@/application/usecases/GetDatabaseStatus.usecase';
import { stationRepository } from '@/infrastructure/persistence/StationRepository';

const mockCount = vi.mocked(stationRepository.count) as Mock;
const mockGetLastUpdated = vi.mocked(stationRepository.getLastUpdated) as Mock;

describe('GetDatabaseStatus.usecase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(1234);
    mockGetLastUpdated.mockResolvedValue('2024-01-15T10:00:00.000Z');
  });

  it('reports a connected postgres historic database when authenticate succeeds', async () => {
    const databaseService = {
      persistedDbInstance: { authenticate: vi.fn().mockResolvedValue(undefined) },
    };

    const result = await getDatabaseStatusUseCase(databaseService);

    expect(result).toEqual({
      realtimeDatabase: {
        type: 'sqlite-memory',
        status: 'connected',
        totalStations: 1234,
        lastUpdated: '2024-01-15T10:00:00.000Z',
      },
      historicDatabase: { type: 'postgres', status: 'connected' },
    });
    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockGetLastUpdated).toHaveBeenCalledTimes(1);
    expect(databaseService.persistedDbInstance.authenticate).toHaveBeenCalledTimes(1);
  });

  it('reports a disconnected postgres historic database when authenticate rejects', async () => {
    const result = await getDatabaseStatusUseCase({
      persistedDbInstance: { authenticate: vi.fn().mockRejectedValue(new Error('auth failed')) },
    });

    expect(result).toEqual({
      realtimeDatabase: {
        type: 'sqlite-memory',
        status: 'connected',
        totalStations: 1234,
        lastUpdated: '2024-01-15T10:00:00.000Z',
      },
      historicDatabase: { type: 'postgres', status: 'disconnected' },
    });
  });

  it('falls back to a disconnected sqlite-memory historic database without a service', async () => {
    const result = await getDatabaseStatusUseCase();

    expect(result).toEqual({
      realtimeDatabase: {
        type: 'sqlite-memory',
        status: 'connected',
        totalStations: 1234,
        lastUpdated: '2024-01-15T10:00:00.000Z',
      },
      historicDatabase: { type: 'sqlite-memory', status: 'disconnected' },
    });
  });

  it('propagates a null lastUpdated when the memory database was never updated', async () => {
    mockGetLastUpdated.mockResolvedValue(null);

    const result = await getDatabaseStatusUseCase();

    expect(result.realtimeDatabase.lastUpdated).toBeNull();
  });
});
