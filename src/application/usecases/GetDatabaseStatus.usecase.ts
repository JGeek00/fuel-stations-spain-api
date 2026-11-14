import { stationRepository } from '@/infrastructure/persistence/StationRepository';

/**
 * Database status use case for MCP get-database-status + database-info resource.
 * Keeps the same shape both consumers already return.
 * Historic status comes from the injected DatabaseService seam (tests + MCP).
 */
export async function getDatabaseStatusUseCase(databaseService?: { persistedDbInstance?: { authenticate: () => Promise<unknown> } }) {
  const totalStations = await stationRepository.count();
  const lastUpdated = await stationRepository.getLastUpdated();
  let historicStatus: string = 'disconnected';
  let hasPersisted = false;
  const persistedFromService = databaseService?.persistedDbInstance;
  if (persistedFromService) {
    hasPersisted = true;
    try {
      await persistedFromService.authenticate();
      historicStatus = 'connected';
    } catch {
      historicStatus = 'disconnected';
    }
  }
  return {
    realtimeDatabase: {
      type: 'sqlite-memory',
      status: 'connected',
      totalStations,
      lastUpdated,
    },
    historicDatabase: {
      type: hasPersisted ? 'postgres' : 'sqlite-memory',
      status: historicStatus,
    },
  };
}
