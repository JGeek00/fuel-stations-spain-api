import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// Migrations model: the real Drizzle pgTable is side-effect free, so it is NOT
// mocked; the service only passes it through to the (mocked) Drizzle db.

// Mock MIGRATIONS
const mockMigration001 = {
  version: '001',
  name: 'baseline',
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
};
const mockMigration002 = {
  version: '002',
  name: 'unique_station_date',
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/migrations', () => ({
  MIGRATIONS: [mockMigration001, mockMigration002],
}));

/**
 * Drizzle-pg seam mock: the migration service talks to a NodePgDatabase-like
 * object (select/insert/delete/execute/transaction). The transaction mock runs
 * the callback with the same db, so `tx` and `db` are the same object.
 */
const createMockDb = () => {
  const appliedRows: Array<{ version: string; name: string; appliedAt: Date }> = [];
  const db: any = {
    appliedRows,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(async () => [...appliedRows]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
    execute: vi.fn(async () => ({ rows: [{ has_tables: false }] })),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
  };
  return db;
};

describe('MigrationService (Drizzle pg seam)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // getApplied() seeds through the shared mockDb state
    mockDb = createMockDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('run', () => {
    it('applies pending migrations', async () => {
      const { migrationService } = await import('@/services/migration.service');
      await migrationService.run(mockDb);

      expect(mockDb.transaction).toHaveBeenCalledTimes(2);
      expect(mockMigration001.up).toHaveBeenCalledWith(mockDb);
      expect(mockMigration002.up).toHaveBeenCalledWith(mockDb);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('skips already applied migrations', async () => {
      mockDb.appliedRows.push({ version: '001', name: 'baseline', appliedAt: new Date() });

      const { migrationService } = await import('@/services/migration.service');
      await migrationService.run(mockDb);

      expect(mockMigration001.up).not.toHaveBeenCalled();
      expect(mockMigration002.up).toHaveBeenCalledWith(mockDb);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('does nothing when all migrations are applied', async () => {
      mockDb.appliedRows.push(
        { version: '001', name: 'baseline', appliedAt: new Date() },
        { version: '002', name: 'unique_station_date', appliedAt: new Date() },
      );

      const { migrationService } = await import('@/services/migration.service');
      await migrationService.run(mockDb);

      expect(mockMigration001.up).not.toHaveBeenCalled();
      expect(mockMigration002.up).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('inserts the applied version and name on the migrations table', async () => {
      const { migrationService } = await import('@/services/migration.service');
      await migrationService.run(mockDb);

      const firstInsert = (mockDb.insert.mock.results[0].value as any).values.mock.calls[0][0];
      expect(firstInsert).toMatchObject({ version: '001', name: 'baseline' });
      expect(firstInsert.appliedAt).toBeInstanceOf(Date);
    });
  });

  describe('rollback', () => {
    it('rolls back the last migration', async () => {
      mockDb.appliedRows.push(
        { version: '001', name: 'baseline', appliedAt: new Date() },
        { version: '002', name: 'unique_station_date', appliedAt: new Date() },
      );

      const { migrationService } = await import('@/services/migration.service');
      await migrationService.rollback(mockDb, 1);

      expect(mockMigration002.down).toHaveBeenCalledWith(mockDb);
      expect(mockMigration001.down).not.toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });

    it('rolls back multiple migrations', async () => {
      mockDb.appliedRows.push(
        { version: '001', name: 'baseline', appliedAt: new Date() },
        { version: '002', name: 'unique_station_date', appliedAt: new Date() },
      );

      const { migrationService } = await import('@/services/migration.service');
      await migrationService.rollback(mockDb, 2);

      expect(mockMigration002.down).toHaveBeenCalled();
      expect(mockMigration001.down).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no migrations to rollback', async () => {
      const { migrationService } = await import('@/services/migration.service');
      await migrationService.rollback(mockDb, 1);

      expect(mockMigration001.down).not.toHaveBeenCalled();
      expect(mockMigration002.down).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('skips migrations not found in registry', async () => {
      mockDb.appliedRows.push({ version: '999', name: 'unknown', appliedAt: new Date() });

      const { migrationService } = await import('@/services/migration.service');
      await migrationService.rollback(mockDb, 1);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('returns status for all migrations', async () => {
      mockDb.appliedRows.push({ version: '001', name: 'baseline', appliedAt: new Date() });

      const { migrationService } = await import('@/services/migration.service');
      const status = await migrationService.status(mockDb);

      expect(status).toEqual([
        { version: '001', name: 'baseline', applied: true },
        { version: '002', name: 'unique_station_date', applied: false },
      ]);
    });

    it('marks all as not applied when none are applied', async () => {
      const { migrationService } = await import('@/services/migration.service');
      const status = await migrationService.status(mockDb);

      expect(status).toEqual([
        { version: '001', name: 'baseline', applied: false },
        { version: '002', name: 'unique_station_date', applied: false },
      ]);
    });
  });

  describe('isDbEmpty', () => {
    it('returns true when no tables exist', async () => {
      mockDb.execute = vi.fn(async () => ({ rows: [{ has_tables: false }] }));

      const { migrationService } = await import('@/services/migration.service');
      const result = await migrationService.isDbEmpty(mockDb);

      expect(result).toBe(true);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('returns false when tables exist', async () => {
      mockDb.execute = vi.fn(async () => ({ rows: [{ has_tables: true }] }));

      const { migrationService } = await import('@/services/migration.service');
      const result = await migrationService.isDbEmpty(mockDb);

      expect(result).toBe(false);
    });
  });

  describe('getLastAppliedVersion', () => {
    it('returns the last applied version', async () => {
      mockDb.appliedRows.push(
        { version: '001', name: 'baseline', appliedAt: new Date() },
        { version: '002', name: 'unique_station_date', appliedAt: new Date() },
      );

      const { migrationService } = await import('@/services/migration.service');
      const result = await migrationService.getLastAppliedVersion(mockDb);

      expect(result).toBe('002');
    });

    it('returns null when no migrations are applied', async () => {
      const { migrationService } = await import('@/services/migration.service');
      const result = await migrationService.getLastAppliedVersion(mockDb);

      expect(result).toBeNull();
    });
  });

  describe('getApplied (private, tested through public methods)', () => {
    it('returns empty list when the migrations table does not exist', async () => {
      mockDb.select = vi.fn(() => ({
        from: vi.fn(() => ({
          orderBy: vi.fn().mockRejectedValue(new Error('relation "migrations" does not exist')),
        })),
      }));

      const { migrationService } = await import('@/services/migration.service');
      const status = await migrationService.status(mockDb);

      // All should be unapplied
      expect(status.every((s) => !s.applied)).toBe(true);
    });
  });
});
