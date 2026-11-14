import { and, asc, between, eq } from 'drizzle-orm';
import { fuelStationsTable, getMemoryDb, getPersistedDb, historicFuelStationsTable } from '@/models/db/memory-db';
import { pgHistoricData } from '@/models/db/HistoricFuelStation';
import { HISTORIC_PRICE_COLUMNS } from './fuel-fields';
import type { IHistoricRepository } from '@/application/ports/repositories';

/**
 * Historic repository — the ONLY place allowed to decide PG-vs-memory.
 * Replaces the seam duplicated in historic-prices.controller,
 * persisted-data.service and (by omission) query-historic-prices tool.
 */
class HistoricRepository implements IHistoricRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private backend(): { db: any; h: any; isPg: boolean } {
    const persisted = getPersistedDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = persisted ?? getMemoryDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h: any = persisted ? pgHistoricData : historicFuelStationsTable;
    return { db, h, isPg: !!persisted };
  }

  async queryRange(stationId: string, startDate: string, endDate: string): Promise<Record<string, unknown>[]> {
    const { db, h } = this.backend();
    const selectShape = Object.fromEntries(HISTORIC_PRICE_COLUMNS.map((c) => [c, h[c]]));
    return (await db
      .select(selectShape)
      .from(h)
      .where(and(eq(h.stationId, stationId), between(h.date, startDate, endDate)))
      .orderBy(asc(h.date))) as Record<string, unknown>[];
  }

  async queryCurrent(stationId: string): Promise<Record<string, unknown> | null> {
    const rows = await getMemoryDb()
      .select()
      .from(fuelStationsTable)
      .where(eq(fuelStationsTable.stationId, stationId))
      .limit(1);
    return (rows[0] as Record<string, unknown>) ?? null;
  }
}

export const historicRepository = new HistoricRepository();
