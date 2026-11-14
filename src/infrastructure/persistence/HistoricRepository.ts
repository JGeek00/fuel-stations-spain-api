import { randomUUID } from 'crypto';
import { and, asc, between, eq } from 'drizzle-orm';
import {
  fuelStationsTable,
  getMemoryDb,
  getPersistedDb,
  historicFuelStationsTable,
  historicNoDataTable,
  isPersistedDbInitialized,
} from '@/infrastructure/persistence/memory-db';
import { pgHistoricData, pgHistoricNoData } from './pg-tables';
import type { HistoricPrice } from '@/domain/entities/HistoricPrice.model';
import { HISTORIC_PRICE_COLUMNS } from './fuel-fields';
import type { IHistoricRepository } from '@/application/ports/repositories';

/**
 * Historic repository — the ONLY place allowed to decide PG-vs-memory.
 * Replaces the seam duplicated in historic-prices.controller,
 * persisted-data.service and (by omission) query-historic-prices tool.
 */
class HistoricRepository implements IHistoricRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private backend(): { db: any; h: any; noDataTable: any; isPg: boolean } {
    const persisted = getPersistedDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = persisted ?? getMemoryDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h: any = persisted ? pgHistoricData : historicFuelStationsTable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noDataTable: any = persisted ? pgHistoricNoData : historicNoDataTable;
    return { db, h, noDataTable, isPg: !!persisted };
  }

  /** Whether the persisted backend is initialized (early-exit seam for jobs). */
  isReady(): boolean {
    return isPersistedDbInitialized();
  }

  /** Sorted list of dates already present in the historic table. */
  async getExistingDates(): Promise<string[]> {
    const { db, h } = this.backend();
    const rows: { date: string | null }[] = await db
      .selectDistinct({ date: h.date })
      .from(h)
      .orderBy(asc(h.date));
    return rows.map((e) => e.date).filter((e): e is string => e != null);
  }

  /** Dates previously marked as having no data. */
  async getNoDataDates(): Promise<string[]> {
    const { db, noDataTable } = this.backend();
    const rows: { date: string | null }[] = await db.select({ date: noDataTable.date }).from(noDataTable);
    return rows.map((e) => e.date).filter((e): e is string => e != null);
  }

  /** Inserts a batch of historic rows (adds ids, ignores conflicts). */
  async insertHistoricBatch(rows: HistoricPrice[]): Promise<void> {
    if (rows.length === 0) return;
    const { db, h } = this.backend();
    await db
      .insert(h)
      .values(rows.map((station) => ({ id: randomUUID(), ...station })))
      .onConflictDoNothing();
  }

  /** Marks a date as having no data to avoid retrying it. */
  async markNoDataDate(date: string): Promise<void> {
    const { db, noDataTable } = this.backend();
    await db.insert(noDataTable).values({ date });
  }

  /** Liveness check for the historic backend (middleware seam). */
  async ping(): Promise<void> {
    const { db } = this.backend();
    if (typeof db.authenticate === 'function') {
      await db.authenticate();
      return;
    }
    await db.select({ date: historicFuelStationsTable.date }).from(historicFuelStationsTable).limit(1);
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
