import { getPersistedDb } from '@/models/db/memory-db';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { LastUpdated } from '@/models/db/LastUpdated';

/**
 * Database status use case for MCP get-database-status + database-info resource.
 * Keeps the same shape both consumers already return.
 */
export async function getDatabaseStatusUseCase() {
  const totalStations = await FuelStationsTable.count();
  const lastUpdatedRow = await LastUpdated.findOne();
  const persisted = getPersistedDb();
  let historicStatus: string = 'disconnected';
  if (persisted) {
    try {
      await persisted.authenticate();
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
      lastUpdated: lastUpdatedRow?.getDataValue('lastUpdated') ?? null,
    },
    historicDatabase: {
      type: persisted ? 'postgres' : 'sqlite-memory',
      status: historicStatus,
    },
  };
}
