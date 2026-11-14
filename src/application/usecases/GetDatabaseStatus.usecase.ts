import { getPersistedDb } from '@/models/db/memory-db';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { LastUpdated } from '@/models/db/LastUpdated';

/**
 * Database status use case for MCP get-database-status + database-info resource.
 * Keeps the same shape both consumers already return.
 * Prefers the injected DatabaseService seam when available (tests + MCP),
 * falling back to the global persisted handle.
 */
export async function getDatabaseStatusUseCase(databaseService?: { persistedDbInstance?: { authenticate: () => Promise<unknown> } }) {
  const totalStations = await FuelStationsTable.count();
  const lastUpdatedRow = await LastUpdated.findOne();
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
  } else {
    const persisted = getPersistedDb();
    hasPersisted = !!persisted;
    if (persisted) {
      try {
        await persisted.authenticate();
        historicStatus = 'connected';
      } catch {
        historicStatus = 'disconnected';
      }
    }
  }
  return {
    realtimeDatabase: {
      type: 'sqlite-memory',
      status: 'connected',
      totalStations,
      lastUpdated: lastUpdatedRow?.getDataValue('lastUpdated') ?? null,
    },
    historicDatabase: {
      type: hasPersisted ? 'postgres' : 'sqlite-memory',
      status: historicStatus,
    },
  };
}
